import { obtenirRoster, obtenirEtatRoster } from '../client-store.js';
import { calculerSegmentation } from '../segmentation.js';
import { grouperActions } from '../next-best-action.js';
import { couleurPourCategorie } from '../risk-colors.js';
import { animateCountUp, revealStagger } from '../animations.js';
import { markupPourEtat, cablerBoutonImport } from '../empty-states.js';

const PRIORITE_EMOJI = { Critique: '🔴', Élevé: '🟠', Modéré: '🟡', Faible: '🟢' };

let clientsSegmentes = [];
let filtreRisque = 'tous';
let actionSelectionnee = null;
let filtreSegmentDetail = 'tous';
let evenementsCables = false;

function clientsFiltres() {
  return filtreRisque === 'tous' ? clientsSegmentes : clientsSegmentes.filter(c => c.niveau_risque === filtreRisque);
}

function construireKpis(groupes, totalClients) {
  const el = document.getElementById('nbaKpiRow');
  const actionPrincipale = groupes[0];
  el.innerHTML = `
    <div class="kpi"><div class="val">${totalClients}</div><div class="lbl">Clients concernés</div></div>
    <div class="kpi"><div class="val">${groupes.length}</div><div class="lbl">Actions distinctes générées</div></div>
    <div class="kpi"><div class="val">${actionPrincipale ? actionPrincipale.nbClients : 0}</div><div class="lbl">${actionPrincipale ? actionPrincipale.action : 'Action principale'}</div></div>
    <div class="kpi"><div class="val">Règle</div><div class="lbl">Recommandation métier, pas une prédiction</div></div>
  `;
  revealStagger(el.querySelectorAll('.kpi'), { step: 50 });
  el.querySelectorAll('.kpi .val').forEach(v => { if (/^\d+$/.test(v.textContent.trim())) animateCountUp(v); });
}

function construireTableActions(groupes) {
  const tbody = document.getElementById('nbaTableBody');
  if (groupes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--grey); padding:16px;">Aucun client pour ce filtre.</td></tr>`;
    return;
  }
  tbody.innerHTML = groupes.map(g => {
    const couleur = couleurPourCategorie(g.risqueDominant) || 'var(--grey)';
    return `
      <tr data-action="${g.action}">
        <td><b>${g.action}</b></td><td style="color:var(--grey);">${g.cause}</td><td>${g.nbClients}</td>
        <td>${PRIORITE_EMOJI[g.risqueDominant] || ''} <span class="badge" style="background:${couleur}26; color:${couleur};">${g.risqueDominant}</span></td>
        <td>${g.segmentDominant ?? '—'}</td>
      </tr>
    `;
  }).join('');
  tbody.querySelectorAll('tr[data-action]').forEach(tr => {
    tr.addEventListener('click', () => {
      actionSelectionnee = tr.dataset.action;
      filtreSegmentDetail = 'tous';
      afficherDetailAction();
    });
  });
}

function afficherDetailAction() {
  const panel = document.getElementById('nbaDetailPanel');
  const titre = document.getElementById('nbaDetailTitre');
  const body = document.getElementById('nbaDetailBody');
  const filtres = document.getElementById('nbaSegmentFilters');
  if (!actionSelectionnee) { panel.style.display = 'none'; return; }

  const groupes = grouperActions(clientsFiltres());
  const groupe = groupes.find(g => g.action === actionSelectionnee);
  panel.style.display = '';

  if (!groupe) {
    titre.textContent = `CLIENTS — ${actionSelectionnee.toUpperCase()} (0)`;
    body.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--grey); padding:16px;">Aucun client pour ce filtre.</td></tr>`;
    return;
  }

  const clients = groupe.clients.filter(c => filtreSegmentDetail === 'tous' || c.segment === filtreSegmentDetail);
  titre.textContent = `CLIENTS — ${actionSelectionnee.toUpperCase()} (${clients.length})`;
  filtres.querySelectorAll('.map-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filtreSegment === filtreSegmentDetail));

  if (clients.length === 0) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--grey); padding:16px;">Aucun client pour ce filtre.</td></tr>`;
    return;
  }
  body.innerHTML = clients.map(c => {
    const couleur = couleurPourCategorie(c.niveau_risque);
    return `<tr data-client-id="${c.id}"><td style="font-family:'JetBrains Mono',monospace; font-size:11px;">${c.id}</td><td>${c.region}</td><td>${c.segment ?? '—'}</td><td><span class="badge" style="background:${couleur}26; color:${couleur};">${c.niveau_risque}</span></td><td>${Math.round(c.probabilite_churn * 100)}%</td></tr>`;
  }).join('');
}

function rendreTableauEtDetail() {
  const clients = clientsFiltres();
  const groupes = grouperActions(clients);
  construireKpis(groupes, clients.length);
  construireTableActions(groupes);
  afficherDetailAction();
}

function cablerEvenements() {
  if (evenementsCables) return;
  evenementsCables = true;

  document.getElementById('nbaFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.map-filter-btn');
    if (!btn) return;
    filtreRisque = btn.dataset.filtreRisque;
    document.querySelectorAll('#nbaFilters .map-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    actionSelectionnee = null;
    rendreTableauEtDetail();
  });

  document.getElementById('nbaSegmentFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.map-filter-btn');
    if (!btn) return;
    filtreSegmentDetail = btn.dataset.filtreSegment;
    afficherDetailAction();
  });

  document.getElementById('nbaDetailBody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-client-id]');
    if (!tr) return;
    document.dispatchEvent(new CustomEvent('client:select', { detail: { id: tr.dataset.clientId } }));
    document.querySelector('.tab[data-view="client"]')?.click();
  });
}

function render() {
  const empty = document.getElementById('nbaEmpty');
  const contenu = document.getElementById('nbaContenu');
  const { etat, message } = obtenirEtatRoster();

  if (etat !== 'pret') {
    contenu.style.display = 'none';
    empty.style.display = '';
    empty.innerHTML = markupPourEtat(etat, message) || '';
    cablerBoutonImport(empty);
    return;
  }

  clientsSegmentes = calculerSegmentation(obtenirRoster()).clients;
  filtreRisque = 'tous';
  actionSelectionnee = null;

  empty.style.display = 'none';
  contenu.style.display = '';
  document.querySelectorAll('#nbaFilters .map-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filtreRisque === 'tous'));

  cablerEvenements();
  rendreTableauEtDetail();
}

export function initNba() {
  render();
  document.addEventListener('roster:ready', render);
}
