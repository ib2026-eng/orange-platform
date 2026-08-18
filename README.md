# Orange Guinée Data & Churn Analytics — Orange Money (v0)

Plateforme Orange Money Customer Intelligence, reconstruite à partir de la
référence fonctionnelle validée dans `orange-money-source/orange_money_deploiement/`
(non modifiée, non incluse dans ce dépôt).

Scope actuel : Orange Money uniquement, stateless, sans base de données.
Le contrat API et les scores actuels sont préservés à l'identique (aucune
régression). Le modèle baseline reste la table de correspondance
`montant_moyen` (AUC 0.60) — voir `docs/DATA_HONESTY_POLICY.md`.

## Structure

```
backend/    API FastAPI (domaine orange_money)
frontend/   Application statique HTML/CSS/JS vanilla
docs/       Architecture, contrat API, politique data
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arborescence, responsabilités, flux
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — contrat gelé frontend/backend
- [`docs/DATA_HONESTY_POLICY.md`](docs/DATA_HONESTY_POLICY.md) — règles données réelles vs fictives

## Lancer en local

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```
Puis ouvrir `http://127.0.0.1:8000/docs`.

Tests :
```bash
cd backend
pytest -q
```

### Frontend

Aucun build step. Servir le dossier statiquement, par exemple :
```bash
cd frontend
python3 -m http.server 8000
```
Puis ouvrir `http://127.0.0.1:8000/`. Par défaut, la vue "Clients scorés"
appelle l'API de démo déployée (`frontend/js/config.js`) ; si elle est en
veille (offre gratuite Render), l'application recalcule les scores
localement et l'affiche clairement.

## CI

`.github/workflows/ci.yml` exécute les tests backend (pytest) et une
vérification de syntaxe sur chaque module JS à chaque push et pull request
vers `main`.

## Déploiement

Mêmes principes que la référence (Render + GitHub Pages, offre gratuite),
adaptés à la structure en sous-dossiers `backend/` / `frontend/`.

### 1. Publier sur GitHub

```bash
git add .
git commit -m "Plateforme Orange Money — v0"
git remote add origin https://github.com/TON-NOM-UTILISATEUR/orange-platform.git
git push -u origin main
```

### 2. Déployer l'API sur Render

1. render.com → New + → Web Service
2. Choisir ce dépôt
3. Render détecte `backend/render.yaml` (le champ `rootDir: backend` pointe
   automatiquement le build/start sur le sous-dossier)
4. Attendre le déploiement (2-5 minutes), noter l'adresse obtenue

### 3. Connecter le frontend à cette adresse

Dans `frontend/js/config.js`, mettre à jour :
```javascript
export const API_OM_URL = "https://api-orange-guinee-om.onrender.com";
```

### 4. Héberger le frontend sur GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` publie automatiquement le
contenu de `frontend/` à chaque push sur `main`. Une seule étape manuelle
requise, une fois : **Settings → Pages → Source : "GitHub Actions"**.

### Point important

L'offre gratuite Render met le service en veille après 15 minutes
d'inactivité — le premier appel peut prendre 20-50 secondes. L'application
gère déjà ce cas : si l'API ne répond pas, elle recalcule les scores
localement (même règle placeholder) et affiche un avertissement clair
plutôt que de planter.
