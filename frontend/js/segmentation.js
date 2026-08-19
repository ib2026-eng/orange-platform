import { construireDistribution, rangPercentile } from './sample-ranges.js';

/* Segmentation RFM -- calcul reel sur le roster actuellement charge (voir
   client-store.js), quelle que soit son origine (demo genere ou futur
   dataset importe -- cette fonction ne fait aucune hypothese sur la
   source, uniquement sur la presence des 4 champs RFM). Jamais invente :
   un client auquel il manque un champ requis est exclu et compte a part,
   plutot que de lui attribuer une valeur devinee. */

export const CHAMPS_REQUIS_RFM = ['jours_inactivite_avant_mars', 'total_transactions', 'montant_moyen', 'nb_types_service'];

export const SEGMENTS = ['Platinum', 'Gold', 'Silver', 'Bronze'];

export const DESCRIPTION_SEGMENT = {
  Platinum: "Quartile supérieur du score RFM composite (récence + fréquence + montant + diversité) sur l'échantillon chargé.",
  Gold: "Deuxième quartile du score RFM composite.",
  Silver: "Troisième quartile du score RFM composite.",
  Bronze: "Quartile inférieur du score RFM composite.",
};

function champsValides(client) {
  return CHAMPS_REQUIS_RFM.every(c => typeof client[c] === 'number' && !Number.isNaN(client[c]));
}

export function scoreRFM(client, distributions) {
  const recence = 1 - (rangPercentile(client.jours_inactivite_avant_mars, distributions.jours_inactivite_avant_mars) ?? 50) / 100;
  const frequence = (rangPercentile(client.total_transactions, distributions.total_transactions) ?? 50) / 100;
  const montant = (rangPercentile(client.montant_moyen, distributions.montant_moyen) ?? 50) / 100;
  const diversite = (rangPercentile(client.nb_types_service, distributions.nb_types_service) ?? 50) / 100;
  return { recence, frequence, montant, diversite, composite: (recence + frequence + montant + diversite) / 4 };
}

function moyenne(clients, cle) {
  if (clients.length === 0) return null;
  return clients.reduce((s, c) => s + c[cle], 0) / clients.length;
}

function valeurDominante(clients, cle) {
  if (clients.length === 0) return null;
  const compte = {};
  clients.forEach(c => { compte[c[cle]] = (compte[c[cle]] || 0) + 1; });
  return Object.entries(compte).sort((a, b) => b[1] - a[1])[0][0];
}

/* Calcule la segmentation complete sur un roster de clients deja scores
   (probabilite_churn / niveau_risque presents). Retourne :
   - clients : tous les clients valides, chacun enrichi de .segment et .rfm
   - resume : { Platinum: {taille, montantMoyen, ...}, ... }
   - exclus : nombre de clients ecartes faute de champs RFM complets
   - total : taille du roster en entree */
export function calculerSegmentation(roster) {
  const valides = roster.filter(champsValides);
  const exclus = roster.length - valides.length;

  const distributions = {};
  for (const champ of CHAMPS_REQUIS_RFM) distributions[champ] = construireDistribution(valides, champ);

  const avecScore = valides
    .map(c => ({ ...c, rfm: scoreRFM(c, distributions) }))
    .sort((a, b) => b.rfm.composite - a.rfm.composite);

  const n = avecScore.length;
  const q = Math.ceil(n / 4);
  avecScore.forEach((c, i) => {
    if (i < q) c.segment = 'Platinum';
    else if (i < 2 * q) c.segment = 'Gold';
    else if (i < 3 * q) c.segment = 'Silver';
    else c.segment = 'Bronze';
  });

  const resume = {};
  for (const seg of SEGMENTS) {
    const clientsSegment = avecScore.filter(c => c.segment === seg);
    resume[seg] = {
      taille: clientsSegment.length,
      montantMoyen: moyenne(clientsSegment, 'montant_moyen'),
      frequenceMoyenne: moyenne(clientsSegment, 'total_transactions'),
      recenceMoyenne: moyenne(clientsSegment, 'jours_inactivite_avant_mars'),
      diversiteMoyenne: moyenne(clientsSegment, 'nb_types_service'),
      risqueDominant: valeurDominante(clientsSegment, 'niveau_risque'),
      clients: clientsSegment,
    };
  }

  return { clients: avecScore, resume, exclus, total: roster.length };
}
