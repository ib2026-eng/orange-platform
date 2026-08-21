from app.domains.orange_money.ingestion.aggregator import (
    agreger_transactions_par_client,
    construire_serie_mensuelle,
    repartition_par_service,
    taux_echec_global,
    taux_echec_par_service,
)

LIGNES = [
    {"client_id": "C1", "montant": "1000", "type_service": "P2P", "statut": "reussie", "date_transaction": "2026-01-05", "region": "Conakry"},
    {"client_id": "C1", "montant": "2000", "type_service": "P2P", "statut": "echouee", "date_transaction": "2026-02-10", "region": "Conakry"},
    {"client_id": "C2", "montant": "500", "type_service": "Retrait", "statut": "reussie", "date_transaction": "2026-02-20", "region": "Kindia"},
]


def test_agregation_calcule_les_features_client():
    resultats = agreger_transactions_par_client(LIGNES)
    c1 = next(c for c in resultats if c["id"] == "C1")
    assert c1["total_transactions"] == 2
    assert c1["montant_total"] == 3000
    assert c1["montant_moyen"] == 1500
    assert c1["nb_types_service"] == 1
    assert c1["region"] == "Conakry"
    assert c1["services_utilises"] == ["P2P"]


def test_agregation_expose_le_taux_echec_par_client():
    resultats = agreger_transactions_par_client(LIGNES)
    c1 = next(c for c in resultats if c["id"] == "C1")
    c2 = next(c for c in resultats if c["id"] == "C2")
    assert c1["taux_echec_client"] == 50.0  # 1 echec sur 2 (reussie, echouee)
    assert c2["taux_echec_client"] == 0.0  # 1 reussie sur 1


def test_agregation_taux_echec_client_indisponible_si_statut_absent():
    lignes = [{"client_id": "C5", "montant": "1000", "date_transaction": "2026-01-01"}]
    resultats = agreger_transactions_par_client(lignes)
    assert resultats[0]["taux_echec_client"] is None


def test_agregation_expose_la_liste_triee_des_services_utilises():
    lignes = [
        {"client_id": "C9", "montant": "1000", "type_service": "Cashout", "date_transaction": "2026-01-01"},
        {"client_id": "C9", "montant": "2000", "type_service": "Paiement Marchand", "date_transaction": "2026-01-02"},
        {"client_id": "C9", "montant": "3000", "type_service": "Cashout", "date_transaction": "2026-01-03"},
    ]
    resultats = agreger_transactions_par_client(lignes)
    assert resultats[0]["services_utilises"] == ["Cashout", "Paiement Marchand"]


def test_agregation_calcule_la_recence_par_rapport_a_la_date_max_du_dataset():
    resultats = agreger_transactions_par_client(LIGNES)
    c1 = next(c for c in resultats if c["id"] == "C1")
    c2 = next(c for c in resultats if c["id"] == "C2")
    # date de reference = max(dataset) = 2026-02-20 ; derniere transaction de C1 = 2026-02-10 -> 10 jours
    assert c1["jours_inactivite_avant_mars"] == 10
    assert c2["jours_inactivite_avant_mars"] == 0


def test_agregation_exclut_un_client_sans_montant_exploitable():
    lignes = [{"client_id": "C3", "montant": "invalide", "type_service": "P2P"}]
    resultats = agreger_transactions_par_client(lignes)
    assert resultats == []


def test_agregation_dataset_vide():
    assert agreger_transactions_par_client([]) == []


def test_serie_mensuelle_compte_par_mois():
    points = construire_serie_mensuelle(LIGNES)
    assert points == [
        {"periode": "2026-01", "transactions": 1},
        {"periode": "2026-02", "transactions": 2},
    ]


def test_serie_mensuelle_vide_si_aucune_date():
    lignes = [{"client_id": "C1", "montant": "1000"}]
    assert construire_serie_mensuelle(lignes) == []


def test_taux_echec_reconnait_le_vocabulaire_documente():
    assert taux_echec_global(LIGNES) == 33.3  # 1 echec sur 3 statuts reconnus (reussie, echouee, reussie)


def test_taux_echec_indisponible_si_vocabulaire_non_reconnu():
    lignes = [{"statut": "XYZ123"}, {"statut": "abc"}]
    assert taux_echec_global(lignes) is None


def test_taux_echec_par_service():
    resultat = taux_echec_par_service(LIGNES)
    assert resultat["P2P"] == 50.0
    assert resultat["Retrait"] == 0.0


def test_repartition_par_service():
    assert repartition_par_service(LIGNES) == {"P2P": 2, "Retrait": 1}


# --- Dataset pre-agrege (nb_transactions_groupees present, Phase 13) ---

LIGNES_PREAGREGEES = [
    {"client_id": "C1", "montant": "9000", "nb_transactions_groupees": "3", "type_service": "CASHOUT", "date_transaction": "2026-01-05"},
    {"client_id": "C1", "montant": "5000", "nb_transactions_groupees": "1", "type_service": "P2P", "date_transaction": "2026-02-10"},
]


def test_agregation_ponderee_par_nb_transactions_groupees():
    # Semantique confirmee : `montant` = montant d'UNE transaction
    # representative du groupe. Volume reel de la ligne = montant * nb_trans.
    # Ligne 1 : 9000 * 3 = 27000 ; ligne 2 : 5000 * 1 = 5000 -> total 32000.
    resultats = agreger_transactions_par_client(LIGNES_PREAGREGEES)
    c1 = next(c for c in resultats if c["id"] == "C1")
    assert c1["total_transactions"] == 4  # 3 + 1, pas 2 (nombre de lignes)
    assert c1["montant_total"] == 32000  # (9000*3) + (5000*1), pas 9000+5000
    assert c1["montant_moyen"] == 8000  # 32000 / 4


def test_volume_financier_est_montant_fois_nb_trans():
    # Test dedie, cas simple : un seul client, une seule ligne. Verifie
    # explicitement volume = montant * nb_trans, pas juste montant.
    lignes = [{"client_id": "C9", "montant": "1000", "nb_transactions_groupees": "50", "date_transaction": "2026-01-01"}]
    resultats = agreger_transactions_par_client(lignes)
    c9 = resultats[0]
    assert c9["montant_total"] == 50000  # 1000 * 50, pas 1000
    assert c9["total_transactions"] == 50
    assert c9["montant_moyen"] == 1000  # 50000 / 50 = le montant representatif lui-meme


def test_volume_financier_avec_poids_meles_pre_agrege_et_atomique():
    # Un client avec un melange de lignes pre-agregees (nb_trans>1) et de
    # lignes atomiques (nb_trans absent -> poids 1) : chaque ligne pesee
    # individuellement, pas une moyenne uniforme.
    lignes = [
        {"client_id": "C1", "montant": "2000", "nb_transactions_groupees": "10", "date_transaction": "2026-01-01"},
        {"client_id": "C1", "montant": "500", "date_transaction": "2026-01-02"},  # atomique, poids 1
    ]
    resultats = agreger_transactions_par_client(lignes)
    c1 = resultats[0]
    assert c1["total_transactions"] == 11  # 10 + 1
    assert c1["montant_total"] == 20500  # (2000*10) + (500*1)
    assert round(c1["montant_moyen"], 2) == round(20500 / 11, 2)


def test_agregation_sans_nb_trans_reste_inchangee():
    # Non-regression : un dataset atomique classique (1 ligne = 1 transaction,
    # pas de colonne nb_transactions_groupees) doit se comporter exactement
    # comme avant cette fonctionnalite.
    resultats = agreger_transactions_par_client(LIGNES)
    c1 = next(c for c in resultats if c["id"] == "C1")
    assert c1["total_transactions"] == 2
    assert c1["montant_moyen"] == 1500


def test_serie_mensuelle_ponderee_par_nb_transactions_groupees():
    points = construire_serie_mensuelle(LIGNES_PREAGREGEES)
    assert points == [
        {"periode": "2026-01", "transactions": 3},
        {"periode": "2026-02", "transactions": 1},
    ]


def test_repartition_par_service_ponderee():
    assert repartition_par_service(LIGNES_PREAGREGEES) == {"CASHOUT": 3, "P2P": 1}
