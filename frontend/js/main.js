import { initTabs } from './tabs.js';
import { initMap } from './map.js';
import { initListe } from './views/list.js';
import { animateCountUp, animateBarsIn, revealStagger } from './animations.js';

initTabs();

/* Vue globale : deja visible au chargement -> animations d'entree immediates. */
revealStagger(document.querySelectorAll('#global .kpi'), { step: 60 });
document.querySelectorAll('#global .kpi .val').forEach(el => animateCountUp(el));
animateBarsIn(document.querySelectorAll('#global .journey-bar-fill'));

initMap();
initListe();
