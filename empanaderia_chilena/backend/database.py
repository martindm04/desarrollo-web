from pymongo import MongoClient

# Conexión a MongoDB local (asegúrate de tener MongoDB corriendo)
client = MongoClient("mongodb://localhost:27017/")

# Nombre de la base de datos
db = client.empanaderia_db

# Colecciones (Equivalente a tablas)
products_collection = db["products"]
users_collection = db["users"]