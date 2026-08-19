import { obtenirRoster, obtenirEtatRoster } from '../client-store.js';
import { calculerSegmentation, DESCRIPTION_SEGMENT, SEGMENTS } from '../segmentation.js';
import { couleurPourCategorie } from '../risk-colors.js';
import { animateBarsIn, animateCountUp, revealStagger } from '../animations.js';
import { markupPourEtat, cablerBoutonImport } from '../empty-states.js';

const COULEUR_SEGMENT = { Platinum: '#0A0A0A', Gold: 'var(--orange)', Silver: '#8C8C8C', Bronze: '#C7C7C7' };

let derniereSegmentation = null;
let filtreRisqueDetail = 'tous';
let segmentSelectionne = null;
let evenementsCables = false;

function fmt(n) { return n == null ? '—' : Math.round(n).toLocaleString('fr-FR'); }

function construireKpis(seg) {
  const el = document.getElementById('segKpiRow');
  const total = seg.total - seg.exclus;
  const montantMoyenGlobal = seg.clients.length ? seg.clients.reduce((s, c) => s + c.montant_moyen, 0) / seg.clients.length : null;
  const frequenceMoyenneGlobale = seg.clients.length ? seg.clients.reduce((s, c) => s + c.total_transactions, 0) / seg.clients.length : null;
  const recenceMoyenneGlobale = seg.clients.length ? seg.clients.reduce((s, c) => s + c.jours_inactivite_avant_mars, 0) / seg.clients.length : null;

  el.innerHTML = `
    <div class="kpi"><div class="val">${total}</div><div class="lbl">Clients segmentés${seg.exclus ? ` (${seg.exclus} exclus, données incomplètes)` : ''}</div></div>
    <div class="kpi"><div class="val">${fmt(montantMoyenGlobal)}</div><div class="lbl">Montant moyen (GNF)</div></div>
    <div class="kpi"><div class="val">${fmt(frequenceMoyenneGlobale)}</div><div class="lbl">Fréquence moyenne</div></div>
    <div class="kpi"><div class="val">${fmt(recenceMoyenneGlobale)} j</div><div class="lbl">Récence moyenne</div></div>
  `;
  revealStagger(el.querySelectorAll('.kpi'), { step: 50 });
  el.querySelectorAll('.kpi .val').forEach(v => animateCountUp(v));
}

function construireChart(seg) {
  const el = document.getElementById('segChart');
  const total = SEGMENTS.reduce((s, k) => s + seg.resume[k].taille, 0) || 1;
  el.innerHTML = SEGMENTS.map(k => {
    const pct = Math.round((seg.resume[k].taille / total) * 100);
    return `<div class="factor-row"><div class="factor-lbl"><span>${k}</span><span>${seg.resume[k].taille} (${pct}%)</span></div><div class="factor-track"><div class="factor-fill" style="width:${pct}%;background:${COULEUR_SEGMENT[k]};"></div></div></div>`;
  }).join('');
  animateBarsIn(el.querySelectorAll('.factor-fill'));
}

function construireRfmGlobal(seg) {
  const el = document.getElementById('segRfmGlobal');
  if (seg.clients.length === 0) { el.innerHTML = `<div class="map-info-empty">Aucun client segmentable.</div>`; return; }
  const moyenne = (cle) => seg.clients.reduce((s, c) => s + c.rfm[cle], 0) / seg.clients.length;
  const dims = [['Récence (inversée)', moyenne('recence')], ['Fréquence', moyenne('frequence')], ['Montant', moyenne('montant')], ['Diversité', moyenne('diversite')]];
  el.innerHTML = dims.map(([libelle, v]) => `
    <div class="factor-row"><div class="factor-lbl"><span>${libelle}</span><span>${Math.round(v * 100)}e percentile</span></div><div class="factor-track"><div class="factor-fill" style="width:${Math.round(v * 100)}%;"></div></div></div>
  `).join('');
  animateBarsIn(el.querySelectorAll('.factor-fill'));
}

function construireTableSegments(seg) {
  const tbody = document.getElementById('segTableBody');
  tbody.innerHTML = SEGMENTS.map(k => {
    const r = seg.resume[k];
    if (r.taille === 0) return `<tr data-segment="${k}"><td><b>${k}</b></td><td colspan="5" style="color:var(--grey);">Aucun client dans ce segment.</td></tr>`;
    const couleurRisque = couleurPourCategorie(r.risqueDominant) || 'var(--grey)';
    return `
      <tr data-segment="${k}">
        <td><b>${k}</b><div style="font-size:10px;color:var(--grey);font-weight:400;max-width:220px;">${DESCRIPTION_SEGMENT[k]}</div></td>
        <td>${r.taille}</td><td>${fmt(r.montantMoyen)} GNF</td><td>${fmt(r.frequenceMoyenne)}</td><td>${fmt(r.recenceMoyenne)} j</td>
        <td><span class="badge" style="background:${couleurRisque}26; color:${couleurRisque};">${r.risqueDominant}</span></td>
      </tr>
    `;
  }).join('');
  tbody.querySelectorAll('tr[data-segment]').forEach(tr => {
    tr.addEventListener('click', () => {
      const k = tr.dataset.segment;
      if (derniereSegmentation.resume[k].taille === 0) return;
      segmentSelectionne = k;
      filtreRisqueDetail = 'tous';
      afficherDetailSegment();
    });
  });
}

function afficherDetailSegment() {
  const panel = document.getElementById('segDetailPanel');
  const titre = document.getElementById('segDetailTitre');
  const body = document.getElementById('segDetailBody');
  const filtres = document.getElementById('segRiskFilters');
  if (!segmentSelectionne) { panel.style.display = 'none'; return; }

  panel.style.display = '';
  const clients = derniereSegmentation.resume[segmentSelectionne].clients.filter(c => filtreRisqueDetail === 'tous' || c.niveau_risque === filtreRisqueDetail);
  titre.textContent = `CLIENTS — SEGMENT ${segmentSelectionne.toUpperCase()} (${clients.length})`;
  filtres.querySelectorAll('.map-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filtreRisque === filtreRisqueDetail));

  if (clients.length === 0) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--grey); padding:16px;">Aucun client pour ce filtre.</td></tr>`;
    return;
  }
  body.innerHTML = clients.map(c => {
    const couleur = couleurPourCategorie(c.niveau_risque);
    return `<tr data-client-id="${c.id}"><td style="font-family:'JetBrains Mono',monospace; font-size:11px;">${c.id}</td><td>${c.region}</td><td><span class="badge" style="background:${couleur}26; color:${couleur};">${c.niveau_risque}</span></td><td>${Math.round(c.probabilite_churn * 100)}%</td></tr>`;
  }).join('');
}

function cablerEvenements() {
  if (evenementsCables) return;
  evenementsCables = true;
  document.getElementById('segRiskFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.map-filter-btn');
    if (!btn) return;
    filtreRisqueDetail = btn.dataset.filtreRisque;
    afficherDetailSegment();
  });
  document.getElementById('segDetailBody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-client-id]');
    if (!tr) return;
    document.dispatchEvent(new CustomEvent('client:select', { detail: { id: tr.dataset.clientId } }));
    document.querySelector('.tab[data-view="client"]')?.click();
  });
}

function render() {
  const empty = document.getElementById('segEmpty');
  const contenu = document.getElementById('segContenu');
  const { etat, message } = obtenirEtatRoster();

  if (etat !== 'pret') {
    contenu.style.display = 'none';
    empty.style.display = '';
    empty.innerHTML = markupPourEtat(etat, message) || '';
    cablerBoutonImport(empty);
    return;
  }

  const roster = obtenirRoster();
  derniereSegmentation = calculerSegmentation(roster);
  segmentSelectionne = null;

  empty.style.display = 'none';
  contenu.style.display = '';

  construireKpis(derniereSegmentation);
  construireChart(derniereSegmentation);
  construireRfmGlobal(derniereSegmentation);
  construireTableSegments(derniereSegmentation);
  document.getElementById('segDetailPanel').style.display = 'none';
  cablerEvenements();
}

export function initSegmentation() {
  render();
  document.addEventListener('roster:ready', render);
}
