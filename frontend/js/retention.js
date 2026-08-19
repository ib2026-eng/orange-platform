/* Recommandation de retention client -- Next Best Action.
   Regle transparente basee uniquement sur les signaux reellement presents
   dans les donnees du client (pas de modele entraine, pas d'uplift estime --
   voir docs/DATA_HONESTY_POLICY.md). Le signal le plus fort l'emporte, pas
   simplement le niveau de risque -- evite qu'un meme profil (ex. Critique)
   recoive systematiquement la meme action. */

const SEUIL_INACTIVITE_FORTE_JOURS = 45;
const SEUIL_VALEUR_ELEVEE_GNF = 100000;
const SEUIL_DIVERSITE_FAIBLE_SERVICES = 2;

// Ordre de priorite des causes -- utilise aussi pour le tri "Cause" de la
// vue Clients a risque (Phase 5).
export const ORDRE_CAUSES = [
  'Inactivité', 'Valeur client', 'Diversité de services', 'Risque de churn',
  'Surveillance', 'Aucun facteur dominant',
];

function estRisqueEleveOuCritique(client) {
  return client.niveau_risque === 'Élevé' || client.niveau_risque === 'Critique';
}

export function getRetentionRecommendation(client) {
  const { niveau_risque, jours_inactivite_avant_mars, montant_moyen, nb_types_service } = client;

  if (typeof jours_inactivite_avant_mars === 'number' && jours_inactivite_avant_mars >= SEUIL_INACTIVITE_FORTE_JOURS) {
    return {
      cause: 'Inactivité',
      action: "Campagne de réactivation",
      pourquoi: `Aucune activité constatée depuis ${Math.round(jours_inactivite_avant_mars)} jours -- signal de désengagement à traiter en priorité.`,
    };
  }

  if (estRisqueEleveOuCritique(client) && typeof montant_moyen === 'number' && montant_moyen >= SEUIL_VALEUR_ELEVEE_GNF) {
    return {
      cause: 'Valeur client',
      action: niveau_risque === 'Critique' ? "Programme de fidélisation premium" : "Offre de fidélisation personnalisée",
      pourquoi: `Client à montant moyen élevé et risque de churn ${niveau_risque.toLowerCase()} -- valeur à protéger en priorité, pas de promotion générique.`,
    };
  }

  if (typeof nb_types_service === 'number' && nb_types_service <= SEUIL_DIVERSITE_FAIBLE_SERVICES) {
    return {
      cause: 'Diversité de services',
      action: "Campagne de cross-sell",
      pourquoi: `Seulement ${nb_types_service} service(s) Orange Money utilisé(s) -- opportunité de diversification.`,
    };
  }

  if (estRisqueEleveOuCritique(client)) {
    return {
      cause: 'Risque de churn',
      action: "Relance personnalisée",
      pourquoi: `Risque de churn ${niveau_risque.toLowerCase()} sans facteur dominant identifiable dans les données disponibles.`,
    };
  }

  if (niveau_risque === 'Modéré') {
    return {
      cause: 'Surveillance',
      action: "Surveillance comportementale",
      pourquoi: "Risque de churn modéré -- pas de signal fort nécessitant une action immédiate.",
    };
  }

  return {
    cause: 'Aucun facteur dominant',
    action: "Suivi standard",
    pourquoi: "Aucun facteur de risque significatif détecté dans les données disponibles.",
  };
}
