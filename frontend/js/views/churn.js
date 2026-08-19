import { obtenirStatutModele } from '../model-status.js';
import { animateBarsIn, revealStagger } from '../animations.js';

/* Vue "Churn IA" -- interroge le statut reel du modele (GET /, endpoint du
   contrat gele) plutot que d'afficher des facteurs "a confirmer" devines.
   En mode placeholder, les poids affiches sont ceux reellement codes dans
   score_risque_placeholder (backend/.../scoring.py) -- documentes, pas
   inventes. Appelee une seule fois, au premier passage sur l'onglet. */
export async function animateChurnFactorsOnce() {
  revealStagger(document.querySelectorAll('#churn .kpi'), { step: 50 });

  const statutTexte = document.getElementById('churnStatutTexte');
  const aucVal = document.getElementById('churnAucVal');
  const variablesVal = document.getElementById('churnVariablesVal');
  const periodeVal = document.getElementById('churnPeriodeVal');
  const facteursTitre = document.getElementById('churnFacteursTitre');
  const facteursEl = document.getElementById('churnFacteurs');

  const statut = await obtenirStatutModele();

  if (statut.modeleReel === true) {
    statutTexte.textContent = "Modèle réel actif (baseline v0) — signal réel mais modeste (AUC 0.60), à ne pas utiliser seul pour des décisions commerciales fermes.";
    aucVal.textContent = '0.60';
    variablesVal.textContent = '1 (montant_moyen)';
    periodeVal.textContent = 'en attente';
    facteursTitre.textContent = 'VARIABLE UTILISÉE PAR LE MODÈLE RÉEL';
    facteursEl.innerHTML = `<div class="factor-row"><div class="factor-lbl"><span>Montant moyen transactionnel</span><span>100% de la décision</span></div><div class="factor-track"><div class="factor-fill" style="width:100%;"></div></div></div>`;
  } else if (statut.modeleReel === false) {
    statutTexte.textContent = "Modèle réel en attente des données historiques — le score actuel utilise une règle simple et documentée (pas un modèle entraîné).";
    aucVal.textContent = 'n/a';
    variablesVal.textContent = '4 (règle)';
    periodeVal.textContent = 'n/a — règle non entraînée';
    facteursTitre.textContent = 'POIDS DE LA RÈGLE PLACEHOLDER (DOCUMENTÉS, PAS DEVINÉS)';
    const poids = [
      ["Jours d'inactivité", 50],
      ['Faible nombre de transactions', 25],
      ['Faible diversité de services', 15],
      ['Faible montant moyen', 10],
    ];
    facteursEl.innerHTML = poids.map(([libelle, p]) => `
      <div class="factor-row"><div class="factor-lbl"><span>${libelle}</span><span>${p}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${p}%;"></div></div></div>
    `).join('');
  } else {
    statutTexte.textContent = 'Statut indisponible (API injoignable pour le moment).';
  }

  animateBarsIn(document.querySelectorAll('#churn .factor-fill'));
}
