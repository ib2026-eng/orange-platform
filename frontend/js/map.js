import { couleurPourClasseCarte } from './risk-colors.js';
import { regrouperClientsParRegion, calculerStatsRegion, normaliserNomRegion } from './regional-stats.js';
import { obtenirRoster, obtenirEtatRoster } from './client-store.js';
import { animateBarsIn } from './animations.js';

const RISK_LABEL = { 'r-faible': 'Faible', 'r-moyen': 'Modéré', 'r-eleve': 'Élevé', 'r-critique': 'Critique' };
const NB_PREFECTURES_CLASSEMENT = 8;

/* Carte dessinee au niveau prefecture (34 formes), donnees reelles
   disponibles au niveau region (8 regions). Chaque prefecture d'une meme
   region affiche donc les memes stats regionales reelles -- pas de
   granularite prefecture inventee. Une region sans client dans le dataset
   actif reste grise ("indisponible"), jamais coloree au hasard. */
function classePourRisque(risqueMoyenPct) {
  if (risqueMoyenPct >= 60) return 'r-critique';
  if (risqueMoyenPct >= 35) return 'r-eleve';
  if (risqueMoyenPct >= 15) return 'r-moyen';
  return 'r-faible';
}

export function initMap() {
  const mapTooltip = document.getElementById('mapTooltip');
  const mapInfoCard = document.getElementById('mapInfoCard');
  const regionalInsightEmpty = document.getElementById('regionalInsightEmpty');
  const regionalInsightBody = document.getElementById('regionalInsightBody');
  const mapResetBtn = document.getElementById('mapResetBtn');
  const mapFilters = document.getElementById('mapFilters');
  const mapRanking = document.getElementById('mapRanking');
  if (!mapTooltip || !mapInfoCard) return;

  const allPrefPaths = Array.from(document.querySelectorAll('#gnMap path.region-shape'));

  let statsParRegion = new Map(); // region normalisee -> stats reelles (ou absente si pas de donnees)
  let filtreActif = 'tous';
  let prefectureSelectionnee = null;

  function statsPourPath(path) {
    return statsParRegion.get(normaliserNomRegion(path.dataset.region)) || null;
  }

  function recalculerStats() {
    const { etat } = obtenirEtatRoster();
    if (etat !== 'pret') {
      statsParRegion = new Map();
    } else {
      const parRegion = regrouperClientsParRegion(obtenirRoster());
      statsParRegion = new Map();
      for (const [region, clients] of parRegion) {
        statsParRegion.set(region, calculerStatsRegion(clients));
      }
    }

    allPrefPaths.forEach(path => {
      const stats = statsPourPath(path);
      path.classList.remove('r-faible', 'r-moyen', 'r-eleve', 'r-critique', 'r-indisponible');
      path.classList.add(stats ? classePourRisque(stats.risqueMoyen) : 'r-indisponible');
    });

    reinitialiserSelection();
    appliquerFiltre(filtreActif);
    construireClassement();
  }

  function positionnerTooltip(evt) {
    const conteneur = mapTooltip.parentElement.getBoundingClientRect();
    mapTooltip.style.left = `${evt.clientX - conteneur.left + 14}px`;
    mapTooltip.style.top = `${evt.clientY - conteneur.top + 14}px`;
  }

  function afficherTooltip(path, evt) {
    const stats = statsPourPath(path);
    const riskCls = path.classList.contains('r-indisponible') ? null : classePourRisque(stats?.risqueMoyen ?? 0);
    mapTooltip.innerHTML = stats ? `
      <div class="map-tooltip-titre">${path.dataset.pref.toUpperCase()}</div>
      <div class="map-tooltip-ligne">Risque ${RISK_LABEL[riskCls].toLowerCase()} · <b>${stats.risqueMoyen}%</b></div>
      <div class="map-tooltip-ligne">Clients à risque · ${stats.clientsARisque.toLocaleString('fr-FR')} / ${stats.clients.toLocaleString('fr-FR')}</div>
      <div class="map-tooltip-ligne">Transactions · ${stats.transactions.toLocaleString('fr-FR')}</div>
    ` : `
      <div class="map-tooltip-titre">${path.dataset.pref.toUpperCase()}</div>
      <div class="map-tooltip-ligne">Aucun client de cette région dans le dataset actif</div>
    `;
    mapTooltip.classList.add('visible');
    positionnerTooltip(evt);
  }

  function masquerTooltip() {
    mapTooltip.classList.remove('visible');
  }

  function afficherRegionalInsight(pref) {
    const path = allPrefPaths.find(p => p.dataset.pref === pref);
    if (!path) return;
    const stats = statsPourPath(path);
    prefectureSelectionnee = pref;

    regionalInsightEmpty.style.display = 'none';
    mapInfoCard.classList.add('active');

    if (!stats) {
      regionalInsightBody.innerHTML = `
        <div class="map-info-head"><span class="pname">${path.dataset.pref}</span></div>
        <div class="map-info-empty">Aucun client de la région ${path.dataset.region} dans le dataset actif.</div>
      `;
    } else {
      const riskCls = classePourRisque(stats.risqueMoyen);
      const d = stats.distribution;
      regionalInsightBody.innerHTML = `
        <div class="map-info-head">
          <span class="pname">${path.dataset.region}</span>
          <span class="rname">RISQUE <span style="color:${couleurPourClasseCarte(riskCls)};">${RISK_LABEL[riskCls].toUpperCase()}</span></span>
        </div>
        <div class="map-info-grid" style="margin-bottom:20px;">
          <div class="map-info-stat"><div class="v">${stats.clients.toLocaleString('fr-FR')}</div><div class="l">Clients</div></div>
          <div class="map-info-stat"><div class="v">${stats.clientsARisque.toLocaleString('fr-FR')}</div><div class="l">Clients à risque</div></div>
          <div class="map-info-stat"><div class="v">${stats.risqueMoyen}%</div><div class="l">Risque moyen</div></div>
          <div class="map-info-stat"><div class="v">${stats.transactions.toLocaleString('fr-FR')}</div><div class="l">Transactions</div></div>
        </div>

        <div class="regional-subhead">DISTRIBUTION DU RISQUE</div>
        <div class="factor-row"><div class="factor-lbl"><span>Critique</span><span>${d.critique}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${d.critique}%;background:var(--risk-critique);"></div></div></div>
        <div class="factor-row"><div class="factor-lbl"><span>Élevé</span><span>${d.eleve}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${d.eleve}%;background:var(--risk-eleve);"></div></div></div>
        <div class="factor-row"><div class="factor-lbl"><span>Modéré</span><span>${d.modere}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${d.modere}%;background:var(--risk-modere);"></div></div></div>
        <div class="factor-row"><div class="factor-lbl"><span>Faible</span><span>${d.faible}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${d.faible}%;background:var(--risk-faible);"></div></div></div>

        ${stats.causes.length ? `
          <div class="regional-subhead" style="margin-top:20px;">CAUSES DOMINANTES (règle Next Best Action)</div>
          ${stats.causes.map(c => `
            <div class="factor-row"><div class="factor-lbl"><span>${c.libelle}</span><span>${c.pct}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${c.pct}%;"></div></div></div>
          `).join('')}
        ` : ''}
      `;
      animateBarsIn(regionalInsightBody.querySelectorAll('.factor-fill'));
    }

    allPrefPaths.forEach(p => {
      const estSelectionnee = p.dataset.pref === pref;
      p.classList.toggle('selectionnee', estSelectionnee);
      p.classList.toggle('estompee', !estSelectionnee);
    });
    mapResetBtn.style.display = '';
  }

  function reinitialiserSelection() {
    prefectureSelectionnee = null;
    allPrefPaths.forEach(p => p.classList.remove('selectionnee', 'estompee'));
    regionalInsightEmpty.style.display = '';
    mapInfoCard.classList.remove('active');
    regionalInsightBody.innerHTML = '';
    mapResetBtn.style.display = filtreActif === 'tous' ? 'none' : '';
  }

  function appliquerFiltre(filtre) {
    filtreActif = filtre;
    mapFilters.querySelectorAll('.map-filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filtre === filtre));
    allPrefPaths.forEach(p => {
      const correspond = filtre === 'tous' || p.classList.contains(filtre);
      p.classList.toggle('filtree', !correspond);
    });
    mapResetBtn.style.display = (filtre === 'tous' && !prefectureSelectionnee) ? 'none' : '';
  }

  function construireClassement() {
    if (!mapRanking) return;
    const vues = new Set();
    const classees = [];
    allPrefPaths.forEach(path => {
      const region = path.dataset.region;
      if (vues.has(region)) return;
      const stats = statsPourPath(path);
      if (!stats) return;
      vues.add(region);
      classees.push({ pref: region, riskCls: classePourRisque(stats.risqueMoyen), risqueMoyen: stats.risqueMoyen });
    });
    classees.sort((a, b) => b.risqueMoyen - a.risqueMoyen);
    const top = classees.slice(0, NB_PREFECTURES_CLASSEMENT);

    mapRanking.innerHTML = top.length ? top.map((s, i) => `
      <div class="ranking-row" data-pref="${s.pref}" tabindex="0" role="button" aria-label="Voir l'analyse de ${s.pref}">
        <span class="ranking-rang">${String(i + 1).padStart(2, '0')}</span>
        <span class="ranking-nom">${s.pref}</span>
        <span class="ranking-valeur" style="color:${couleurPourClasseCarte(s.riskCls)};">${s.risqueMoyen}%</span>
      </div>
    `).join('') : `<div class="map-info-empty">Aucune région exploitable dans le dataset actif.</div>`;

    mapRanking.querySelectorAll('.ranking-row').forEach(row => {
      const ouvrir = () => {
        const path = allPrefPaths.find(p => p.dataset.region === row.dataset.pref);
        if (path) afficherRegionalInsight(path.dataset.pref);
      };
      row.addEventListener('click', ouvrir);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); } });
    });
  }

  allPrefPaths.forEach(path => {
    path.addEventListener('mouseenter', (e) => afficherTooltip(path, e));
    path.addEventListener('mousemove', positionnerTooltip);
    path.addEventListener('mouseleave', masquerTooltip);
    path.addEventListener('click', () => afficherRegionalInsight(path.dataset.pref));
    path.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); afficherRegionalInsight(path.dataset.pref); } });
  });

  if (mapFilters) {
    mapFilters.querySelectorAll('.map-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => appliquerFiltre(btn.dataset.filtre));
    });
  }

  if (mapResetBtn) {
    mapResetBtn.addEventListener('click', () => {
      appliquerFiltre('tous');
      reinitialiserSelection();
    });
  }

  recalculerStats();
  document.addEventListener('roster:ready', recalculerStats);
}
