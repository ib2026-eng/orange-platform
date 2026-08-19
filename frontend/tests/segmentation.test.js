import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SEGMENTS, calculerSegmentation, scoreRFM } from '../js/segmentation.js';
import { construireDistribution } from '../js/sample-ranges.js';

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

function rosterVarie(n = 40) {
  // valeurs deliberement dispersees sur toute la plage pour obtenir une
  // vraie repartition en quartiles (pas des valeurs identiques).
  return Array.from({ length: n }, (_, i) => client({
    id: `PT${i}`,
    total_transactions: 1 + i,
    nb_types_service: 1 + (i % 8),
    jours_inactivite_avant_mars: i * 2,
    montant_moyen: 5000 + i * 7000,
    niveau_risque: ['Faible', 'Modéré', 'Élevé', 'Critique'][i % 4],
  }));
}

function distributionsPour(roster) {
  const champs = ['jours_inactivite_avant_mars', 'total_transactions', 'montant_moyen', 'nb_types_service'];
  const d = {};
  for (const c of champs) d[c] = construireDistribution(roster, c);
  return d;
}

test('scoreRFM: composite reste dans [0,1] et recence est inversee (moins de jours = mieux)', () => {
  const distributions = distributionsPour(rosterVarie(40));
  const actif = scoreRFM(client({ jours_inactivite_avant_mars: 0 }), distributions);
  const inactif = scoreRFM(client({ jours_inactivite_avant_mars: 89 }), distributions);
  assert.ok(actif.composite >= 0 && actif.composite <= 1);
  assert.ok(inactif.composite >= 0 && inactif.composite <= 1);
  assert.ok(actif.recence > inactif.recence, 'un client recent doit avoir un score de recence plus eleve');
});

test('scoreRFM: le percentile est calcule dynamiquement sur le roster charge, pas une plage fixe', () => {
  // Regression : d'anciennes bornes fixes (calibrees sur 100 clients de demo,
  // montant_moyen plafonne a 305000) saturaient a 100% une bonne partie des
  // clients reels. Avec des montants tous tres eleves (echelle differente),
  // le classement doit rester discriminant, pas ecrase au plafond.
  const rosterHauteEchelle = Array.from({ length: 20 }, (_, i) => client({
    id: `H${i}`, montant_moyen: 5000000 + i * 1000000, // tous largement > 305000
  }));
  const distributions = distributionsPour(rosterHauteEchelle);
  const bas = scoreRFM(client({ montant_moyen: 5000000 }), distributions);
  const haut = scoreRFM(client({ montant_moyen: 24000000 }), distributions);
  assert.ok(haut.montant > bas.montant, 'le client au montant le plus eleve du roster doit rester mieux classe, meme hors de l\'ancienne plage fixe');
});

test('calculerSegmentation: repartit tous les clients valides en 4 segments, sans perte ni doublon', () => {
  const roster = rosterVarie(40);
  const { clients, resume, total, exclus } = calculerSegmentation(roster);

  assert.equal(total, 40);
  assert.equal(exclus, 0);
  assert.equal(clients.length, 40);

  const sommeTailles = SEGMENTS.reduce((s, seg) => s + resume[seg].taille, 0);
  assert.equal(sommeTailles, 40, 'la somme des tailles de segment doit egaler le nombre de clients valides');

  clients.forEach(c => assert.ok(SEGMENTS.includes(c.segment), `segment invalide: ${c.segment}`));
});

test('calculerSegmentation: le segment Platinum contient les scores composites les plus eleves', () => {
  const roster = rosterVarie(40);
  const { clients } = calculerSegmentation(roster);
  const platinum = clients.filter(c => c.segment === 'Platinum');
  const bronze = clients.filter(c => c.segment === 'Bronze');
  const moyenneComposite = (liste) => liste.reduce((s, c) => s + c.rfm.composite, 0) / liste.length;
  assert.ok(moyenneComposite(platinum) > moyenneComposite(bronze), 'Platinum doit avoir un score RFM moyen superieur a Bronze');
});

test('calculerSegmentation: dataset vide -> aucun crash, tailles a zero', () => {
  const { clients, resume, total, exclus } = calculerSegmentation([]);
  assert.equal(total, 0);
  assert.equal(exclus, 0);
  assert.equal(clients.length, 0);
  SEGMENTS.forEach(seg => assert.equal(resume[seg].taille, 0));
});

test('calculerSegmentation: clients avec champs RFM manquants sont exclus, pas de valeur inventee', () => {
  const roster = [
    client({ id: 'A' }),
    client({ id: 'B', montant_moyen: undefined }),      // champ manquant
    client({ id: 'C', total_transactions: 'NaN-ish' }), // mauvais type
  ];
  const { clients, exclus, total } = calculerSegmentation(roster);
  assert.equal(total, 3);
  assert.equal(exclus, 2);
  assert.equal(clients.length, 1);
  assert.equal(clients[0].id, 'A');
});

test('calculerSegmentation: fonctionne identiquement sur un roster de forme differente ("dataset importe")', () => {
  // simule un futur dataset importe : memes 4 champs RFM requis, valeurs et
  // volumetrie differentes du generateur demo -- la fonction ne doit faire
  // aucune hypothese sur la source des donnees.
  const rosterImporte = Array.from({ length: 17 }, (_, i) => client({
    id: `IMPORT-${i}`,
    total_transactions: 100 + i * 3,
    nb_types_service: 2,
    jours_inactivite_avant_mars: 10 + i,
    montant_moyen: 1000000 + i * 50000,
  }));
  const { clients, total, exclus } = calculerSegmentation(rosterImporte);
  assert.equal(total, 17);
  assert.equal(exclus, 0);
  assert.equal(clients.length, 17);
});

test('calculerSegmentation: resume expose bien les 4 dimensions RFM par segment (pas juste un compteur)', () => {
  const { resume } = calculerSegmentation(rosterVarie(40));
  SEGMENTS.forEach(seg => {
    if (resume[seg].taille > 0) {
      assert.equal(typeof resume[seg].montantMoyen, 'number');
      assert.equal(typeof resume[seg].frequenceMoyenne, 'number');
      assert.equal(typeof resume[seg].recenceMoyenne, 'number');
      assert.equal(typeof resume[seg].diversiteMoyenne, 'number');
      assert.ok(resume[seg].risqueDominant, 'un risque dominant doit etre identifie');
    }
  });
});
