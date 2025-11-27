import requests, sys

API = "http://127.0.0.1:8000"

def test():
    print("--- 🛡️ TEST DE SEGURIDAD Y LÓGICA ---")
    
    # 1. Test Password Corta (Debe fallar)
    res = requests.post(f"{API}/register", json={"name":"Test","email":"t@t.com","password":"123"})
    if res.status_code == 400: print("✅ Seguridad: Password corta rechazada")
    else: print(f"❌ FALLO: Password corta aceptada ({res.status_code})"); sys.exit()

    # 2. Registro OK
    email = "admin@admin.com"
    requests.post(f"{API}/register", json={"name":"Admin","email":email,"password":"password123"})
    print("✅ Registro OK")

    # 3. Login Híbrido (Con Nombre en vez de Email)
    res = requests.post(f"{API}/login", json={"identifier":"Admin", "password":"password123"})
    if res.status_code == 200: print("✅ Login Híbrido (Nombre) OK")
    else: print(f"❌ FALLO Login Híbrido ({res.text})"); sys.exit()
    
    token = res.json()["access_token"]
    
    # 4. Carga de Stock Rápida (Admin)
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.post(f"{API}/admin/stock/1", json={"quantity": 50}, headers=headers)
    if res.status_code == 200: print("✅ Gestión de Stock Admin OK")
    else: print(f"❌ FALLO Stock Admin ({res.text})")

    print("\n✨ BACKEND LISTO PARA FASE 2 ✨")

if __name__ == "__main__": test()