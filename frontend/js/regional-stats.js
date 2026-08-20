import { getRetentionRecommendation } from './retention.js';

/* Statistiques regionales calculees REELLEMENT a partir du roster actif,
   regroupees par region (le champ `region` du dataset importe). La carte
   est dessinee au niveau prefecture (34 formes), mais le dataset ne fournit
   que la region (8 regions reelles de Guinee) -- chaque prefecture d'une
   meme region affiche donc les memes stats regionales reelles, plutot que
   d'inventer une granularite prefecture qui n'existe pas dans les donnees.

   Rien n'est fictif ici : niveau_risque et probabilite_churn viennent du
   scoring reel (API), la cause vient de la meme regle deterministe que
   Next Best Action (retention.js). Aucun Churn_Label observe n'existe --
   "risque moyen" reste un score de risque predit, jamais presente comme un
   taux de churn constate. */

export function normaliserNomRegion(nom) {
  return String(nom || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/['’`\s-]/g, '');
}

export function regrouperClientsParRegion(roster) {
  const parRegion = new Map();
  for (const client of roster) {
    const cle = normaliserNomRegion(client.region);
    if (!cle) continue;
    if (!parRegion.has(cle)) parRegion.set(cle, []);
    parRegion.get(cle).push(client);
  }
  return parRegion;
}

const ORDRE_NIVEAU = ['Critique', 'Élevé', 'Modéré', 'Faible'];

export function calculerStatsRegion(clients) {
  const n = clients.length;
  if (n === 0) return null;

  const compteNiveau = { Critique: 0, Élevé: 0, Modéré: 0, Faible: 0 };
  const compteCause = {};
  let sommeProba = 0;
  let sommeTransactions = 0;

  for (const c of clients) {
    if (compteNiveau[c.niveau_risque] != null) compteNiveau[c.niveau_risque]++;
    sommeProba += typeof c.probabilite_churn === 'number' ? c.probabilite_churn : 0;
    sommeTransactions += typeof c.total_transactions === 'number' ? c.total_transactions : 0;
    const { cause } = getRetentionRecommendation(c);
    compteCause[cause] = (compteCause[cause] || 0) + 1;
  }

  const niveauDominant = ORDRE_NIVEAU.reduce((a, b) => (compteNiveau[b] > compteNiveau[a] ? b : a), ORDRE_NIVEAU[0]);
  const causesTriees = Object.entries(compteCause)
    .map(([libelle, count]) => ({ libelle, pct: Math.round((count / n) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  return {
    clients: n,
    clientsARisque: compteNiveau.Critique + compteNiveau.Élevé,
    risqueMoyen: Math.round((sommeProba / n) * 1000) / 10,
    transactions: sommeTransactions,
    niveauDominant,
    distribution: {
      critique: Math.round((compteNiveau.Critique / n) * 100),
      eleve: Math.round((compteNiveau.Élevé / n) * 100),
      modere: Math.round((compteNiveau.Modéré / n) * 100),
      faible: Math.round((compteNiveau.Faible / n) * 100),
    },
    causes: causesTriees,
    causeDominante: causesTriees[0] || null,
  };
}
