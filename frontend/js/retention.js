/* Recommandation de retention client -- Next Best Action.
   Regle transparente basee uniquement sur les signaux reellement presents
   dans les donnees du client (pas de modele entraine, pas d'uplift estime --
   voir docs/DATA_HONESTY_POLICY.md). Le signal le plus fort l'emporte, pas
   simplement le niveau de risque -- evite qu'un meme profil (ex. Critique)
   recoive systematiquement la meme action.

   Contexte concurrentiel (Wave et autres acteurs low-cost) : deux causes
   supplementaires (Experience degradee, Sensibilite aux frais) ciblent
   specifiquement les profils les plus exposes a un concurrent qui rivalise
   sur les frais de transfert/retrait basiques -- voir service-catalog.js
   pour la classification des services par pouvoir de verrouillage. */
import { obtenirRoster } from './client-store.js';
import { estExposeALaConcurrenceLowCost, suggererServiceVerrouillant } from './service-catalog.js';

const SEUIL_INACTIVITE_FORTE_JOURS_DEFAUT = 45;
const SEUIL_VALEUR_ELEVEE_GNF = 100000;
const SEUIL_DIVERSITE_FAIBLE_SERVICES = 2;
const SEUIL_TRANSACTIONS_FREQUENCE_ELEVEE = 10;
const SEUIL_TAUX_ECHEC_ELEVE_PCT = 20;

// Ordre de priorite des causes -- utilise aussi pour le tri "Cause" de la
// vue Clients a risque (Phase 5).
export const ORDRE_CAUSES = [
  'Expérience dégradée', 'Inactivité', 'Valeur client',
  'Sensibilité aux frais', 'Diversité de services', 'Risque de churn',
  'Surveillance', 'Aucun facteur dominant',
];

function estRisqueEleveOuCritique(client) {
  return client.niveau_risque === 'Élevé' || client.niveau_risque === 'Critique';
}

// Seuil d'inactivite recalcule sur la periode reellement couverte par le
// dataset actif, plutot qu'une valeur fixe pensee pour un historique long.
// Sur un import de 2-3 mois, 45 jours fixes ne se declenche presque jamais
// (voir audit Phase 12) -- ici, le 75e percentile d'inactivite reelle du
// dataset actif sert de seuil, avec un plancher de 7 jours.
let seuilInactiviteCache = null;
let rosterReferenceCache = null;

function seuilInactiviteDynamique() {
  const roster = obtenirRoster();
  if (roster === rosterReferenceCache && seuilInactiviteCache != null) return seuilInactiviteCache;

  const valeurs = roster
    .map(c => c.jours_inactivite_avant_mars)
    .filter(v => typeof v === 'number' && !Number.isNaN(v))
    .sort((a, b) => a - b);

  rosterReferenceCache = roster;
  seuilInactiviteCache = valeurs.length === 0
    ? SEUIL_INACTIVITE_FORTE_JOURS_DEFAUT
    : Math.max(7, valeurs[Math.floor(valeurs.length * 0.75)]);
  return seuilInactiviteCache;
}

export function getRetentionRecommendation(client) {
  const { niveau_risque, jours_inactivite_avant_mars, montant_moyen, nb_types_service, total_transactions, services_utilises, taux_echec_client } = client;

  // 1. Experience degradee -- signal de defiance immediat et actif : le
  // client transacte encore mais rencontre des echecs frequents. Priorite
  // maximale car c'est un probleme en cours, pas un risque a anticiper.
  // Ne se declenche que si le fichier importe fournit un champ statut
  // reconnu (sinon taux_echec_client vaut null -- jamais suppose a 0%).
  if (typeof taux_echec_client === 'number' && taux_echec_client >= SEUIL_TAUX_ECHEC_ELEVE_PCT) {
    return {
      cause: 'Expérience dégradée',
      action: 'Assistance / résolution du problème',
      pourquoi: `${taux_echec_client}% des transactions de ce client ont échoué -- signal de défiance actif à traiter avant toute action commerciale.`,
    };
  }

  const seuilInactivite = seuilInactiviteDynamique();
  if (typeof jours_inactivite_avant_mars === 'number' && jours_inactivite_avant_mars >= seuilInactivite) {
    return {
      cause: 'Inactivité',
      action: "Campagne de réactivation",
      pourquoi: `Aucune activité constatée depuis ${Math.round(jours_inactivite_avant_mars)} jours -- signal de désengagement à traiter en priorité.`,
    };
  }

  if (estRisqueEleveOuCritique(client) && typeof montant_moyen === 'number' && montant_moyen >= SEUIL_VALEUR_ELEVEE_GNF) {
    const servicePrincipal = services_utilises?.[0];
    const mention = servicePrincipal ? ` (usage principal : ${servicePrincipal})` : '';
    return {
      cause: 'Valeur client',
      action: niveau_risque === 'Critique' ? "Programme de fidélisation premium" : "Offre de fidélisation personnalisée",
      pourquoi: `Client à montant moyen élevé et risque de churn ${niveau_risque.toLowerCase()}${mention} -- valeur à protéger en priorité, pas de promotion générique.`,
    };
  }

  // 3. Sensibilite aux frais / risque concurrentiel -- client actif
  // (frequence reelle, pas un usage occasionnel) mais n'ayant jamais
  // utilise de service "verrouillant" (paiement marchand, facture...).
  // C'est exactement le profil le plus facile a debaucher par un
  // concurrent a frais quasi nuls (Wave) : rien ne le retient
  // specifiquement chez Orange Money.
  if (typeof total_transactions === 'number' && total_transactions >= SEUIL_TRANSACTIONS_FREQUENCE_ELEVEE && estExposeALaConcurrenceLowCost(services_utilises)) {
    const suggestion = suggererServiceVerrouillant(services_utilises);
    return {
      cause: 'Sensibilité aux frais',
      action: 'Offre préférentielle sur frais de transfert/retrait',
      pourquoi: `${total_transactions} transactions réalisées, uniquement sur des services basiques (retrait, dépôt, transfert) -- profil le plus exposé à un concurrent à frais réduits. Suggestion de diversification : ${suggestion}.`,
    };
  }

  if (typeof nb_types_service === 'number' && nb_types_service <= SEUIL_DIVERSITE_FAIBLE_SERVICES) {
    const suggestion = suggererServiceVerrouillant(services_utilises);
    return {
      cause: 'Diversité de services',
      action: "Campagne de cross-sell",
      pourquoi: `Seulement ${nb_types_service} service(s) Orange Money utilisé(s) -- suggestion : ${suggestion}, un service qui crée un lien récurrent difficile à reproduire chez un concurrent.`,
    };
  }

  if (estRisqueEleveOuCritique(client)) {
    return {
      cause: 'Risque de churn',
      action: "Relance personnalisée",
      pourquoi: `Risque de churn ${niveau_risque.toLowerCase()} sans facteur dominant identifiable. Profil : ${Math.round(total_transactions ?? 0)} transactions, montant moyen ${Math.round(montant_moyen ?? 0).toLocaleString('fr-FR')} GNF, ${nb_types_service ?? 0} service(s) -- à qualifier manuellement par l'agent CRM.`,
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
