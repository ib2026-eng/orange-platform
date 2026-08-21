"""Agrege un dataset transactions (ou combine) en features client-level
compatibles avec le contrat de scoring existant (ClientOM), et construit une
serie temporelle du volume de transactions. Ne fabrique aucune valeur : un
client sans montant exploitable, ou une metrique sans champ source, sont
explicitement ecartes plutot que devines.

Semantique de `montant` (confirmee) : montant d'UNE transaction representative
du groupe (pas un total de groupe). Le volume financier reel d'une ligne
pre-agregee est donc montant * nb_transactions_groupees -- voir
_poids_transactions et son usage dans agreger_transactions_par_client.

Vocabulaire d'echec documente (pas invente a la volee) : une transaction est
consideree en echec si son champ `statut` correspond a l'une des valeurs
listees dans STATUTS_ECHEC_CONNUS (comparaison insensible a la casse). Si
aucune valeur du dataset ne correspond a ce vocabulaire connu, le taux
d'echec est juge indisponible plutot que suppose nul -- voir
docs/DATA_HONESTY_POLICY.md."""
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

CHAMP_CLIENT = "client_id"
CHAMP_MONTANT = "montant"
CHAMP_TYPE_SERVICE = "type_service"
CHAMP_DATE = "date_transaction"
CHAMP_REGION = "region"
CHAMP_STATUT = "statut"
CHAMP_NB_GROUPEES = "nb_transactions_groupees"

FORMATS_DATE = ["%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"]

STATUTS_ECHEC_CONNUS = {
    "echec", "echouee", "echoue", "failed", "failure", "rejete", "rejetee",
    "annulee", "annule", "refuse", "refusee", "error", "erreur",
}
STATUTS_REUSSITE_CONNUS = {
    "reussie", "reussi", "success", "succes", "ok", "valide", "validee", "completed",
}


def _parser_date(valeur: Any) -> Optional[datetime]:
    if valeur is None or valeur == "":
        return None
    texte = str(valeur).strip()
    for fmt in FORMATS_DATE:
        try:
            return datetime.strptime(texte, fmt)
        except ValueError:
            continue
    return None


def _montant_valide(valeur: Any) -> Optional[float]:
    if valeur is None or valeur == "":
        return None
    try:
        return float(str(valeur).replace(",", "."))
    except ValueError:
        return None


def _poids_transactions(ligne: Dict[str, Any]) -> int:
    """Nombre reel de transactions representees par une ligne. Sur un export
    pre-agrege (nb_transactions_groupees present), une ligne peut representer
    plusieurs transactions -- la compter comme 1 sous-estimerait fortement le
    volume reel. Sur un export atomique classique (1 ligne = 1 transaction,
    pas de colonne nb_transactions_groupees), repli sur 1 -- comportement
    inchange pour les datasets deja geres avant cette fonctionnalite."""
    poids = _montant_valide(ligne.get(CHAMP_NB_GROUPEES))
    return int(poids) if poids and poids > 0 else 1


def agreger_transactions_par_client(lignes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Regroupe des lignes de transactions par client_id. Un client est
    exclu du resultat s'il n'a aucun montant exploitable -- le scoring en a
    besoin, aucune valeur de repli n'est inventee."""
    par_client: Dict[Any, List[Dict[str, Any]]] = defaultdict(list)
    for ligne in lignes:
        cid = ligne.get(CHAMP_CLIENT)
        if cid is None or cid == "":
            continue
        par_client[cid].append(ligne)

    toutes_dates = [d for l in lignes if (d := _parser_date(l.get(CHAMP_DATE)))]
    date_reference = max(toutes_dates) if toutes_dates else None

    resultats = []
    for cid, transactions in par_client.items():
        # Semantique confirmee : `montant` est le montant d'UNE transaction
        # representative du groupe, pas un total de groupe. Le volume financier
        # reel d'une ligne est donc montant * nb_transactions_groupees (poids),
        # pas montant seul. montant_total = somme des volumes de groupe ;
        # montant_moyen = volume total / nombre reel de transactions (moyenne
        # ponderee, pas une simple moyenne arithmetique des montants de ligne).
        montants_ponderes = [
            (m, _poids_transactions(t)) for t in transactions
            if (m := _montant_valide(t.get(CHAMP_MONTANT))) is not None
        ]
        if not montants_ponderes:
            continue

        montant_total = sum(m * poids for m, poids in montants_ponderes)
        nb_transactions_reelles = sum(poids for _, poids in montants_ponderes)
        montant_moyen = montant_total / nb_transactions_reelles
        types_service = {t.get(CHAMP_TYPE_SERVICE) for t in transactions if t.get(CHAMP_TYPE_SERVICE)}
        region = next((t.get(CHAMP_REGION) for t in transactions if t.get(CHAMP_REGION)), None)

        client = {
            "id": str(cid),
            "region": region or "Non renseignée",
            "total_transactions": nb_transactions_reelles,
            "montant_total": montant_total,
            "montant_moyen": montant_moyen,
            "nb_types_service": len(types_service),
            "services_utilises": sorted(types_service),
            # None si le vocabulaire de `statut` n'est pas reconnu pour ce
            # client -- jamais suppose a 0% (voir _taux_echec).
            "taux_echec_client": _taux_echec(transactions, filtre=lambda _l: True),
        }

        dates_client = [d for t in transactions if (d := _parser_date(t.get(CHAMP_DATE)))]
        if dates_client and date_reference:
            client["jours_inactivite_avant_mars"] = (date_reference - max(dates_client)).days

        resultats.append(client)

    return resultats


def construire_serie_mensuelle(lignes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Volume de transactions par mois. Pondere par nb_transactions_groupees
    quand present (export pre-agrege) -- sinon chaque ligne compte pour 1
    (comportement inchange). Retourne [] si date_transaction est
    absent/illisible partout."""
    par_mois: Dict[str, int] = defaultdict(int)
    for ligne in lignes:
        date = _parser_date(ligne.get(CHAMP_DATE))
        if date is None:
            continue
        par_mois[date.strftime("%Y-%m")] += _poids_transactions(ligne)

    return [{"periode": cle, "transactions": par_mois[cle]} for cle in sorted(par_mois.keys())]


def taux_echec_global(lignes: List[Dict[str, Any]]) -> Optional[float]:
    """Pourcentage de transactions en echec, uniquement si le vocabulaire de
    la colonne statut est reconnu (voir STATUTS_ECHEC_CONNUS/REUSSITE_CONNUS).
    None si indetermine -- ne jamais supposer 0%."""
    return _taux_echec(lignes, filtre=lambda _l: True)


def taux_echec_par_service(lignes: List[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    services = {l.get(CHAMP_TYPE_SERVICE) for l in lignes if l.get(CHAMP_TYPE_SERVICE)}
    return {
        service: _taux_echec(lignes, filtre=lambda l, s=service: l.get(CHAMP_TYPE_SERVICE) == s)
        for service in services
    }


def _taux_echec(lignes, filtre) -> Optional[float]:
    sous_ensemble = [l for l in lignes if filtre(l)]
    reconnus = [
        l for l in sous_ensemble
        if str(l.get(CHAMP_STATUT, "")).strip().lower() in (STATUTS_ECHEC_CONNUS | STATUTS_REUSSITE_CONNUS)
    ]
    if not reconnus:
        return None
    poids_total = sum(_poids_transactions(l) for l in reconnus)
    poids_echecs = sum(_poids_transactions(l) for l in reconnus if str(l.get(CHAMP_STATUT, "")).strip().lower() in STATUTS_ECHEC_CONNUS)
    return round(100 * poids_echecs / poids_total, 1)


def repartition_par_service(lignes: List[Dict[str, Any]]) -> Dict[str, int]:
    """Nombre de transactions par type_service, pondere par
    nb_transactions_groupees quand present (voir construire_serie_mensuelle)."""
    compte: Dict[str, int] = defaultdict(int)
    for ligne in lignes:
        service = ligne.get(CHAMP_TYPE_SERVICE)
        if service:
            compte[service] += _poids_transactions(ligne)
    return dict(compte)
