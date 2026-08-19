import io

import pytest
from fastapi.testclient import TestClient

from app.domains.orange_money.ingestion.store import get_magasin
from app.main import app

client = TestClient(app)

CSV_TRANSACTIONS = (
    "client_id,transaction_id,montant,statut,date_transaction,type_service,region\n"
    "C1,T1,50000,reussie,2026-01-05,P2P,Conakry\n"
    "C1,T2,60000,echouee,2026-02-10,P2P,Conakry\n"
    "C2,T3,120000,reussie,2026-02-20,Retrait,Kindia\n"
    "C2,T4,130000,reussie,2026-02-25,Rechargement,Kindia\n"
)

CSV_CLIENTS = "client_id,date_naissance,age,region\nC1,1990-01-01,36,Conakry\n"


@pytest.fixture(autouse=True)
def magasin_propre():
    magasin = get_magasin()
    magasin.annuler_attente()
    magasin.supprimer_actif()
    yield
    magasin.annuler_attente()
    magasin.supprimer_actif()


def _importer_et_valider(contenu, nom="test.csv"):
    client.post("/data/import", files={"fichier": (nom, io.BytesIO(contenu.encode()), "text/csv")})
    return client.post("/data/validate")


def test_clients_sans_dataset_actif_404():
    r = client.get("/data/clients")
    assert r.status_code == 404


def test_clients_agrege_et_score_le_dataset_transactions():
    _importer_et_valider(CSV_TRANSACTIONS)
    r = client.get("/data/clients")
    assert r.status_code == 200
    body = r.json()
    assert body["nb_clients"] == 2
    c1 = next(c for c in body["resultats"] if c["id"] == "C1")
    assert c1["total_transactions"] == 2
    assert c1["montant_moyen"] == 55000
    assert "probabilite_churn" in c1
    assert "niveau_risque" in c1


def test_clients_dataset_type_clients_est_rejete_proprement():
    _importer_et_valider(CSV_CLIENTS)
    r = client.get("/data/clients")
    assert r.status_code == 422
    assert "transaction" in r.json()["detail"].lower()


def test_timeseries_sans_dataset_404():
    r = client.get("/data/timeseries")
    assert r.status_code == 404


def test_timeseries_calcule_le_volume_mensuel():
    _importer_et_valider(CSV_TRANSACTIONS)
    r = client.get("/data/timeseries")
    assert r.status_code == 200
    points = r.json()["points"]
    assert points == [
        {"periode": "2026-01", "transactions": 1},
        {"periode": "2026-02", "transactions": 3},
    ]


def test_repartition_services_sans_dataset_404():
    r = client.get("/data/repartition-services")
    assert r.status_code == 404


def test_repartition_services_calculee():
    _importer_et_valider(CSV_TRANSACTIONS)
    r = client.get("/data/repartition-services")
    assert r.status_code == 200
    body = r.json()
    assert body["repartition"]["P2P"] == 2
    assert body["taux_echec_global"] == 25.0  # 1 echec sur 4 statuts reconnus
    assert body["taux_echec_par_service"]["P2P"] == 50.0
