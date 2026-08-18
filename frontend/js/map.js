import { hashSeed, seededRandom } from './random.js';
import { couleurPourClasseCarte } from './risk-colors.js';

const RISK_LABEL = { 'r-faible': 'Faible', 'r-moyen': 'Moyen', 'r-eleve': 'Élevé', 'r-critique': 'Critique' };

export function initMap() {
  const mapInfoCard = document.getElementById('mapInfoCard');
  if (!mapInfoCard) return;

  function showPrefectureInfo(path) {
    const pref = path.dataset.pref;
    const region = path.dataset.region;
    const riskCls = ['r-faible', 'r-moyen', 'r-eleve', 'r-critique'].find(c => path.classList.contains(c));

    const rnd = seededRandom(hashSeed(pref));
    const clients = Math.round(1200 + rnd() * 18000);
    const churn = (2 + rnd() * 16).toFixed(1);
    const inactivite = Math.round(5 + rnd() * 90);
    const echec = (1 + rnd() * 12).toFixed(1);

    mapInfoCard.classList.add('active');
    mapInfoCard.innerHTML = `
      <div class="map-info-head">
        <span class="pname">${pref}</span>
        <span class="rname">RÉGION DE ${region.toUpperCase()} · RISQUE <span style="color:${couleurPourClasseCarte(riskCls)};">${RISK_LABEL[riskCls].toUpperCase()}</span></span>
      </div>
      <div class="map-info-grid">
        <div class="map-info-stat"><div class="v">${clients.toLocaleString('fr-FR')}</div><div class="l">Clients estimés</div></div>
        <div class="map-info-stat"><div class="v">${churn}%</div><div class="l">Taux de churn (fictif)</div></div>
        <div class="map-info-stat"><div class="v">${inactivite} j</div><div class="l">Inactivité moyenne</div></div>
        <div class="map-info-stat"><div class="v">${echec}%</div><div class="l">Taux d'échec transactions</div></div>
      </div>
    `;
  }

  const allPrefPaths = document.querySelectorAll('#gnMap path.region-shape');
  allPrefPaths.forEach(path => {
    path.addEventListener('click', () => showPrefectureInfo(path));
    path.addEventListener('mouseenter', () => showPrefectureInfo(path));
    path.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPrefectureInfo(path); } });
  });
}
