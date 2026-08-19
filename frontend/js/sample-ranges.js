/* Position d'une valeur en percentile REEL dans la distribution du roster
   actuellement charge -- jamais une plage fixe/historique. Recalculee a
   chaque dataset actif, donc valide aussi bien sur un petit echantillon que
   sur 700 000+ clients reels (voir Phase 13 : d'anciennes bornes fixes,
   calibrees sur les 100 clients de demo, saturaient a 100% une bonne partie
   des clients reels et rendaient le classement RFM inutilisable). */

export function construireDistribution(clients, champ) {
  return clients
    .map(c => c[champ])
    .filter(v => typeof v === 'number' && !Number.isNaN(v))
    .sort((a, b) => a - b);
}

export function rangPercentile(valeur, valeursTriees) {
  if (!valeursTriees || valeursTriees.length === 0 || typeof valeur !== 'number' || Number.isNaN(valeur)) return null;
  let lo = 0, hi = valeursTriees.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (valeursTriees[mid] <= valeur) lo = mid + 1; else hi = mid;
  }
  return Math.round((lo / valeursTriees.length) * 100);
}
