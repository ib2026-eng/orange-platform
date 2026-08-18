"""Logique de scoring Orange Money -- portage fidele des fonctions de
orange-money-source/orange_money_deploiement/api_om_churn.py. Le comportement
(entrees -> sorties) doit rester identique a la reference."""
from .reference_table import TABLE_MONTANT_MOYEN


def score_modele_reel(montant_moyen: float) -> float:
    """Reproduit les predictions du modele reel (Random Forest, montant_moyen,
    AUC 0.60) via une table de correspondance construite a partir des quantiles
    de la population d'entrainement -- equivalent fonctionnel au modele .pkl,
    sans dependre du fichier binaire."""
    for borne_min, borne_max, proba in TABLE_MONTANT_MOYEN:
        if borne_min <= montant_moyen < borne_max:
            return proba
    return TABLE_MONTANT_MOYEN[-1][2]


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
        return round(score_modele_reel(montant_moyen), 4)
    return score_risque_placeholder(row)


def niveau_risque(proba: float) -> str:
    if proba >= 0.6:
        return "Critique"
    if proba >= 0.35:
        return "Élevé"
    if proba >= 0.15:
        return "Modéré"
    return "Faible"
