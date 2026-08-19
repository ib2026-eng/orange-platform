"""Reconnaissance des noms de colonnes reels d'un export Orange Money et
mapping vers le schema canonique interne (client_id, transaction_id,
montant, statut, date_transaction, type_service, nb_transactions_groupees,
ville, region, ...).

Centralise ici, pas bricole dans chaque vue frontend : le reste du
pipeline (validation, normalisation, agregation, scoring) ne connait que
les noms canoniques. Une colonne non reconnue n'est jamais supprimee -- elle
est conservee telle quelle dans les lignes importees, simplement absente du
rapport de mapping (le frontend l'affiche comme "non utilisee")."""
import re
import unicodedata
from typing import Any, Dict, List, Tuple

CANONIQUES = {
    "client_id", "transaction_id", "montant", "statut", "date_transaction",
    "type_service", "nb_transactions_groupees", "ville", "region",
    "date_souscription", "date_naissance", "age", "age_sim",
}

# Cle : alias normalise (minuscules, sans accents, separateurs -> "_").
# Valeur : nom canonique. Liste non exhaustive par construction -- une
# colonne absente d'ici n'est pas rejetee, juste non mappee (voir
# mapper_colonnes). Alimentee par des noms reellement observes sur des
# exports Orange Money (num_sender, transaction_tag, op_date, nb_trans...)
# et par les variantes usuelles (anglais, snake_case, espaces).
ALIAS_COLONNES = {
    # client_id
    "id_client": "client_id", "idclient": "client_id", "customer_id": "client_id",
    "customerid": "client_id", "msisdn": "client_id", "numero_client": "client_id",
    "num_client": "client_id", "num_sender": "client_id", "sender": "client_id",
    "code_client": "client_id", "identifiant_client": "client_id",

    # transaction_id
    "id_transaction": "transaction_id", "transactionid": "transaction_id",
    "numero_transaction": "transaction_id", "num_transaction": "transaction_id",
    "reference_transaction": "transaction_id", "ref_transaction": "transaction_id",
    "transaction_ref": "transaction_id", "code_transaction": "transaction_id",

    # montant
    "amount": "montant", "montant_transaction": "montant",
    "transaction_amount": "montant", "amount_transaction": "montant",
    "valeur_transaction": "montant",

    # date_transaction
    "date": "date_transaction", "transaction_date": "date_transaction",
    "date_trans": "date_transaction", "created_at": "date_transaction",
    "op_date": "date_transaction", "date_operation": "date_transaction",
    "transaction_dt": "date_transaction", "date_op": "date_transaction",

    # statut
    "status": "statut", "etat": "statut", "statut_transaction": "statut",
    "transaction_status": "statut", "status_transaction": "statut",

    # type_service
    "service": "type_service", "type_transaction": "type_service",
    "transaction_type": "type_service", "service_type": "type_service",
    "transaction_tag": "type_service", "tag": "type_service",
    "categorie_transaction": "type_service",

    # nb_transactions_groupees (exports pre-agreges)
    "nb_trans": "nb_transactions_groupees", "nombre_transactions": "nb_transactions_groupees",
    "transaction_count": "nb_transactions_groupees", "nb_transaction": "nb_transactions_groupees",
    "nbtrans": "nb_transactions_groupees",

    # ville / region
    "city": "ville", "town": "ville",
    "region_name": "region",

    # champs clients
    "birth_date": "date_naissance", "dob": "date_naissance",
    "subscription_date": "date_souscription", "date_inscription": "date_souscription",
}


def normaliser_nom_colonne(nom: str) -> str:
    """minuscules, sans accents, separateurs (espace/tiret/point) -> '_'."""
    sans_accents = unicodedata.normalize("NFKD", str(nom)).encode("ascii", "ignore").decode("ascii")
    minuscule = sans_accents.strip().lower()
    normalise = re.sub(r"[^a-z0-9]+", "_", minuscule).strip("_")
    return normalise


def mapper_colonnes(lignes: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Renomme les colonnes reconnues vers le schema canonique. Retourne
    (lignes_mappees, rapport) -- rapport liste chaque colonne originale avec
    son nom canonique (ou None si non reconnue) et un niveau de confiance,
    pour affichage transparent cote frontend (jamais de mapping silencieux)."""
    if not lignes:
        return lignes, []

    colonnes_originales = list(lignes[0].keys())
    correspondance: Dict[str, str] = {}
    canoniques_deja_prises = set()
    rapport = []

    for col in colonnes_originales:
        if col in CANONIQUES:
            correspondance[col] = col
            canoniques_deja_prises.add(col)
            rapport.append({"colonne_originale": col, "colonne_canonique": col, "confiance": "déjà standard"})
            continue

        norm = normaliser_nom_colonne(col)
        cible = ALIAS_COLONNES.get(norm)
        if cible and cible not in canoniques_deja_prises:
            correspondance[col] = cible
            canoniques_deja_prises.add(cible)
            rapport.append({"colonne_originale": col, "colonne_canonique": cible, "confiance": "élevée"})
        elif cible:
            # Une colonne mappant vers ce meme canonique a deja ete prise --
            # conflit reel dans le fichier, on ne devine pas laquelle est la
            # bonne : les deux restent sous leur nom d'origine.
            rapport.append({"colonne_originale": col, "colonne_canonique": None, "confiance": "conflit"})
        else:
            rapport.append({"colonne_originale": col, "colonne_canonique": None, "confiance": "non reconnue"})

    if not correspondance:
        return lignes, rapport

    lignes_mappees = [
        {correspondance.get(k, k): v for k, v in ligne.items()}
        for ligne in lignes
    ]
    return lignes_mappees, rapport
