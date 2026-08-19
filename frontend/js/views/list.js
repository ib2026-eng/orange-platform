import { couleurPourCategorie } from '../risk-colors.js';
import { revealStagger, prefersReducedMotion } from '../animations.js';
import { ORDRE_CAUSES, getRetentionRecommendation } from '../retention.js';
import { obtenirRoster, obtenirEtatRoster } from '../client-store.js';
import { markupPourEtat, cablerBoutonImport } from '../empty-states.js';

const ORDRE_RISQUE = ['Critique', 'Élevé', 'Modéré', 'Faible'];
const PRIORITE_EMOJI = { Critique: '🔴', Élevé: '🟠', Modéré: '🟡', Faible: '🟢' };
const LIGNES_PAR_PAGE = 25;

let filtreRisque = 'tous';
let termeRecherche = '';
let tri = 'score-desc';
let pageActuelle = 1;
let clientsPageActuelle = new Map();

function renderSkeleton(tbody, n = 8) {
  const largeurs = [120, 70, 60, 60, 110, 140, 40];
  tbody.innerHTML = Array.from({ length: n }, () => `
    <tr class="skeleton-row">
      ${largeurs.map(l => `<td><span class="skeleton-bar" style="width:${l}px;"></span></td>`).join('')}
    </tr>
  `).join('');
}

function ligneHtml(c) {
  const color = couleurPourCategorie(c.niveau_risque);
  const pct = Math.round(c.probabilite_churn * 100);
  return `
    <tr data-client-id="${c.id}">
      <td style="font-family:'JetBrains Mono',monospace; font-size:11px;">${c.id}</td>
      <td>${c.region}</td>
      <td><span class="badge" style="background:${color}26; color:${color};">${c.niveau_risque}</span></td>
      <td>
        <div class="score-bar-wrap">
          <div class="score-bar-track"><div class="score-bar-fill" data-target-width="${pct}%" style="width:0%; background:${color};"></div></div>
          <span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:${color};">${pct}%</span>
        </div>
      </td>
      <td style="font-size:12px; color:var(--ink);">${c.reco.cause}</td>
      <td style="font-size:12px;">
        <div style="color:var(--ink);">${c.reco.action}</div>
        <div style="font-size:10.5px; color:var(--grey); margin-top:2px; line-height:1.4;">${c.reco.pourquoi}</div>
      </td>
      <td style="text-align:center; font-size:14px;" title="Priorité ${c.niveau_risque}">${PRIORITE_EMOJI[c.niveau_risque] || ''}</td>
    </tr>
  `;
}

function renderPagination(elements, totalResultats, totalPages) {
  if (!elements.pagination) return;
  if (totalPages <= 1) { elements.pagination.innerHTML = ''; return; }
  elements.pagination.innerHTML = `
    <button type="button" class="btn-secondary" id="listPagePrev" ${pageActuelle === 1 ? 'disabled' : ''}>‹ Précédent</button>
    <span class="list-pagination-info">Page ${pageActuelle} / ${totalPages} · ${totalResultats} résultat(s)</span>
    <button type="button" class="btn-secondary" id="listPageNext" ${pageActuelle === totalPages ? 'disabled' : ''}>Suivant ›</button>
  `;
  document.getElementById('listPagePrev')?.addEventListener('click', () => {
    pageActuelle = Math.max(1, pageActuelle - 1);
    render(elements);
  });
  document.getElementById('listPageNext')?.addEventListener('click', () => {
    pageActuelle = Math.min(totalPages, pageActuelle + 1);
    render(elements);
  });
}

function render(elements) {
  const { etat, message } = obtenirEtatRoster();

  if (etat === 'chargement') {
    elements.toolbar.style.display = 'none';
    renderSkeleton(elements.clientListBody);
    elements.pagination.innerHTML = '';
    elements.listSummary.textContent = '';
    return;
  }
  if (etat !== 'pret') {
    elements.toolbar.style.display = 'none';
    elements.clientListBody.innerHTML = `<tr><td colspan="7">${markupPourEtat(etat, message)}</td></tr>`;
    cablerBoutonImport(elements.clientListBody);
    elements.pagination.innerHTML = '';
    elements.listSummary.textContent = '';
    return;
  }
  elements.toolbar.style.display = '';

  let resultats = obtenirRoster().map(c => ({ ...c, reco: getRetentionRecommendation(c) }));

  if (filtreRisque !== 'tous') resultats = resultats.filter(c => c.niveau_risque === filtreRisque);
  if (termeRecherche) {
    const terme = termeRecherche.toLowerCase();
    resultats = resultats.filter(c => c.id.toLowerCase().includes(terme) || c.region.toLowerCase().includes(terme));
  }

  switch (tri) {
    case 'priorite': resultats.sort((a, b) => ORDRE_RISQUE.indexOf(a.niveau_risque) - ORDRE_RISQUE.indexOf(b.niveau_risque)); break;
    case 'cause': resultats.sort((a, b) => ORDRE_CAUSES.indexOf(a.reco.cause) - ORDRE_CAUSES.indexOf(b.reco.cause)); break;
    case 'region': resultats.sort((a, b) => a.region.localeCompare(b.region)); break;
    default: resultats.sort((a, b) => b.probabilite_churn - a.probabilite_churn);
  }

  const nbRisque = obtenirRoster().filter(c => c.prediction_churn === 1).length;
  elements.listSummary.textContent = `${nbRisque} à risque élevé/critique · ${resultats.length} correspondant(s)`;

  if (resultats.length === 0) {
    elements.clientListBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--grey); padding:24px;">Aucun client ne correspond à ces critères.</td></tr>`;
    clientsPageActuelle = new Map();
    renderPagination(elements, 0, 1);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(resultats.length / LIGNES_PAR_PAGE));
  pageActuelle = Math.min(Math.max(1, pageActuelle), totalPages);
  const debut = (pageActuelle - 1) * LIGNES_PAR_PAGE;
  const pageResultats = resultats.slice(debut, debut + LIGNES_PAR_PAGE);

  clientsPageActuelle = new Map(pageResultats.map(c => [c.id, c]));
  elements.clientListBody.innerHTML = pageResultats.map(ligneHtml).join('');
  renderPagination(elements, resultats.length, totalPages);

  const lignes = Array.from(elements.clientListBody.querySelectorAll('tr'));
  revealStagger(lignes, { step: 8, maxStagger: 20 });

  const appliquerLargeursCibles = () => {
    elements.clientListBody.querySelectorAll('.score-bar-fill').forEach(fill => { fill.style.width = fill.dataset.targetWidth; });
  };
  if (prefersReducedMotion()) appliquerLargeursCibles();
  else requestAnimationFrame(() => requestAnimationFrame(appliquerLargeursCibles));
}

function debounce(fn, delai) {
  let handle;
  return (...args) => { clearTimeout(handle); handle = setTimeout(() => fn(...args), delai); };
}

function reinitialiserPageEtRender(elements) {
  pageActuelle = 1;
  render(elements);
}

function cablerBarreOutils(elements) {
  document.getElementById('listFilters')?.querySelectorAll('.map-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtreRisque = btn.dataset.filtreRisque;
      document.querySelectorAll('#listFilters .map-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      reinitialiserPageEtRender(elements);
    });
  });

  const recherche = document.getElementById('listSearchInput');
  recherche?.addEventListener('input', debounce(() => {
    termeRecherche = recherche.value.trim();
    reinitialiserPageEtRender(elements);
  }, 200));

  const trieur = document.getElementById('listSortSelect');
  trieur?.addEventListener('change', () => { tri = trieur.value; reinitialiserPageEtRender(elements); });

  document.getElementById('importClientsBtn')?.addEventListener('click', () => {
    document.querySelector('.tab[data-view="import"]')?.click();
  });

  elements.clientListBody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-client-id]');
    if (!tr) return;
    const client = clientsPageActuelle.get(tr.dataset.clientId);
    if (!client) return;
    elements.clientListBody.querySelectorAll('tr.selectionnee').forEach(r => r.classList.remove('selectionnee'));
    tr.classList.add('selectionnee');
    document.dispatchEvent(new CustomEvent('client:select', { detail: { id: client.id } }));
    document.querySelector('.tab[data-view="client"]')?.click();
  });
}

export function initListe() {
  const elements = {
    clientListBody: document.getElementById('clientListBody'),
    listSummary: document.getElementById('listSummary'),
    pagination: document.getElementById('listPagination'),
    toolbar: document.querySelector('#list .list-toolbar'),
  };
  if (!elements.clientListBody) return;

  cablerBarreOutils(elements);
  render(elements);
  document.addEventListener('roster:ready', () => render(elements));
}
