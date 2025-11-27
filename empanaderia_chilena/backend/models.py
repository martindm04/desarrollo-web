from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional

class LoginRequest(BaseModel):
    identifier: str
    password: str

class Product(BaseModel):
    id: int
    name: str
    category: str
    price: int = Field(..., gt=0)  # Precio debe ser mayor a 0
    stock: int = Field(..., ge=0)  # Stock no puede ser negativo
    image: str

class OrderItem(BaseModel):
    product_id: int
    name: str
    price: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)

class Order(BaseModel):
    customer_email: EmailStr # Valida que sea un email real
    items: List[OrderItem]
    total: int
    status: str = "recibido"

class User(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "cliente"