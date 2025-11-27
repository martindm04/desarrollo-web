import os
import logging
from contextlib import asynccontextmanager # <--- NUEVO IMPORT
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

# Importar routers y base de datos
from routers import users, products, orders
from database import products_collection

# Configuración Base
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

# Configuración de Rate Limiting
limiter = Limiter(key_func=get_remote_address)

# --- LIFESPAN (La nueva forma moderna de manejar el inicio/cierre) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # LÓGICA DE INICIO (Lo que estaba antes en @app.on_event)
    if products_collection.count_documents({}) == 0:
        base_img = "http://127.0.0.1:8000/static/images"
        initials = [
            {"id": 1, "name": "Empanada de Pino", "category": "horno", "price": 2500, "stock": 50, "image": f"{base_img}/pino.jpg"},
            {"id": 2, "name": "Empanada de Queso", "category": "frita", "price": 2000, "stock": 40, "image": f"{base_img}/queso.jpg"},
            {"id": 3, "name": "Sopaipillas (3 un)", "category": "acompañamiento", "price": 1000, "stock": 80, "image": f"{base_img}/sopaipillas.jpg"},
            {"id": 4, "name": "Bebida Lata", "category": "bebida", "price": 1500, "stock": 100, "image": f"{base_img}/bebida.jpg"},
            {"id": 5, "name": "Pebre Chileno", "category": "acompañamiento", "price": 500, "stock": 200, "image": f"{base_img}/pebre.jpg"}
        ]
        products_collection.insert_many(initials)
        logger.info("Base de datos poblada con imágenes locales")
    
    logger.info("Base de datos verificada y lista")
    
    yield # Aquí es donde la aplicación corre
    
    # LÓGICA DE APAGADO (Opcional: cerrar conexiones, etc.)
    logger.info("Apagando aplicación...")

# --- INICIALIZACIÓN APP ---
app = FastAPI(
    title="Empanadería API", 
    version="2.0.0",
    lifespan=lifespan # <--- CONECTAMOS EL LIFESPAN AQUÍ
)

# Conectar limitador
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ARCHIVOS ESTÁTICOS ---
script_dir = os.path.dirname(os.path.abspath(__file__))
static_path = os.path.join(script_dir, "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

# --- ROUTERS ---
app.include_router(users.router)
app.include_router(products.router)
app.include_router(orders.router)

@app.get("/")
def root():
    return {"message": "API Empanadería La Chilena V2 funcionando 🚀"}