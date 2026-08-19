import { API_OM_URL } from '../config.js';
import { obtenirRoster, obtenirEtatRoster } from '../client-store.js';
import { animateBarsIn, animateCountUp, prefersReducedMotion, revealStagger } from '../animations.js';
import { markupPourEtat, cablerBoutonImport } from '../empty-states.js';

const MOIS_COURTS = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

function formaterPeriode(periode) {
  const [annee, mois] = periode.split('-');
  return `${MOIS_COURTS[parseInt(mois, 10) - 1]} ${annee}`;
}

async function recuperer(chemin) {
  const res = await fetch(API_OM_URL + chemin);
  if (!res.ok) return null;
  return res.json();
}

/* --- Graphique de tendance : volume de transactions par mois --- */
function longueurApprox(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += Math.hypot(coords[i].x - coords[i - 1].x, coords[i].y - coords[i - 1].y);
  }
  return Math.max(1, Math.round(total));
}

function rendreGraphiqueTendance(conteneur, points) {
  if (!points || points.length === 0) {
    conteneur.innerHTML = markupPourEtat('insuffisant', "Aucune date de transaction exploitable dans le dataset actif — impossible de calculer une tendance temporelle.");
    return;
  }

  const L = 700, H = 220, M = { haut: 16, bas: 34, gauche: 46, droite: 16 };
  const largeurUtile = L - M.gauche - M.droite;
  const hauteurUtile = H - M.haut - M.bas;
  const n = points.length;
  const maxVal = Math.max(...points.map(p => p.transactions), 1);

  const xPour = (i) => M.gauche + (n === 1 ? largeurUtile / 2 : (i / (n - 1)) * largeurUtile);
  const yPour = (v) => M.haut + hauteurUtile - (v / maxVal) * hauteurUtile;
  const coords = points.map((p, i) => ({ x: xPour(i), y: yPour(p.transactions), p }));

  const lignePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const yBas = M.haut + hauteurUtile;
  const airePath = `${lignePath} L${coords[n - 1].x.toFixed(1)},${yBas} L${coords[0].x.toFixed(1)},${yBas} Z`;
  const longueur = longueurApprox(coords);

  const nbLignesGrille = 4;
  let grille = '', labelsY = '';
  for (let i = 0; i <= nbLignesGrille; i++) {
    const v = Math.round((maxVal / nbLignesGrille) * i);
    const y = yPour(v);
    grille += `<line class="trend-grid-line" x1="${M.gauche}" y1="${y.toFixed(1)}" x2="${L - M.droite}" y2="${y.toFixed(1)}"/>`;
    labelsY += `<text class="trend-axis-label" x="${M.gauche - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
  }

  const pasLabel = n > 10 ? Math.ceil(n / 7) : 1;
  const labelsX = coords.map((c, i) => (i % pasLabel === 0 || i === n - 1)
    ? `<text class="trend-axis-label" x="${c.x.toFixed(1)}" y="${H - 12}" text-anchor="middle">${formaterPeriode(c.p.periode)}</text>` : '').join('');

  const pointsSvg = coords.map((c, i) => `<circle class="trend-point" data-index="${i}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" style="animation-delay:${220 + i * Math.min(90, 500 / n)}ms;"/>`).join('');

  conteneur.innerHTML = `
    <svg viewBox="0 0 ${L} ${H}" class="trend-chart-svg" id="trendSvg" role="img" aria-label="Volume de transactions par mois">
      <g class="trend-grid">${grille}</g>
      <path class="trend-fill" d="${airePath}"/>
      <path class="trend-line" d="${lignePath}" style="--trend-len:${longueur};stroke-dasharray:${longueur};stroke-dashoffset:${longueur};"/>
      <g class="trend-labels-y">${labelsY}</g>
      <g class="trend-labels-x">${labelsX}</g>
      <g class="trend-points">${pointsSvg}</g>
    </svg>
    <div class="trend-tooltip" id="trendTooltip"></div>
  `;

  const svg = conteneur.querySelector('#trendSvg');
  const tooltip = conteneur.querySelector('#trendTooltip');
  coords.forEach((c, i) => {
    const cercle = svg.querySelector(`circle[data-index="${i}"]`);
    const afficher = () => {
      svg.querySelectorAll('.trend-point').forEach(p => p.classList.remove('actif'));
      cercle.classList.add('actif');
      tooltip.innerHTML = `<div class="trend-tooltip-titre">${formaterPeriode(c.p.periode)}</div><div class="trend-tooltip-valeur">Transactions · <b>${c.p.transactions.toLocaleString('fr-FR')}</b></div>`;
      const pctX = (c.x / L) * 100;
      const pctY = (c.y / H) * 100;
      tooltip.style.left = `${Math.min(85, Math.max(2, pctX))}%`;
      tooltip.style.top = `${Math.max(2, pctY - 12)}%`;
      tooltip.classList.add('visible');
    };
    cercle.addEventListener('mouseenter', afficher);
    cercle.addEventListener('focus', afficher);
    cercle.addEventListener('mouseleave', () => { tooltip.classList.remove('visible'); cercle.classList.remove('actif'); });
  });
}

/* --- KPI + panneaux service --- */
function fmtPct(v) { return v == null ? 'Indisponible' : `${v.toLocaleString('fr-FR')} %`; }

function construireKpis(nbClients, repartitionServices) {
  const el = document.getElementById('globalKpiRow');
  const totalTransactions = repartitionServices ? Object.values(repartitionServices.repartition).reduce((a, b) => a + b, 0) : null;
  const echecMax = repartitionServices
    ? Object.entries(repartitionServices.taux_echec_par_service).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1])[0]
    : null;

  el.innerHTML = `
    <div class="kpi"><div class="val">${nbClients.toLocaleString('fr-FR')}</div><div class="lbl">Clients (dataset actif)</div></div>
    <div class="kpi ${repartitionServices?.taux_echec_global == null ? '' : 'warn'}"><div class="val">${fmtPct(repartitionServices?.taux_echec_global)}</div><div class="lbl">Taux d'échec transactionnel</div></div>
    <div class="kpi"><div class="val">${totalTransactions != null ? totalTransactions.toLocaleString('fr-FR') : 'Indisponible'}</div><div class="lbl">Transactions</div></div>
    <div class="kpi ${echecMax ? 'risk' : ''}"><div class="val">${echecMax ? fmtPct(echecMax[1]) : 'Indisponible'}</div><div class="lbl">${echecMax ? `Échec le + élevé (${echecMax[0]})` : 'Échec le plus élevé'}</div></div>
  `;
  revealStagger(el.querySelectorAll('.kpi'), { step: 60 });
  el.querySelectorAll('.kpi .val').forEach(v => animateCountUp(v));
}

function construireRepartitionServices(repartitionServices) {
  const el = document.getElementById('globalServiceChart');
  const elEchec = document.getElementById('globalEchecChart');
  if (!repartitionServices) {
    el.innerHTML = markupPourEtat('insuffisant', "Champ type_service indisponible dans le dataset actif.");
    elEchec.innerHTML = '';
    return;
  }
  const entrees = Object.entries(repartitionServices.repartition).sort((a, b) => b[1] - a[1]);
  const total = entrees.reduce((s, [, v]) => s + v, 0) || 1;
  el.innerHTML = entrees.map(([service, count], i) => {
    const pct = Math.round((count / total) * 100);
    return `<div class="journey-step"><div class="journey-lbl">${service}</div><div class="journey-bar-track"><div class="journey-bar-fill" style="width:${pct}%;background:${i === 0 ? 'var(--orange)' : '#8C8C8C'};">${pct}%</div></div></div>`;
  }).join('');
  setTimeout(() => animateBarsIn(el.querySelectorAll('.journey-bar-fill')), 150);

  const echecs = entrees.map(([service]) => [service, repartitionServices.taux_echec_par_service[service]]).sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1));
  elEchec.innerHTML = echecs.map(([service, taux]) => `
    <div class="seg-row"><span><span class="seg-dot" style="background:${taux == null ? '#D6D6D6' : 'var(--ink)'};"></span>${service}</span><b style="color:${taux == null ? 'var(--grey)' : 'var(--ink)'};">${taux == null ? 'Indisponible' : taux + ' %'}</b></div>
  `).join('');
}

export async function initVueGlobale() {
  const empty = document.getElementById('globalEmpty');
  const contenu = document.getElementById('globalContenu');

  async function render() {
    const { etat, message } = obtenirEtatRoster();
    if (etat !== 'pret') {
      contenu.style.display = 'none';
      empty.style.display = '';
      empty.innerHTML = markupPourEtat(etat, message) || '';
      cablerBoutonImport(empty);
      return;
    }
    empty.style.display = 'none';
    contenu.style.display = '';

    const roster = obtenirRoster();
    const [timeseries, repartitionServices] = await Promise.all([
      recuperer('/data/timeseries'),
      recuperer('/data/repartition-services'),
    ]);

    construireKpis(roster.length, repartitionServices);
    rendreGraphiqueTendance(document.getElementById('trendChartConteneur'), timeseries?.points);
    construireRepartitionServices(repartitionServices);
  }

  await render();
  document.addEventListener('roster:ready', render);
}
