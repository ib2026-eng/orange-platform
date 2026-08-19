import { API_OM_URL } from '../config.js';
import { rafraichirRoster } from '../client-store.js';

/* Vue "Data Import". Pipeline : upload -> analyse -> aperçu qualité ->
   validation -> dataset actif. Une fois validé (ou supprimé), le dataset
   actif devient la source de vérité de toute l'application -- rafraichirRoster()
   notifie les autres vues via l'evenement 'roster:ready'.

   Choreographie honnete : la barre de progression "Upload" reflete un vrai
   pourcentage d'octets envoyes (evenement XHR reel). L'etape "Analyse" n'a
   pas de progression chiffree -- le backend traite tout en un seul appel
   synchrone, aucune donnee reelle de progression n'existe pendant cette
   attente. Toutes les valeurs affichees ensuite proviennent integralement
   de la reponse de l'API. */

const elements = {};

function q(id) { return document.getElementById(id); }

function definirEtapeActive(nomEtape) {
  document.querySelectorAll('#pipelineStepper .pipeline-step').forEach(el => {
    const etape = el.dataset.stage;
    el.classList.remove('actif', 'fait');
    if (etape === nomEtape) el.classList.add('actif');
    else if (ordreAvant(etape, nomEtape)) el.classList.add('fait');
  });
}

const ORDRE_ETAPES = ['upload', 'analyse', 'ready'];
function ordreAvant(etape, reference) { return ORDRE_ETAPES.indexOf(etape) < ORDRE_ETAPES.indexOf(reference); }

function reinitialiserVuePipeline() {
  elements.dropzonePanel.style.display = '';
  elements.pipelinePanel.style.display = 'none';
  elements.resultPanel.style.display = 'none';
  elements.readyPanel.style.display = 'none';
  elements.uploadProgressFill.style.width = '0%';
  elements.fileInput.value = '';
}

function formaterOctets(o) {
  if (o < 1024) return `${o} o`;
  if (o < 1024 * 1024) return `${(o / 1024).toFixed(0)} Ko`;
  return `${(o / (1024 * 1024)).toFixed(1)} Mo`;
}

function classeScoreQualite(score) {
  if (score >= 80) return 'safe';
  if (score >= 50) return 'mid';
  return 'risk';
}

function construireKpiQualite(profil) {
  const classeScore = classeScoreQualite(profil.score_qualite);
  elements.qualityKpiRow.innerHTML = `
    <div class="kpi"><div class="val">${profil.lignes_recues.toLocaleString('fr-FR')}</div><div class="lbl">Lignes reçues</div></div>
    <div class="kpi"><div class="val">${profil.lignes_valides.toLocaleString('fr-FR')}</div><div class="lbl">Lignes valides</div></div>
    <div class="kpi"><div class="val">${profil.pct_lignes_valides}%</div><div class="lbl">Lignes valides (%)</div></div>
    <div class="kpi ${classeScore === 'risk' ? 'risk' : classeScore === 'mid' ? 'warn' : ''}"><div class="val">${profil.score_qualite}/100</div><div class="lbl">Score qualité</div></div>
  `;
}

function construireAvertissementsQualite(profil, colonnesManquantes) {
  const items = [];
  if (colonnesManquantes && colonnesManquantes.length > 0) {
    items.push(`<div class="data-quality-error">✕ Import impossible — colonne(s) requise(s) introuvable(s), même après reconnaissance automatique des variantes de nom : ${colonnesManquantes.join(', ')}. Vérifiez que le fichier contient bien cette donnée.</div>`);
  } else if (profil && profil.lignes_recues > 0 && profil.lignes_valides === 0) {
    items.push(`<div class="data-quality-error">✕ Aucune ligne exploitable : les colonnes requises sont présentes, mais chaque ligne a un champ requis vide ou invalide (montant...). Vérifiez le contenu du fichier.</div>`);
  }
  if (profil) {
    if (profil.doublons > 0) items.push(`<div class="data-quality-warning">⚠ ${profil.doublons.toLocaleString('fr-FR')} doublon(s) détecté(s) et retiré(s)</div>`);
    if (profil.valeurs_manquantes > 0) items.push(`<div class="data-quality-warning">⚠ ${profil.valeurs_manquantes.toLocaleString('fr-FR')} valeur(s) manquante(s)</div>`);
  }
  elements.qualityWarnings.innerHTML = items.join('');
}

function construireRapportMapping(rapport) {
  const el = elements.mappingReport;
  if (!el) return;
  if (!rapport || rapport.length === 0) { el.innerHTML = ''; return; }

  const reconnues = rapport.filter(r => r.colonne_canonique);
  const nonUtilisees = rapport.filter(r => !r.colonne_canonique);

  const ligne = (r) => `<div style="font-size:12px;padding:3px 0;"><span style="font-family:'JetBrains Mono',monospace;">${r.colonne_originale}</span> → <b>${r.colonne_canonique}</b></div>`;
  const ligneNonUtilisee = (r) => `<div style="font-size:12px;padding:3px 0;color:var(--grey);"><span style="font-family:'JetBrains Mono',monospace;">${r.colonne_originale}</span> — conservée, non utilisée par le modèle${r.confiance === 'conflit' ? ' (correspondance ambiguë)' : ''}</div>`;

  el.innerHTML = `
    ${reconnues.length ? `
      <div class="panel-label" style="margin-top:0;">COLONNES RECONNUES AUTOMATIQUEMENT</div>
      ${reconnues.map(ligne).join('')}
    ` : ''}
    ${nonUtilisees.length ? `
      <div class="panel-label" style="margin-top:12px;">COLONNES CONSERVÉES, NON UTILISÉES</div>
      ${nonUtilisees.map(ligneNonUtilisee).join('')}
    ` : ''}
  `;
}

function construireErreursValidation(erreurs) {
  if (!erreurs || erreurs.length === 0) { elements.errorsPanel.innerHTML = ''; return; }
  elements.errorsPanel.innerHTML = erreurs.slice(0, 10).map(e =>
    `<div class="data-quality-error">Ligne ${e.ligne != null ? e.ligne + 1 : '—'}${e.colonne ? ` · ${e.colonne}` : ''} — ${e.message}</div>`
  ).join('');
}

function construireApercuTable(apercu) {
  if (!apercu || apercu.colonnes.length === 0) { elements.previewTable.innerHTML = ''; return; }
  const thead = `<thead><tr>${apercu.colonnes.map(c => `<th>${c.colonne}<br><span style="font-weight:400; text-transform:none; color:var(--grey);">${c.type_detecte}${c.valeurs_manquantes ? ` · ${c.valeurs_manquantes} manq.` : ''}</span></th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${apercu.lignes.map(ligne => `<tr>${apercu.colonnes.map(c => `<td>${ligne[c.colonne] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>`;
  elements.previewTable.innerHTML = thead + tbody;
}

function majBadgeSource(source, nomFichier) {
  elements.sourceBadge.textContent = source === 'importe'
    ? `SOURCE · Dataset actif${nomFichier ? ` (${nomFichier})` : ''}`
    : 'SOURCE · Aucun dataset actif';
}

async function chargerStatutInitial() {
  try {
    const res = await fetch(API_OM_URL + '/data/status');
    if (!res.ok) return;
    const statut = await res.json();
    majBadgeSource(statut.source, statut.actif?.nom_fichier);
    if (statut.actif) afficherResume(statut.actif);
  } catch (err) {
    // API indisponible au chargement -- l'etat vide des autres vues gere deja ce cas.
  }
}

function afficherResume(actif) {
  reinitialiserVuePipeline();
  elements.dropzonePanel.style.display = 'none';
  elements.readyPanel.style.display = '';
  const p = actif.profil;
  elements.readyDetail.textContent = p
    ? `${p.lignes_valides.toLocaleString('fr-FR')} lignes valides · score qualité ${p.score_qualite}/100 · importé le ${new Date(actif.importe_le).toLocaleString('fr-FR')}`
    : `Importé le ${new Date(actif.importe_le).toLocaleString('fr-FR')}`;
}

function televerserFichier(fichier) {
  reinitialiserVuePipeline();
  elements.dropzonePanel.style.display = 'none';
  elements.pipelinePanel.style.display = '';
  definirEtapeActive('upload');
  elements.pipelineStatusText.textContent = `Envoi de ${fichier.name} (${formaterOctets(fichier.size)})...`;

  const donnees = new FormData();
  donnees.append('fichier', fichier);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', API_OM_URL + '/data/import');

  xhr.upload.addEventListener('progress', (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    elements.uploadProgressFill.style.width = pct + '%';
    if (pct >= 100) {
      definirEtapeActive('analyse');
      elements.pipelineStatusText.textContent = 'Analyse en cours...';
    }
  });

  xhr.addEventListener('load', () => {
    let body;
    try { body = JSON.parse(xhr.responseText); } catch { afficherErreurImport("Réponse de l'API illisible."); return; }
    if (xhr.status !== 200) { afficherErreurImport(body.detail || "Erreur lors de l'import."); return; }
    afficherResultatImport(body);
  });

  xhr.addEventListener('error', () => afficherErreurImport("API indisponible -- vérifiez que le backend est démarré et joignable."));
  xhr.send(donnees);
}

function afficherErreurImport(message) {
  elements.pipelinePanel.style.display = 'none';
  elements.dropzonePanel.style.display = '';
  elements.pipelineStatusText.textContent = '';
  window.alert(message);
}

function afficherResultatImport(body) {
  definirEtapeActive(body.pret_a_valider ? 'ready' : 'analyse');
  elements.pipelinePanel.style.display = 'none';
  elements.resultPanel.style.display = '';

  const dataset = body.en_attente;
  if (dataset.profil) construireKpiQualite(dataset.profil);
  else elements.qualityKpiRow.innerHTML = '';
  construireAvertissementsQualite(dataset.profil, dataset.colonnes_manquantes);
  construireErreursValidation(body.apercu_erreurs);
  construireApercuTable(body.apercu_donnees);
  construireRapportMapping(dataset.rapport_mapping);

  elements.validateBtn.disabled = !body.pret_a_valider;
  elements.validateBtn.textContent = body.pret_a_valider ? 'Valider le dataset' : 'Corriger avant validation';
}

async function confirmerImport() {
  try {
    const res = await fetch(API_OM_URL + '/data/validate', { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body.detail || 'Validation impossible.');
      return;
    }
    const body = await res.json();
    majBadgeSource('importe', body.actif.nom_fichier);
    elements.resultPanel.style.display = 'none';
    afficherResume(body.actif);
    await rafraichirRoster();
  } catch (err) {
    window.alert("API indisponible -- validation impossible pour le moment.");
  }
}

async function annulerImport() {
  try { await fetch(API_OM_URL + '/data/cancel', { method: 'POST' }); } catch (err) { /* best-effort */ }
  reinitialiserVuePipeline();
}

async function supprimerDataset() {
  try {
    await fetch(API_OM_URL + '/data', { method: 'DELETE' });
  } catch (err) {
    window.alert("API indisponible -- impossible de supprimer le dataset actif pour le moment.");
    return;
  }
  majBadgeSource('aucun');
  reinitialiserVuePipeline();
  await rafraichirRoster();
}

export function initDataImport() {
  elements.dropzone = q('dropzone');
  elements.dropzonePanel = q('importDropzonePanel');
  elements.fileInput = q('fileInput');
  elements.selectFileBtn = q('selectFileBtn');
  elements.pipelinePanel = q('importPipelinePanel');
  elements.uploadProgressFill = q('uploadProgressFill');
  elements.pipelineStatusText = q('pipelineStatusText');
  elements.resultPanel = q('importResultPanel');
  elements.qualityKpiRow = q('qualityKpiRow');
  elements.qualityWarnings = q('qualityWarnings');
  elements.errorsPanel = q('importErrorsPanel');
  elements.mappingReport = q('mappingReport');
  elements.previewTable = q('previewTable');
  elements.validateBtn = q('validateImportBtn');
  elements.cancelBtn = q('cancelImportBtn');
  elements.readyPanel = q('importReadyPanel');
  elements.readyDetail = q('importReadyDetail');
  elements.removeDatasetBtn = q('removeDatasetBtn');
  elements.sourceBadge = q('dataSourceBadge');

  if (!elements.dropzone) return;

  elements.selectFileBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', () => { if (elements.fileInput.files[0]) televerserFichier(elements.fileInput.files[0]); });

  elements.dropzone.addEventListener('click', (e) => {
    // fileInput.click() emet lui-meme un evenement click qui remonte
    // jusqu'ici (fileInput est un enfant de dropzone) : sans ce garde, le
    // clic sur #selectFileBtn (ou le declenchement programmatique) reboucle
    // indefiniment sur fileInput.click(), epuise l'activation utilisateur,
    // et la boite de dialogue native ne s'ouvre jamais silencieusement.
    if (e.target === elements.selectFileBtn || e.target === elements.fileInput) return;
    elements.fileInput.click();
  });
  elements.dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elements.fileInput.click(); } });
  ['dragover', 'dragenter'].forEach(evt => elements.dropzone.addEventListener(evt, (e) => { e.preventDefault(); elements.dropzone.classList.add('dragover'); }));
  ['dragleave', 'dragend'].forEach(evt => elements.dropzone.addEventListener(evt, () => elements.dropzone.classList.remove('dragover')));
  elements.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropzone.classList.remove('dragover');
    const fichier = e.dataTransfer.files[0];
    if (fichier) televerserFichier(fichier);
  });

  elements.validateBtn.addEventListener('click', confirmerImport);
  elements.cancelBtn.addEventListener('click', annulerImport);
  elements.removeDatasetBtn.addEventListener('click', supprimerDataset);

  chargerStatutInitial();
}
