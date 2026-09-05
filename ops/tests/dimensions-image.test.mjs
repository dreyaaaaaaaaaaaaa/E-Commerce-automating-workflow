/**
 * tests/dimensions-image.test.mjs
 *
 * dimensions-image.mjs relit les octets d'en-tete a la main (JPEG, PNG,
 * WebP) plutot que de dependre de sharp : voir la note de conception en
 * tete de ce module. C'est exactement le genre de parseur binaire ecrit
 * a la main qui merite des tests, les bugs y sont silencieux (une mauvaise
 * lecture d'offset ne plante pas, elle rend juste un mauvais nombre).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { dimensionsImage } from '../src/dimensions-image.mjs';
import { DOSSIER_IMAGES_FIXTURES } from './aide-fixtures.mjs';
import { join } from 'node:path';

test('lit correctement un JPEG (fixture 1400x1750)', () => {
  const info = dimensionsImage(join(DOSSIER_IMAGES_FIXTURES, 'conforme-4x5.jpg'));
  assert.equal(info.largeur, 1400);
  assert.equal(info.hauteur, 1750);
  assert.equal(info.format, 'jpeg');
  assert.ok(info.octets > 0);
});

test('lit correctement un JPEG carre (fixture 1400x1400)', () => {
  const info = dimensionsImage(join(DOSSIER_IMAGES_FIXTURES, 'carre-1x1.jpg'));
  assert.equal(info.largeur, 1400);
  assert.equal(info.hauteur, 1400);
});

test('un format non reconnu leve une erreur explicite', () => {
  assert.throws(
    () => dimensionsImage(join(DOSSIER_IMAGES_FIXTURES, 'non-image.txt')),
    /non reconnu/
  );
});
