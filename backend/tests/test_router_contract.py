from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_racine_expose_le_contrat_attendu():
    r = client.get("/")
    assert r.status_code == 200
    assert set(r.json().keys()) == {"message", "statut_modele", "documentation", "endpoints"}
    assert r.json()["endpoints"] == ["POST /predire_churn", "POST /predire_churn_batch"]


def test_predire_churn_forme_de_reponse():
    r = client.post("/predire_churn", json={"montant_moyen": 50000})
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {
        "probabilite_churn", "prediction_churn", "niveau_risque", "modele_reel", "note_fiabilite",
    }
    assert isinstance(body["probabilite_churn"], float)
    assert body["prediction_churn"] in (0, 1)


def test_predire_churn_montant_moyen_requis():
    r = client.post("/predire_churn", json={})
    assert r.status_code == 422


def test_predire_churn_batch_forme_de_reponse():
    r = client.post("/predire_churn_batch", json={"clients": [{"montant_moyen": 1000}]})
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"nb_clients", "nb_a_risque", "modele_reel", "resultats"}
    assert body["nb_clients"] == 1
    assert "probabilite_churn" in body["resultats"][0]


def test_predire_churn_batch_vide_retourne_400():
    r = client.post("/predire_churn_batch", json={"clients": []})
    assert r.status_code == 400
    assert "vide" in r.json()["detail"].lower()
