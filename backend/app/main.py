"""API de prediction du churn Orange Money -- Customer Intelligence.

Portage modulaire de orange-money-source/orange_money_deploiement/api_om_churn.py.
Contrat (chemins, formes de reponse) et comportement identiques a la reference.

Lancement local (depuis backend/) :
    uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .domains.orange_money.ingestion.router import router as ingestion_router
from .domains.orange_money.router import router as orange_money_router

settings = get_settings()

app = FastAPI(
    title="API Orange Money Customer Intelligence",
    description="Prédiction du risque de churn -- modèle réel (AUC 0.60, signal modeste) si disponible, sinon règle transparente en repli.",
    version="0.2",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orange_money_router)
app.include_router(ingestion_router)
