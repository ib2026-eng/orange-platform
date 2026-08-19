import { getRetentionRecommendation } from './retention.js';

/* Regroupe des clients (deja segmentes -- voir segmentation.js) par action
   de retention recommandee. Regle deterministe et explicable (voir
   retention.js) -- aucun uplift, taux de conversion ou impact commercial
   n'est calcule ou invente ici. */

function dominant(clients, cle) {
  if (clients.length === 0) return null;
  const compte = {};
  clients.forEach(c => { compte[c[cle]] = (compte[c[cle]] || 0) + 1; });
  return Object.entries(compte).sort((a, b) => b[1] - a[1])[0][0];
}

export function grouperActions(clientsSegmentes) {
  const groupes = new Map();

  clientsSegmentes.forEach(client => {
    const reco = getRetentionRecommendation(client);
    if (!groupes.has(reco.action)) {
      groupes.set(reco.action, { action: reco.action, cause: reco.cause, clients: [] });
    }
    groupes.get(reco.action).clients.push({ ...client, reco });
  });

  return Array.from(groupes.values())
    .map(g => ({
      action: g.action,
      cause: g.cause,
      clients: g.clients,
      nbClients: g.clients.length,
      risqueDominant: dominant(g.clients, 'niveau_risque'),
      segmentDominant: dominant(g.clients, 'segment'),
    }))
    .sort((a, b) => b.nbClients - a.nbClients);
}
