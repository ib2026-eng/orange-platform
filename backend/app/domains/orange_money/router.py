import pandas as pd
from fastapi import APIRouter, HTTPException

from ...core.config import get_settings
from .schemas import ClientBatchOM, ClientOM
from .scoring import niveau_risque, score_risque

router = APIRouter()


@router.get("/")
def racine():
    settings = get_settings()
    return {
        "message": "API Orange Money Customer Intelligence",
        "statut_modele": "Modèle réel (AUC 0.60, montant_moyen)" if settings.modele_reel_disponible else "PLACEHOLDER (règle simple, en attente du modèle réel)",
        "documentation": "/docs",
        "endpoints": ["POST /predire_churn", "POST /predire_churn_batch"],
    }


@router.post("/predire_churn")
def predire_churn(client: ClientOM):
    settings = get_settings()
    try:
        donnees = client.model_dump() if hasattr(client, "model_dump") else client.dict()
        proba = score_risque(donnees, settings.modele_reel_disponible)

        return {
            "probabilite_churn": proba,
            "prediction_churn": int(proba >= 0.5),
            "niveau_risque": niveau_risque(proba),
            "modele_reel": settings.modele_reel_disponible,
            "note_fiabilite": "Signal réel modeste (AUC 0.60) -- ne pas utiliser seul pour des décisions commerciales fermes" if settings.modele_reel_disponible else "Placeholder -- règle non entraînée",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur de traitement : {e}")


@router.post("/predire_churn_batch")
def predire_churn_batch(payload: ClientBatchOM):
    settings = get_settings()
    try:
        if len(payload.clients) == 0:
            raise HTTPException(status_code=400, detail="Le fichier envoye est vide.")

        resultats = []
        for ligne in payload.clients:
            proba = score_risque(ligne, settings.modele_reel_disponible)
            resultats.append({
                **{k: (None if pd.isna(v) else v) for k, v in ligne.items()},
                "probabilite_churn": proba,
                "prediction_churn": int(proba >= 0.5),
                "niveau_risque": niveau_risque(proba),
            })

        return {
            "nb_clients": len(resultats),
            "nb_a_risque": sum(1 for r in resultats if r["prediction_churn"] == 1),
            "modele_reel": settings.modele_reel_disponible,
            "resultats": resultats,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur de traitement du fichier : {e}")
