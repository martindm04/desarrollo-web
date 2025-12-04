# Empanadería "La Chilena" - Web & Mobile Module

## 📋 Project Overview

This project implements a Full-Stack web application for managing online orders for "Empanadería La Chilena". It features a public catalog, shopping cart, user authentication, and an administration panel for product management.

**Stack:**

* **Frontend:** HTML5, CSS3 (Responsive/Grid), Vanilla JavaScript.
* **Backend:** Python (FastAPI).
* **Database:** MongoDB (Motor/Pymongo).
* **Architecture:** Layered (Routes, Models, Database).

## 🚀 Prerequisites

* **Python 3.9+** installed.
* **MongoDB** installed and running on port `27017`.

## 🛠️ Installation & Execution

### 1. Backend Setup

Navigate to the backend folder and install dependencies:

```bash
cd .\empanaderia_chilena\backend\
pip install fastapi uvicorn pymongo pydantic
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pytest tests/test_suite.py -v
```
