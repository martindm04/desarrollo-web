from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import products_collection, db 
# Importamos User también
from models import Product, Order, User 

app = FastAPI()

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SEEDER (Productos iniciales) ---
def seed_products():
    if products_collection.count_documents({}) == 0:
        initial_products = [
            {"id": 1, "name": "Empanada de Pino", "category": "horno", "price": 2500, "stock": 20, "image": "pino.jpg"},
            {"id": 2, "name": "Empanada de Queso", "category": "frita", "price": 2000, "stock": 15, "image": "queso.jpg"},
            {"id": 3, "name": "Camarón Queso", "category": "frita", "price": 2800, "stock": 0, "image": "camaron.jpg"},
            {"id": 4, "name": "Napolitana", "category": "horno", "price": 2200, "stock": 10, "image": "napo.jpg"},
            {"id": 5, "name": "Bebida 500ml", "category": "bebida", "price": 1500, "stock": 50, "image": "soda.jpg"}
        ]
        products_collection.insert_many(initial_products)
        print("--- Datos iniciales cargados ---")

seed_products()

# --- RUTAS ---

@app.get("/")
def read_root():
    return {"mensaje": "API La Chilena Activa"}

@app.get("/products")
def get_products():
    return list(products_collection.find({}, {"_id": 0}))

@app.post("/orders")
def create_order(order: Order):
    result = db.orders.insert_one(order.model_dump())
    return {"id": str(result.inserted_id), "status": "recibido"}

# --- NUEVAS RUTAS DE AUTENTICACIÓN (ÉPICA 1) ---

# 1. Registro de Usuario (US-01)
@app.post("/register")
def register_user(user: User):
    # Verificar si el email ya existe
    if db.users.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    # Guardar usuario
    db.users.insert_one(user.model_dump())
    return {"message": "Usuario creado exitosamente"}

# 2. Login de Usuario (US-02)
@app.post("/login")
def login_user(user: User):
    # Buscar usuario por email y password
    # NOTA: Usamos la misma clase User, pero solo nos importan email y pass
    found_user = db.users.find_one({"email": user.email, "password": user.password})
    
    if not found_user:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # Si lo encuentra, devolvemos sus datos (sin el password por seguridad)
    return {
        "message": "Login exitoso",
        "email": found_user["email"],
        "name": found_user["name"],
        "role": found_user["role"]
    }
    
# --- RUTAS DE ADMINISTRACIÓN (ÉPICA 6) ---

# 3. Crear nuevo producto
@app.post("/products")
def create_product(product: Product):
    # Insertar en MongoDB
    db.products.insert_one(product.model_dump())
    return {"message": "Producto creado exitosamente"}

# 4. Actualizar producto (Precio o Stock)
@app.put("/products/{product_id}")
def update_product(product_id: int, product: Product):
    # Actualizamos buscando por el ID numérico (no el _id de mongo)
    result = db.products.update_one(
        {"id": product_id}, 
        {"$set": product.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto actualizado"}

# 5. Eliminar producto
@app.delete("/products/{product_id}")
def delete_product(product_id: int):
    result = db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto eliminado"}