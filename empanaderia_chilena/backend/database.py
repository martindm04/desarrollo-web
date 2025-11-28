import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "empanaderia_db")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

products_collection = db["products"]
users_collection = db["users"]
orders_collection = db["orders"]