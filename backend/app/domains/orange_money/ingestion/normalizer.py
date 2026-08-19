"""Normalisation d'un dataset deja valide -- types coherents, espaces
superflus retires, dates au format ISO 8601. N'invente aucune valeur : un
champ manquant reste manquant apres normalisation."""
from datetime import datetime
from typing import Any, Dict, List

from .validator import CHAMPS_DATE, CHAMPS_NUMERIQUES, FORMATS_DATE_ACCEPTES, _est_vide

CHAMPS_TEXTE_NORMALISES = {"ville", "region", "statut", "type_service"}


def _normaliser_date(valeur: Any) -> Any:
    if _est_vide(valeur):
        return valeur
    texte = str(valeur).strip()
    for fmt in FORMATS_DATE_ACCEPTES:
        try:
            return datetime.strptime(texte, fmt).date().isoformat()
        except ValueError:
            continue
    return valeur  # format non reconnu -- laisse tel quel, deja signale par le validateur


def _normaliser_montant(valeur: Any) -> Any:
    if _est_vide(valeur):
        return valeur
    try:
        return float(str(valeur).replace(",", "."))
    except ValueError:
        return valeur


def _normaliser_texte(valeur: Any) -> Any:
    if _est_vide(valeur):
        return valeur
    return str(valeur).strip().title()


def normaliser_ligne(ligne: Dict[str, Any]) -> Dict[str, Any]:
    resultat = {}
    for champ, valeur in ligne.items():
        if isinstance(valeur, str):
            valeur = valeur.strip()
        if champ in CHAMPS_DATE:
            valeur = _normaliser_date(valeur)
        elif champ in CHAMPS_NUMERIQUES:
            valeur = _normaliser_montant(valeur)
        elif champ in CHAMPS_TEXTE_NORMALISES:
            valeur = _normaliser_texte(valeur)
        resultat[champ] = valeur
    return resultat


def normaliser_dataset(lignes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalise chaque ligne et retire les lignes entierement vides (aucun
    champ renseigne) -- ce ne sont pas des donnees, juste du bruit d'export."""
    resultat = []
    for ligne in lignes:
        normalisee = normaliser_ligne(ligne)
        if any(not _est_vide(v) for v in normalisee.values()):
            resultat.append(normalisee)
    return resultat
