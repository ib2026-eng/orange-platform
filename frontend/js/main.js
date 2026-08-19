import { initTabs } from './tabs.js';
import { initMap } from './map.js';
import { initClientStore } from './client-store.js';
import { initVueGlobale } from './views/global.js';
import { initListe } from './views/list.js';
import { initSegmentation } from './views/loyalty.js';
import { initNba } from './views/nba.js';
import { initDataImport } from './views/data-import.js';
import { initFicheClient } from './views/client.js';

initTabs();
initMap();

// Source unique de verite : charge le dataset actif une fois, chaque vue
// s'abonne a 'roster:ready' et se met a jour independamment.
initClientStore();

initVueGlobale();
initListe();
initSegmentation();
initNba();
initDataImport();
initFicheClient();
