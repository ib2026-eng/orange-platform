/* Repli local -- reproduit exactement la regle score_risque_placeholder de
   l'API (voir backend/app/domains/orange_money/scoring.py), utilise
   uniquement si l'API est indisponible. */
export function categoriserScore(p) {
  if (p >= 0.6) return 'Critique';
  if (p >= 0.35) return 'Élevé';
  if (p >= 0.15) return 'Modéré';
  return 'Faible';
}

export function scoreRisquePlaceholder(client) {
  const score = (
    0.50 * Math.min(client.jours_inactivite_avant_mars / 60, 1)
    + 0.25 * (1 - Math.min(client.total_transactions / 30, 1))
    + 0.15 * (1 - Math.min(client.nb_types_service / 6, 1))
    + 0.10 * (1 - Math.min(client.montant_moyen / 200000, 1))
  );
  return Math.min(Math.max(score, 0.01), 0.97);
}
