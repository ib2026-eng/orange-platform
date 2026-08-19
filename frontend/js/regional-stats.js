import { hashSeed, seededRandom } from './random.js';

/* Generateur de statistiques regionales fictives (section 5-6) --
   deterministe par prefecture (memes chiffres a chaque appel), et
   contraint a la tranche de risque deja peinte sur la carte (classe
   r-faible/r-moyen/r-eleve/r-critique static du SVG) pour que le taux de
   churn affiche ne contredise jamais la couleur du contour -- incoherence
   presente dans une version anterieure, corrigee ici.

   Toutes ces valeurs restent FICTIVES (voir la bannière de la carte) :
   aucun Churn_Label ni historique regional reel n'est disponible. */

const BANDES_CHURN_PAR_CLASSE = {
  'r-faible': [1, 14.9],
  'r-moyen': [15, 34.9],
  'r-eleve': [35, 59.9],
  'r-critique': [60, 85],
};

const CAUSES = ['inactivite', 'echecs', 'baisse_usage', 'diversite'];
const LIBELLE_CAUSE = {
  inactivite: 'Inactivité',
  echecs: 'Échecs transactionnels',
  baisse_usage: "Baisse d'utilisation",
  diversite: 'Faible diversité de services',
};
const ACTION_PAR_CAUSE = {
  inactivite: 'Réactivation client',
  echecs: 'Assistance / résolution du problème',
  baisse_usage: 'Campagne de réengagement',
  diversite: 'Activation de services pertinents',
};

export function genererStatsPrefecture(pref, riskCls) {
  const rnd = seededRandom(hashSeed(pref));
  const [min, max] = BANDES_CHURN_PAR_CLASSE[riskCls] || [1, 85];

  const clients = Math.round(1200 + rnd() * 18000);
  const churn = Math.round((min + rnd() * (max - min)) * 10) / 10;
  const clientsARisque = Math.round(clients * (churn / 100));
  const inactiviteMoyenne = Math.round(5 + rnd() * 90);
  const echec = Math.round((1 + rnd() * 12) * 10) / 10;
  const transactions = Math.round(3000 + rnd() * 40000);

  const critique = Math.round(5 + rnd() * 35);
  const eleve = Math.round(10 + rnd() * 30);
  const modere = Math.round(10 + rnd() * 30);
  const faible = Math.max(0, 100 - critique - eleve - modere);

  const poids = CAUSES.map(() => rnd());
  const totalPoids = poids.reduce((a, b) => a + b, 0);
  const causes = CAUSES.map((cle, i) => ({
    cle,
    libelle: LIBELLE_CAUSE[cle],
    pct: Math.round((poids[i] / totalPoids) * 100),
  })).sort((a, b) => b.pct - a.pct);

  const causeDominante = causes[0];

  return {
    pref,
    riskCls,
    clients,
    churn,
    clientsARisque,
    inactiviteMoyenne,
    echec,
    transactions,
    distribution: { critique, eleve, modere, faible },
    causes,
    causeDominante,
    action: ACTION_PAR_CAUSE[causeDominante.cle],
  };
}
