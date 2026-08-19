import { couleurPourClasseCarte } from './risk-colors.js';
import { genererStatsPrefecture } from './regional-stats.js';
import { animateBarsIn } from './animations.js';

const RISK_LABEL = { 'r-faible': 'Faible', 'r-moyen': 'Modéré', 'r-eleve': 'Élevé', 'r-critique': 'Critique' };
const CLASSES_RISQUE = ['r-faible', 'r-moyen', 'r-eleve', 'r-critique'];
const NB_PREFECTURES_CLASSEMENT = 8;

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

  // Statistiques fictives precalculees une fois -- deterministes par
  // prefecture, contraintes a la tranche de risque deja peinte sur la
  // carte (voir regional-stats.js).
  const statsParPrefecture = new Map();
  allPrefPaths.forEach(path => {
    const riskCls = CLASSES_RISQUE.find(c => path.classList.contains(c));
    statsParPrefecture.set(path.dataset.pref, genererStatsPrefecture(path.dataset.pref, riskCls));
  });

  let filtreActif = 'tous';
  let prefectureSelectionnee = null;

  function positionnerTooltip(evt) {
    const conteneur = mapTooltip.parentElement.getBoundingClientRect();
    mapTooltip.style.left = `${evt.clientX - conteneur.left + 14}px`;
    mapTooltip.style.top = `${evt.clientY - conteneur.top + 14}px`;
  }

  function afficherTooltip(path, evt) {
    const stats = statsParPrefecture.get(path.dataset.pref);
    mapTooltip.innerHTML = `
      <div class="map-tooltip-titre">${stats.pref.toUpperCase()}</div>
      <div class="map-tooltip-ligne">Risque ${RISK_LABEL[stats.riskCls].toLowerCase()} · <b>${stats.churn}%</b></div>
      <div class="map-tooltip-ligne">Clients à risque · ${stats.clientsARisque.toLocaleString('fr-FR')}</div>
      <div class="map-tooltip-ligne">Transactions · ${stats.transactions.toLocaleString('fr-FR')}</div>
    `;
    mapTooltip.classList.add('visible');
    positionnerTooltip(evt);
  }

  function masquerTooltip() {
    mapTooltip.classList.remove('visible');
  }

  function afficherRegionalInsight(pref) {
    const stats = statsParPrefecture.get(pref);
    if (!stats) return;
    prefectureSelectionnee = pref;

    regionalInsightEmpty.style.display = 'none';
    mapInfoCard.classList.add('active');

    const d = stats.distribution;
    regionalInsightBody.innerHTML = `
      <div class="map-info-head">
        <span class="pname">${stats.pref}</span>
        <span class="rname">RISQUE <span style="color:${couleurPourClasseCarte(stats.riskCls)};">${RISK_LABEL[stats.riskCls].toUpperCase()}</span></span>
      </div>
      <div class="map-info-grid" style="margin-bottom:20px;">
        <div class="map-info-stat"><div class="v">${stats.clients.toLocaleString('fr-FR')}</div><div class="l">Clients</div></div>
        <div class="map-info-stat"><div class="v">${stats.clientsARisque.toLocaleString('fr-FR')}</div><div class="l">Clients à risque</div></div>
        <div class="map-info-stat"><div class="v">${stats.churn}%</div><div class="l">Risque moyen</div></div>
        <div class="map-info-stat"><div class="v">${stats.echec}%</div><div class="l">Taux d'échec</div></div>
      </div>

      <div class="regional-subhead">DISTRIBUTION (FICTIF)</div>
      <div class="factor-row"><div class="factor-lbl"><span>Critique</span><span>${d.critique}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${d.critique}%;background:var(--risk-critique);"></div></div></div>
      <div class="factor-row"><div class="factor-lbl"><span>Élevé</span><span>${d.eleve}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${d.eleve}%;background:var(--risk-eleve);"></div></div></div>
      <div class="factor-row"><div class="factor-lbl"><span>Modéré</span><span>${d.modere}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${d.modere}%;background:var(--risk-modere);"></div></div></div>
      <div class="factor-row"><div class="factor-lbl"><span>Faible</span><span>${d.faible}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${d.faible}%;background:var(--risk-faible);"></div></div></div>

      <div class="regional-subhead" style="margin-top:20px;">CAUSES (FICTIF)</div>
      ${stats.causes.map(c => `
        <div class="factor-row"><div class="factor-lbl"><span>${c.libelle}</span><span>${c.pct}%</span></div><div class="factor-track"><div class="factor-fill" style="width:${c.pct}%;"></div></div></div>
      `).join('')}

      <div class="reco-card" style="margin-top:18px;">
        <b>Action CRM recommandée</b>
        <div class="why">Cause dominante : ${stats.causeDominante.libelle} (${stats.causeDominante.pct}%) → <b style="color:var(--ink);">${stats.action}</b><br>Ne préjuge pas d'un impact chiffré -- aucun historique de campagne ne permet de l'estimer.</div>
      </div>
    `;
    animateBarsIn(regionalInsightBody.querySelectorAll('.factor-fill'));

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
    const classees = Array.from(statsParPrefecture.values())
      .sort((a, b) => b.churn - a.churn)
      .slice(0, NB_PREFECTURES_CLASSEMENT);
    mapRanking.innerHTML = classees.map((s, i) => `
      <div class="ranking-row" data-pref="${s.pref}" tabindex="0" role="button" aria-label="Voir l'analyse de ${s.pref}">
        <span class="ranking-rang">${String(i + 1).padStart(2, '0')}</span>
        <span class="ranking-nom">${s.pref}</span>
        <span class="ranking-valeur" style="color:${couleurPourClasseCarte(s.riskCls)};">${s.churn}%</span>
      </div>
    `).join('');
    mapRanking.querySelectorAll('.ranking-row').forEach(row => {
      const ouvrir = () => afficherRegionalInsight(row.dataset.pref);
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

  construireClassement();
}
