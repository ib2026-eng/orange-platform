from app.domains.orange_money.ingestion.deduplicator import dedupliquer, dedupliquer_dataset
from app.domains.orange_money.ingestion.schemas import TypeDataset


def test_doublons_sont_detectes_et_retires():
    lignes = [
        {"transaction_id": "T1", "montant": 100},
        {"transaction_id": "T2", "montant": 200},
        {"transaction_id": "T1", "montant": 100},  # doublon
    ]
    resultat, doublons = dedupliquer(lignes, "transaction_id")
    assert doublons == 1
    assert len(resultat) == 2
    assert [l["transaction_id"] for l in resultat] == ["T1", "T2"]


def test_aucun_doublon_si_cles_distinctes():
    lignes = [{"transaction_id": f"T{i}"} for i in range(50)]
    resultat, doublons = dedupliquer(lignes, "transaction_id")
    assert doublons == 0
    assert len(resultat) == 50


def test_dedupliquer_dataset_utilise_la_cle_du_type():
    lignes = [{"client_id": "C1"}, {"client_id": "C1"}, {"client_id": "C2"}]
    resultat, doublons = dedupliquer_dataset(lignes, TypeDataset.CLIENTS)
    assert doublons == 1
    assert len(resultat) == 2


def test_dedupliquer_dataset_sans_transaction_id_bascule_sur_cle_composite():
    # Regression Phase 13 : un export pre-agrege (voir column_mapper.py) n'a
    # pas de transaction_id. Sans repli, ligne.get('transaction_id') vaut
    # None pour TOUTES les lignes -> tout apres la premiere serait pris pour
    # un doublon du premier enregistrement (perte quasi totale du dataset).
    lignes = [
        {"client_id": "C1", "type_service": "CASHOUT", "date_transaction": "2026-01-01", "montant": 1000},
        {"client_id": "C1", "type_service": "CASHOUT", "date_transaction": "2026-01-02", "montant": 500},  # meme client/service, date differente
        {"client_id": "C1", "type_service": "CASHOUT", "date_transaction": "2026-01-01", "montant": 1000},  # vrai doublon
        {"client_id": "C2", "type_service": "P2P", "date_transaction": "2026-01-01", "montant": 200},
    ]
    resultat, doublons = dedupliquer_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert doublons == 1
    assert len(resultat) == 3


def test_dedupliquer_dataset_avec_transaction_id_inchange():
    lignes = [
        {"client_id": "C1", "transaction_id": "T1", "montant": 1000},
        {"client_id": "C1", "transaction_id": "T1", "montant": 1000},
    ]
    resultat, doublons = dedupliquer_dataset(lignes, TypeDataset.TRANSACTIONS)
    assert doublons == 1
    assert len(resultat) == 1
