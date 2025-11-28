import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
print(f"📡 Intentando conectar a: {uri}")

try:
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    print("✅ ¡Conexión Exitosa a MongoDB!")

    db = client[os.getenv("DB_NAME", "empanaderia_db")]
    count = db.products.count_documents({})
    print(f"📦 Productos en la colección: {count}")

except Exception as e:
    print(f"❌ ERROR CRÍTICO: {e}")