import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getRetentionRecommendation } from '../js/retention.js';

function client(overrides = {}) {
  return {
    id: 'PT000', region: 'Conakry',
    total_transactions: 5, nb_types_service: 4,
    jours_inactivite_avant_mars: 5, montant_moyen: 10000,
    montant_total: 50000, services_utilises: ['Paiement Marchand', 'Cashout'],
    taux_echec_client: null,
    probabilite_churn: 0.3, prediction_churn: 0, niveau_risque: 'Modéré',
    ...overrides,
  };
}

test('Expérience dégradée : priorité maximale si taux d\'échec élevé', () => {
  const reco = getRetentionRecommendation(client({ taux_echec_client: 35, jours_inactivite_avant_mars: 90, niveau_risque: 'Critique' }));
  assert.equal(reco.cause, 'Expérience dégradée');
  assert.ok(reco.pourquoi.includes('35%'));
});

test('Expérience dégradée : ne se déclenche jamais si taux_echec_client est null', () => {
  const reco = getRetentionRecommendation(client({ taux_echec_client: null, jours_inactivite_avant_mars: 90 }));
  assert.notEqual(reco.cause, 'Expérience dégradée');
});

test('Sensibilité aux frais : client actif sans aucun service verrouillant', () => {
  const reco = getRetentionRecommendation(client({
    total_transactions: 15,
    services_utilises: ['Cashout', 'P2P'],
    niveau_risque: 'Faible',
    montant_moyen: 5000,
  }));
  assert.equal(reco.cause, 'Sensibilité aux frais');
  assert.equal(reco.action, 'Offre préférentielle sur frais de transfert/retrait');
});

test('Sensibilité aux frais : ne se déclenche pas si le client a déjà un service verrouillant', () => {
  const reco = getRetentionRecommendation(client({
    total_transactions: 15,
    services_utilises: ['Cashout', 'Paiement Marchand'],
    niveau_risque: 'Faible',
    montant_moyen: 5000,
  }));
  assert.notEqual(reco.cause, 'Sensibilité aux frais');
});

test('Sensibilité aux frais : ne se déclenche pas si peu de transactions (pas un usage réel actif)', () => {
  const reco = getRetentionRecommendation(client({
    total_transactions: 2,
    services_utilises: ['Cashout'],
    niveau_risque: 'Faible',
    montant_moyen: 5000,
  }));
  assert.notEqual(reco.cause, 'Sensibilité aux frais');
});

test('Diversité de services : la suggestion nomme un service précis', () => {
  const reco = getRetentionRecommendation(client({ nb_types_service: 1, services_utilises: ['Cashout'], niveau_risque: 'Faible', total_transactions: 3, montant_moyen: 1000 }));
  assert.equal(reco.cause, 'Diversité de services');
  assert.ok(reco.pourquoi.includes('Paiement Marchand'));
});

test('Valeur client : mentionne le service principal du client', () => {
  const reco = getRetentionRecommendation(client({
    niveau_risque: 'Critique', montant_moyen: 200000, jours_inactivite_avant_mars: 2,
    services_utilises: ['Paiement Salaire'], nb_types_service: 3,
  }));
  assert.equal(reco.cause, 'Valeur client');
  assert.ok(reco.pourquoi.includes('Paiement Salaire'));
});

test('Risque de churn générique : affiche les valeurs brutes du profil', () => {
  const reco = getRetentionRecommendation(client({
    niveau_risque: 'Critique', montant_moyen: 5000, total_transactions: 4, nb_types_service: 3,
    services_utilises: ['Paiement Marchand', 'Cashout', 'Top Up'], jours_inactivite_avant_mars: 2,
  }));
  assert.equal(reco.cause, 'Risque de churn');
  assert.ok(reco.pourquoi.includes('4 transactions'));
  assert.ok(reco.pourquoi.includes('GNF'));
});

test('Aucun facteur dominant reste inchangé pour un profil sain', () => {
  const reco = getRetentionRecommendation(client({ niveau_risque: 'Faible', jours_inactivite_avant_mars: 2 }));
  assert.equal(reco.cause, 'Aucun facteur dominant');
});
