"""Deduplication d'un dataset normalise -- une cle metier (transaction_id,
client_id...) determine l'unicite. Conserve la premiere occurrence
rencontree, compte le reste comme doublon."""
from typing import Any, Dict, List, Tuple

from .schemas import TypeDataset

CLE_DEDUPLICATION = {
    TypeDataset.TRANSACTIONS: "transaction_id",
    TypeDataset.CLIENTS: "client_id",
    TypeDataset.COMBINE: "client_id",
}


def dedupliquer(lignes: List[Dict[str, Any]], cle: str) -> Tuple[List[Dict[str, Any]], int]:
    """Retourne (lignes_dedupliquees, nombre_de_doublons_retires)."""
    vus = set()
    resultat = []
    doublons = 0
    for ligne in lignes:
        valeur_cle = ligne.get(cle)
        if valeur_cle in vus:
            doublons += 1
            continue
        vus.add(valeur_cle)
        resultat.append(ligne)
    return resultat, doublons


def dedupliquer_composite(lignes: List[Dict[str, Any]], cles: List[str]) -> Tuple[List[Dict[str, Any]], int]:
    vus = set()
    resultat = []
    doublons = 0
    for ligne in lignes:
        valeur_cle = tuple(ligne.get(c) for c in cles)
        if valeur_cle in vus:
            doublons += 1
            continue
        vus.add(valeur_cle)
        resultat.append(ligne)
    return resultat, doublons


def dedupliquer_dataset(lignes: List[Dict[str, Any]], type_dataset: TypeDataset) -> Tuple[List[Dict[str, Any]], int]:
    cle = CLE_DEDUPLICATION[type_dataset]

    # Sur un export pre-agrege sans transaction_id (voir column_mapper.py),
    # dedupliquer sur transaction_id enverrait ligne.get('transaction_id')
    # -> None pour TOUTES les lignes, qui seraient alors toutes prises pour
    # des doublons de la premiere apres normalisation -- perte quasi totale
    # du dataset. On deduplique plutot sur la cle metier du regroupement
    # (client x service x date), coherente avec ce que represente une ligne.
    if type_dataset == TypeDataset.TRANSACTIONS and lignes and cle not in lignes[0]:
        return dedupliquer_composite(lignes, ["client_id", "type_service", "date_transaction"])

    return dedupliquer(lignes, cle)
