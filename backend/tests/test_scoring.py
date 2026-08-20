import pytest

from app.domains.orange_money.reference_table import AUC_MODELE, VARIABLES_MODELE
from app.domains.orange_money.scoring import (
    niveau_risque,
    score_modele_reel,
    score_risque,
    score_risque_batch,
    score_risque_placeholder,
)


def test_reference_table_documente_le_modele_v1():
    assert VARIABLES_MODELE == ["montant_moyen", "total_transactions"]
    assert AUC_MODELE == 0.6538


def test_score_modele_reel_retourne_une_probabilite_valide():
    proba = score_modele_reel(100000, 20)
    assert 0.0 <= proba <= 1.0


def test_score_modele_reel_est_deterministe():
    assert score_modele_reel(50000, 10) == score_modele_reel(50000, 10)


def test_score_modele_reel_discrimine_reellement():
    # Le modele v1 (XGBoost, 2 variables) doit produire des scores distincts
    # pour des profils clairement differents -- pas un plafond unique comme
    # l'ancienne table v0 sur de gros volumes reels.
    profils = [
        score_modele_reel(0, 0),
        score_modele_reel(980, 5),
        score_modele_reel(100000, 20),
        score_modele_reel(10, 100),
        score_modele_reel(2000000, 50),
    ]
    assert len(set(round(p, 4) for p in profils)) > 1


def test_score_modele_reel_champs_absents_ne_plante_pas():
    assert 0.0 <= score_modele_reel(None, None) <= 1.0


def test_score_risque_bascule_sur_le_flag_modele_reel():
    row = {"montant_moyen": 50000, "total_transactions": 12}
    assert score_risque(row, True) == round(score_modele_reel(50000, 12), 4)
    assert score_risque(row, False) == score_risque_placeholder(row)


def test_score_risque_placeholder_plafond_haut():
    row = {"jours_inactivite_avant_mars": 1000, "total_transactions": 0, "nb_types_service": 0, "montant_moyen": 0}
    assert score_risque_placeholder(row) == 0.97


def test_score_risque_placeholder_plancher_bas():
    row = {"jours_inactivite_avant_mars": 0, "total_transactions": 1000, "nb_types_service": 1000, "montant_moyen": 10**9}
    assert score_risque_placeholder(row) == 0.01


def test_score_risque_placeholder_champs_absents():
    assert score_risque_placeholder({}) == 0.5


def test_score_risque_batch_identique_a_la_boucle_ligne_par_ligne():
    # La version vectorisee (utilisee sur de gros volumes, voir /data/clients
    # et /predire_churn_batch) doit produire exactement les memes resultats
    # que score_risque appele un par un -- juste plus vite.
    rows = [
        {"montant_moyen": 0, "total_transactions": 0},
        {"montant_moyen": 980, "total_transactions": 5},
        {"montant_moyen": 100000, "total_transactions": 20},
        {"montant_moyen": 2000000, "total_transactions": 50},
    ]
    attendu = [score_risque(r, True) for r in rows]
    assert score_risque_batch(rows, True) == attendu


def test_score_risque_batch_placeholder_identique_a_la_boucle():
    rows = [{"jours_inactivite_avant_mars": 10, "total_transactions": 5, "nb_types_service": 2, "montant_moyen": 3000}]
    attendu = [score_risque(r, False) for r in rows]
    assert score_risque_batch(rows, False) == attendu


def test_score_risque_batch_liste_vide():
    assert score_risque_batch([], True) == []


@pytest.mark.parametrize("proba,attendu", [
    (0.0, "Faible"), (0.14, "Faible"),
    (0.15, "Modéré"), (0.34, "Modéré"),
    (0.35, "Élevé"), (0.59, "Élevé"),
    (0.6, "Critique"), (1.0, "Critique"),
])
def test_niveau_risque_seuils(proba, attendu):
    assert niveau_risque(proba) == attendu
