from app.domains.orange_money.ingestion.column_mapper import mapper_colonnes, normaliser_nom_colonne


def test_normaliser_nom_colonne():
    assert normaliser_nom_colonne("Client_ID") == "client_id"
    assert normaliser_nom_colonne("Région") == "region"
    assert normaliser_nom_colonne("Date de Transaction") == "date_de_transaction"
    assert normaliser_nom_colonne("MSISDN") == "msisdn"


def test_mapper_colonnes_export_orange_money_reel():
    lignes = [
        {"num_sender": "C1", "transaction_tag": "CASHOUT", "op_date": "20260220", "montant": "1000", "nb_trans": "3", "region": "Conakry"},
    ]
    mappees, rapport = mapper_colonnes(lignes)
    assert mappees[0] == {
        "client_id": "C1", "type_service": "CASHOUT", "date_transaction": "20260220",
        "montant": "1000", "nb_transactions_groupees": "3", "region": "Conakry",
    }
    confiances = {r["colonne_originale"]: r["colonne_canonique"] for r in rapport}
    assert confiances["num_sender"] == "client_id"
    assert confiances["transaction_tag"] == "type_service"
    assert confiances["op_date"] == "date_transaction"


def test_mapper_colonnes_deja_canonique_inchangee():
    lignes = [{"client_id": "C1", "montant": "1000"}]
    mappees, rapport = mapper_colonnes(lignes)
    assert mappees == lignes
    assert all(r["confiance"] == "déjà standard" for r in rapport)


def test_mapper_colonnes_inconnue_est_conservee_pas_supprimee():
    lignes = [{"client_id": "C1", "montant": "1000", "colonne_maison_bizarre": "xyz"}]
    mappees, rapport = mapper_colonnes(lignes)
    assert mappees[0]["colonne_maison_bizarre"] == "xyz"
    assert any(r["colonne_originale"] == "colonne_maison_bizarre" and r["colonne_canonique"] is None for r in rapport)


def test_mapper_colonnes_dataset_vide():
    assert mapper_colonnes([]) == ([], [])


def test_mapper_colonnes_variantes_multiples():
    lignes = [{"customer_id": "C1", "amount": "500", "status": "reussie", "transaction_date": "2026-01-01"}]
    mappees, _ = mapper_colonnes(lignes)
    assert mappees[0] == {"client_id": "C1", "montant": "500", "statut": "reussie", "date_transaction": "2026-01-01"}
