import io

import pytest
from fastapi.testclient import TestClient

from app.domains.orange_money.ingestion.store import get_magasin
from app.main import app

client = TestClient(app)

CSV_VALIDE = (
    "client_id,transaction_id,montant,statut,date_transaction\n"
    "C1,T1,1000,reussie,2026-05-01\n"
    "C2,T2,2000,reussie,2026-05-02\n"
)
CSV_COLONNE_MANQUANTE = "client_id,transaction_id\nC1,T1\n"  # montant absent (toujours requis)


@pytest.fixture(autouse=True)
def magasin_propre():
    magasin = get_magasin()
    magasin.annuler_attente()
    magasin.supprimer_actif()
    yield
    magasin.annuler_attente()
    magasin.supprimer_actif()


def _upload(contenu: str, nom="test.csv"):
    return client.post("/data/import", files={"fichier": (nom, io.BytesIO(contenu.encode()), "text/csv")})


def test_import_csv_valide_va_en_attente():
    r = _upload(CSV_VALIDE)
    assert r.status_code == 200
    body = r.json()
    assert body["pret_a_valider"] is True
    assert body["en_attente"]["statut"] == "valide"
    assert body["en_attente"]["profil"]["lignes_recues"] == 2
    assert len(body["apercu_donnees"]["lignes"]) == 2
    colonnes_apercu = {c["colonne"] for c in body["apercu_donnees"]["colonnes"]}
    assert {"client_id", "transaction_id", "montant", "statut"}.issubset(colonnes_apercu)


def test_import_colonne_manquante_est_signale_sans_planter():
    r = _upload(CSV_COLONNE_MANQUANTE)
    assert r.status_code == 200
    body = r.json()
    assert body["pret_a_valider"] is False
    assert "montant" in body["en_attente"]["colonnes_manquantes"]


def test_import_format_non_supporte():
    r = client.post("/data/import", files={"fichier": ("test.parquet", io.BytesIO(b"xxx"), "application/octet-stream")})
    assert r.status_code == 400
    assert "parquet" in r.json()["detail"].lower()


def test_status_vide_par_defaut():
    r = client.get("/data/status")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "aucun"
    assert body["actif"] is None


def test_validate_sans_import_prealable_404():
    r = client.post("/data/validate")
    assert r.status_code == 404


def test_flux_complet_import_puis_validate():
    _upload(CSV_VALIDE)
    r = client.post("/data/validate")
    assert r.status_code == 200
    assert r.json()["actif"]["statut"] == "valide"

    assert client.get("/data/status").json()["source"] == "importe"

    r_profile = client.get("/data/profile")
    assert r_profile.status_code == 200
    assert r_profile.json()["profil"]["lignes_recues"] == 2


def test_validate_dataset_invalide_est_refuse():
    _upload(CSV_COLONNE_MANQUANTE)
    r = client.post("/data/validate")
    assert r.status_code == 400


def test_cancel_annule_sans_toucher_au_dataset_actif():
    _upload(CSV_VALIDE)
    client.post("/data/validate")
    _upload(CSV_COLONNE_MANQUANTE)
    r = client.post("/data/cancel")
    assert r.status_code == 200
    body = client.get("/data/status").json()
    assert body["actif"]["statut"] == "valide"
    assert body["en_attente"] is None


def test_delete_supprime_le_dataset_actif():
    _upload(CSV_VALIDE)
    client.post("/data/validate")
    r = client.delete("/data")
    assert r.status_code == 200
    body = client.get("/data/status").json()
    assert body["actif"] is None
    assert body["source"] == "aucun"


def test_endpoints_existants_toujours_fonctionnels_avec_le_nouveau_router():
    assert client.get("/").status_code == 200
    r = client.post("/predire_churn", json={"montant_moyen": 50000})
    assert r.status_code == 200
    assert "probabilite_churn" in r.json()
