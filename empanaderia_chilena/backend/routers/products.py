from fastapi import APIRouter, HTTPException, Depends, Body, File, UploadFile
from typing import List
from database import db, products_collection
from models import Product
from auth import get_admin
import shutil
import os
import uuid

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

@router.post("/upload")
def upload_image(file: UploadFile = File(...)):
    try:
        # 1. Validar que sea imagen
        if not file.content_type.startswith("image/"):
            raise HTTPException(400, "El archivo debe ser una imagen")
            
        # 2. Generar nombre único (para evitar sobreescribir pino.jpg si suben otro pino.jpg)
        file_ext = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        
        # 3. Ruta de guardado (backend/static/images)
        # Nota: Asumimos que la carpeta static/images ya existe por el paso anterior
        save_path = f"static/images/{unique_filename}"
        
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 4. Devolver la URL pública
        # Nota: Hardcodeamos localhost para dev, en prod usarías una variable de entorno DOMAIN
        file_url = f"http://127.0.0.1:8000/{save_path}"
        
        return {"url": file_url}
        
    except Exception as e:
        print(e)
        raise HTTPException(500, "Error al subir la imagen")

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
  