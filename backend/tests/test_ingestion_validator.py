from app.domains.orange_money.ingestion.schemas import TypeDataset
from app.domains.orange_money.ingestion.validator import ligne_est_utilisable, valider_colonnes, valider_dataset

LIGNE_TRANSACTION_VALIDE = {
    "client_id": "C1", "transaction_id": "T1", "montant": "1000",
    "statut": "reussie", "date_transaction": "2026-05-01",
}


def test_fichier_valide_est_accepte():
    lignes = [LIGNE_TRANSACTION_VALIDE, {**LIGNE_TRANSACTION_VALIDE, "transaction_id": "T2"}]
    resultat = valider_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert resultat.valide is True
    assert resultat.nb_erreurs == 0
    assert resultat.colonnes_manquantes == []


def test_fichier_vide_est_refuse():
    resultat = valider_dataset([], TypeDataset.TRANSACTIONS)
    assert resultat.valide is False
    assert "vide" in resultat.erreurs[0].message.lower()


def test_type_indetermine_est_refuse():
    resultat = valider_dataset([{"foo": "bar"}], None)
    assert resultat.valide is False
    assert resultat.type_dataset is None


def test_colonne_manquante_produit_une_erreur_claire():
    # transaction_id/statut ne sont plus requis (Phase 13) ; seul montant
    # (avec client_id) l'est encore pour TRANSACTIONS.
    lignes = [{"client_id": "C1", "transaction_id": "T1"}]  # montant absent
    resultat = valider_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert resultat.valide is False
    assert set(resultat.colonnes_manquantes) == {"montant"}


def test_valider_colonnes_liste_precisement_ce_qui_manque():
    manquantes = valider_colonnes(["client_id"], TypeDataset.TRANSACTIONS)
    assert set(manquantes) == {"montant"}


def test_mauvais_type_montant_est_signale_mais_ne_bloque_pas_le_dataset():
    # Phase 12 : une valeur individuelle invalide n'invalide plus tout le
    # fichier -- seul un schema incomplet (colonne manquante) le fait. La
    # ligne concernee est filtree plus loin dans le pipeline (voir
    # test_ingestion_pipeline.py), pas ici.
    lignes = [{**LIGNE_TRANSACTION_VALIDE, "montant": "pas-un-nombre"}]
    resultat = valider_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert resultat.valide is True
    assert resultat.nb_erreurs == 1
    assert any(e.colonne == "montant" for e in resultat.erreurs)


def test_date_invalide_est_signalee_mais_ne_bloque_pas_le_dataset():
    lignes = [{**LIGNE_TRANSACTION_VALIDE, "date_transaction": "31-31-2026"}]
    resultat = valider_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert resultat.valide is True
    assert resultat.nb_erreurs == 1
    assert any(e.colonne == "date_transaction" for e in resultat.erreurs)


def test_valeur_manquante_sur_champ_requis_est_signalee_mais_ne_bloque_pas_le_dataset():
    lignes = [{**LIGNE_TRANSACTION_VALIDE, "client_id": ""}]
    resultat = valider_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert resultat.valide is True
    assert resultat.nb_erreurs == 1
    assert any(e.colonne == "client_id" for e in resultat.erreurs)


def test_statut_vide_n_est_plus_une_erreur_car_non_requis():
    # Phase 13 : statut n'est plus requis (exports Orange Money pre-agreges
    # sans statut reussite/echec, voir column_mapper.py).
    lignes = [{**LIGNE_TRANSACTION_VALIDE, "statut": ""}]
    resultat = valider_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert resultat.valide is True
    assert resultat.nb_erreurs == 0


def test_gros_dataset_avec_une_poignee_de_lignes_invalides_reste_valide():
    # Reproduit le cas trouve en testant la performance a grande echelle :
    # 100 000 lignes correctes + quelques cellules vides ne doivent plus
    # rejeter tout le fichier.
    lignes = [{**LIGNE_TRANSACTION_VALIDE, "transaction_id": f"T{i}"} for i in range(1000)]
    for i in (10, 250, 999):
        lignes[i] = {**lignes[i], "montant": ""}
    resultat = valider_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert resultat.valide is True
    assert resultat.nb_erreurs == 3


def test_ligne_est_utilisable():
    assert ligne_est_utilisable(LIGNE_TRANSACTION_VALIDE, TypeDataset.TRANSACTIONS) is True
    assert ligne_est_utilisable({**LIGNE_TRANSACTION_VALIDE, "montant": ""}, TypeDataset.TRANSACTIONS) is False
    assert ligne_est_utilisable({**LIGNE_TRANSACTION_VALIDE, "montant": "abc"}, TypeDataset.TRANSACTIONS) is False
    assert ligne_est_utilisable({**LIGNE_TRANSACTION_VALIDE, "client_id": ""}, TypeDataset.TRANSACTIONS) is False
    # statut n'est plus requis (Phase 13) : vide n'exclut plus la ligne.
    assert ligne_est_utilisable({**LIGNE_TRANSACTION_VALIDE, "statut": ""}, TypeDataset.TRANSACTIONS) is True


def test_dataset_volumineux_traite_sans_exploser():
    lignes = [{**LIGNE_TRANSACTION_VALIDE, "transaction_id": f"T{i}"} for i in range(20000)]
    resultat = valider_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert resultat.valide is True
    assert resultat.nb_lignes == 20000


def test_erreurs_detaillees_plafonnees_mais_compte_total_exact():
    lignes = [{**LIGNE_TRANSACTION_VALIDE, "transaction_id": f"T{i}", "montant": "invalide"} for i in range(200)]
    resultat = valider_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert resultat.nb_erreurs == 200
    assert len(resultat.erreurs) == 50  # plafond MAX_ERREURS_DETAILLEES
