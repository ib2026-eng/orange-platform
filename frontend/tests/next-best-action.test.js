import assert from 'node:assert/strict';
import { test } from 'node:test';

import { grouperActions } from '../js/next-best-action.js';
import { calculerSegmentation } from '../js/segmentation.js';

function client(overrides = {}) {
  return {
    id: 'PT000', region: 'Conakry',
    total_transactions: 20, nb_types_service: 4,
    jours_inactivite_avant_mars: 30, montant_moyen: 100000,
    montant_total: 2000000,
    probabilite_churn: 0.3, prediction_churn: 0, niveau_risque: 'Modéré',
    ...overrides,
  };
}

test('grouperActions: dataset vide -> aucun groupe, aucun crash', () => {
  const groupes = grouperActions([]);
  assert.deepEqual(groupes, []);
});

test('grouperActions: repartit chaque client dans exactement un groupe (aucune perte)', () => {
  const clients = [
    client({ id: 'A', niveau_risque: 'Critique', jours_inactivite_avant_mars: 80 }), // -> reactivation
    client({ id: 'B', niveau_risque: 'Élevé', montant_moyen: 200000, jours_inactivite_avant_mars: 5 }), // -> fidelisation
    client({ id: 'C', niveau_risque: 'Modéré', nb_types_service: 1, jours_inactivite_avant_mars: 5 }), // -> cross-sell
    client({ id: 'D', niveau_risque: 'Faible', jours_inactivite_avant_mars: 5 }), // -> suivi standard
  ];
  const groupes = grouperActions(clients);
  const totalClients = groupes.reduce((s, g) => s + g.nbClients, 0);
  assert.equal(totalClients, 4);
});

test('grouperActions: jamais un groupe unique "Cashback marchand 5%" pour tout le monde', () => {
  const clients = [
    client({ id: 'A', niveau_risque: 'Critique', jours_inactivite_avant_mars: 80 }),
    client({ id: 'B', niveau_risque: 'Critique', montant_moyen: 200000, jours_inactivite_avant_mars: 5 }),
    client({ id: 'C', niveau_risque: 'Critique', nb_types_service: 1, jours_inactivite_avant_mars: 5 }),
  ];
  const groupes = grouperActions(clients);
  assert.ok(groupes.length > 1, 'des clients Critique avec des causes differentes doivent produire plusieurs actions distinctes');
  groupes.forEach(g => assert.notEqual(g.action, 'Cashback marchand 5%'));
});

test('grouperActions: risqueDominant et segmentDominant sont calcules par groupe', () => {
  const { clients } = calculerSegmentation([
    client({ id: 'A', niveau_risque: 'Critique', jours_inactivite_avant_mars: 80 }),
    client({ id: 'B', niveau_risque: 'Critique', jours_inactivite_avant_mars: 85 }),
  ]);
  const groupes = grouperActions(clients);
  assert.equal(groupes.length, 1);
  assert.equal(groupes[0].risqueDominant, 'Critique');
  assert.ok(['Platinum', 'Gold', 'Silver', 'Bronze'].includes(groupes[0].segmentDominant));
});

test('filtrage: on peut restreindre les clients par risque puis par segment avant regroupement', () => {
  const { clients } = calculerSegmentation([
    client({ id: 'A', niveau_risque: 'Critique', jours_inactivite_avant_mars: 80 }),
    client({ id: 'B', niveau_risque: 'Faible', jours_inactivite_avant_mars: 1, montant_moyen: 5000, nb_types_service: 8, total_transactions: 40 }),
  ]);
  const filtresCritique = clients.filter(c => c.niveau_risque === 'Critique');
  assert.equal(filtresCritique.length, 1);
  const groupes = grouperActions(filtresCritique);
  assert.equal(groupes.reduce((s, g) => s + g.nbClients, 0), 1);
});
