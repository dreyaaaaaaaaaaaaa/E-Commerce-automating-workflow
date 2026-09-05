/**
 * tests/aide-fixtures.mjs
 *
 * Construit un produit conforme a schema/regles-da.mjs et l'ecrit dans un
 * dossier temporaire, pour que chaque test appelle validerCatalogue() sur
 * des donnees jetables plutot que sur le vrai catalogue dans data/produits.
 */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ICI = dirname(fileURLToPath(import.meta.url));
export const DOSSIER_IMAGES_FIXTURES = join(ICI, 'fixtures', 'images');

/** Un produit qui respecte toutes les regles. Chaque test part de la et
 *  ne modifie que le champ qu'il veut casser. */
export function produitValide(surcharges = {}) {
  return {
    handle: 'carafe-test',
    reference: 'AB-1000',
    titre: 'Carafe Lumière, verre soufflé',
    univers: 'table-et-lumiere',
    description:
      "<p>Soufflée à la canne dans un atelier normand, cette carafe garde les " +
      "irrégularités du geste. Le verre à peine teinté attrape la lumière de " +
      "fin de journée et la rend au reste de la table.</p>",
    variantes: [
      { sku: 'AB-1000-IV', prix_centimes: 8900, options: { Couleur: 'Ivoire' } },
    ],
    metachamps: {
      matiere: 'Verre soufflé bouche, non teinté dans la masse.',
      dimensions: 'Hauteur 26 cm, diamètre 11 cm, contenance 1,1 L',
      entretien: 'Lavage à la main à l eau tiède, séchage immédiat avec un linge doux.',
      brief_photo: 'carafe sur nappe de lin, contre-jour',
    },
    images: [
      {
        fichier: 'conforme-4x5.jpg',
        alt: {
          fr: 'Carafe en verre soufflé posée sur une nappe de lin',
          en: 'Hand-blown glass carafe on a linen tablecloth',
        },
      },
    ],
    traductions: {
      en: {
        titre: 'Lumière carafe, hand-blown glass',
        description: '<p>Blown by hand in a Normandy workshop, this carafe keeps the irregularities of the gesture.</p>',
      },
    },
    ...surcharges,
  };
}

/**
 * Ecrit chaque produit dans un fichier <handle>.json d'un dossier
 * temporaire et retourne { dossier, nettoyer }. `nettoyer()` doit etre
 * appele en fin de test (t.after dans node:test).
 */
export function ecrireCatalogueTemporaire(produits) {
  const dossier = mkdtempSync(join(tmpdir(), 'maison-valider-'));
  // Le nom de fichier est indexe, jamais derive du handle : un test qui
  // ecrit deux produits au meme handle (pour verifier la detection de
  // doublon) doit produire deux fichiers distincts, pas un seul ecrase
  // par l'autre.
  produits.forEach((p, i) => {
    writeFileSync(join(dossier, `produit-${i}.json`), JSON.stringify(p), 'utf8');
  });
  return {
    dossier,
    nettoyer: () => rmSync(dossier, { recursive: true, force: true }),
  };
}
