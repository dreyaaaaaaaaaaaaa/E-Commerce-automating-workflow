/**
 * tests/valider.test.mjs
 *
 * Suite de tests du validateur de catalogue. Lancer avec :
 *   node --test tests/
 *
 * Chaque test ecrit un catalogue jetable dans un dossier temporaire (voir
 * aide-fixtures.mjs) : jamais de lecture ni d'ecriture dans data/produits,
 * qui reste le vrai catalogue.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validerCatalogue } from '../src/valider.mjs';
import { produitValide, ecrireCatalogueTemporaire, DOSSIER_IMAGES_FIXTURES } from './aide-fixtures.mjs';

/** Valide un jeu de produits et nettoie le dossier temporaire, meme si
 *  une assertion leve. */
function valider(produits) {
  const { dossier, nettoyer } = ecrireCatalogueTemporaire(produits);
  try {
    return validerCatalogue({ dossierProduits: dossier, dossierImages: DOSSIER_IMAGES_FIXTURES });
  } finally {
    nettoyer();
  }
}

test('un catalogue conforme ne remonte aucune erreur', () => {
  const { problemes, produits } = valider([produitValide()]);
  assert.deepEqual(problemes, []);
  assert.equal(produits.length, 1);
});

test('deux appels successifs ne se contaminent pas (pas d etat partage)', () => {
  const casse = valider([produitValide({ handle: 'CAPS-INVALIDE' })]);
  const propre = valider([produitValide()]);
  assert.ok(casse.problemes.length > 0, 'le premier catalogue doit echouer');
  assert.deepEqual(propre.problemes, [], 'le second catalogue ne doit pas heriter des erreurs du premier');
});

test('titre trop long est refuse avec une explication', () => {
  const titreLong = 'Un titre bien trop long pour la colonne de quatre cent soixante-dix pixels du gabarit produit';
  const { problemes } = valider([produitValide({ titre: titreLong })]);
  const erreur = problemes.find((p) => p.champ === 'titre');
  assert.ok(erreur, 'une erreur de titre est attendue');
  assert.match(erreur.message, /caractères/);
});

test('un titre en capitales est refuse', () => {
  const { problemes } = valider([produitValide({ titre: 'CARAFE Lumière' })]);
  assert.ok(problemes.some((p) => p.champ === 'titre' && /capitales/.test(p.message)));
});

test('une image au ratio 1:1 est refusee, une image 4:5 est acceptee', () => {
  const carre = valider([
    produitValide({
      handle: 'produit-carre',
      images: [{ fichier: 'carre-1x1.jpg', alt: produitValide().images[0].alt }],
    }),
  ]);
  const ratio = carre.problemes.find((p) => p.champ === 'images[0].ratio');
  assert.ok(ratio, 'le ratio 1:1 doit etre refuse');
  assert.match(ratio.message, /4:5/);

  const conforme = valider([produitValide({ handle: 'produit-conforme' })]);
  assert.equal(conforme.problemes.filter((p) => p.champ.startsWith('images')).length, 0);
});

test('un metachamp obligatoire manquant est refuse', () => {
  const sansEntretien = produitValide();
  delete sansEntretien.metachamps.entretien;
  const { problemes } = valider([sansEntretien]);
  assert.ok(problemes.some((p) => p.champ === 'metachamps.entretien'));
});

test('une traduction anglaise manquante est refusee', () => {
  const sansTraduction = produitValide();
  delete sansTraduction.traductions;
  const { problemes } = valider([sansTraduction]);
  assert.ok(problemes.some((p) => p.champ === 'traductions.en'));
});

test('un univers hors liste fermee est refuse', () => {
  const { problemes } = valider([produitValide({ univers: 'univers-invente' })]);
  const erreur = problemes.find((p) => p.champ === 'univers');
  assert.ok(erreur);
  assert.match(erreur.message, /table-et-lumiere/);
});

test('un prix non multiple de 50 centimes est un avertissement, pas une erreur bloquante', () => {
  const produit = produitValide();
  produit.variantes[0].prix_centimes = 8937;
  const { problemes, avertissements } = valider([produit]);
  assert.equal(problemes.length, 0, 'ne doit pas bloquer le lot');
  assert.ok(avertissements.some((a) => a.champ === 'variantes[0].prix_centimes'));
});

test('un handle duplique entre deux produits est detecte', () => {
  const { problemes } = valider([
    produitValide({ handle: 'meme-handle' }),
    produitValide({ handle: 'meme-handle', reference: 'AB-1001' }),
  ]);
  assert.ok(problemes.some((p) => p.champ === 'handle' && /doublon/.test(p.message)));
});

test('une reference dupliquee entre deux produits est detectee', () => {
  const { problemes } = valider([
    produitValide({ handle: 'produit-a' }),
    produitValide({ handle: 'produit-b' }), // meme reference AB-1000 par defaut
  ]);
  assert.ok(problemes.some((p) => p.champ === 'reference' && /déjà utilisée/.test(p.message)));
});

test('un SKU duplique entre deux produits est detecte', () => {
  const { problemes } = valider([
    produitValide({ handle: 'produit-a', reference: 'AB-1000' }),
    produitValide({ handle: 'produit-b', reference: 'AB-1001' }), // meme SKU AB-1000-IV
  ]);
  assert.ok(problemes.some((p) => p.champ === 'variantes.sku'));
});

test('un JSON invalide est signale sans faire planter tout le lot', () => {
  const { dossier, nettoyer } = ecrireCatalogueTemporaire([produitValide({ handle: 'valide' })]);
  try {
    writeFileSync(join(dossier, 'casse.json'), '{ ceci n est pas du JSON', 'utf8');

    const { produits, problemes } = validerCatalogue({
      dossierProduits: dossier,
      dossierImages: DOSSIER_IMAGES_FIXTURES,
    });

    assert.equal(produits.length, 1, 'le produit valide doit quand meme etre charge');
    assert.ok(
      problemes.some((p) => p.handle === 'casse.json' && /JSON invalide/.test(p.message)),
      'le fichier casse doit etre signale par son nom'
    );
  } finally {
    nettoyer();
  }
});

test('un dossier produits introuvable leve une erreur explicite plutot que de planter en silence', () => {
  assert.throws(
    () => validerCatalogue({ dossierProduits: '/chemin/qui-n-existe-pas-vraiment', dossierImages: DOSSIER_IMAGES_FIXTURES }),
    /Dossier introuvable/
  );
});
