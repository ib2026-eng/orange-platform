"""Garde-fou de non-regression (section 49) : aucune valeur de ligne ne doit
jamais transiter par le logger Python pendant le pipeline d'import. Le code
actuel ne logue rien du tout (audit confirme), donc ce test passe
trivialement aujourd'hui -- son role est de detecter une future regression
(ex. un print()/logging.info(ligne) ajoute par megarde)."""
import io

from fastapi.testclient import TestClient

from app.domains.orange_money.ingestion.store import get_magasin
from app.main import app

client = TestClient(app)

VALEUR_SENSIBLE = "622334455"  # ressemble a un numero de telephone guineen

CSV_AVEC_VALEUR_SENSIBLE = (
    "client_id,transaction_id,montant,statut,date_transaction\n"
    f"{VALEUR_SENSIBLE},T1,1000,reussie,2026-05-01\n"
)


def test_import_ne_logue_aucune_valeur_de_ligne(caplog):
    magasin = get_magasin()
    magasin.annuler_attente()
    magasin.supprimer_actif()

    with caplog.at_level("DEBUG"):
        r = client.post(
            "/data/import",
            files={"fichier": ("test.csv", io.BytesIO(CSV_AVEC_VALEUR_SENSIBLE.encode()), "text/csv")},
        )

    assert r.status_code == 200
    assert VALEUR_SENSIBLE not in caplog.text

    magasin.annuler_attente()
    magasin.supprimer_actif()
