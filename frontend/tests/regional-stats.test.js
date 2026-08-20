import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normaliserNomRegion, regrouperClientsParRegion, calculerStatsRegion } from '../js/regional-stats.js';

function client(overrides = {}) {
  return {
    id: 'C1', region: 'Conakry', niveau_risque: 'Élevé', probabilite_churn: 0.5,
    total_transactions: 10, nb_types_service: 3, jours_inactivite_avant_mars: 5, montant_moyen: 50000,
    ...overrides,
  };
}

test('normaliserNomRegion: variantes accentuees/non-accentuees convergent', () => {
  assert.equal(normaliserNomRegion('Nzérékoré'), normaliserNomRegion("N'Zerekore"));
  assert.equal(normaliserNomRegion('Boké'), normaliserNomRegion('Boke'));
  assert.equal(normaliserNomRegion('Labé'), normaliserNomRegion('Labe'));
});

test('regrouperClientsParRegion: regroupe correctement, ignore les regions vides', () => {
  const roster = [client({ id: 'A', region: 'Conakry' }), client({ id: 'B', region: 'Boke' }), client({ id: 'C', region: '' })];
  const groupes = regrouperClientsParRegion(roster);
  assert.equal(groupes.get(normaliserNomRegion('Conakry')).length, 1);
  assert.equal(groupes.get(normaliserNomRegion('Boke')).length, 1);
  assert.equal(groupes.size, 2);
});

test('calculerStatsRegion: distribution de risque reelle, pas inventee', () => {
  const clients = [
    client({ niveau_risque: 'Critique' }),
    client({ niveau_risque: 'Critique' }),
    client({ niveau_risque: 'Faible' }),
    client({ niveau_risque: 'Faible' }),
  ];
  const stats = calculerStatsRegion(clients);
  assert.equal(stats.clients, 4);
  assert.equal(stats.distribution.critique, 50);
  assert.equal(stats.distribution.faible, 50);
  assert.equal(stats.clientsARisque, 2);
});

test('calculerStatsRegion: aucun client -> null (pas de valeur devinee)', () => {
  assert.equal(calculerStatsRegion([]), null);
});

test('calculerStatsRegion: cause dominante vient de la meme regle que Next Best Action', () => {
  // tous inactifs depuis longtemps -> cause "Inactivité" (voir retention.js)
  const clients = [client({ jours_inactivite_avant_mars: 90 }), client({ jours_inactivite_avant_mars: 80 })];
  const stats = calculerStatsRegion(clients);
  assert.equal(stats.causeDominante.libelle, 'Inactivité');
  assert.equal(stats.causeDominante.pct, 100);
});
