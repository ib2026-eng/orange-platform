import { animateBarsIn, revealStagger } from '../animations.js';

/* Vue "Churn IA" : contenu entierement statique (structure prete, pas de
   modele entraine). Seule l'apparition (KPI + barres de facteurs) est
   animee, une fois, au premier passage sur l'onglet. */
export function animateChurnFactorsOnce() {
  revealStagger(document.querySelectorAll('#churn .kpi'), { step: 50 });
  animateBarsIn(document.querySelectorAll('#churn .factor-fill'));
}
