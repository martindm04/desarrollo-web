import logging
import json
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Depends, status, Body
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
import jwt

from database import products_collection, db
from models import Product, Order, User, LoginRequest

import os
from dotenv import load_dotenv

from fastapi.staticfiles import StaticFiles

# Cargar variables al inicio
load_dotenv()

# --- LOGGING ESTRUCTURADO (Seguridad) ---
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "msg": record.getMessage()
        }
        return json.dumps(log_obj)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger = logging.getLogger("api")
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# --- SEGURIDAD ---
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

if not SECRET_KEY:
    raise ValueError("❌ ERROR CRÍTICO: No se encontró SECRET_KEY en el archivo .env")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Utilidades
def get_password_hash(password): return pwd_context.hash(password)
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)

def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise Exception()
        return {"email": email, "role": payload.get("role"), "name": payload.get("name")}
    except:
        raise HTTPException(status_code=401, detail="Sesión inválida")

async def get_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        logger.warning(f"Acceso admin denegado: {user['email']}")
        raise HTTPException(status_code=403, detail="Requiere privilegios de administrador")
    return user

# --- SEEDER (Datos Iniciales) ---
def seed_db():
    if products_collection.count_documents({}) == 0:
        # Base URL para imágenes locales
        base_img = "http://127.0.0.1:8000/static/images"
        
        initials = [
            # NOTA: Debes descargar imágenes reales y guardarlas con estos nombres en backend/static/images/
            # Si no tienes la imagen, usa un placeholder por mientras.
            {
                "id": 1, "name": "Empanada de Pino", "category": "horno", "price": 2500, "stock": 50, 
                "image": f"{base_img}/pino.jpg" 
            },
            {
                "id": 2, "name": "Empanada de Queso", "category": "frita", "price": 2000, "stock": 40, 
                "image": f"{base_img}/queso.jpg"
            },
            {
                "id": 3, "name": "Sopaipillas (3 un)", "category": "acompañamiento", "price": 1000, "stock": 80, 
                "image": f"{base_img}/sopaipillas.jpg"
            },
            {
                "id": 4, "name": "Bebida Lata", "category": "bebida", "price": 1500, "stock": 100, 
                "image": f"{base_img}/bebida.jpg"
            },
            {
                "id": 5, "name": "Pebre Chileno", "category": "acompañamiento", "price": 500, "stock": 200, 
                "image": f"{base_img}/pebre.jpg"
            }
        ]
        products_collection.insert_many(initials)
        logger.info("Base de datos poblada con imágenes locales")

seed_db()

# --- RUTAS PÚBLICAS ---

@app.get("/products")
def list_products():
    return list(products_collection.find({}, {"_id": 0}))

@app.post("/register")
def register(user: User):
    # Seguridad: Validar complejidad contraseña (Req 3)
    if len(user.password) < 8:
        raise HTTPException(400, "La contraseña debe tener al menos 8 caracteres")
    
    if db.users.find_one({"email": user.email}):
        # Mensaje genérico anti-enumeración (Req 8)
        raise HTTPException(400, "Error en el registro") 
    
    user_dict = user.model_dump()
    user_dict["password"] = get_password_hash(user.password)
    user_dict["role"] = "admin" if "@admin.com" in user.email else "cliente"
    
    db.users.insert_one(user_dict)
    return {"message": "Cuenta creada"}

@app.post("/login")
def login(creds: LoginRequest):
    # Login Híbrido: Email o Nombre (Req 2)
    user = db.users.find_one({
        "$or": [{"email": creds.identifier}, {"name": creds.identifier}]
    })

    if not user or not verify_password(creds.password, user["password"]):
        logger.warning("Login fallido")
        # Seguridad: No decir qué falló (Req 8)
        raise HTTPException(401, "Credenciales inválidas")
    
    token = create_token({"sub": user["email"], "role": user["role"], "name": user["name"]})
    return {
        "access_token": token, 
        "token_type": "bearer",
        "user": {"name": user["name"], "email": user["email"], "role": user["role"]}
    }

# --- RUTAS PROTEGIDAS ---

@app.post("/orders")
def create_order(order: Order, current_user: dict = Depends(get_current_user)):
    # Validación de Stock Atómica
    for item in order.items:
        p = db.products.find_one({"id": item.product_id})
        if not p or p["stock"] < item.quantity:
            raise HTTPException(400, f"Stock insuficiente para {item.name}")
            
    # Descontar Stock
    for item in order.items:
        db.products.update_one({"id": item.product_id}, {"$inc": {"stock": -item.quantity}})
        
    order_data = order.model_dump()
    order_data["customer_email"] = current_user["email"]
    res = db.orders.insert_one(order_data)
    return {"id": str(res.inserted_id), "status": "confirmado"}

@app.get("/orders/user/{email}")
def my_orders(email: str, current_user: dict = Depends(get_current_user)):
    if current_user["email"] != email and current_user["role"] != "admin":
        raise HTTPException(403, "No autorizado")
    cursor = db.orders.find({"customer_email": email})
    return [{"id": str(d.pop("_id")), **d} for d in cursor]

# --- ADMIN ---

@app.get("/orders", dependencies=[Depends(get_admin)])
def all_orders():
    cursor = db.orders.find().sort("_id", -1).limit(100)
    return [{"id": str(d.pop("_id")), **d} for d in cursor]

# Gestión Rápida de Stock (Req 6a)
@app.post("/admin/stock/{pid}", dependencies=[Depends(get_admin)])
def add_stock(pid: int, quantity: int = Body(..., embed=True)):
    res = db.products.update_one({"id": pid}, {"$inc": {"stock": quantity}})
    if res.matched_count == 0: raise HTTPException(404, "Producto no encontrado")
    return {"message": "Stock actualizado"}

@app.post("/products", dependencies=[Depends(get_admin)])
def add_prod(p: Product):
    if db.products.find_one({"id": p.id}): raise HTTPException(400, "ID existe")
    db.products.insert_one(p.model_dump())
    return {"message": "Creado"}

@app.put("/products/{pid}", dependencies=[Depends(get_admin)])
def edit_prod(pid: int, p: Product):
    res = db.products.update_one({"id": pid}, {"$set": p.model_dump()})
    if res.matched_count == 0: raise HTTPException(404, "No encontrado")
    return {"message": "Actualizado"}

@app.delete("/products/{pid}", dependencies=[Depends(get_admin)])
def del_prod(pid: int):
    db.products.delete_one({"id": pid})
    return {"message": "Eliminado"}