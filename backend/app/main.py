from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.models.database import engine
from app.models import models
from app.api.v1 import api_router

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="好论点智检平台 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {"message": "好论点智检平台 API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}