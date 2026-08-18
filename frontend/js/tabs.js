import { animateChurnFactorsOnce } from './views/churn.js';

const dejaOuvert = new Set();
const ANIMATIONS_PREMIERE_OUVERTURE = {
  churn: animateChurnFactorsOnce,
};

export function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.view).classList.add('active');

      const vue = tab.dataset.view;
      if (!dejaOuvert.has(vue) && ANIMATIONS_PREMIERE_OUVERTURE[vue]) {
        dejaOuvert.add(vue);
        ANIMATIONS_PREMIERE_OUVERTURE[vue]();
      }
    });
  });
}
