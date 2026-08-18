import { fetchScoresBatch, scoreLocalement } from '../api.js';
import { couleurPourCategorie } from '../risk-colors.js';
import { hashSeed, seededRandom } from '../random.js';
import { revealStagger, prefersReducedMotion } from '../animations.js';

const REGIONS_GN = ['Boké', 'Faranah', 'Kankan', 'Kindia', 'Labé', 'Mamou', 'Nzérékoré', 'Conakry'];
const ACTIONS_PAR_CATEGORIE = {
  'Critique': "Cashback marchand 5%",
  'Élevé': "Contact support prioritaire",
  'Modéré': "Offre découverte paiement marchand",
  'Faible': "Suivi standard",
};

function genererClientsFictifs() {
  const clients = [];
  for (let i = 1; i <= 100; i++) {
    const id = `PT${240000 + i * 37}.${1000 + i}.${800000 + i * 13}`;
    const rnd = seededRandom(hashSeed(id));
    const total_transactions = Math.round(1 + rnd() * 40);
    const nb_types_service = Math.round(1 + rnd() * 7);
    const jours_inactivite_avant_mars = Math.round(rnd() * 89);
    const montant_moyen = Math.round(5000 + rnd() * 300000);
    const region = REGIONS_GN[Math.floor(rnd() * 1000) % REGIONS_GN.length];
    clients.push({
      id, region, total_transactions, nb_types_service,
      jours_inactivite_avant_mars, montant_moyen,
      montant_total: montant_moyen * total_transactions,
    });
  }
  return clients;
}

function renderSkeleton(tbody, n = 8) {
  const largeurs = [120, 70, 90, 60, 140];
  tbody.innerHTML = Array.from({ length: n }, () => `
    <tr class="skeleton-row">
      ${largeurs.map(l => `<td><span class="skeleton-bar" style="width:${l}px;"></span></td>`).join('')}
    </tr>
  `).join('');
}

function renderListe(clientsAvecScore, { clientListBody, listSummary }) {
  clientsAvecScore.sort((a, b) => b.probabilite_churn - a.probabilite_churn);
  const nbRisque = clientsAvecScore.filter(c => c.prediction_churn === 1).length;
  listSummary.textContent = `${nbRisque} à risque élevé/critique`;

  clientListBody.innerHTML = "";
  const lignes = clientsAvecScore.map(c => {
    const color = couleurPourCategorie(c.niveau_risque);
    const pct = Math.round(c.probabilite_churn * 100);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:'JetBrains Mono',monospace; font-size:11px;">${c.id}</td>
      <td>${c.region}</td>
      <td>
        <div class="score-bar-wrap">
          <div class="score-bar-track"><div class="score-bar-fill" data-target-width="${pct}%" style="width:0%; background:${color};"></div></div>
          <span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:${color};">${pct}%</span>
        </div>
      </td>
      <td><span class="badge" style="background:${color}26; color:${color};">${c.niveau_risque}</span></td>
      <td style="font-size:12px; color:var(--grey);">${ACTIONS_PAR_CATEGORIE[c.niveau_risque] || '—'}</td>
    `;
    clientListBody.appendChild(tr);
    return tr;
  });

  revealStagger(lignes, { step: 8, maxStagger: 20 });

  const appliquerLargeursCibles = () => {
    clientListBody.querySelectorAll('.score-bar-fill').forEach(fill => {
      fill.style.width = fill.dataset.targetWidth;
    });
  };
  if (prefersReducedMotion()) {
    appliquerLargeursCibles();
  } else {
    requestAnimationFrame(() => requestAnimationFrame(appliquerLargeursCibles));
  }
}

export async function initListe() {
  const clientListBody = document.getElementById('clientListBody');
  const listSummary = document.getElementById('listSummary');
  const listApiStatus = document.getElementById('listApiStatus');
  if (!clientListBody) return;

  renderSkeleton(clientListBody);

  const clientsBruts = genererClientsFictifs();
  try {
    const fusion = await fetchScoresBatch(clientsBruts);
    renderListe(fusion, { clientListBody, listSummary });
    listApiStatus.textContent = "✓ Scores calculés via l'API (modèle placeholder)";
    listApiStatus.style.color = "#0A0A0A";
  } catch (err) {
    const fictifs = scoreLocalement(clientsBruts);
    renderListe(fictifs, { clientListBody, listSummary });
    listApiStatus.textContent = "⚠ API indisponible (mise en veille probable) — scores calculés localement, patientez puis rechargez";
    listApiStatus.style.color = "#5C5C5C";
  }
}
