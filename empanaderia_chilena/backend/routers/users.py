from fastapi import APIRouter, HTTPException, Depends, Request
from database import db
from models import User, LoginRequest
from auth import get_password_hash, verify_password, create_token

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Usuarios"])

@router.post("/register")
def register(user: User):
    if len(user.password) < 8:
        raise HTTPException(400, "La contraseña debe tener al menos 8 caracteres")
    
    if db.users.find_one({"email": user.email}):
        raise HTTPException(400, "El usuario ya existe")
    
    user_dict = user.model_dump()
    user_dict["password"] = get_password_hash(user.password)
    # Lógica simple de roles: si contiene "admin", es admin (Solo para dev/demo)
    user_dict["role"] = "admin" if "admin" in user.email else "cliente"
    
    db.users.insert_one(user_dict)
    return {"message": "Cuenta creada exitosamente"}

@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, creds: LoginRequest):
    user = db.users.find_one({
        "$or": [{"email": creds.identifier}, {"name": creds.identifier}]
    })

    if not user or not verify_password(creds.password, user["password"]):
        raise HTTPException(401, "Credenciales inválidas")
    
    token = create_token({"sub": user["email"], "role": user["role"], "name": user["name"]})
    return {
        "access_token": token, 
        "token_type": "bearer",
        "user": {"name": user["name"], "email": user["email"], "role": user["role"]}
    }
    