import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  estServiceVerrouillant,
  estServiceFaibleVerrouillage,
  suggererServiceVerrouillant,
  estExposeALaConcurrenceLowCost,
} from '../js/service-catalog.js';

test('classification : services verrouillants vs faible verrouillage sont distincts', () => {
  assert.equal(estServiceVerrouillant('Paiement Marchand'), true);
  assert.equal(estServiceFaibleVerrouillage('Paiement Marchand'), false);
  assert.equal(estServiceVerrouillant('Cashout'), false);
  assert.equal(estServiceFaibleVerrouillage('Cashout'), true);
});

test('suggererServiceVerrouillant : ne suggere pas un service deja utilise', () => {
  const suggestion = suggererServiceVerrouillant(['Paiement Marchand']);
  assert.notEqual(suggestion, 'Paiement Marchand');
});

test('suggererServiceVerrouillant : dataset vide -> une suggestion par defaut', () => {
  assert.equal(typeof suggererServiceVerrouillant([]), 'string');
});

test('estExposeALaConcurrenceLowCost : true si aucun service verrouillant utilise', () => {
  assert.equal(estExposeALaConcurrenceLowCost(['Cashout', 'P2P']), true);
});

test('estExposeALaConcurrenceLowCost : false des qu un service verrouillant est present', () => {
  assert.equal(estExposeALaConcurrenceLowCost(['Cashout', 'Paiement Marchand']), false);
});

test('estExposeALaConcurrenceLowCost : false si aucun service faible-verrouillage non plus', () => {
  assert.equal(estExposeALaConcurrenceLowCost([]), false);
  assert.equal(estExposeALaConcurrenceLowCost(['Fermeture De Compte']), false);
});
