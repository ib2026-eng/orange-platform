from typing import Any, Dict, List

from pydantic import BaseModel, Field

# Colonnes attendues par le modele -- reprises telles quelles de la reference
# (declarees mais non utilisees dans la logique, a titre documentaire).
COLONNES_MODELE = [
    'total_transactions', 'montant_total', 'montant_moyen',
    'nb_types_service', 'jours_inactivite_avant_mars',
]


class ClientOM(BaseModel):
    """Profil comportemental agrege d'un client (Customer 360)."""
    total_transactions: int = Field(0, ge=0, examples=[18])
    montant_total: float = Field(0, ge=0, examples=[2500000])
    montant_moyen: float = Field(..., ge=0, examples=[138000])
    nb_types_service: int = Field(0, ge=0, le=15, examples=[3])
    jours_inactivite_avant_mars: float = Field(0, ge=0, examples=[8])


class ClientBatchOM(BaseModel):
    clients: List[Dict[str, Any]]
