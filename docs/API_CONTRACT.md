# Contrat API — Orange Money (gelé)

Ce contrat est identique à `orange-money-source/orange_money_deploiement/api_om_churn.py`.
Toute évolution (nouveau champ, nouvel endpoint, changement de forme) doit
être documentée ici **avant** d'être codée, et ne doit jamais casser un
consommateur existant du frontend sans version explicite.

Implémentation : `backend/app/domains/orange_money/router.py`.
Non-régression vérifiée par `backend/tests/test_non_regression.py`.

## `GET /`

Réponse `200` :
```json
{
  "message": "API Orange Money Customer Intelligence",
  "statut_modele": "Modèle réel (AUC 0.60, montant_moyen)",
  "documentation": "/docs",
  "endpoints": ["POST /predire_churn", "POST /predire_churn_batch"]
}
```
`statut_modele` vaut `"PLACEHOLDER (règle simple, en attente du modèle réel)"`
si `MODELE_REEL_DISPONIBLE=false`.

## `POST /predire_churn`

**Entrée** (`ClientOM`) :

| Champ | Type | Requis | Défaut | Contrainte |
|---|---|---|---|---|
| `total_transactions` | int | non | 0 | `>= 0` |
| `montant_total` | float | non | 0 | `>= 0` |
| `montant_moyen` | float | **oui** | — | `>= 0` |
| `nb_types_service` | int | non | 0 | `0 <= x <= 15` |
| `jours_inactivite_avant_mars` | float | non | 0 | `>= 0` |

Champ manquant/type invalide → `422` (validation Pydantic).

**Réponse** `200` :
```json
{
  "probabilite_churn": 0.5907,
  "prediction_churn": 1,
  "niveau_risque": "Élevé",
  "modele_reel": true,
  "note_fiabilite": "Signal réel modeste (AUC 0.60) -- ne pas utiliser seul pour des décisions commerciales fermes"
}
```
`note_fiabilite` vaut `"Placeholder -- règle non entraînée"` si le modèle
réel n'est pas disponible.

Erreur de traitement interne → `400` avec `{"detail": "Erreur de traitement : ..."}`.

## `POST /predire_churn_batch`

**Entrée** (`ClientBatchOM`) : `{ "clients": [ { ...champs libres... }, ... ] }`
— les objets clients ne sont pas validés par schéma strict (dicts libres),
identique à la référence.

`clients` vide → `400` avec `{"detail": "Le fichier envoye est vide."}`.

**Réponse** `200` :
```json
{
  "nb_clients": 100,
  "nb_a_risque": 42,
  "modele_reel": true,
  "resultats": [
    { "...champs d'entrée...": "...", "probabilite_churn": 0.42, "prediction_churn": 0, "niveau_risque": "Modéré" }
  ]
}
```

## Seuils de catégorisation (`niveau_risque`)

Identiques côté backend (`scoring.py::niveau_risque`) et côté frontend
(`scoring-fallback.js::categoriserScore`, utilisé uniquement en repli local) :

| Seuil | Catégorie |
|---|---|
| `proba >= 0.6` | Critique |
| `0.35 <= proba < 0.6` | Élevé |
| `0.15 <= proba < 0.35` | Modéré |
| `proba < 0.15` | Faible |

`prediction_churn` = `1` si `proba >= 0.5`, sinon `0`.

**Note historique** : la référence utilisait `'Moyen'` côté JS pour ce
palier, alors que le backend renvoie `'Modéré'` — mismatch corrigé dans
cette plateforme (voir `ARCHITECTURE.md`). Le libellé de référence pour ce
palier est **`Modéré`**.

## CORS

`ALLOWED_ORIGINS` (variable d'env, défaut `*` — identique à la référence).
À restreindre au domaine réel du frontend une fois celui-ci fixé en
production (voir `ARCHITECTURE.md` §Extensibilité).
