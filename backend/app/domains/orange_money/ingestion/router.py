"""Endpoints d'import de dataset -- prefixe /data, entierement separes du
contrat gele (GET /, POST /predire_churn, POST /predire_churn_batch). Aucun
de ces endpoints ne modifie ni ne remplace les routes existantes."""
from fastapi import APIRouter, File, HTTPException, UploadFile

from ....core.config import get_settings
from ..scoring import niveau_risque, score_risque
from .aggregator import (
    agreger_transactions_par_client,
    construire_serie_mensuelle,
    repartition_par_service,
    taux_echec_global,
    taux_echec_par_service,
)
from .apercu import construire_apercu
from .parsers import FormatNonSupporte, parser_fichier
from .pipeline import executer_pipeline
from .schemas import TypeDataset
from .scoring_input import normaliser_montant_pour_scoring
from .store import StatutImport, get_magasin

router = APIRouter(prefix="/data", tags=["ingestion"])


def _serialiser_dataset(dataset) -> dict:
    if dataset is None:
        return None
    profil = None
    if dataset.profil is not None:
        p = dataset.profil
        profil = {
            "lignes_recues": p.lignes_recues,
            "lignes_valides": p.lignes_valides,
            "pct_lignes_valides": p.pct_lignes_valides,
            "doublons": p.doublons,
            "valeurs_manquantes": p.valeurs_manquantes,
            "score_qualite": p.score,
        }
    return {
        "statut": dataset.statut.value,
        "type_dataset": dataset.type_dataset.value if dataset.type_dataset else None,
        "nom_fichier": dataset.nom_fichier,
        "importe_le": dataset.importe_le,
        "colonnes_manquantes": dataset.colonnes_manquantes,
        "nb_erreurs_validation": dataset.nb_erreurs_validation,
        "doublons_retires": dataset.doublons_retires,
        "profil": profil,
        "rapport_mapping": dataset.rapport_mapping,
    }


@router.post("/import")
async def importer_dataset(fichier: UploadFile = File(...)):
    """Parse le fichier et execute le pipeline (validation -> normalisation
    -> deduplication -> profil qualite). Place le resultat "en attente" --
    ne devient le dataset actif qu'apres /data/validate."""
    contenu = await fichier.read()
    try:
        lignes = parser_fichier(fichier.filename, contenu)
    except FormatNonSupporte as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fichier illisible : {e}")

    resultat = executer_pipeline(lignes, nom_fichier=fichier.filename)
    get_magasin().mettre_en_attente(resultat.dataset)

    erreurs_apercu = [
        {"ligne": e.ligne, "colonne": e.colonne, "message": e.message}
        for e in resultat.validation.erreurs[:20]
    ]
    apercu_donnees = (
        construire_apercu(resultat.dataset.lignes)
        if resultat.dataset.statut == StatutImport.VALIDE
        else {"colonnes": [], "lignes": []}
    )

    return {
        "en_attente": _serialiser_dataset(resultat.dataset),
        "pret_a_valider": resultat.dataset.statut == StatutImport.VALIDE,
        "apercu_erreurs": erreurs_apercu,
        "apercu_donnees": apercu_donnees,
    }


@router.post("/validate")
def valider_import():
    """Confirme le dataset en attente -> devient le dataset actif utilise
    par le reste de la plateforme (section 15, bouton "Valider le dataset")."""
    magasin = get_magasin()
    en_attente = magasin.obtenir_en_attente()
    if en_attente is None:
        raise HTTPException(status_code=404, detail="Aucun dataset en attente de validation.")
    if en_attente.statut != StatutImport.VALIDE:
        raise HTTPException(status_code=400, detail="Le dataset en attente contient des erreurs -- ne peut pas être validé.")

    actif = magasin.confirmer()
    return {"actif": _serialiser_dataset(actif)}


@router.post("/cancel")
def annuler_import():
    """Annule le dataset en attente sans toucher au dataset actif (bouton
    "Annuler" de la section 15)."""
    get_magasin().annuler_attente()
    return {"annule": True}


@router.get("/status")
def statut_dataset():
    magasin = get_magasin()
    en_attente = magasin.obtenir_en_attente()
    actif = magasin.obtenir_actif()
    return {
        "source": "importe" if actif is not None else "aucun",
        "actif": _serialiser_dataset(actif),
        "en_attente": _serialiser_dataset(en_attente),
    }


@router.get("/profile")
def profil_dataset():
    actif = get_magasin().obtenir_actif()
    if actif is None or actif.profil is None:
        raise HTTPException(status_code=404, detail="Aucun dataset actif -- importez et validez un dataset d'abord.")
    return _serialiser_dataset(actif)


@router.delete("")
def supprimer_dataset():
    """Supprime le dataset actif (section 49 -- droit à la suppression)."""
    get_magasin().supprimer_actif()
    return {"supprime": True}


@router.get("/clients")
def clients_dataset_actif():
    """Agrege le dataset actif en clients (si transactions/combine) et les
    score via la meme logique que /predire_churn_batch (contrat gele,
    reutilise sans duplication). Source de verite pour toutes les vues
    frontend une fois un dataset importe et validé."""
    actif = get_magasin().obtenir_actif()
    if actif is None:
        raise HTTPException(status_code=404, detail="Aucun dataset actif.")
    if actif.type_dataset == TypeDataset.CLIENTS:
        raise HTTPException(
            status_code=422,
            detail="Le dataset actif ne contient pas de transactions -- aucun score de risque ne peut être calculé.",
        )

    clients_agreges = agreger_transactions_par_client(actif.lignes)
    if not clients_agreges:
        raise HTTPException(
            status_code=422,
            detail="Aucun client exploitable dans le dataset actif (montants manquants ou invalides).",
        )

    settings = get_settings()
    montants_tries = sorted(c["montant_moyen"] for c in clients_agreges)
    resultats = []
    for client in clients_agreges:
        champs_scoring = {k: v for k, v in client.items() if k not in ("id", "region")}
        # Normalise l'ENTREE (pas la table figee, jamais modifiee) par rang
        # percentile dans le dataset actif -- voir scoring_input.py pour le
        # detail du probleme et du correctif.
        champs_scoring["montant_moyen"] = normaliser_montant_pour_scoring(client["montant_moyen"], montants_tries)
        proba = score_risque(champs_scoring, settings.modele_reel_disponible)
        resultats.append({
            **client,
            "probabilite_churn": proba,
            "prediction_churn": int(proba >= 0.5),
            "niveau_risque": niveau_risque(proba),
        })

    return {
        "nb_clients": len(resultats),
        "modele_reel": settings.modele_reel_disponible,
        "resultats": resultats,
    }


@router.get("/timeseries")
def timeseries_dataset_actif():
    """Volume de transactions par mois -- comptage pur depuis date_transaction.
    Ne calcule pas d'evolution du risque de churn (necessiterait plusieurs
    extractions historiques datees, indisponibles -- voir DATA_HONESTY_POLICY.md)."""
    actif = get_magasin().obtenir_actif()
    if actif is None:
        raise HTTPException(status_code=404, detail="Aucun dataset actif.")

    points = construire_serie_mensuelle(actif.lignes)
    if not points:
        raise HTTPException(
            status_code=422,
            detail="Aucune date de transaction exploitable -- impossible de construire une tendance temporelle.",
        )
    return {"points": points}


@router.get("/repartition-services")
def repartition_services_dataset_actif():
    """Repartition des transactions par type_service, et taux d'echec (si le
    vocabulaire de la colonne statut est reconnu -- voir aggregator.py)."""
    actif = get_magasin().obtenir_actif()
    if actif is None:
        raise HTTPException(status_code=404, detail="Aucun dataset actif.")

    repartition = repartition_par_service(actif.lignes)
    if not repartition:
        raise HTTPException(status_code=422, detail="Aucun type de service exploitable dans le dataset actif.")

    return {
        "repartition": repartition,
        "taux_echec_global": taux_echec_global(actif.lignes),
        "taux_echec_par_service": taux_echec_par_service(actif.lignes),
    }
