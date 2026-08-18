import { API_OM_URL } from './config.js';
import { categoriserScore, scoreRisquePlaceholder } from './scoring-fallback.js';

export async function fetchScoresBatch(clientsBruts) {
  const res = await fetch(API_OM_URL + "/predire_churn_batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clients: clientsBruts.map(({ id, region, ...reste }) => reste) }),
  });
  if (!res.ok) throw new Error("Réponse API invalide");
  const data = await res.json();
  return data.resultats.map((r, i) => ({
    ...r, id: clientsBruts[i].id, region: clientsBruts[i].region,
  }));
}

export function scoreLocalement(clientsBruts) {
  return clientsBruts.map(c => {
    const score = scoreRisquePlaceholder(c);
    return {
      ...c,
      probabilite_churn: score,
      prediction_churn: score >= 0.5 ? 1 : 0,
      niveau_risque: categoriserScore(score),
    };
  });
}
