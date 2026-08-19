/* Etats vides professionnels partages -- remplace les placeholders "type
   demo" par une communication claire de ce qui manque et de l'action a
   faire. Reutilise .map-info-empty (deja existant) plutot que d'inventer
   un nouveau composant visuel. */

export function markupAucunDataset() {
  return `
    <div class="empty-state">
      <div class="empty-state-titre">Aucun dataset actif</div>
      <div class="empty-state-texte">Importez vos données clients pour afficher les indicateurs, segments et recommandations.</div>
      <button type="button" class="btn-primary empty-state-cta" id="__emptyStateImportBtn">Importer des données</button>
    </div>
  `;
}

export function markupDonneesInsuffisantes(message) {
  return `
    <div class="empty-state">
      <div class="empty-state-titre">Données insuffisantes</div>
      <div class="empty-state-texte">${message || "Les données disponibles ne permettent pas encore de calculer cette analyse."}</div>
    </div>
  `;
}

export function markupChargement() {
  return `<div class="empty-state"><div class="empty-state-texte">Chargement du dataset actif...</div></div>`;
}

export function markupErreur(message) {
  return `<div class="empty-state"><div class="empty-state-titre">Indisponible</div><div class="empty-state-texte">${message || "API indisponible."}</div></div>`;
}

/* Cable le bouton "Importer des données" d'un etat vide fraichement injecte
   dans le DOM -- a appeler juste apres avoir pose markupAucunDataset(). */
export function cablerBoutonImport(conteneur) {
  conteneur.querySelector('#__emptyStateImportBtn')?.addEventListener('click', () => {
    document.querySelector('.tab[data-view="import"]')?.click();
  });
}

/* Rendu generique par etat -- retourne le HTML approprie ou null si l'appelant
   doit rendre son propre contenu (etat 'pret'). */
export function markupPourEtat(etat, message) {
  switch (etat) {
    case 'vide': return markupAucunDataset();
    case 'insuffisant': return markupDonneesInsuffisantes(message);
    case 'erreur': return markupErreur(message);
    case 'chargement': return markupChargement();
    default: return null;
  }
}
