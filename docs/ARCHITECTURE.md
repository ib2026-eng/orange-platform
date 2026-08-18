# Architecture — Orange Money Customer Intelligence (v0)

Statut : implémenté (étapes 1 à 6). Référence technique :
`orange-money-source/orange_money_deploiement/` (dépôt séparé, non modifié).

## Périmètre

- Orange Money uniquement pour l'instant (voir §Extensibilité pour Télécom).
- Stateless, aucune base de données.
- Contrat API et scores identiques à la référence — zéro régression (voir
  `tests/test_non_regression.py` et `API_CONTRACT.md`).
- Modèle baseline v0 = table de correspondance `montant_moyen` (AUC 0.60),
  non ré-entraîné (voir `DATA_HONESTY_POLICY.md`).

## Arborescence

```
backend/
  app/
    main.py                      Assemble FastAPI + CORS + router
    core/config.py                ALLOWED_ORIGINS / MODELE_REEL_DISPONIBLE (env)
    domains/orange_money/
      schemas.py                  ClientOM, ClientBatchOM, COLONNES_MODELE
      reference_table.py          TABLE_MONTANT_MOYEN (copie fidèle)
      scoring.py                  score_modele_reel, score_risque_placeholder,
                                   score_risque, niveau_risque
      router.py                   GET /, POST /predire_churn(_batch)
  tests/
    golden_reference.json         Valeurs figées, générées depuis la référence
    test_scoring.py               Tests unitaires purs (bornes de table, seuils)
    test_router_contract.py       Forme des réponses, codes HTTP
    test_non_regression.py        Rejoue golden_reference.json contre l'API
  requirements.txt / requirements-dev.txt
  render.yaml / runtime.txt         Déploiement Render (rootDir: backend)

frontend/
  index.html                      Markup des 6 vues (identique à la référence)
  css/
    tokens.css                    Jetons de design + palette fonctionnelle risque
    base.css                      Reset, layout, topbar, onglets
    components.css                Panels, KPI, badges, tables (réutilisables)
    views.css                     Styles propres à une vue (carte, liste, etc.)
    animations.css                Keyframes, utilitaire .reveal, reduced-motion
  js/
    config.js                     API_OM_URL
    random.js                     hashSeed / seededRandom (partagé)
    risk-colors.js                Lit les jetons --risk-* (source unique de couleur)
    scoring-fallback.js           Repli local (miroir exact du backend)
    api.js                        fetchScoresBatch, scoreLocalement
    animations.js                 revealStagger, animateBarsIn, animateCountUp
    tabs.js                       Bascule d'onglets + déclenchement animations
    map.js                        Interaction carte des préfectures
    views/list.js                 Liste 100 clients (seule vue connectée à l'API)
    views/churn.js                Animation d'entrée de l'onglet Churn IA
    main.js                       Point d'entrée, initialisation

docs/
  ARCHITECTURE.md                 Ce document
  API_CONTRACT.md                 Contrat gelé frontend/backend
  DATA_HONESTY_POLICY.md          Règles données réelles vs fictives

.github/workflows/
  ci.yml                           pytest (backend) + syntaxe JS (frontend)
  deploy-pages.yml                 Publie frontend/ sur GitHub Pages à chaque push main
```

Fichiers volontairement absents : `js/views/client360.js`, `js/views/loyalty.js`,
`js/format.js`, `js/state.js` — envisagés à la conception mais les vues
correspondantes n'ont aucune logique dynamique (contenu statique), les créer
aurait ajouté des fichiers vides sans y placer de comportement réel.

## Backend

`main.py` ne contient aucune logique métier : il assemble le router du
domaine `orange_money` et configure CORS depuis `core/config.py`. Le module
`domains/orange_money/` est conçu pour être dupliqué à l'identique pour un
futur domaine `telecom/` (voir §Extensibilité).

`scoring.py::score_risque()` est l'unique point de bascule entre le modèle
réel (table `montant_moyen`) et la règle placeholder — piloté par
`Settings.modele_reel_disponible` (variable d'env `MODELE_REEL_DISPONIBLE`,
défaut `true`, identique au comportement de la référence).

## Frontend

Vanilla HTML/CSS/JS, aucun framework, aucun build step — cohérent avec le
déploiement statique gratuit (GitHub Pages) déjà validé sur la référence.
Les modules JS utilisent `type="module"` (imports ES natifs, aucun bundler
nécessaire).

Seule la vue **Clients scorés (100)** appelle réellement l'API
(`views/list.js` → `api.js` → `POST /predire_churn_batch`), avec repli local
automatique (`scoring-fallback.js`, formule identique au backend) si l'API
est indisponible (mise en veille Render). Les 5 autres vues sont statiques ou
structurelles, conformément à `DATA_HONESTY_POLICY.md`.

### Couche d'animation (étape 5)

Ajoutée sans changer structure, typographie, espacement ni comportement.
Purement `opacity`/`transform`/`width`/couleur avec `transition` — pas de
librairie, pas de bounce/rotation. Un bloc global
`@media (prefers-reduced-motion: reduce)` dans `animations.css` neutralise
toutes les animations pour les utilisateurs concernés ; les valeurs finales
affichées (KPI, largeurs de barres) sont toujours reverrouillées sur leur
valeur d'origine exacte à la fin de l'animation — aucune dérive de données
possible.

### Palette de risque fonctionnelle (étape 4)

`tokens.css` définit `--risk-faible` (vert sourd), `--risk-modere` (ambre),
`--risk-eleve` (orange-rouge), `--risk-critique` (rouge) — desaturés, sur la
famille noir/blanc/orange. Les anciennes variables de la référence
(`--r0..--r3`, `--safe/--risk/--mid`) sont repointées dessus, donc la carte
des préfectures et les badges se recolorent automatiquement sans toucher
leurs règles CSS. `risk-colors.js` lit ces jetons via `getComputedStyle`
plutôt que de dupliquer des valeurs hex côté JS.

**Bug corrigé au passage** : la référence utilisait la clé `'Moyen'` côté JS
alors que le backend renvoie `'Modéré'` pour ce palier — un mismatch déjà
présent qui faisait perdre silencieusement la couleur/action de ce palier en
usage réel (voir historique de conversation, étape 4). Corrigé en alignant
le JS sur le libellé du backend.

## Flux de données

```
views/list.js: genererClientsFictifs() -> 100 profils déterministes
  -> api.js: POST /predire_churn_batch
       succès -> fusion résultats + id/région -> renderListe()
       échec  -> scoring-fallback.js (formule identique) -> renderListe()
```

Aucun autre flux réseau. Les KPI, la tendance, la carte (hors clic/survol
fictif) et la segmentation restent des données statiques intégrées au
HTML/CSS/JS, conformément au principe d'honnêteté data.

## Tests et CI

70 tests (`backend/tests/`) : bornes de la table de correspondance, seuils
de `niveau_risque`, forme des réponses, et non-régression stricte contre des
valeurs figées générées depuis la référence (`golden_reference.json` — la
CI n'a pas besoin du dépôt externe). `.github/workflows/ci.yml` exécute ces
tests plus une vérification de syntaxe sur chaque module JS, sur chaque push
et pull request vers `main`.

## Extensibilité future

**Modèle réel / vraies données** — points de remplacement : `scoring.py::score_risque()`
(swap vers `model.predict_proba()`), `reference_table.py` (régénérée ou
supprimée), `core/config.py` (bascule par variable d'env, sans redéploiement
de code), `views/list.js` / futur `client360.js` (données démo à remplacer
par de vrais endpoints).

**Module Télécom** — `backend/app/domains/telecom/` reproduirait la
structure de `orange_money/` (router/schemas/scoring propres), monté via un
second `include_router()` dans `main.py`, zéro fichier OM touché. Le
préfixage des routes (`/telecom/...` vs racine partagée) reste à trancher au
moment venu, sans impact sur le contrat OM actuel. Côté frontend,
`js/views/` accueillerait de nouveaux fichiers de vue Télécom ; `tabs.js` et
`animations.js` sont déjà agnostiques du domaine.
