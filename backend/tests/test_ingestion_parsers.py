import math

from app.domains.orange_money.ingestion.parsers import parser_fichier


def test_cellule_montant_vide_devient_none_pas_nan():
    # Regression Phase 12 : sur une colonne numerique (montant), pandas
    # infere un dtype float64. Une cellule vide y devient NaN, et sans
    # conversion explicite en object, NaN survit et casse le JSON en aval
    # (et fausse silencieusement les sommes/moyennes cote agregation).
    csv = b"client_id,transaction_id,montant,statut\nC1,T1,1000,reussie\nC2,T2,,reussie\nC3,T3,N/A,reussie\n"
    lignes = parser_fichier("test.csv", csv)
    assert lignes[0]["montant"] == 1000
    assert lignes[1]["montant"] is None
    assert lignes[2]["montant"] is None


def test_delimiteur_point_virgule_est_detecte_automatiquement():
    # Regression Phase 13 : plusieurs exports Orange Money reels utilisent ';'
    # plutot que ',' -- sans detection, le fichier entier etait lu comme une
    # seule colonne geante (aucune colonne requise reconnue).
    csv = b"client_id;montant;statut\nC1;1000;reussie\nC2;2000;echouee\n"
    lignes = parser_fichier("test.csv", csv)
    assert list(lignes[0].keys()) == ["client_id", "montant", "statut"]
    assert lignes[0]["montant"] == 1000
    assert lignes[1]["statut"] == "echouee"


def test_delimiteur_tabulation_est_detecte_automatiquement():
    csv = b"client_id\tmontant\nC1\t1000\n"
    lignes = parser_fichier("test.csv", csv)
    assert list(lignes[0].keys()) == ["client_id", "montant"]


def test_delimiteur_virgule_reste_supporte():
    csv = b"client_id,montant\nC1,1000\n"
    lignes = parser_fichier("test.csv", csv)
    assert list(lignes[0].keys()) == ["client_id", "montant"]


def test_aucune_valeur_nan_flottante_ne_subsiste():
    csv = b"client_id,transaction_id,montant,statut,date_transaction\nC1,T1,,reussie,\nC2,T2,2000,,2026-01-01\n"
    lignes = parser_fichier("test.csv", csv)
    for ligne in lignes:
        for valeur in ligne.values():
            assert not (isinstance(valeur, float) and math.isnan(valeur))
