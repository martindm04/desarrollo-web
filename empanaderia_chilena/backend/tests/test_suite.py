import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
from main import app
from database import products_collection, users_collection, orders_collection
import uuid

client = TestClient(app)

def generate_user(role="cliente"):
    """Genera credenciales únicas para no chocar con la BD real"""
    uid = str(uuid.uuid4())[:8]
    email = f"admin_{uid}@test.cl" if role == "admin" else f"user_{uid}@test.cl"
    return {
        "name": f"Test {role.capitalize()} {uid}",
        "email": email,
        "password": "password123"
    }

@pytest.fixture
def admin_auth():
    """Crea un admin y devuelve sus headers de autenticación"""
    user_data = generate_user("admin")
    client.post("/register", json=user_data)
    res = client.post("/login", json={"identifier": user_data["email"], "password": user_data["password"]})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

@pytest.fixture
def client_auth():
    """Crea un cliente y devuelve sus headers + email"""
    user_data = generate_user("cliente")
    client.post("/register", json=user_data)
    res = client.post("/login", json={"identifier": user_data["email"], "password": user_data["password"]})
    return {"Authorization": f"Bearer {res.json()['access_token']}", "email": user_data["email"]}

def test_api_health():
    """Verifica que la API responda"""
    res = client.get("/")
    assert res.status_code == 200
    assert "funcionando" in res.json()["message"]

def test_product_lifecycle_admin(admin_auth):
    """
    Prueba que un ADMIN puede: Crear -> Leer -> Actualizar -> Borrar un producto.
    Y verifica que los cambios impacten la BD.
    """
    prod_id = 88888
    new_product = {
        "id": prod_id,
        "name": "Empanada Test Integration",
        "category": "horno",
        "price": 1500,
        "stock": 100,
        "image": "/static/test.jpg"
    }
    
    res_create = client.post("/products", json=new_product, headers=admin_auth)
    assert res_create.status_code == 200

    res_list = client.get("/products")
    assert res_list.status_code == 200
    products = res_list.json()
    assert any(p["id"] == prod_id for p in products)

    update_data = new_product.copy()
    update_data["price"] = 2000
    res_update = client.put(f"/products/{prod_id}", json=update_data, headers=admin_auth)
    assert res_update.status_code == 200

    res_get = client.get(f"/products/{prod_id}")
    assert res_get.json()["price"] == 2000

    res_del = client.delete(f"/products/{prod_id}", headers=admin_auth)
    assert res_del.status_code == 200
    
    assert client.get(f"/products/{prod_id}").status_code == 404

def test_full_purchase_flow(client_auth):
    """
    Prueba el flujo crítico de negocio:
    1. Existencia de producto
    2. Cliente crea orden
    3. Stock se descuenta
    4. Orden aparece en historial
    """
    prod_id = 77777
    initial_stock = 50
    buy_qty = 5
    
    products_collection.update_one(
        {"id": prod_id}, 
        {"$set": {"name": "Stock Test", "price": 1000, "stock": initial_stock, "category": "pruebas", "image": "img"}}, 
        upsert=True
    )

    order_payload = {
        "customer_email": client_auth["email"],
        "items": [
            {"product_id": prod_id, "name": "Stock Test", "price": 1000, "quantity": buy_qty}
        ],
        "total": 5000
    }

    res_order = client.post("/orders", json=order_payload, headers=client_auth)
    assert res_order.status_code == 200
    assert res_order.json()["status"] == "confirmado"

    updated_prod = products_collection.find_one({"id": prod_id})
    assert updated_prod["stock"] == initial_stock - buy_qty

    res_hist = client.get(f"/orders/user/{client_auth['email']}", headers=client_auth)
    assert res_hist.status_code == 200
    history = res_hist.json()
    assert len(history) >= 1
    assert history[-1]["total"] == 5000

def test_admin_order_management(admin_auth, client_auth):
    """
    Prueba que el ADMIN puede ver todas las órdenes y cambiar su estado.
    """
    prod_id = 77777
    products_collection.update_one({"id": prod_id}, {"$set": {"stock": 100}}, upsert=True)
    
    order_payload = {
        "customer_email": client_auth["email"],
        "items": [{"product_id": prod_id, "name": "Test Status", "price": 100, "quantity": 1}],
        "total": 100
    }
    create_res = client.post("/orders", json=order_payload, headers=client_auth)
    order_id = create_res.json()["id"]

    res_all = client.get("/orders", headers=admin_auth)
    assert res_all.status_code == 200
    assert any(o["id"] == order_id for o in res_all.json())

    res_status = client.patch(f"/orders/{order_id}/status", json={"status": "entregado"}, headers=admin_auth)
    assert res_status.status_code == 200

    res_check = client.get(f"/orders/user/{client_auth['email']}", headers=client_auth)
    my_order = next(o for o in res_check.json() if o["id"] == order_id)
    assert my_order["status"] == "entregado"

def test_security_rate_limit():
    """
    Verifica que el sistema bloquee intentos de fuerza bruta en el login.
    """
    fake_ip = {"X-Forwarded-For": "10.0.0.99"} 
    
    limit_hit = False
    for _ in range(7):
        res = client.post("/login", json={"identifier": "hacker", "password": "123"}, headers=fake_ip)
        if res.status_code == 429:
            limit_hit = True
            break
            
    assert limit_hit == True