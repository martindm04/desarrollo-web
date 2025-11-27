import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
import jwt

from database import products_collection, db
from models import Product, Order, User

# --- CONFIGURACIÓN US-15 (LOGGING CENTRALIZADO) ---
# Configuramos logs en formato JSON para cumplir con la historia "Enabler"
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module
        }
        return json.dumps(log_obj)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger = logging.getLogger("uvicorn")
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# --- CONFIGURACIÓN DE SEGURIDAD (JWT) ---
SECRET_KEY = "tu_secreto_super_seguro_para_el_taller" # En prod usar variable de entorno
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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

# --- UTILIDADES DE SEGURIDAD ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None:
            raise credentials_exception
        return {"email": email, "role": role}
    except jwt.PyJWTError:
        raise credentials_exception

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        logger.warning(f"Acceso denegado a admin para: {current_user['email']}") # Log de seguridad
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    return current_user

# --- SEEDER ---
def seed_products():
    if products_collection.count_documents({}) == 0:
        initial_products = [
            {"id": 1, "name": "Empanada de Pino", "category": "horno", "price": 2500, "stock": 20, "image": "pino.jpg"},
            {"id": 2, "name": "Empanada de Queso", "category": "frita", "price": 2000, "stock": 15, "image": "queso.jpg"},
            {"id": 3, "name": "Camarón Queso", "category": "frita", "price": 2800, "stock": 0, "image": "camaron.jpg"},
            {"id": 4, "name": "Bebida 500ml", "category": "bebida", "price": 1500, "stock": 50, "image": "soda.jpg"},
            {"id": 11, "name": "Pebre Chileno", "category": "acompañamiento", "price": 500, "stock": 50, "image": "https://www.gourmet.cl/wp-content/uploads/2016/09/Pebre-Cuchareado-web.jpg"}
        ]
        products_collection.insert_many(initial_products)
        logger.info("Datos iniciales cargados")

seed_products()

# --- RUTAS PÚBLICAS ---

@app.get("/products")
def get_products():
    return list(products_collection.find({}, {"_id": 0}))

@app.post("/register")
def register_user(user: User):
    if db.users.find_one({"email": user.email}):
        raise HTTPException(400, "Email en uso")
    
    # Hashear contraseña
    user_dict = user.model_dump()
    user_dict["password"] = get_password_hash(user.password)
    
    # Asignar rol admin si el correo es corporativo (lógica simple para el taller)
    if "@admin.com" in user.email:
        user_dict["role"] = "admin"
    else:
        user_dict["role"] = "cliente"

    db.users.insert_one(user_dict)
    logger.info(f"Nuevo usuario registrado: {user.email}")
    return {"message": "Usuario creado exitosamente"}

@app.post("/login")
def login_user(user: User):
    # Buscar usuario
    db_user = db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        logger.warning(f"Intento de login fallido: {user.email}")
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # Generar Token JWT
    access_token = create_access_token(
        data={"sub": db_user["email"], "role": db_user["role"], "name": db_user["name"]}
    )
    
    logger.info(f"Login exitoso: {user.email}")
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "name": db_user["name"],
            "email": db_user["email"],
            "role": db_user["role"]
        }
    }

# --- RUTAS PROTEGIDAS (Requieren Token) ---

# Solo usuarios logueados pueden ver sus pedidos
@app.get("/orders/user/{email}")
def get_orders_by_user(email: str, current_user: dict = Depends(get_current_user)):
    # Validar que el usuario pida SUS propias órdenes (Seguridad Horizontal)
    if current_user["email"] != email and current_user["role"] != "admin":
        raise HTTPException(403, "No puedes ver órdenes de otro usuario")
        
    cursor = db.orders.find({"customer_email": email})
    orders = []
    for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        orders.append(doc)
    return orders

# Solo usuarios logueados pueden comprar
@app.post("/orders")
def create_order(order: Order, current_user: dict = Depends(get_current_user)):
    # 1. Verificar Stock
    for item in order.items:
        prod = db.products.find_one({"id": item.product_id})
        if not prod:
            raise HTTPException(404, f"Producto {item.name} no existe")
        if prod["stock"] < item.quantity:
            raise HTTPException(400, f"Stock insuficiente para {item.name}")

    # 2. Descontar Stock
    for item in order.items:
        db.products.update_one(
            {"id": item.product_id},
            {"$inc": {"stock": -item.quantity}}
        )

    # 3. Guardar Orden con el usuario del token (más seguro)
    order_dict = order.model_dump()
    order_dict["customer_email"] = current_user["email"] # Forzamos el email del token
    
    result = db.orders.insert_one(order_dict)
    logger.info(f"Orden creada {result.inserted_id} por {current_user['email']}")
    return {"id": str(result.inserted_id), "status": "recibido"}

# --- RUTAS DE ADMIN (Protegidas con rol='admin') ---
# Cumple US-13 y US-14

@app.get("/orders", dependencies=[Depends(get_current_admin)])
def get_all_orders():
    cursor = db.orders.find().sort("_id", -1).limit(50)
    orders = []
    for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        orders.append(doc)
    return orders

@app.post("/products", dependencies=[Depends(get_current_admin)])
def create_product(product: Product):
    if db.products.find_one({"id": product.id}):
        raise HTTPException(400, "ID ya existe")
    db.products.insert_one(product.model_dump())
    logger.info(f"Producto creado: {product.name}")
    return {"message": "Producto creado"}

@app.put("/products/{product_id}", dependencies=[Depends(get_current_admin)])
def update_product(product_id: int, product: Product):
    result = db.products.update_one({"id": product_id}, {"$set": product.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(404, "Producto no encontrado")
    logger.info(f"Producto actualizado: {product_id}")
    return {"message": "Actualizado"}

@app.delete("/products/{product_id}", dependencies=[Depends(get_current_admin)])
def delete_product(product_id: int):
    result = db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Producto no encontrado")
    logger.info(f"Producto eliminado: {product_id}")
    return {"message": "Eliminado"}