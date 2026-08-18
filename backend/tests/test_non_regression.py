"""Non-regression contre orange-money-source/orange_money_deploiement/api_om_churn.py.

Les valeurs attendues dans golden_reference.json ont ete generees en
interrogeant directement la reference (lecture seule, non modifiee). Ce
fichier ne depend plus du depot externe pour s'executer en CI."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
GOLDEN = json.loads((Path(__file__).parent / "golden_reference.json").read_text(encoding="utf-8"))


def test_racine_identique_a_la_reference():
    assert client.get("/").json() == GOLDEN["racine_attendu"]


@pytest.mark.parametrize("cas", GOLDEN["golden_unitaires"], ids=lambda c: str(c["payload"]))
def test_predire_churn_identique_a_la_reference(cas):
    assert client.post("/predire_churn", json=cas["payload"]).json() == cas["attendu"]


def test_predire_churn_batch_identique_a_la_reference():
    r = client.post("/predire_churn_batch", json=GOLDEN["batch_payload"])
    assert r.json() == GOLDEN["batch_attendu"]
