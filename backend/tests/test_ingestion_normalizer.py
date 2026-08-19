from app.domains.orange_money.ingestion.normalizer import normaliser_dataset, normaliser_ligne


def test_normalise_montant_avec_virgule():
    ligne = normaliser_ligne({"montant": "1 234,5".replace(" ", "")})
    assert ligne["montant"] == 1234.5


def test_normalise_date_slash_en_iso():
    ligne = normaliser_ligne({"date_transaction": "05/03/2026"})
    assert ligne["date_transaction"] == "2026-03-05"


def test_normalise_texte_espaces_et_casse():
    ligne = normaliser_ligne({"ville": "  conakry  "})
    assert ligne["ville"] == "Conakry"


def test_ne_touche_pas_un_champ_deja_absent():
    ligne = normaliser_ligne({"client_id": "C1"})
    assert "montant" not in ligne


def test_dataset_retire_les_lignes_entierement_vides():
    lignes = [
        {"client_id": "C1", "montant": "1000"},
        {"client_id": "", "montant": ""},
        {"client_id": "C2", "montant": "2000"},
    ]
    resultat = normaliser_dataset(lignes)
    assert len(resultat) == 2
    assert [l["client_id"] for l in resultat] == ["C1", "C2"]


def test_format_date_non_reconnu_laisse_tel_quel():
    ligne = normaliser_ligne({"date_transaction": "pas-une-date"})
    assert ligne["date_transaction"] == "pas-une-date"
