import pytest
from fastapi.testclient import TestClient
from main import app
from database import products_collection, users_collection
import uuid

# Creamos un cliente de prueba que simula ser un navegador
client = TestClient(app)

# --- FIXTURES (Datos de preparación) ---

@pytest.fixture
def test_user():
    """Crea un usuario único para cada prueba y devuelve sus credenciales"""
    unique_id = str(uuid.uuid4())[:8]
    user_data = {
        "name": f"Test User {unique_id}",
        "email": f"test_{unique_id}@qa.com",
        "password": "password123", # Cumple min 8 chars
        "role": "cliente"
    }
    # Registramos el usuario
    response = client.post("/register", json=user_data)
    assert response.status_code == 200
    return user_data

@pytest.fixture
def test_product():
    """Crea un producto de prueba en la BD"""
    prod_id = 9999
    product_data = {
        "id": prod_id,
        "name": "Empanada QA",
        "category": "pruebas",
        "price": 1000,
        "stock": 10,
        "image": "http://img.com/qa.jpg"
    }
    # Usamos upsert para asegurar que exista y tenga stock 10
    products_collection.update_one(
        {"id": prod_id}, 
        {"$set": product_data}, 
        upsert=True
    )
    return product_data

# --- TEST CASES (Pruebas) ---

def test_health_check():
    """Verifica que la API esté viva"""
    res = client.get("/")
    assert res.status_code == 200
    assert "funcionando" in res.json()["message"]

def test_auth_flow(test_user):
    """Prueba el ciclo completo: Registro (en fixture) -> Login -> Token"""
    # Intentamos loguearnos con el usuario creado
    login_data = {
        "identifier": test_user["email"],
        "password": test_user["password"]
    }
    res = client.post("/login", json=login_data)
    
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_stock_deduction_logic(test_user, test_product):
    """
    Prueba crítica de negocio:
    1. Loguearse
    2. Comprar producto
    3. Verificar que el stock bajó en la BD
    """
    # 1. Login
    login_res = client.post("/login", json={"identifier": test_user["email"], "password": test_user["password"]})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Comprar 3 unidades
    qty_to_buy = 3
    order_payload = {
        "customer_email": test_user["email"],
        "items": [
            {
                "product_id": test_product["id"],
                "name": test_product["name"],
                "price": test_product["price"],
                "quantity": qty_to_buy
            }
        ],
        "total": test_product["price"] * qty_to_buy
    }
    
    res_order = client.post("/orders", json=order_payload, headers=headers)
    assert res_order.status_code == 200
    assert res_order.json()["status"] == "confirmado"

    # 3. Verificar Stock en Base de Datos (Sin pasar por la API)
    updated_prod = products_collection.find_one({"id": test_product["id"]})
    expected_stock = test_product["stock"] - qty_to_buy
    
    assert updated_prod["stock"] == expected_stock
    print(f"\n✅ Stock verificado: Bajó de {test_product['stock']} a {updated_prod['stock']}")

def test_rate_limit_protection():
    """
    Prueba de Seguridad:
    Intenta loguearse muchas veces y verifica que el sistema bloquee (429).
    """
    print("\n🛡️ Probando Fuerza Bruta (Rate Limit)...")
    
    # Intentamos 7 veces (el límite configurado era 5/minuto)
    # Nota: Usamos una IP falsa simulada en el header para no bloquear al usuario del test anterior
    fake_ip_headers = {"X-Forwarded-For": "192.168.1.50"} 
    
    limit_hit = False
    for i in range(7):
        res = client.post(
            "/login", 
            json={"identifier": "hacker@test.com", "password": "wrong"},
            headers=fake_ip_headers
        )
        if res.status_code == 429:
            limit_hit = True
            break
            
    if limit_hit:
        print("✅ Sistema de seguridad activo: Bloqueo detectado (429).")
    else:
        pytest.fail("❌ FALLO DE SEGURIDAD: El rate limit no se activó.")

    assert limit_hit == True