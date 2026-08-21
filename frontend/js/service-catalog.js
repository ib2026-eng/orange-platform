/* Catalogue des services Orange Money Guinee, classes par pouvoir de
   "verrouillage" client -- base sur la liste officielle des services
   fournie par l'utilisateur et sur les valeurs reelles de type_service
   observees dans les exports (transaction_tag normalise en Title Case).

   VERROUILLANTS : services qui creent un lien recurrent difficile a
   reproduire chez un concurrent low-cost (Wave...) -- paiement marchand,
   factures, salaire, ecole, services bancaires. Un client qui les utilise
   a un cout de changement reel, pas seulement une habitude.

   FAIBLE_VERROUILLAGE : mouvement d'argent basique (retrait, depot,
   transfert P2P, rechargement) -- exactement le terrain ou un concurrent
   a frais quasi nuls comme Wave rivalise le plus directement. Utiliser
   uniquement ces services ne cree aucune barriere a la sortie.

   Les autres (annulations, remboursements, fermetures, corrections) sont
   volontairement exclus des deux categories : ce ne sont pas des signaux
   d'usage ou de fidelite, juste des evenements techniques. */

const SERVICES_VERROUILLANTS = new Set([
  'Paiement Marchand', 'Paiement Marchand Channel',
  'Paiement Salaire', 'Paiement Facture', 'Facture',
  'Electricite', 'Eau', 'Abonnement Tv',
  'Scolarite', 'E-School', 'Ecole',
  'Autodebit', 'Transfert Recurrent',
  'B2W In', 'B2W Out', // Bank to Wallet -- lien avec "Acces a ma banque"
]);

const SERVICES_FAIBLE_VERROUILLAGE = new Set([
  'Cashout', 'Cashout Channel', 'Cashin',
  'P2P', 'C2C', 'C2W In',
  'Top Up', 'Top Up Channel', 'Achat Airtime',
  'Operator Withdraw', 'Irt In', 'Irt Out',
]);

export function estServiceVerrouillant(typeService) {
  return SERVICES_VERROUILLANTS.has(typeService);
}

export function estServiceFaibleVerrouillage(typeService) {
  return SERVICES_FAIBLE_VERROUILLAGE.has(typeService);
}

// Pour un client donne (liste de services deja utilises), le meilleur
// service verrouillant a lui suggerer -- celui qu'il n'utilise pas encore,
// dans un ordre de pertinence business (paiement marchand et factures
// avant les cas plus specifiques comme la scolarite).
const ORDRE_SUGGESTION = [
  'Paiement Marchand', 'Paiement Facture', 'Paiement Salaire',
  'Autodebit', 'Transfert Recurrent', 'Scolarite', 'B2W In',
];

export function suggererServiceVerrouillant(servicesUtilises) {
  const deja = new Set(servicesUtilises || []);
  return ORDRE_SUGGESTION.find(s => !deja.has(s)) || 'Paiement Marchand';
}

// true si le client a un usage reel de services a faible verrouillage et
// aucun usage de service verrouillant -- le profil le plus expose a un
// concurrent low-cost (Wave) : rien ne le retient specifiquement chez
// Orange Money.
export function estExposeALaConcurrenceLowCost(servicesUtilises) {
  const services = servicesUtilises || [];
  const aDuFaibleVerrouillage = services.some(s => SERVICES_FAIBLE_VERROUILLAGE.has(s));
  const aDuVerrouillant = services.some(s => SERVICES_VERROUILLANTS.has(s));
  return aDuFaibleVerrouillage && !aDuVerrouillant;
}
