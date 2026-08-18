/* Source unique des couleurs de risque : lit les jetons CSS de tokens.css
   au lieu de dupliquer des valeurs hex dans le JS (voir etape 4). */
function lireJeton(nom) {
  return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
}

const JETON_PAR_CLASSE_CARTE = {
  'r-faible': '--risk-faible',
  'r-moyen': '--risk-modere',
  'r-eleve': '--risk-eleve',
  'r-critique': '--risk-critique',
};

const JETON_PAR_CATEGORIE = {
  'Faible': '--risk-faible',
  'Modéré': '--risk-modere',
  'Élevé': '--risk-eleve',
  'Critique': '--risk-critique',
};

export function couleurPourClasseCarte(classeCss) {
  return lireJeton(JETON_PAR_CLASSE_CARTE[classeCss]);
}

export function couleurPourCategorie(categorie) {
  return lireJeton(JETON_PAR_CATEGORIE[categorie]);
}
