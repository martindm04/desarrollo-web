from fastapi import APIRouter, HTTPException, Depends, Request
from database import users_collection
from models import User, LoginRequest
from auth import get_password_hash, verify_password, create_token
from config import limiter

router = APIRouter(tags=["Usuarios"])

@router.post("/register")
def register(user: User):
    if len(user.password) < 8:
        raise HTTPException(400, "La contraseña debe tener al menos 8 caracteres")

    if users_collection.find_one({"email": user.email}):
        raise HTTPException(400, "El usuario ya existe")

    user_dict = user.model_dump()
    user_dict["password"] = get_password_hash(user.password)
    user_dict["role"] = "admin" if "admin" in user.email else "cliente"
    
    users_collection.insert_one(user_dict)
    return {"message": "Cuenta creada exitosamente"}

@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, creds: LoginRequest):
    user = users_collection.find_one({
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