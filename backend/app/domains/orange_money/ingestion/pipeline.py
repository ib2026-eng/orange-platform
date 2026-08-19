"""Orchestration du pipeline d'import :
UPLOAD -> DETECTION -> VALIDATION -> NORMALISATION -> DEDUPLICATION ->
QUALITY CHECK -> ANALYTICS DATASET (section 12).

Chaque etape est deleguee a son module dedie (validator/normalizer/
deduplicator/profiler) ; ce fichier ne fait qu'orchestrer, il ne contient
aucune regle metier propre."""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .column_mapper import mapper_colonnes
from .deduplicator import dedupliquer_dataset
from .normalizer import normaliser_dataset
from .profiler import calculer_profil
from .schemas import detecter_type_dataset
from .store import DatasetImporte, StatutImport
from .validator import ResultatValidation, ligne_est_utilisable, valider_dataset


@dataclass
class ResultatPipeline:
    dataset: DatasetImporte
    validation: ResultatValidation


def executer_pipeline(lignes: List[Dict[str, Any]], nom_fichier: Optional[str] = None) -> ResultatPipeline:
    # Mapping des noms de colonnes reels (num_sender, transaction_tag,
    # op_date...) vers le schema canonique AVANT toute detection/validation --
    # le reste du pipeline ne connait que les noms canoniques. Transparent :
    # rapport_mapping expose chaque colonne d'origine et sa correspondance
    # (ou None) au frontend, jamais un mapping silencieux.
    lignes, rapport_mapping = mapper_colonnes(lignes)

    type_dataset = detecter_type_dataset(lignes[0].keys()) if lignes else None
    validation = valider_dataset(lignes, type_dataset)
    importe_le = datetime.now(timezone.utc).isoformat()

    if not validation.valide:
        dataset = DatasetImporte(
            type_dataset=type_dataset,
            statut=StatutImport.INVALIDE,
            lignes=[],
            colonnes_manquantes=validation.colonnes_manquantes,
            nb_erreurs_validation=validation.nb_erreurs,
            importe_le=importe_le,
            nom_fichier=nom_fichier,
            rapport_mapping=rapport_mapping,
        )
        return ResultatPipeline(dataset=dataset, validation=validation)

    # Filtre les lignes individuellement inutilisables (champ requis manquant
    # ou montant non numerique) -- ne bloque plus tout le dataset (voir
    # docstring du module et validator.py). Le nombre de lignes ecartees ici
    # alimente le score qualite via lignes_recues - lignes_valides.
    utilisables = [ligne for ligne in lignes if ligne_est_utilisable(ligne, type_dataset)]

    if not utilisables:
        # Schema correct mais aucune ligne exploitable (ex: champ requis vide
        # sur 100% des lignes) -- un dataset "valide" a 0 client serait trompeur
        # (bouton Valider actif sur un import qui ne produirait rien). Traite
        # comme invalide, avec le profil qualite pour expliquer pourquoi.
        dataset = DatasetImporte(
            type_dataset=type_dataset,
            statut=StatutImport.INVALIDE,
            lignes=[],
            profil=calculer_profil(lignes_recues=len(lignes), lignes_valides=0, doublons=0, valeurs_manquantes=0),
            nb_erreurs_validation=validation.nb_erreurs,
            importe_le=importe_le,
            nom_fichier=nom_fichier,
            rapport_mapping=rapport_mapping,
        )
        return ResultatPipeline(dataset=dataset, validation=validation)

    normalisees = normaliser_dataset(utilisables)
    dedupliquees, doublons = dedupliquer_dataset(normalisees, type_dataset)
    valeurs_manquantes = _compter_valeurs_manquantes(dedupliquees)

    profil = calculer_profil(
        lignes_recues=len(lignes),
        lignes_valides=len(dedupliquees),
        doublons=doublons,
        valeurs_manquantes=valeurs_manquantes,
    )

    dataset = DatasetImporte(
        type_dataset=type_dataset,
        statut=StatutImport.VALIDE,
        lignes=dedupliquees,
        profil=profil,
        nb_erreurs_validation=validation.nb_erreurs,
        doublons_retires=doublons,
        importe_le=importe_le,
        nom_fichier=nom_fichier,
        rapport_mapping=rapport_mapping,
    )
    return ResultatPipeline(dataset=dataset, validation=validation)


def _compter_valeurs_manquantes(lignes: List[Dict[str, Any]]) -> int:
    return sum(
        1 for ligne in lignes for v in ligne.values()
        if v is None or (isinstance(v, str) and v.strip() == "")
    )
