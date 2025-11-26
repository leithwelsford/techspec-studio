from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"app": "TechSpec Writer", "status": "ok"}
