import test from 'node:test';
import assert from 'node:assert/strict';
import { formaterRatio, REGLES } from '../schema/regles-da.mjs';

test('formaterRatio reconnait les ratios courants', () => {
  assert.equal(formaterRatio(1400, 1750), '4:5');
  assert.equal(formaterRatio(1400, 1400), '1:1');
  assert.equal(formaterRatio(1600, 1200), '4:3');
});

test('formaterRatio retombe sur une valeur numerique pour un ratio inconnu', () => {
  // 7:11 n'est dans aucune des paires reconnues.
  assert.equal(formaterRatio(700, 1100), (700 / 1100).toFixed(3));
});

test('les regles de prix restent coherentes entre elles', () => {
  assert.ok(REGLES.prix.minCentimes < REGLES.prix.maxCentimes);
  assert.equal(REGLES.prix.minCentimes % REGLES.prix.multipleDe, 0);
});
