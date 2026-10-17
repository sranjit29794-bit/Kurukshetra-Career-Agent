
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


items = []


# TODO: add SQL database integration
@app.get("/items", response_model=list[ItemResponse])
def list_items():
    return items


@app.post("/items", response_model=ItemResponse)
def create_item(item: ItemCreate):
    if item.price < 0:
        raise HTTPException(status_code=400, detail="Price must be positive")
    new_item = {"id": len(items) + 1, "name": item.name, "price": item.price}
    items.append(new_item)
    return new_item
