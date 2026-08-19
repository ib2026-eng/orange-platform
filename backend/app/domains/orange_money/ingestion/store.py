"""Etat du dataset importe -- memoire process uniquement (Option A retenue
en Phase 0 : pas de base de donnees). Perdu au redemarrage du service, un
seul dataset a la fois. Deux emplacements : un dataset "en attente" (juste
importe, pas encore confirme -- section 15, boutons Annuler/Valider) et un
dataset "actif" (confirme, utilise par le reste de la plateforme)."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from .profiler import ProfilQualite
from .schemas import TypeDataset


class StatutImport(str, Enum):
    VALIDE = "valide"      # pipeline termine sans erreur
    INVALIDE = "invalide"  # pipeline termine avec des erreurs bloquantes


@dataclass
class DatasetImporte:
    type_dataset: Optional[TypeDataset]
    statut: StatutImport
    lignes: List[Dict[str, Any]] = field(default_factory=list)
    profil: Optional[ProfilQualite] = None
    colonnes_manquantes: List[str] = field(default_factory=list)
    nb_erreurs_validation: int = 0
    doublons_retires: int = 0
    importe_le: Optional[str] = None
    nom_fichier: Optional[str] = None
    rapport_mapping: List[Dict[str, Any]] = field(default_factory=list)


class MagasinDataset:
    """Singleton process. Pas thread-safe au sens strict (pas necessaire :
    uvicorn en dev/Render free tier tourne en un seul worker pour ce
    service) -- a revisiter si un jour plusieurs workers sont utilises."""

    def __init__(self):
        self._en_attente: Optional[DatasetImporte] = None
        self._actif: Optional[DatasetImporte] = None

    def mettre_en_attente(self, dataset: DatasetImporte) -> None:
        self._en_attente = dataset

    def obtenir_en_attente(self) -> Optional[DatasetImporte]:
        return self._en_attente

    def confirmer(self) -> Optional[DatasetImporte]:
        """Bascule le dataset en attente vers actif. Ne fait rien si le
        dataset en attente est invalide ou absent."""
        if self._en_attente is None or self._en_attente.statut != StatutImport.VALIDE:
            return None
        self._actif = self._en_attente
        self._en_attente = None
        return self._actif

    def annuler_attente(self) -> None:
        self._en_attente = None

    def obtenir_actif(self) -> Optional[DatasetImporte]:
        return self._actif

    def supprimer_actif(self) -> None:
        self._actif = None


_magasin = MagasinDataset()


def get_magasin() -> MagasinDataset:
    return _magasin
