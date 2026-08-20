"""Logique de scoring Orange Money.

v1 : execute directement le vrai modele entraine (XGBClassifier, 2
variables) via les artefacts serialises (model_files/*.pkl) -- plus
d'approximation par table de correspondance. Voir reference_table.py pour
les metadonnees (version, variables, AUC)."""
from pathlib import Path

import joblib
import pandas as pd

from .reference_table import VARIABLES_MODELE

_DOSSIER_MODELE = Path(__file__).parent / "model_files"
_modele = joblib.load(_DOSSIER_MODELE / "modele_churn_om_reel.pkl")
_scaler = joblib.load(_DOSSIER_MODELE / "scaler_om_reel.pkl")


def score_modele_reel(montant_moyen: float, total_transactions: float) -> float:
    """Execute le vrai modele XGBoost -- VARIABLES_MODELE fixe l'ordre exact
    des colonnes attendu par le scaler/modele entraines."""
    valeurs = {"montant_moyen": montant_moyen or 0, "total_transactions": total_transactions or 0}
    entree = pd.DataFrame([[valeurs[nom] for nom in VARIABLES_MODELE]], columns=VARIABLES_MODELE)
    entree_normalisee = _scaler.transform(entree)
    return float(_modele.predict_proba(entree_normalisee)[0][1])


def score_risque_placeholder(row: dict) -> float:
    """Regle de score simple et documentee -- utilisee uniquement si le
    modele reel n'est pas encore disponible."""
    jours_inactivite = row.get('jours_inactivite_avant_mars', 0)
    total_transactions = row.get('total_transactions', 0)
    nb_types_service = row.get('nb_types_service', 0)
    montant_moyen = row.get('montant_moyen', 0)

    score = (
        0.50 * min(jours_inactivite / 60, 1.0)
        + 0.25 * (1 - min(total_transactions / 30, 1.0))
        + 0.15 * (1 - min(nb_types_service / 6, 1.0))
        + 0.10 * (1 - min(montant_moyen / 200000, 1.0))
    )
    return round(min(max(score, 0.01), 0.97), 4)


def score_risque(row: dict, modele_reel_disponible: bool) -> float:
    if modele_reel_disponible:
        montant_moyen = row.get('montant_moyen', 0)
        total_transactions = row.get('total_transactions', 0)
        return round(score_modele_reel(montant_moyen, total_transactions), 4)
    return score_risque_placeholder(row)


def score_risque_batch(rows: list, modele_reel_disponible: bool) -> list:
    """Equivalent de [score_risque(r, ...) for r in rows], mais un seul
    appel au modele pour tout le lot (au lieu d'un appel Python + un
    DataFrame par client) -- indispensable pour rester rapide sur de gros
    datasets reels (des centaines de milliers de clients). Memes resultats
    que la version ligne par ligne, juste vectorisee."""
    if not rows:
        return []
    if not modele_reel_disponible:
        return [score_risque_placeholder(r) for r in rows]
    entree = pd.DataFrame(
        [[r.get('montant_moyen', 0) or 0, r.get('total_transactions', 0) or 0] for r in rows],
        columns=VARIABLES_MODELE,
    )
    entree_normalisee = _scaler.transform(entree)
    probas = _modele.predict_proba(entree_normalisee)[:, 1]
    return [round(float(p), 4) for p in probas]


def niveau_risque(proba: float) -> str:
    if proba >= 0.6:
        return "Critique"
    if proba >= 0.35:
        return "Élevé"
    if proba >= 0.15:
        return "Modéré"
    return "Faible"
