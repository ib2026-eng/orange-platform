import pytest

from app.domains.orange_money.reference_table import TABLE_MONTANT_MOYEN
from app.domains.orange_money.scoring import (
    niveau_risque,
    score_modele_reel,
    score_risque,
    score_risque_placeholder,
)


def test_table_couvre_zero_a_infini_sans_trou():
    assert TABLE_MONTANT_MOYEN[0][0] == 0
    assert TABLE_MONTANT_MOYEN[-1][1] == float("inf")
    for (_, borne_max_precedente, _), (borne_min_suivante, _, _) in zip(TABLE_MONTANT_MOYEN, TABLE_MONTANT_MOYEN[1:]):
        assert borne_max_precedente == borne_min_suivante


@pytest.mark.parametrize("borne_min,borne_max,proba", TABLE_MONTANT_MOYEN)
def test_score_modele_reel_sur_chaque_tranche(borne_min, borne_max, proba):
    assert score_modele_reel(borne_min) == proba
    if borne_max != float("inf"):
        assert score_modele_reel(borne_max - 0.01) == proba


def test_score_modele_reel_au_dela_de_la_derniere_borne():
    assert score_modele_reel(10**12) == TABLE_MONTANT_MOYEN[-1][2]


def test_score_risque_bascule_sur_le_flag_modele_reel():
    row = {"montant_moyen": 980}
    assert score_risque(row, True) == round(score_modele_reel(980), 4)
    assert score_risque(row, False) == score_risque_placeholder(row)


def test_score_risque_placeholder_plafond_haut():
    row = {"jours_inactivite_avant_mars": 1000, "total_transactions": 0, "nb_types_service": 0, "montant_moyen": 0}
    assert score_risque_placeholder(row) == 0.97


def test_score_risque_placeholder_plancher_bas():
    row = {"jours_inactivite_avant_mars": 0, "total_transactions": 1000, "nb_types_service": 1000, "montant_moyen": 10**9}
    assert score_risque_placeholder(row) == 0.01


def test_score_risque_placeholder_champs_absents():
    assert score_risque_placeholder({}) == 0.5


@pytest.mark.parametrize("proba,attendu", [
    (0.0, "Faible"), (0.14, "Faible"),
    (0.15, "Modéré"), (0.34, "Modéré"),
    (0.35, "Élevé"), (0.59, "Élevé"),
    (0.6, "Critique"), (1.0, "Critique"),
])
def test_niveau_risque_seuils(proba, attendu):
    assert niveau_risque(proba) == attendu
