"""Normalisation de l'entree soumise au modele de scoring fige (jamais
modifie -- voir orange_money/scoring.py, TABLE_MONTANT_MOYEN). Concerne
uniquement le pipeline d'ingestion (/data/clients) ; n'affecte jamais le
contrat gele /predire_churn(_batch), qui continue de recevoir montant_moyen
brut, exactement comme avant.

Probleme reel observe sur de vrais exports Orange Money Guinee : la table
figee a ete calibree sur une population d'entrainement a une echelle bien
plus faible que les montants GNF reels (mediane observee ~50 000 GNF, mais
des clients jusqu'a plusieurs milliards). Au-dela d'un seuil assez bas, la
quasi-totalite des clients reels tombe dans le meme palier plafond de la
table, ecrasant tout pouvoir discriminant (presque tous les clients
classes "Eleve"/"Critique", quel que soit leur profil reel).

Correctif retenu : normalisation par RANG PERCENTILE dans la population du
dataset actif, avant l'appel a la table -- pas une modification de la
table elle-meme. Le client le plus faible du dataset est mappe pres de sa
borne basse, le plus eleve pres de sa borne haute finie, les autres
proportionnellement a leur rang reel. C'est une technique statistique
standard (quantile normalization), monotone : elle ne fait qu'etaler la
population reelle sur l'echelle que la table sait discriminer, sans
inventer de nouvelle logique de risque.

Le montant_moyen BRUT reste affiche tel quel partout ailleurs (Fiche
client, Segmentation...) -- seule l'entree fournie au scoring est ajustee."""
import bisect
from typing import List

# TABLE_MONTANT_MOYEN (orange_money/reference_table.py) n'est plus vraiment
# discriminante au-dela de 300 000 (bornes originales) : de 300 000 a
# l'infini, la probabilite reste figee autour de 0.59 (0.5904/0.5907, quatre
# paliers consecutifs quasi identiques). Normaliser jusqu'a la derniere
# borne finie (2 451 324) gaspillerait donc la majorite de l'echelle
# percentile sur une zone plate -- 300 000 est la vraie borne haute
# "utile" de la table (le palier (101000,130000,0.7181) juste en dessous
# est son maximum global).
BORNE_MAX_TABLE_SCORING = 300_000


def normaliser_montant_pour_scoring(valeur: float, valeurs_triees: List[float]) -> float:
    if not valeurs_triees or valeur is None:
        return valeur
    rang = bisect.bisect_right(valeurs_triees, valeur) / len(valeurs_triees)
    return rang * BORNE_MAX_TABLE_SCORING
