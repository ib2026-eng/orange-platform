"""Metadonnees du modele reel Orange Money -- v1, XGBoost, 2 variables.

Changement de version volontaire (valide explicitement), pas une
regression : remplace le modele v0 (Random Forest, montant_moyen seul,
AUC 0.60, reproduit via une table de correspondance figee) par le vrai
modele entraine directement (XGBClassifier, montant_moyen +
total_transactions, AUC 0.6538 sur donnees de test).

Le modele n'est plus approxime par une table -- les fichiers .pkl reels
(model_files/modele_churn_om_reel.pkl, model_files/scaler_om_reel.pkl)
sont charges et executes directement (voir scoring.py). Ce fichier documente
les faits verifies sur ces artefacts, pour reference et non-regression."""

VERSION_MODELE = "v1"
TYPE_MODELE = "XGBClassifier (200 arbres, profondeur max 4)"
VARIABLES_MODELE = ["montant_moyen", "total_transactions"]  # ordre exact attendu par le scaler/modele
AUC_MODELE = 0.6538  # mesuree sur le jeu de test lors de l'entrainement (customer_E, jan-fev -> mars)
