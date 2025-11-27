from fastapi import APIRouter, HTTPException, Depends, Body
from database import db
from models import Order
from auth import get_current_user, get_admin
from bson import ObjectId

router = APIRouter(tags=["Ordenes"])

@router.post("/orders")
def create_order(order: Order, current_user: dict = Depends(get_current_user)):
    # 1. Validar Stock
    for item in order.items:
        p = db.products.find_one({"id": item.product_id})
        if not p: raise HTTPException(404, f"Producto {item.name} no existe")
        if p["stock"] < item.quantity:
            raise HTTPException(400, f"Sin stock suficiente para {item.name}")

    # 2. Descontar Stock
    for item in order.items:
        db.products.update_one({"id": item.product_id}, {"$inc": {"stock": -item.quantity}})
        
    # 3. Guardar Orden
    order_data = order.model_dump()
    order_data["customer_email"] = current_user["email"]
    res = db.orders.insert_one(order_data)
    
    return {"id": str(res.inserted_id), "status": "confirmado"}

@router.get("/orders/user/{email}")
def my_orders(email: str, current_user: dict = Depends(get_current_user)):
    # Validar que el usuario solo vea sus propias órdenes (o sea admin)
    if current_user["email"] != email and current_user["role"] != "admin":
        raise HTTPException(403, "No puedes ver órdenes de otros usuarios")
        
    cursor = db.orders.find({"customer_email": email})
    return [{"id": str(d.pop("_id")), **d} for d in cursor]

@router.get("/orders", dependencies=[Depends(get_admin)])
def all_orders():
    cursor = db.orders.find().sort("_id", -1).limit(100)
    return [{"id": str(d.pop("_id")), **d} for d in cursor]
  
@router.patch("/orders/{order_id}/status", dependencies=[Depends(get_admin)])
def update_order_status(order_id: str, status: str = Body(..., embed=True)):
    # Validamos que el estado sea uno permitido
    valid_statuses = ["recibido", "preparando", "listo", "entregado"]
    if status not in valid_statuses:
        raise HTTPException(400, f"Estado inválido. Use: {valid_statuses}")

    try:
        # Intentamos convertir a ObjectId si es necesario, o buscamos por string
        oid = ObjectId(order_id)
        res = db.orders.update_one({"_id": oid}, {"$set": {"status": status}})
    except:
        # Si falla la conversión a ObjectId (por si acaso), intentamos buscar por id string si lo tuvieras
        raise HTTPException(400, "ID de orden inválido")
    
    if res.matched_count == 0:
        raise HTTPException(404, "Orden no encontrada")
        
    return {"message": f"Orden actualizada a {status}"}
  
  