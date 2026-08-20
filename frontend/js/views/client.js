import { obtenirRoster, obtenirEtatRoster, trouverClientParId } from '../client-store.js';
import { couleurPourCategorie } from '../risk-colors.js';
import { getRetentionRecommendation } from '../retention.js';
import { construireDistribution, rangPercentile } from '../sample-ranges.js';
import { animateBarsIn, animateCountUp } from '../animations.js';
import { markupPourEtat, cablerBoutonImport } from '../empty-states.js';

let dernierIdRecherche = null;
let distributionsCache = null; // recalculee uniquement quand le roster change (voir render()) -- pas a chaque recherche

const CHAMPS_DISTRIBUTION = ['jours_inactivite_avant_mars', 'total_transactions', 'nb_types_service', 'montant_moyen'];
const CIRCONFERENCE_ANNEAU = 2 * Math.PI * 60; // rayon 60 (voir score-ring dans index.html)

function distributionsPourRoster(roster) {
  if (distributionsCache?.roster === roster) return distributionsCache.valeurs;
  const valeurs = {};
  for (const champ of CHAMPS_DISTRIBUTION) valeurs[champ] = construireDistribution(roster, champ);
  distributionsCache = { roster, valeurs };
  return valeurs;
}

function construireTable(client) {
  const ancienneteRow = client.jours_inactivite_avant_mars != null
    ? `<tr><td style="color:var(--grey);">Dernière activité</td><td>il y a ${Math.round(client.jours_inactivite_avant_mars)} jour(s)</td></tr>`
    : `<tr><td style="color:var(--grey);">Dernière activité</td><td style="color:var(--grey);">Indisponible — date de transaction non fournie</td></tr>`;
  return `
    <tr><td style="color:var(--grey);width:42%;">Région</td><td>${client.region}</td></tr>
    <tr><td style="color:var(--grey);">Âge</td><td style="color:var(--grey);">Indisponible — champ non présent dans le dataset</td></tr>
    <tr><td style="color:var(--grey);">Ancienneté Orange Money</td><td style="color:var(--grey);">Indisponible — champ date_souscription</td></tr>
    <tr><td style="color:var(--grey);">Transactions</td><td>${client.total_transactions}</td></tr>
    <tr><td style="color:var(--grey);">Montant moyen</td><td>${Math.round(client.montant_moyen).toLocaleString('fr-FR')} GNF</td></tr>
    <tr><td style="color:var(--grey);">Montant total</td><td>${Math.round(client.montant_total).toLocaleString('fr-FR')} GNF</td></tr>
    <tr><td style="color:var(--grey);">Services utilisés</td><td>${client.nb_types_service}</td></tr>
    ${ancienneteRow}
  `;
}

function barreFacteur(client, libelle, cle, distributions) {
  const pct = rangPercentile(client[cle], distributions[cle]) ?? 50;
  return `<div class="factor-row"><div class="factor-lbl"><span>${libelle}</span><span>${pct}e percentile éch.</span></div><div class="factor-track"><div class="factor-fill" style="width:${pct}%;"></div></div></div>`;
}

const TOUS_LES_FACTEURS = [
  { libelle: 'Inactivité', cle: 'jours_inactivite_avant_mars' },
  { libelle: 'Transactions', cle: 'total_transactions' },
  { libelle: 'Diversité de services', cle: 'nb_types_service' },
  { libelle: 'Montant moyen', cle: 'montant_moyen' },
];

function construireFacteurs(client, distributions) {
  return TOUS_LES_FACTEURS.map(f => barreFacteur(client, f.libelle, f.cle, distributions)).join('');
}

function afficherFiche(client, message, contenu, distributions) {
  message.style.display = 'none';
  contenu.style.display = '';

  document.getElementById('clientFicheTitre').textContent = `CLIENT #${client.id}`;
  document.getElementById('clientFicheTable').innerHTML = construireTable(client);

  const reco = getRetentionRecommendation(client);
  document.getElementById('clientRecoCard').innerHTML = `
    <b>Action recommandée</b>
    <div class="why"><b style="color:var(--ink);">${reco.action}</b><br>${reco.pourquoi}<br><span style="opacity:.75;">Ne constitue pas une garantie de résultat — aucun historique de campagne ne permet d'estimer un impact chiffré.</span></div>
  `;

  const couleur = couleurPourCategorie(client.niveau_risque);
  const pctScore = Math.round(client.probabilite_churn * 100);

  const scoreNum = document.getElementById('clientScoreNum');
  scoreNum.style.color = couleur;
  scoreNum.textContent = `${pctScore}%`;
  animateCountUp(scoreNum);

  const ring = document.getElementById('clientScoreRing');
  ring.style.stroke = couleur;
  ring.style.strokeDashoffset = CIRCONFERENCE_ANNEAU * (1 - pctScore / 100);

  const badge = document.getElementById('clientScoreBadge');
  badge.textContent = client.niveau_risque;
  badge.style.background = `${couleur}26`;
  badge.style.color = couleur;

  document.getElementById('clientCauseCard').textContent = reco.cause;

  const facteursEl = document.getElementById('clientFacteurs');
  facteursEl.innerHTML = construireFacteurs(client, distributions);
  animateBarsIn(facteursEl.querySelectorAll('.factor-fill'));
}

function render() {
  const message = document.getElementById('clientFicheMessage');
  const contenu = document.getElementById('clientFicheContenu');
  const input = document.getElementById('clientSearchInput');
  const { etat, message: texteEtat } = obtenirEtatRoster();

  if (etat !== 'pret') {
    contenu.style.display = 'none';
    message.style.display = '';
    message.innerHTML = markupPourEtat(etat, texteEtat) || '';
    cablerBoutonImport(message);
    return;
  }

  if (!dernierIdRecherche) {
    contenu.style.display = 'none';
    message.style.display = '';
    message.innerHTML = `<div class="map-info-empty">Recherchez un identifiant client, ou sélectionnez-en un depuis l'onglet "Clients à risque".</div>`;
    return;
  }

  const id = dernierIdRecherche;
  if (input && !input.value) input.value = id;

  const client = trouverClientParId(id);
  if (!client) {
    message.style.display = '';
    contenu.style.display = 'none';
    message.innerHTML = `<div class="map-info-empty">Client « ${id} » introuvable dans le dataset actif. Essayez un identifiant de l'onglet "Clients à risque".</div>`;
    return;
  }
  afficherFiche(client, message, contenu, distributionsPourRoster(obtenirRoster()));
}

function rechercher() {
  const input = document.getElementById('clientSearchInput');
  dernierIdRecherche = input.value.trim();
  render();
}

export async function initFicheClient() {
  const input = document.getElementById('clientSearchInput');
  const btn = document.getElementById('clientSearchBtn');
  if (!input) return;

  btn.addEventListener('click', rechercher);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') rechercher(); });
  document.addEventListener('client:select', (e) => {
    if (!e.detail?.id) return;
    dernierIdRecherche = e.detail.id;
    input.value = e.detail.id;
    render();
  });

  render();
  document.addEventListener('roster:ready', () => { dernierIdRecherche = dernierIdRecherche; render(); });
}
