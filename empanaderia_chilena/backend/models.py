from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional

class LoginRequest(BaseModel):
    identifier: str
    password: str

class Product(BaseModel):
    id: int
    name: str
    category: str
    price: int = Field(..., gt=0)
    stock: int = Field(..., ge=0)
    image: str

class OrderItem(BaseModel):
    product_id: int
    name: str
    price: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)

class Order(BaseModel):
    customer_email: EmailStr
    items: List[OrderItem]
    total: int
    status: str = "recibido"

class User(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "cliente"