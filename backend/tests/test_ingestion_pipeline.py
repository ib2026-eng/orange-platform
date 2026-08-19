from app.domains.orange_money.ingestion.pipeline import executer_pipeline
from app.domains.orange_money.ingestion.store import StatutImport

LIGNES_VALIDES = [
    {"client_id": "C1", "transaction_id": "T1", "montant": "1000", "statut": "reussie"},
    {"client_id": "C2", "transaction_id": "T2", "montant": "2000", "statut": "reussie"},
    {"client_id": "C1", "transaction_id": "T1", "montant": "1000", "statut": "reussie"},  # doublon
]


def test_pipeline_dataset_valide():
    resultat = executer_pipeline(LIGNES_VALIDES, nom_fichier="test.csv")
    assert resultat.dataset.statut == StatutImport.VALIDE
    assert resultat.dataset.doublons_retires == 1
    assert len(resultat.dataset.lignes) == 2
    assert resultat.dataset.profil.lignes_recues == 3
    assert resultat.dataset.nom_fichier == "test.csv"


def test_pipeline_colonnes_manquantes():
    # transaction_id/statut ne sont plus requis (Phase 13 -- exports Orange
    # Money pre-agreges sans ces colonnes) ; seul montant l'est encore.
    lignes = [{"client_id": "C1", "transaction_id": "T1"}]  # montant absent
    resultat = executer_pipeline(lignes)
    assert resultat.dataset.statut == StatutImport.INVALIDE
    assert resultat.dataset.lignes == []
    assert "montant" in resultat.dataset.colonnes_manquantes


def test_pipeline_dataset_vide():
    resultat = executer_pipeline([])
    assert resultat.dataset.statut == StatutImport.INVALIDE


def test_pipeline_ne_modifie_pas_les_donnees_en_entree():
    lignes = [dict(l) for l in LIGNES_VALIDES]
    executer_pipeline(lignes)
    assert lignes == LIGNES_VALIDES


def test_pipeline_filtre_les_lignes_invalides_sans_rejeter_tout_le_dataset():
    # Regression Phase 12 : un dataset volumineux et par ailleurs correct ne
    # doit pas etre rejete en bloc a cause de quelques cellules vides.
    lignes = [
        {"client_id": "C1", "transaction_id": "T1", "montant": "1000", "statut": "reussie"},
        {"client_id": "C2", "transaction_id": "T2", "montant": "", "statut": "reussie"},  # montant manquant
        {"client_id": "C3", "transaction_id": "T3", "montant": "abc", "statut": "reussie"},  # montant invalide
        {"client_id": "C4", "transaction_id": "T4", "montant": "3000", "statut": ""},  # statut vide -- OK, non requis
        {"client_id": "C5", "transaction_id": "T5", "montant": "4000", "statut": "reussie"},
    ]
    resultat = executer_pipeline(lignes)
    assert resultat.dataset.statut == StatutImport.VALIDE
    assert len(resultat.dataset.lignes) == 3  # C1, C4 (statut non requis) et C5
    assert resultat.validation.nb_erreurs == 2
    assert {l["client_id"] for l in resultat.dataset.lignes} == {"C1", "C4", "C5"}
    assert resultat.dataset.nb_erreurs_validation == 2


def test_pipeline_accepte_export_orange_money_reel_pre_agrege():
    # Regression Phase 13 : reproduit la forme reelle d'un export Orange
    # Money (num_sender/transaction_tag/op_date/nb_trans, ';' comme
    # delimiteur logique -- ici on passe deja des dict, le delimiteur est
    # teste separement dans test_ingestion_parsers.py). Pas de
    # transaction_id ni de statut : doit rester importable.
    lignes = [
        {"num_sender": "C1", "transaction_tag": "CASHOUT", "op_date": "20260220", "montant": "1000000", "nb_trans": "1", "region": "Conakry"},
        {"num_sender": "C1", "transaction_tag": "P2P", "op_date": "20260221", "montant": "30300", "nb_trans": "1", "region": "Conakry"},
        {"num_sender": "C2", "transaction_tag": "CASHIN", "op_date": "20260307", "montant": "85000", "nb_trans": "3", "region": "Boke"},
    ]
    resultat = executer_pipeline(lignes, nom_fichier="base_dataset_OM.csv")
    assert resultat.dataset.statut == StatutImport.VALIDE
    assert len(resultat.dataset.lignes) == 3
    colonnes = set(resultat.dataset.lignes[0].keys())
    assert colonnes == {"client_id", "type_service", "date_transaction", "montant", "nb_transactions_groupees", "region"}
    assert resultat.dataset.lignes[0]["date_transaction"] == "2026-02-20"
    noms_mappes = {r["colonne_originale"]: r["colonne_canonique"] for r in resultat.dataset.rapport_mapping}
    assert noms_mappes["num_sender"] == "client_id"


def test_pipeline_zero_ligne_exploitable_est_invalide_pas_faussement_valide():
    # Regression Phase 12 : schema correct mais 100% des lignes ont un champ
    # requis vide -- un dataset "valide" a 0 client serait trompeur (le
    # bouton Valider serait actif sur un import qui ne produit rien).
    lignes = [
        {"client_id": "C1", "transaction_id": "T1", "montant": "", "statut": "reussie"},
        {"client_id": "C2", "transaction_id": "T2", "montant": "abc", "statut": "reussie"},
    ]
    resultat = executer_pipeline(lignes)
    assert resultat.dataset.statut == StatutImport.INVALIDE
    assert resultat.dataset.lignes == []
    assert resultat.dataset.profil is not None
    assert resultat.dataset.profil.lignes_recues == 2
    assert resultat.dataset.profil.lignes_valides == 0
