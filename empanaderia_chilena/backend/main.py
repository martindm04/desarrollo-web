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

# --- 1. CONFIGURACIÓN DE LOGGING (US-15) ---
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_content = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module
        }
        return json.dumps(log_content)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger = logging.getLogger("la_chilena_api")
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# --- 2. SEGURIDAD Y JWT ---
SECRET_KEY = "clave_maestra_segura_prod_2025" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app = FastAPI(title="API Empanadería La Chilena")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Utilidades Auth
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
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None: raise credentials_exception
        return {"email": email, "role": role, "name": payload.get("name")}
    except jwt.PyJWTError:
        raise credentials_exception

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        logger.warning(f"Acceso no autorizado a Admin: {current_user['email']}")
        raise HTTPException(403, "Se requieren privilegios de administrador")
    return current_user

# --- 3. SEEDER (Datos Iniciales Correctos) ---
def seed_products():
    if products_collection.count_documents({}) == 0:
        initial_products = [
            {"id": 1, "name": "Empanada de Pino", "category": "horno", "price": 2500, "stock": 50, "image": "https://comidaschilenas.com/wp-content/uploads/2019/02/Receta-de-empanadas-de-pino-al-horno-chilenas.jpg"},
            {"id": 2, "name": "Empanada de Queso", "category": "frita", "price": 2000, "stock": 40, "image": "https://comidaschilenas.com/wp-content/uploads/2019/02/Receta-de-empanadas-de-queso-fritas-chilenas.jpg"},
            {"id": 3, "name": "Camarón Queso", "category": "frita", "price": 2800, "stock": 0, "image": "https://unareceta.com/wp-content/uploads/2016/08/receta-empanadas-de-camaron-queso.jpg"},
            {"id": 4, "name": "Bebida 500ml", "category": "bebida", "price": 1500, "stock": 100, "image": "https://dojiw2m9tvv09.cloudfront.net/11132/product/cocacola500cc8224.jpg"},
            {"id": 11, "name": "Pebre Chileno", "category": "acompañamiento", "price": 500, "stock": 200, "image": "https://www.gourmet.cl/wp-content/uploads/2016/09/Pebre-Cuchareado-web.jpg"}
        ]
        products_collection.insert_many(initial_products)
        logger.info("Base de datos poblada correctamente")

seed_products()

# --- 4. ENDPOINTS ---

@app.get("/products")
def get_products():
    return list(products_collection.find({}, {"_id": 0}))

@app.post("/register")
def register(user: User):
    if len(user.password) < 4: # Validación básica (en prod usar 8+)
        raise HTTPException(400, "La contraseña es muy corta")
    
    if db.users.find_one({"email": user.email}):
        raise HTTPException(400, "Este correo ya está registrado")

    user_dict = user.model_dump()
    user_dict["password"] = get_password_hash(user.password)
    user_dict["role"] = "admin" if "@admin.com" in user.email else "cliente"
    
    db.users.insert_one(user_dict)
    logger.info(f"Nuevo usuario: {user.email}")
    return {"message": "Registro exitoso"}

@app.post("/login")
def login(creds: LoginRequest):
    # Login Híbrido: Busca por email O por nombre
    user = db.users.find_one({
        "$or": [{"email": creds.identifier}, {"name": creds.identifier}]
    })

    if not user or not verify_password(creds.password, user["password"]):
        logger.warning("Fallo de autenticación")
        raise HTTPException(401, "Credenciales inválidas")
    
    token = create_access_token({"sub": user["email"], "role": user["role"], "name": user["name"]})
    return {
        "access_token": token, 
        "token_type": "bearer",
        "user": {"name": user["name"], "email": user["email"], "role": user["role"]}
    }

@app.post("/orders")
def place_order(order: Order, current_user: dict = Depends(get_current_user)):
    # Validación de Stock
    for item in order.items:
        p = db.products.find_one({"id": item.product_id})
        if not p or p["stock"] < item.quantity:
            raise HTTPException(400, f"Stock insuficiente para {item.name}")
            
    # Descuento de Stock
    for item in order.items:
        db.products.update_one({"id": item.product_id}, {"$inc": {"stock": -item.quantity}})
        
    order_data = order.model_dump()
    order_data["customer_email"] = current_user["email"] # Forzar identidad
    res = db.orders.insert_one(order_data)
    
    logger.info(f"Venta realizada ID: {res.inserted_id}")
    return {"id": str(res.inserted_id), "status": "confirmado"}

@app.get("/orders/user/{email}")
def user_orders(email: str, current_user: dict = Depends(get_current_user)):
    if current_user["email"] != email and current_user["role"] != "admin":
        raise HTTPException(403, "No autorizado")
    cursor = db.orders.find({"customer_email": email})
    return [{"id": str(d.pop("_id")), **d} for d in cursor]

# --- ADMIN ROUTES ---
@app.get("/orders", dependencies=[Depends(get_current_admin)])
def admin_orders():
    cursor = db.orders.find().sort("_id", -1).limit(100)
    return [{"id": str(d.pop("_id")), **d} for d in cursor]

@app.post("/products", dependencies=[Depends(get_current_admin)])
def add_product(p: Product):
    if db.products.find_one({"id": p.id}): raise HTTPException(400, "ID Duplicado")
    db.products.insert_one(p.model_dump())
    return {"msg": "Producto creado"}

@app.put("/products/{pid}", dependencies=[Depends(get_current_admin)])
def edit_product(pid: int, p: Product):
    res = db.products.update_one({"id": pid}, {"$set": p.model_dump()})
    if res.matched_count == 0: raise HTTPException(404, "No encontrado")
    return {"msg": "Actualizado"}

@app.delete("/products/{pid}", dependencies=[Depends(get_current_admin)])
def delete_product(pid: int):
    db.products.delete_one({"id": pid})
    return {"msg": "Eliminado"}