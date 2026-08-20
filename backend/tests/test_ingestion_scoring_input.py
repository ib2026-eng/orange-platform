from app.domains.orange_money.ingestion.scoring_input import (
    BORNE_MAX_TABLE_SCORING,
    normaliser_montant_pour_scoring,
)


def test_client_le_plus_faible_mappe_pres_de_zero():
    valeurs = sorted([1000, 5000, 20000, 100000, 5_000_000])
    # rang = bisect_right(1000) / 5 = 1/5 = 20% -- le plus faible reste
    # proche du bas de l'echelle, pas exactement 0 (definition rang percentile).
    assert normaliser_montant_pour_scoring(1000, valeurs) == 0.2 * BORNE_MAX_TABLE_SCORING


def test_client_le_plus_eleve_mappe_pres_de_la_borne_max():
    valeurs = [1000, 5000, 20000, 100000, 5_000_000]
    resultat = normaliser_montant_pour_scoring(5_000_000, sorted(valeurs))
    assert resultat == BORNE_MAX_TABLE_SCORING  # rang 5/5 = 100%


def test_rang_intermediaire_proportionnel():
    valeurs = sorted([10, 20, 30, 40])
    # 20 est au rang 2/4 = 50%
    assert normaliser_montant_pour_scoring(20, valeurs) == 0.5 * BORNE_MAX_TABLE_SCORING


def test_liste_vide_retourne_la_valeur_telle_quelle():
    assert normaliser_montant_pour_scoring(12345, []) == 12345


def test_valeur_none_ne_plante_pas():
    assert normaliser_montant_pour_scoring(None, [1, 2, 3]) is None
