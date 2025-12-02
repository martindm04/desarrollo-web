import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_HOST = os.getenv("MONGO_HOST", "127.0.0.1")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
DB_NAME = os.getenv("DB_NAME", "empanaderia_db")

env_uri = os.getenv("MONGO_URI")

if env_uri and env_uri.startswith("mongodb"):
    MONGO_URI = env_uri
else:
    MONGO_URI = f"mongodb://{MONGO_HOST}:{MONGO_PORT}/"

print(f"📡 Conectando a MongoDB: {MONGO_URI}")

try:
    client = MongoClient(MONGO_URI)
    client.admin.command('ping')
    print("✅ Conexión exitosa a MongoDB")
    
    db = client[DB_NAME]

    products_collection = db["products"]
    users_collection = db["users"]
    orders_collection = db["orders"]

except Exception as e:
    print(f"❌ Error crítico de base de datos: {e}")
    raise e