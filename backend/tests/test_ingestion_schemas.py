from app.domains.orange_money.ingestion.schemas import TypeDataset, detecter_type_dataset


def test_detecte_transactions():
    colonnes = ["client_id", "transaction_id", "montant", "statut", "ville"]
    assert detecter_type_dataset(colonnes) == TypeDataset.TRANSACTIONS


def test_detecte_clients():
    colonnes = ["client_id", "date_naissance", "age", "region"]
    assert detecter_type_dataset(colonnes) == TypeDataset.CLIENTS


def test_detecte_combine():
    colonnes = ["client_id", "transaction_id", "montant", "statut", "date_naissance", "age"]
    assert detecter_type_dataset(colonnes) == TypeDataset.COMBINE


def test_type_indetermine():
    colonnes = ["foo", "bar"]
    assert detecter_type_dataset(colonnes) is None
