from app.domains.orange_money.ingestion.schemas import TypeDataset
from app.domains.orange_money.ingestion.store import DatasetImporte, MagasinDataset, StatutImport


def _dataset(statut=StatutImport.VALIDE):
    return DatasetImporte(type_dataset=TypeDataset.TRANSACTIONS, statut=statut, lignes=[{"a": 1}])


def test_magasin_vide_par_defaut():
    m = MagasinDataset()
    assert m.obtenir_actif() is None
    assert m.obtenir_en_attente() is None


def test_confirmer_bascule_en_attente_vers_actif():
    m = MagasinDataset()
    m.mettre_en_attente(_dataset())
    actif = m.confirmer()
    assert actif is not None
    assert m.obtenir_actif() is actif
    assert m.obtenir_en_attente() is None


def test_confirmer_refuse_un_dataset_invalide():
    m = MagasinDataset()
    m.mettre_en_attente(_dataset(statut=StatutImport.INVALIDE))
    assert m.confirmer() is None
    assert m.obtenir_actif() is None


def test_annuler_attente_ne_touche_pas_actif():
    m = MagasinDataset()
    m.mettre_en_attente(_dataset())
    m.confirmer()
    m.mettre_en_attente(_dataset(statut=StatutImport.INVALIDE))
    m.annuler_attente()
    assert m.obtenir_en_attente() is None
    assert m.obtenir_actif() is not None


def test_supprimer_actif():
    m = MagasinDataset()
    m.mettre_en_attente(_dataset())
    m.confirmer()
    m.supprimer_actif()
    assert m.obtenir_actif() is None
