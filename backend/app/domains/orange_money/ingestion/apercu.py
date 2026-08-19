"""Apercu d'un dataset valide -- colonnes detectees, type devine, valeurs
manquantes, exemple, et un echantillon de lignes (section 14 : "Apercu avant
validation"). Purement informatif, ne modifie pas les donnees."""
from typing import Any, Dict, List

from .validator import CHAMPS_DATE, CHAMPS_NUMERIQUES, _est_vide

NB_LIGNES_APERCU = 5


def detecter_type_colonne(nom_colonne: str, valeurs: List[Any]) -> str:
    if nom_colonne in CHAMPS_NUMERIQUES:
        return "FLOAT"
    if nom_colonne in CHAMPS_DATE:
        return "DATE"

    valeurs_non_vides = [v for v in valeurs if not _est_vide(v)]
    if not valeurs_non_vides:
        return "STRING"
    if all(isinstance(v, (int, float)) for v in valeurs_non_vides):
        return "FLOAT"

    valeurs_uniques = len(set(str(v) for v in valeurs_non_vides))
    if valeurs_uniques <= max(3, len(valeurs_non_vides) // 5):
        return "CATEGORY"
    return "STRING"


def construire_apercu(lignes: List[Dict[str, Any]], n: int = NB_LIGNES_APERCU) -> Dict[str, Any]:
    if not lignes:
        return {"colonnes": [], "lignes": []}

    colonnes = list(lignes[0].keys())
    apercu_colonnes = []
    for col in colonnes:
        valeurs = [ligne.get(col) for ligne in lignes]
        manquants = sum(1 for v in valeurs if _est_vide(v))
        exemple = next((v for v in valeurs if not _est_vide(v)), None)
        apercu_colonnes.append({
            "colonne": col,
            "type_detecte": detecter_type_colonne(col, valeurs),
            "valeurs_manquantes": manquants,
            "exemple": exemple,
        })

    return {"colonnes": apercu_colonnes, "lignes": lignes[:n]}
