from pydantic import BaseModel
from typing import List, Optional

# Modelo para Login Híbrido (Req 2)
class LoginRequest(BaseModel):
    identifier: str # Puede ser email o nombre de usuario
    password: str

class Product(BaseModel):
    id: int
    name: str
    category: str
    price: int
    stock: int
    image: str

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

class User(BaseModel):
    email: str
    password: str
    name: str
    role: str = "cliente"