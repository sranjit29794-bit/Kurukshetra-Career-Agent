
from app import db
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Student API", version="1.0.0")


class ItemCreate(BaseModel):
    name: str
    price: float


class ItemResponse(BaseModel):
    id: int
    name: str
    price: float


@app.get("/items", response_model=list[ItemResponse])
def list_items():
    """Retrieve all inventory items from the database."""
    items = db.get_items()
    return items


@app.post("/items", response_model=ItemResponse)
def create_item(item: ItemCreate):
    """Insert a new inventory item using parameterized SQL queries."""
    if item.price < 0:
        raise HTTPException(status_code=400, detail="Price must be positive")
    created = db.insert_item(item.name, item.price)
    return created
