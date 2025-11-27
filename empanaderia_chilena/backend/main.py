import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Importar los nuevos routers
from routers import users, products, orders
from database import products_collection

# Configuración Base
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

app = FastAPI(title="Empanadería API", version="2.0.0")

# --- MIDDLEWARE (CORS) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción cambiar por dominio real
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ARCHIVOS ESTÁTICOS ---
script_dir = os.path.dirname(os.path.abspath(__file__))
static_path = os.path.join(script_dir, "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

# --- INCLUIR ROUTERS ---
# Aquí conectamos los módulos que creamos
app.include_router(users.router)
app.include_router(products.router)
app.include_router(orders.router)

# --- SEEDER (Datos Iniciales) ---
# Se mantiene simple para poblar la DB al inicio
@app.on_event("startup")
async def startup_event():
    if products_collection.count_documents({}) == 0:
        base_img = "http://127.0.0.1:8000/static/images"
        # ... (Puedes copiar tu lógica de seed_db aquí o importarla)
        logger.info("Base de datos verificada")

@app.get("/")
def root():
    return {"message": "API Empanadería La Chilena V2 funcionando 🚀"}