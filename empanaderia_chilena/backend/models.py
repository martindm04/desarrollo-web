from pydantic import BaseModel
from typing import Optional, List

# --- PRODUCTOS ---
class Product(BaseModel):
    id: int
    name: str
    category: str
    price: int
    stock: int
    image: str

# --- ORDENES ---
class OrderItem(BaseModel):
    product_id: int
    name: str
    price: int
    quantity: int

class Order(BaseModel):
    customer_email: str
    items: List[OrderItem]
    total: int
    status: str = "recibido"

# --- NUEVO: USUARIOS (ÉPICA 1) ---
class User(BaseModel):
    email: str
    password: str  # En un caso real, esto se encripta. Para el taller, texto plano.
    name: str
    role: str = "cliente" # cliente o admin