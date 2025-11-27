import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, status, Body
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel
import jwt

from database import products_collection, db
from models import Product, Order, User

# --- MODELO LOGIN FLEXIBLE ---
class LoginRequest(BaseModel):
    identifier: str  # Puede ser email o nombre
    password: str

# --- LOGGING ---
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {"timestamp": datetime.now(timezone.utc).isoformat(), "level": record.levelname, "message": record.getMessage()}
        return json.dumps(log_obj)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger = logging.getLogger("uvicorn")
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# --- CONFIGURACIÓN SEGURIDAD ---
SECRET_KEY = "secreto_super_seguro_taller_dwm" # Cambiar en producción
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- UTILIDADES ---
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
def get_password_hash(password): return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesión inválida o expirada",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None: raise credentials_exception
        return {"email": email, "role": role}
    except jwt.PyJWTError:
        raise credentials_exception

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        logger.warning(f"Acceso admin denegado: {current_user['email']}")
        raise HTTPException(status_code=403, detail="Acceso restringido")
    return current_user

# --- ENDPOINTS PÚBLICOS ---

@app.get("/products")
def get_products():
    return list(products_collection.find({}, {"_id": 0}))

@app.post("/register")
def register_user(user: User):
    # Validación de seguridad (Punto 3 y 8)
    if len(user.password) < 8:
        raise HTTPException(400, "La contraseña debe tener al menos 8 caracteres")
    
    if db.users.find_one({"email": user.email}):
        # Mensaje genérico por seguridad o específico según política UX
        raise HTTPException(400, "Error en el registro: verifica tus datos") 
    
    user_dict = user.model_dump()
    user_dict["password"] = get_password_hash(user.password)
    user_dict["role"] = "admin" if "@admin.com" in user.email else "cliente"

    db.users.insert_one(user_dict)
    return {"message": "Cuenta creada exitosamente"}

@app.post("/login")
def login_user(login_data: LoginRequest):
    # Login con Email o Nombre de Usuario (Punto 2)
    user = db.users.find_one({
        "$or": [{"email": login_data.identifier}, {"name": login_data.identifier}]
    })

    if not user or not verify_password(login_data.password, user["password"]):
        # Mensaje genérico para evitar enumeración (Punto 8)
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    token = create_access_token({"sub": user["email"], "role": user["role"], "name": user["name"]})
    return {"access_token": token, "token_type": "bearer", "user": {"name": user["name"], "email": user["email"], "role": user["role"]}}

# --- ENDPOINTS PROTEGIDOS ---

@app.post("/orders")
def create_order(order: Order, current_user: dict = Depends(get_current_user)):
    # Verificación de Stock Atómica (Punto 6a)
    for item in order.items:
        prod = db.products.find_one({"id": item.product_id})
        if not prod: raise HTTPException(404, f"Producto {item.name} no disponible")
        if prod["stock"] < item.quantity:
            raise HTTPException(400, f"Stock insuficiente para {item.name}. Disponibles: {prod['stock']}")

    # Descontar Stock
    for item in order.items:
        db.products.update_one({"id": item.product_id}, {"$inc": {"stock": -item.quantity}})

    order_dict = order.model_dump()
    order_dict["customer_email"] = current_user["email"]
    result = db.orders.insert_one(order_dict)
    return {"id": str(result.inserted_id), "status": "recibido"}

@app.get("/orders/user/{email}")
def get_orders(email: str, current_user: dict = Depends(get_current_user)):
    if current_user["email"] != email and current_user["role"] != "admin":
        raise HTTPException(403, "Acceso denegado")
    cursor = db.orders.find({"customer_email": email})
    return [{"id": str(d.pop("_id")), **d} for d in cursor]

# --- ADMIN (Punto 4 y 6) ---

@app.get("/orders", dependencies=[Depends(get_current_admin)])
def get_all_orders():
    cursor = db.orders.find().sort("_id", -1).limit(100)
    return [{"id": str(d.pop("_id")), **d} for d in cursor]

# Endpoint para carga rápida de stock (Punto 6a)
@app.post("/admin/stock/{product_id}", dependencies=[Depends(get_current_admin)])
def add_stock(product_id: int, quantity: int = Body(..., embed=True)):
    result = db.products.update_one({"id": product_id}, {"$inc": {"stock": quantity}})
    if result.matched_count == 0: raise HTTPException(404, "Producto no encontrado")
    return {"message": "Stock actualizado"}

@app.post("/products", dependencies=[Depends(get_current_admin)])
def create_prod(product: Product):
    if db.products.find_one({"id": product.id}): raise HTTPException(400, "ID existe")
    db.products.insert_one(product.model_dump())
    return {"message": "Creado"}

@app.put("/products/{pid}", dependencies=[Depends(get_current_admin)])
def update_prod(pid: int, p: Product):
    res = db.products.update_one({"id": pid}, {"$set": p.model_dump()})
    if res.matched_count == 0: raise HTTPException(404, "No encontrado")
    return {"message": "Actualizado"}

@app.delete("/products/{pid}", dependencies=[Depends(get_current_admin)])
def delete_prod(pid: int):
    res = db.products.delete_one({"id": pid})
    if res.deleted_count == 0: raise HTTPException(404, "No encontrado")
    return {"message": "Eliminado"}