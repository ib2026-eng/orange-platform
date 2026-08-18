/* Utilitaires d'animation partages -- purement visuels : n'alterent jamais
   les donnees, le scoring ou les couleurs fonctionnelles. Respectent
   prefers-reduced-motion (l'etat final est toujours applique immediatement,
   sans jouer la transition). */

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* Apparition progressive et decalee d'une liste d'elements (cartes KPI,
   lignes de tableau...). Le decalage est plafonne (maxStagger) pour que le
   temps total d'apparition reste borne meme sur de longues listes. */
export function revealStagger(elements, { step = 40, maxStagger = 16 } = {}) {
  const liste = Array.from(elements);
  if (liste.length === 0) return;
  if (prefersReducedMotion()) {
    liste.forEach(el => el.classList.add('reveal', 'is-visible'));
    return;
  }
  liste.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.setProperty('--reveal-delay', `${Math.min(i, maxStagger) * step}ms`);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    liste.forEach(el => el.classList.add('is-visible'));
  }));
}

/* Anime la largeur de barres (repartition service, facteurs) de 0 jusqu'a
   leur largeur cible deja definie en inline style dans le HTML. */
export function animateBarsIn(elements) {
  const liste = Array.from(elements);
  if (liste.length === 0 || prefersReducedMotion()) return;
  const cibles = liste.map(el => el.style.width);
  liste.forEach(el => { el.style.width = '0%'; });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    liste.forEach((el, i) => { el.style.width = cibles[i]; });
  }));
}

/* Fait defiler un chiffre de 0 jusqu'a sa valeur finale, puis fixe le texte
   exactement a sa valeur d'origine (aucune derive d'arrondi possible). Les
   formats geres : "6 493", "6,4 %", "14,6 %", etc. Si le texte n'est pas un
   nombre reconnaissable (ex. "—"), l'element n'est pas touche. */
export function animateCountUp(el, { duration = 700 } = {}) {
  if (!el || prefersReducedMotion()) return;
  const brut = el.textContent.trim();
  const correspondance = brut.match(/^(\D*)([\d\s.,]*\d)(\D*)$/);
  if (!correspondance) return;

  const [, prefixe, partieNombre, suffixe] = correspondance;
  const normalise = partieNombre.replace(/\s/g, '').replace(',', '.');
  const cible = parseFloat(normalise);
  if (Number.isNaN(cible)) return;
  const decimales = normalise.includes('.') ? normalise.split('.')[1].length : 0;

  const depart = performance.now();
  function frame(maintenant) {
    const t = Math.min((maintenant - depart) / duration, 1);
    const progression = 1 - Math.pow(1 - t, 3); // ease-out cubique
    const valeur = cible * progression;
    el.textContent = prefixe + valeur.toLocaleString('fr-FR', {
      minimumFractionDigits: decimales, maximumFractionDigits: decimales,
    }) + suffixe;
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = brut; // verrouille la valeur d'origine, au caractere pres
  }
  requestAnimationFrame(frame);
}
