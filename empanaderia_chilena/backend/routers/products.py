from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List
from database import products_collection
from models import Product
from auth import get_admin # Solo importamos lo necesario

router = APIRouter(tags=["Productos"])

# --- RUTAS PÚBLICAS ---
@router.get("/products")
def list_products():
    return list(products_collection.find({}, {"_id": 0}))

@router.get("/products/{pid}")
def get_product(pid: int):
    p = products_collection.find_one({"id": pid}, {"_id": 0})
    if not p: raise HTTPException(404, "Producto no encontrado")
    return p

# --- RUTAS DE ADMIN ---
@router.post("/products", dependencies=[Depends(get_admin)])
def add_prod(p: Product):
    if products_collection.find_one({"id": p.id}): 
        raise HTTPException(400, "ID ya existe")
    products_collection.insert_one(p.model_dump())
    return {"message": "Producto creado"}

@router.delete("/products/{pid}", dependencies=[Depends(get_admin)])
def del_prod(pid: int):
    res = products_collection.delete_one({"id": pid})
    if res.deleted_count == 0: raise HTTPException(404, "No encontrado")
    return {"message": "Eliminado"}

@router.post("/admin/stock/{pid}", dependencies=[Depends(get_admin)])
def add_stock(pid: int, quantity: int = Body(..., embed=True)):
    res = products_collection.update_one({"id": pid}, {"$inc": {"stock": quantity}})
    if res.matched_count == 0: raise HTTPException(404, "Producto no encontrado")
    return {"message": "Stock actualizado"}
  