"""Formes de dataset attendues -- Orange Money Data Import (V2).

Ne definit aucun modele ML, aucune donnee client : uniquement la structure
des jeux de donnees que la plateforme sait ingerer, pour detecter le type
d'un fichier importe et savoir quelles colonnes valider."""
from enum import Enum
from typing import Optional


class TypeDataset(str, Enum):
    TRANSACTIONS = "transactions"
    CLIENTS = "clients"
    COMBINE = "combine"


# Colonnes sans lesquelles le dataset ne peut pas etre exploite. transaction_id
# et statut ne sont PAS requis : certains exports Orange Money reels sont
# pre-agreges (une ligne = plusieurs transactions groupees, voir nb_trans /
# column_mapper.py) et n'ont ni identifiant de transaction unique ni statut
# reussite/echec. Le pipeline reste honnete dans ce cas : pas de dedup par
# transaction_id, pas de taux d'echec -- indisponible plutot qu'invente (voir
# deduplicator.py et aggregator.py).
COLONNES_REQUISES = {
    TypeDataset.TRANSACTIONS: ["client_id", "montant"],
    TypeDataset.CLIENTS: ["client_id"],
    TypeDataset.COMBINE: ["client_id"],
}

# Colonnes reconnues (utilisees pour la normalisation cible et l'apercu) --
# None pour COMBINE : toutes les colonnes disponibles sont conservees.
COLONNES_ATTENDUES = {
    TypeDataset.TRANSACTIONS: [
        "client_id", "transaction_id", "date_transaction", "type_service",
        "montant", "statut", "ville", "region", "nb_transactions_groupees",
    ],
    TypeDataset.CLIENTS: [
        "client_id", "date_souscription", "date_naissance", "age",
        "ville", "region", "age_sim",
    ],
    TypeDataset.COMBINE: None,
}

# Colonnes propres a chaque type (hors client_id, commun aux trois) -- un
# seul recoupement suffit a orienter la detection, meme si le dataset est
# par ailleurs incomplet (le validateur signalera alors precisement les
# colonnes requises manquantes, plutot que de tomber en "type indetermine").
COLONNES_SIGNATURE_TRANSACTIONS = {"transaction_id", "montant", "statut", "date_transaction", "type_service"}
COLONNES_SIGNATURE_CLIENTS = {"date_naissance", "age", "date_souscription", "age_sim"}


def detecter_type_dataset(colonnes) -> Optional[TypeDataset]:
    """Devine le type de dataset a partir des noms de colonnes presentes,
    par recoupement avec les colonnes caracteristiques de chaque type.
    Retourne None si le dataset ne contient meme pas client_id, ou si
    aucune colonne caracteristique d'aucun type n'est presente -- dans ce
    cas seulement, le type est reellement indetermine."""
    presentes = set(colonnes)
    if "client_id" not in presentes:
        return None

    a_signature_transactions = bool(COLONNES_SIGNATURE_TRANSACTIONS & presentes)
    a_signature_clients = bool(COLONNES_SIGNATURE_CLIENTS & presentes)

    if a_signature_transactions and a_signature_clients:
        return TypeDataset.COMBINE
    if a_signature_transactions:
        return TypeDataset.TRANSACTIONS
    if a_signature_clients:
        return TypeDataset.CLIENTS
    return None
