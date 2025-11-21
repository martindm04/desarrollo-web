from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import products_collection, db 
from models import Product, Order, User 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SEEDER (Solo corre si la base está vacía) ---
def seed_products():
    if products_collection.count_documents({}) == 0:
        # Nota: IDs iniciales
        initial_products = [
            {"id": 1, "name": "Empanada de Pino", "category": "horno", "price": 2500, "stock": 20, "image": "pino.jpg"},
            {"id": 2, "name": "Empanada de Queso", "category": "frita", "price": 2000, "stock": 15, "image": "queso.jpg"},
            {"id": 3, "name": "Camarón Queso", "category": "frita", "price": 2800, "stock": 0, "image": "camaron.jpg"}, # Agotado prueba
            {"id": 4, "name": "Bebida 500ml", "category": "bebida", "price": 1500, "stock": 50, "image": "soda.jpg"}
        ]
        products_collection.insert_many(initial_products)
        print("--- Datos iniciales cargados ---")

seed_products()

# --- RUTAS ---

@app.get("/products")
def get_products():
    return list(products_collection.find({}, {"_id": 0}))

@app.post("/products")
def create_product(product: Product):
    if db.products.find_one({"id": product.id}):
        raise HTTPException(400, "ID ya existe")
    db.products.insert_one(product.model_dump())
    return {"message": "Producto creado"}

@app.put("/products/{product_id}")
def update_product(product_id: int, product: Product):
    result = db.products.update_one({"id": product_id}, {"$set": product.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(404, "Producto no encontrado")
    return {"message": "Actualizado"}

@app.delete("/products/{product_id}")
def delete_product(product_id: int):
    result = db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Producto no encontrado")
    return {"message": "Eliminado"}

# --- RUTAS DE ORDENES (MEJORADAS PARA STOCK Y ADMIN) ---

@app.post("/orders")
def create_order(order: Order):
    # 1. Verificar Stock antes de vender
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

    # 3. Guardar Orden
    result = db.orders.insert_one(order.model_dump())
    return {"id": str(result.inserted_id), "status": "recibido"}

# Ruta Usuario: Mis Pedidos
@app.get("/orders/user/{email}")
def get_orders_by_user(email: str):
    cursor = db.orders.find({"customer_email": email})
    orders = []
    for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        orders.append(doc)
    return orders

# Ruta Admin: Todas las Ventas (Punto 3)
@app.get("/orders")
def get_all_orders():
    cursor = db.orders.find().sort("_id", -1).limit(50) # Últimas 50
    orders = []
    for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        orders.append(doc)
    return orders

# --- RUTAS AUTH ---
@app.post("/register")
def register_user(user: User):
    if db.users.find_one({"email": user.email}):
        raise HTTPException(400, "Email en uso")
    db.users.insert_one(user.model_dump())
    return {"message": "Creado"}

@app.post("/login")
def login_user(user: User):
    found = db.users.find_one({"email": user.email, "password": user.password})
    if not found:
        raise HTTPException(401, "Credenciales invalidas")
    return {"email": found["email"], "name": found["name"], "role": found["role"]}