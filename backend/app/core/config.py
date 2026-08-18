"""Configuration de l'API -- valeurs par défaut identiques à la référence
(orange-money-source/orange_money_deploiement/api_om_churn.py), surchargeables
par variables d'environnement sans changer le code."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    allowed_origins: list
    modele_reel_disponible: bool


def get_settings() -> Settings:
    origins_env = os.environ.get("ALLOWED_ORIGINS", "*").strip()
    allowed_origins = ["*"] if origins_env == "*" else [o.strip() for o in origins_env.split(",") if o.strip()]

    modele_reel_env = os.environ.get("MODELE_REEL_DISPONIBLE", "true").strip().lower()
    modele_reel_disponible = modele_reel_env != "false"

    return Settings(allowed_origins=allowed_origins, modele_reel_disponible=modele_reel_disponible)
