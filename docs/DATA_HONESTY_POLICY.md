# Politique d'honnêteté data

Principe hérité de la référence et non négociable : **aucune donnée
fictive n'est présentée comme réelle**, et **aucun chiffre n'est inventé**
(ni performance ML, ni client réel, ni métrique d'impact). Ce document liste
ce qui est réel, ce qui est fictif, et où c'est marqué dans l'interface.

## Classement par vue

| Vue | Statut | Marquage |
|---|---|---|
| Vue globale — KPI (24h) | Réel (agrégat mesuré sur l'échantillon disponible) | Aucun (affiché normalement) |
| Vue globale — tendance mensuelle | Fictif (structure de démo) | `.fictif-banner` visible en permanence |
| Vue globale — carte régionale | Fictif (contours réels, indicateurs fictifs) | `.fictif-banner` + mention sous la carte |
| Churn IA | En attente (pas de modèle entraîné) | `.honesty` banner, valeurs `—` |
| Fiche client | Démo statique | Contenu marqué comme exemple dans le libellé |
| Clients scorés (100) | Fictif, mais **API réelle** | `.honesty` banner explicite sur le statut du modèle |
| Segmentation | En attente (logique RFM non calculée) | `.honesty` banner + liste explicite de ce qui n'est pas construit |
| Next Best Action | Verrouillé | Panneau explicatif, aucune donnée |

## Modèle ML — baseline v0

- **Statut** : table de correspondance figée (`reference_table.py`),
  extraite d'un Random Forest à une seule variable (`montant_moyen`),
  **AUC 0.60** — signal réel mais modeste.
- **Ne pas** : ré-entraîner, ajouter des variables, changer les bornes de la
  table, ou afficher un AUC différent, sans qu'un nouveau modèle réel ait
  été validé et sans mettre à jour ce document et `API_CONTRACT.md` en
  conséquence.
- **Blocage connu** (hérité, non résolu dans cette plateforme) : l'identifiant
  client (`num_sender`) est tronqué à 4 caractères côté extraction, ce qui
  empêche un modèle multivarié fiable par client. Documenté dans le README
  de la référence.

## Règles pour toute évolution future

1. Une nouvelle donnée réelle (agrégat mesuré) peut être affichée sans
   bannière, à condition que sa source soit traçable (requête, fichier,
   date d'extraction).
2. Une donnée de démonstration, un exemple, ou une projection doit
   **toujours** porter une bannière `.fictif-banner` ou `.honesty` visible
   à l'écran — jamais en info-bulle seule, jamais en petit texte discret.
3. Aucune métrique d'impact (ROI, uplift, taux de rétention gagné) ne doit
   être affichée sans historique de campagne réel permettant de la calculer
   (voir la liste "ce qu'on ne construit pas" de l'onglet Segmentation).
4. Un futur module Télécom hérite de ces mêmes règles — pas de politique
   séparée à inventer.
