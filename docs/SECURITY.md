# Sécurité — données personnelles et journalisation

## Journalisation

**Aucune ligne de dataset importé n'est journalisée.** Audit du code (`backend/app/`) :
aucun appel `print()` ou `logging.*` n'existe dans le pipeline d'ingestion
(`validator.py`, `normalizer.py`, `deduplicator.py`, `profiler.py`,
`pipeline.py`, `router.py`). Les seuls logs produits sont ceux d'uvicorn
(méthode HTTP, chemin, code de statut) — jamais le corps de la requête ni
le contenu d'un fichier importé.

Garde-fou de non-régression : `backend/tests/test_ingestion_no_pii_logging.py`
importe un fichier contenant une valeur ressemblant à un numéro de
téléphone et vérifie qu'elle n'apparaît dans aucun log capturé. Si un futur
changement introduit un `print()`/`logging.info()` sur une ligne de
données, ce test échoue.

## Suppression du dataset importé

Deux mécanismes, déjà en place depuis la Phase 2 :

- `POST /data/cancel` — annule un dataset en attente (importé mais pas
  encore validé), sans toucher au dataset actif.
- `DELETE /data` — supprime le dataset actif. Le badge SOURCE repasse
  immédiatement sur "Démo — EXEMPLE FICTIF" (`frontend/js/views/data-import.js::revenirAuDemo`).

Comme la persistance est en mémoire process (Option A, voir
`ARCHITECTURE.md`), un redémarrage du service supprime également tout
dataset actif ou en attente — aucune donnée importée ne survit au-delà de
la durée de vie du processus.

## Ce qui est transmis au client (pas une fuite)

Les messages de validation (`apercu_erreurs`) peuvent réafficher la valeur
brute d'une cellule invalide (ex. `"Valeur non numérique : '622334455'"`).
Ce n'est **pas** une fuite : c'est la même personne qui vient d'importer ce
fichier qui reçoit ce message, pour corriger sa propre donnée — comportement
attendu d'un outil de validation, distinct de la journalisation côté serveur.

## Limites connues (hors périmètre de cette V2)

- Pas d'authentification sur les endpoints `/data/*` — quiconque peut
  appeler l'API peut importer/supprimer le dataset actif. À traiter avant
  une exposition publique réelle (hors périmètre de ce chantier).
- Pas de limite de taille sur `/predire_churn_batch` ni sur l'upload de
  fichier — risque de déni de service par payload volumineux, hérité de la
  référence, documenté dans la revue de code de ce projet.
