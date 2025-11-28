from fastapi import APIRouter, HTTPException, Depends, Body
from database import products_collection, orders_collection
from models import Order
from auth import get_current_user, get_admin
from bson import ObjectId

router = APIRouter(tags=["Ordenes"])

@router.post("/orders")
def create_order(order: Order, current_user: dict = Depends(get_current_user)):
    for item in order.items:
        if not products_collection.find_one({"id": item.product_id}):
            raise HTTPException(404, f"Producto {item.name} no existe")

    for item in order.items:
        result = products_collection.update_one(
            {
                "id": item.product_id, 
                "stock": {"$gte": item.quantity}
            },
            {"$inc": {"stock": -item.quantity}}
        )

        if result.matched_count == 0:
            raise HTTPException(409, f"Stock insuficiente para {item.name}. Alguien compró el último justo ahora.")

    order_data = order.model_dump()
    order_data["customer_email"] = current_user["email"]

    res = orders_collection.insert_one(order_data)
    
    return {"id": str(res.inserted_id), "status": "confirmado"}

@router.get("/orders/user/{email}")
def my_orders(email: str, current_user: dict = Depends(get_current_user)):
    if current_user["email"] != email and current_user["role"] != "admin":
        raise HTTPException(403, "No puedes ver órdenes de otros usuarios")
        
    cursor = orders_collection.find({"customer_email": email})
    return [{"id": str(d.pop("_id")), **d} for d in cursor]

@router.get("/orders", dependencies=[Depends(get_admin)])
def all_orders():
    cursor = orders_collection.find().sort("_id", -1).limit(100)
    return [{"id": str(d.pop("_id")), **d} for d in cursor]

@router.patch("/orders/{order_id}/status", dependencies=[Depends(get_admin)])
def update_order_status(order_id: str, status: str = Body(..., embed=True)):
    valid_statuses = ["recibido", "preparando", "listo", "entregado"]
    if status not in valid_statuses:
        raise HTTPException(400, f"Estado inválido. Use: {valid_statuses}")

    try:
        oid = ObjectId(order_id)
        res = orders_collection.update_one({"_id": oid}, {"$set": {"status": status}})
    except:
        raise HTTPException(400, "ID de orden inválido")

    if res.matched_count == 0:
        raise HTTPException(404, "Orden no encontrada")

    return {"message": f"Orden actualizada a {status}"}