from app.domains.orange_money.ingestion.apercu import construire_apercu, detecter_type_colonne


def test_type_detecte_montant_float():
    assert detecter_type_colonne("montant", [1000, 2000]) == "FLOAT"


def test_type_detecte_date():
    assert detecter_type_colonne("date_transaction", ["2026-05-01"]) == "DATE"


def test_type_detecte_category_faible_cardinalite():
    valeurs = ["reussie"] * 8 + ["echouee"] * 2
    assert detecter_type_colonne("statut", valeurs) == "CATEGORY"


def test_type_detecte_string_haute_cardinalite():
    valeurs = [f"C{i}" for i in range(20)]
    assert detecter_type_colonne("client_id", valeurs) == "STRING"


def test_apercu_vide_pour_dataset_vide():
    apercu = construire_apercu([])
    assert apercu == {"colonnes": [], "lignes": []}


def test_apercu_colonnes_et_echantillon():
    lignes = [
        {"client_id": "C1", "montant": 1000, "statut": "reussie"},
        {"client_id": "C2", "montant": None, "statut": "reussie"},
        {"client_id": "C3", "montant": 3000, "statut": None},
    ]
    apercu = construire_apercu(lignes, n=2)
    assert len(apercu["lignes"]) == 2
    colonnes = {c["colonne"]: c for c in apercu["colonnes"]}
    assert colonnes["montant"]["valeurs_manquantes"] == 1
    assert colonnes["montant"]["type_detecte"] == "FLOAT"
    assert colonnes["statut"]["valeurs_manquantes"] == 1
    assert colonnes["client_id"]["exemple"] == "C1"
