from app.domains.orange_money.ingestion.profiler import calculer_profil


def test_dataset_parfait_score_100():
    profil = calculer_profil(lignes_recues=1000, lignes_valides=1000, doublons=0, valeurs_manquantes=0)
    assert profil.score == 100
    assert profil.pct_lignes_valides == 100.0


def test_dataset_vide_score_0():
    profil = calculer_profil(lignes_recues=0, lignes_valides=0, doublons=0, valeurs_manquantes=0)
    assert profil.score == 0
    assert profil.lignes_recues == 0


def test_doublons_et_manquants_baissent_le_score():
    parfait = calculer_profil(1000, 1000, 0, 0)
    degrade = calculer_profil(1000, 900, 100, 50)
    assert degrade.score < parfait.score


def test_score_reste_dans_les_bornes_0_100():
    profil = calculer_profil(lignes_recues=100, lignes_valides=10, doublons=90, valeurs_manquantes=90)
    assert 0 <= profil.score <= 100
