"""Profil qualite d'un dataset importe -- statistiques et score transparent.

Le score n'est PAS un indicateur statistiquement optimise ni issu d'un
modele : c'est une regle ponderee simple et documentee, dans le meme esprit
que score_risque_placeholder (voir scoring.py) -- transparente plutot que
pretendument optimale. Voir docs/DATA_HONESTY_POLICY.md."""
from dataclasses import dataclass


@dataclass
class ProfilQualite:
    lignes_recues: int
    lignes_valides: int
    pct_lignes_valides: float
    doublons: int
    valeurs_manquantes: int
    score: int  # 0-100


def calculer_profil(
    lignes_recues: int,
    lignes_valides: int,
    doublons: int,
    valeurs_manquantes: int,
) -> ProfilQualite:
    if lignes_recues == 0:
        return ProfilQualite(
            lignes_recues=0, lignes_valides=0, pct_lignes_valides=0.0,
            doublons=0, valeurs_manquantes=0, score=0,
        )

    pct_lignes_valides = round(100 * lignes_valides / lignes_recues, 1)

    # Regle transparente : part de la note sur la validite des lignes,
    # penalites plafonnees pour les doublons et les valeurs manquantes afin
    # qu'un dataset par ailleurs propre ne s'effondre pas sur un seul defaut.
    penalite_doublons = min(doublons / lignes_recues, 0.3) * 100 * 0.3
    base_manquants = max(lignes_valides, 1)
    penalite_manquants = min(valeurs_manquantes / base_manquants, 0.3) * 100 * 0.3

    score = round(max(0.0, min(100.0, pct_lignes_valides - penalite_doublons - penalite_manquants)))

    return ProfilQualite(
        lignes_recues=lignes_recues,
        lignes_valides=lignes_valides,
        pct_lignes_valides=pct_lignes_valides,
        doublons=doublons,
        valeurs_manquantes=valeurs_manquantes,
        score=score,
    )
