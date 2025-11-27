from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Test 1: Verificar que el catálogo carga
def test_read_products():
    response = client.get("/products")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# Test 2: Verificar validación de stock (Lógica de Negocio)
def test_create_order_no_auth():
    # Intentar comprar sin token debe fallar
    response = client.post("/orders", json={
        "customer_email": "test@kiosco.cl",
        "items": [],
        "total": 1000
    })
    assert response.status_code == 401 # Unauthorized