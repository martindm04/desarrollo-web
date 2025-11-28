import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

from routers import users, products, orders
from database import products_collection
from config import limiter

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if products_collection.count_documents({}) == 0:
        base_img = "/static/images"
        initials = [
            {"id": 1, "name": "Empanada de Pino", "category": "horno", "price": 2500, "stock": 50, "image": f"{base_img}/pino.jpg"},
            {"id": 2, "name": "Empanada de Queso", "category": "frita", "price": 2000, "stock": 40, "image": f"{base_img}/queso.jpg"},
            {"id": 3, "name": "Sopaipillas (3 un)", "category": "acompañamiento", "price": 1000, "stock": 80, "image": f"{base_img}/sopaipillas.jpg"},
            {"id": 4, "name": "Bebida Lata", "category": "bebida", "price": 1500, "stock": 100, "image": f"{base_img}/bebida.jpg"},
            {"id": 5, "name": "Pebre Chileno", "category": "acompañamiento", "price": 500, "stock": 200, "image": f"{base_img}/pebre.jpg"}
        ]
        products_collection.insert_many(initials)
        logger.info("Base de datos poblada con imágenes locales")

    logger.info("Sistema iniciado correctamente")
    yield
    logger.info("Apagando aplicación...")

app = FastAPI(
    title="Empanadería API", 
    version="2.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

script_dir = os.path.dirname(os.path.abspath(__file__))
static_path = os.path.join(script_dir, "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

app.include_router(users.router)
app.include_router(products.router)
app.include_router(orders.router)

@app.get("/")
def root():
    return {"message": "API Empanadería La Chilena V2 funcionando 🚀"}