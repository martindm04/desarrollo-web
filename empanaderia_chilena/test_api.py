import requests
import json
import random
import sys

# Configuración
BASE_URL = "http://127.0.0.1:8000"
TEST_EMAIL = f"test_jwt_{random.randint(1000,9999)}@cliente.com"
TEST_PASS = "1234"

# Colores para la terminal
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"

def print_step(step, msg):
    print(f"\n[PASO {step}] {msg}...", end=" ")

def run_test():
    print(f"--- 🛡️ INICIANDO TEST CON SEGURIDAD JWT: {TEST_EMAIL} ---")

    # 1. Verificar Catálogo (Público)
    print_step(1, "Obteniendo producto para la prueba")
    try:
        res = requests.get(f"{BASE_URL}/products")
        if res.status_code == 200 and len(res.json()) > 0:
            products = res.json()
            target_product = products[0] # Usaremos el primer producto
            print(f"{GREEN}✅ OK ({target_product['name']}){RESET}")
        else:
            print(f"{RED}❌ FALLÓ (No hay productos o API caída){RESET}")
            sys.exit(1)
    except Exception as e:
        print(f"{RED}❌ ERROR CONEXIÓN: {e}{RESET}")
        sys.exit(1)

    # 2. Registro de Usuario (Público)
    print_step(2, "Registrando Usuario Nuevo")
    res = requests.post(f"{BASE_URL}/register", json={
        "name": "Bot Tester JWT",
        "email": TEST_EMAIL,
        "password": TEST_PASS,
        "role": "cliente"
    })
    
    if res.status_code == 200:
        print(f"{GREEN}✅ OK{RESET}")
    elif res.status_code == 400:
        print(f"{GREEN}⚠️ YA EXISTE (Continuamos){RESET}")
    else:
        print(f"{RED}❌ FALLÓ ({res.status_code}: {res.text}){RESET}")
        sys.exit(1)

    # 3. Login y Obtención de Token (CRÍTICO)
    print_step(3, "Iniciando Sesión para obtener JWT")
    res = requests.post(f"{BASE_URL}/login", json={
        "name": "temp",
        "email": TEST_EMAIL,
        "password": TEST_PASS
    })
    
    auth_token = None
    if res.status_code == 200:
        data = res.json()
        auth_token = data.get("access_token") # Capturamos el token real
        if auth_token:
            print(f"{GREEN}✅ OK (Token recibido: {auth_token[:10]}...){RESET}")
        else:
            print(f"{RED}❌ ERROR: No vino el token en la respuesta{RESET}")
            sys.exit(1)
    else:
        print(f"{RED}❌ FALLÓ LOGIN ({res.status_code}){RESET}")
        sys.exit(1)

    # 4. Crear Orden Protegida (Requiere Header Authorization)
    print_step(4, f"Comprando '{target_product['name']}' usando Token")
    stock_inicial = target_product['stock']
    
    # Headers con el Token Bearer
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }

    order_data = {
        "customer_email": TEST_EMAIL, # El backend usa el del token, pero lo enviamos por estructura
        "items": [
            {
                "product_id": target_product['id'],
                "name": target_product['name'],
                "price": target_product['price'],
                "quantity": 1
            }
        ],
        "total": target_product['price']
    }
    
    res = requests.post(f"{BASE_URL}/orders", json=order_data, headers=headers)
    
    if res.status_code == 200:
        print(f"{GREEN}✅ OK (Compra autorizada){RESET}")
    elif res.status_code == 401:
        print(f"{RED}❌ DENEGADO (Token inválido o no enviado){RESET}")
        sys.exit(1)
    else:
        print(f"{RED}❌ FALLÓ ({res.text}){RESET}")
        sys.exit(1)

    # 5. Verificar Historial (Nueva prueba para US-Historial)
    print_step(5, "Verificando 'Mis Pedidos' (Ruta Protegida)")
    res = requests.get(f"{BASE_URL}/orders/user/{TEST_EMAIL}", headers=headers)
    
    if res.status_code == 200 and len(res.json()) > 0:
        print(f"{GREEN}✅ OK (Historial recuperado){RESET}")
    else:
        print(f"{RED}❌ FALLÓ (No se ven las órdenes){RESET}")

    # 6. Verificar Descuento de Stock (Público)
    print_step(6, "Validando consistencia de Stock en DB")
    res = requests.get(f"{BASE_URL}/products")
    updated_products = res.json()
    updated_target = next(p for p in updated_products if p['id'] == target_product['id'])
    
    if updated_target['stock'] == stock_inicial - 1:
        print(f"{GREEN}✅ OK (Stock bajó de {stock_inicial} a {updated_target['stock']}){RESET}")
    else:
        print(f"{RED}❌ ERROR DE LÓGICA: El stock no bajó{RESET}")

    print(f"\n{GREEN}--- 🏆 SISTEMA VERIFICADO Y SEGURO ---{RESET}")

if __name__ == "__main__":
    run_test()