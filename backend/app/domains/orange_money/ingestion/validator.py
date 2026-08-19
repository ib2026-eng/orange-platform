"""Validation d'un dataset importe -- colonnes requises et types de champs
connus. Opere sur des lignes deja parsees (list[dict]), independamment du
format source (CSV/XLSX/Parquet) : le parsing fichier est une preoccupation
separee (couche API).

Distinction importante (Phase 12, corrige une regression de production
decouverte en testant de gros volumes) : une colonne REQUISE totalement
absente du fichier est une erreur de schema, bloquante (`valide=False`).
Une valeur individuelle manquante ou invalide sur une ligne par ailleurs
correcte n'est PAS bloquante pour le dataset entier -- cette ligne est
simplement ecartee lors de la normalisation (voir pipeline.py), et
comptabilisee dans le score qualite. Un fichier de 100 000 lignes avec une
poignee de cellules vides doit rester important, pas rejete en bloc."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from .schemas import COLONNES_REQUISES, TypeDataset

# Nombre maximum d'erreurs detaillees conservees -- au-dela, seul le compte
# total est garde, pour rester raisonnable sur un dataset volumineux.
MAX_ERREURS_DETAILLEES = 50

FORMATS_DATE_ACCEPTES = ["%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y%m%d"]

# nb_transactions_groupees : present sur les exports pre-agreges (une ligne =
# plusieurs transactions regroupees par client/service/date, voir
# column_mapper.py) -- champ numerique comme montant, mais un compte, pas une
# somme d'argent.
CHAMPS_NUMERIQUES = {"montant", "nb_transactions_groupees"}
CHAMPS_DATE = {"date_transaction", "date_souscription", "date_naissance"}


@dataclass
class ErreurValidation:
    ligne: Optional[int]
    colonne: Optional[str]
    message: str


@dataclass
class ResultatValidation:
    valide: bool  # False uniquement si le schema est inutilisable (colonnes manquantes, type indetermine, fichier vide)
    type_dataset: Optional[TypeDataset]
    colonnes_manquantes: List[str] = field(default_factory=list)
    nb_lignes: int = 0
    nb_erreurs: int = 0  # nombre de lignes ecartees pour probleme de donnees (non bloquant)
    erreurs: List[ErreurValidation] = field(default_factory=list)


def _est_vide(valeur: Any) -> bool:
    return valeur is None or (isinstance(valeur, str) and valeur.strip() == "")


def _date_valide(valeur: Any) -> bool:
    if _est_vide(valeur):
        return True  # champ optionnel absent -- pas une erreur de format
    texte = str(valeur).strip()
    for fmt in FORMATS_DATE_ACCEPTES:
        try:
            datetime.strptime(texte, fmt)
            return True
        except ValueError:
            continue
    return False


def _montant_valide(valeur: Any) -> bool:
    if _est_vide(valeur):
        return True
    try:
        float(str(valeur).replace(",", "."))
        return True
    except ValueError:
        return False


def valider_colonnes(colonnes_presentes, type_dataset: TypeDataset) -> List[str]:
    """Retourne la liste des colonnes requises absentes (vide si tout est la)."""
    requises = COLONNES_REQUISES[type_dataset]
    presentes = set(colonnes_presentes)
    return [c for c in requises if c not in presentes]


def ligne_est_utilisable(ligne: Dict[str, Any], type_dataset: TypeDataset) -> bool:
    """Une ligne est utilisable si tous ses champs requis sont presents et
    valides. Utilise par pipeline.py pour filtrer avant normalisation --
    une ligne non utilisable est ecartee, pas fatale pour le dataset."""
    for champ in COLONNES_REQUISES[type_dataset]:
        if _est_vide(ligne.get(champ)):
            return False
    if "montant" in ligne and not _montant_valide(ligne.get("montant")):
        return False
    return True


def valider_dataset(lignes: List[Dict[str, Any]], type_dataset: Optional[TypeDataset]) -> ResultatValidation:
    """Valide le SCHEMA d'un dataset type (colonnes requises presentes).
    Un dataset vide ou de type indetermine est rejete immediatement. Les
    problemes ligne par ligne sont comptabilises (erreurs/nb_erreurs) pour
    information et pour le score qualite, mais ne changent pas `valide`."""
    if not lignes:
        return ResultatValidation(
            valide=False,
            type_dataset=type_dataset,
            erreurs=[ErreurValidation(ligne=None, colonne=None, message="Le fichier envoyé est vide.")],
        )

    if type_dataset is None:
        return ResultatValidation(
            valide=False,
            type_dataset=None,
            erreurs=[ErreurValidation(
                ligne=None, colonne=None,
                message="Type de dataset indéterminé -- aucune combinaison de colonnes requises reconnue.",
            )],
        )

    colonnes_presentes = lignes[0].keys()
    colonnes_manquantes = valider_colonnes(colonnes_presentes, type_dataset)

    erreurs: List[ErreurValidation] = []
    nb_erreurs_total = 0
    if not colonnes_manquantes:
        for i, ligne in enumerate(lignes):
            ligne_a_une_erreur = False
            for champ in CHAMPS_NUMERIQUES & ligne.keys():
                if not _montant_valide(ligne[champ]):
                    ligne_a_une_erreur = True
                    if len(erreurs) < MAX_ERREURS_DETAILLEES:
                        erreurs.append(ErreurValidation(ligne=i, colonne=champ, message=f"Valeur non numérique : {ligne[champ]!r}"))
            for champ in CHAMPS_DATE & ligne.keys():
                if not _date_valide(ligne[champ]):
                    ligne_a_une_erreur = True
                    if len(erreurs) < MAX_ERREURS_DETAILLEES:
                        erreurs.append(ErreurValidation(ligne=i, colonne=champ, message=f"Date invalide : {ligne[champ]!r}"))
            for champ in COLONNES_REQUISES[type_dataset]:
                if _est_vide(ligne.get(champ)):
                    ligne_a_une_erreur = True
                    if len(erreurs) < MAX_ERREURS_DETAILLEES:
                        erreurs.append(ErreurValidation(ligne=i, colonne=champ, message="Valeur manquante sur un champ requis"))
            if ligne_a_une_erreur:
                nb_erreurs_total += 1

    return ResultatValidation(
        valide=(not colonnes_manquantes),
        type_dataset=type_dataset,
        colonnes_manquantes=colonnes_manquantes,
        nb_lignes=len(lignes),
        nb_erreurs=nb_erreurs_total,
        erreurs=erreurs,
    )
