#!/usr/bin/env node
/**
 * Déclare les définitions de métachamps de la boutique, en code.
 *
 * Sans définition, un métachamp existe mais reste invisible dans l'admin
 * et non typé : n'importe quelle valeur passe. Avec définition, Shopify
 * valide le type et la longueur côté serveur : deuxième filet après le
 * validateur du dépôt, celui-là impossible à contourner même en modifiant
 * un produit à la main dans l'admin.
 *
 * Idempotent : une définition existante est mise à jour, pas dupliquée.
 * Usage : node src/appliquer-metachamps.mjs --appliquer
 */

import { graphql } from './shopify.mjs';

const APPLIQUER = process.argv.includes('--appliquer');

/**
 * `ownerType` PRODUCT ou COLLECTION.
 * `validations` : les mêmes bornes que schema/regles-da.mjs, appliquées
 * côté Shopify. Les deux doivent rester alignées : voir docs/CATALOGUE.md.
 */
const DEFINITIONS = [
  {
    ownerType: 'PRODUCT',
    namespace: 'custom',
    key: 'matiere',
    name: 'Matière',
    description: 'Matières et finitions. Affiché dans « Détails & dimensions ».',
    type: 'multi_line_text_field',
    validations: [{ name: 'max', value: '220' }],
    pin: true,
  },
  {
    ownerType: 'PRODUCT',
    namespace: 'custom',
    key: 'dimensions',
    name: 'Dimensions',
    description: 'Hauteur, diamètre, contenance. Affiché dans « Détails & dimensions ».',
    type: 'multi_line_text_field',
    validations: [{ name: 'max', value: '220' }],
    pin: true,
  },
  {
    ownerType: 'PRODUCT',
    namespace: 'custom',
    key: 'entretien',
    name: 'Entretien',
    description: 'Lavage, précautions. Alimente le troisième accordéon de la fiche.',
    type: 'multi_line_text_field',
    validations: [{ name: 'max', value: '400' }],
    pin: true,
  },
  {
    ownerType: 'PRODUCT',
    namespace: 'custom',
    key: 'brief_photo',
    name: 'Brief photo',
    description: 'Légende affichée dans le placeholder tant que le visuel manque.',
    type: 'single_line_text_field',
    validations: [{ name: 'max', value: '160' }],
    pin: true,
  },
  {
    ownerType: 'PRODUCT',
    namespace: 'custom',
    key: 'reference_interne',
    name: 'Référence interne',
    description: 'Format AB-1234. Affichée sous le prix.',
    type: 'single_line_text_field',
    validations: [{ name: 'regex', value: '^[A-Z]{2,4}-\\d{3,5}$' }],
    pin: true,
  },

  /* ---- Univers = collection enrichie ---- */
  {
    ownerType: 'COLLECTION',
    namespace: 'custom',
    key: 'numero',
    name: 'Numéro d univers',
    description: 'Affiché en 01, 02, 03 sur l accueil et la page univers.',
    type: 'number_integer',
    validations: [{ name: 'min', value: '1' }, { name: 'max', value: '99' }],
    pin: true,
  },
  {
    ownerType: 'COLLECTION',
    namespace: 'custom',
    key: 'chapo',
    name: 'Chapô',
    description: '80 à 220 caractères. Sous le titre de la page univers.',
    type: 'multi_line_text_field',
    validations: [{ name: 'max', value: '220' }],
    pin: true,
  },
  {
    ownerType: 'COLLECTION',
    namespace: 'custom',
    key: 'stylisme',
    name: 'Stylisme',
    description: 'Crédit stylisme affiché en libellé (ex. « Stylisme maison »).',
    type: 'single_line_text_field',
    pin: true,
  },
  {
    ownerType: 'COLLECTION',
    namespace: 'custom',
    key: 'image_editoriale',
    name: 'Visuel éditorial 4:3',
    description: 'Plan large d ambiance, ratio 4:3 strict.',
    type: 'file_reference',
    validations: [{ name: 'file_type_options', value: '["Image"]' }],
    pin: true,
  },
  {
    ownerType: 'COLLECTION',
    namespace: 'custom',
    key: 'brief_photo',
    name: 'Brief photo',
    description: 'Légende du placeholder de la page univers.',
    type: 'single_line_text_field',
    validations: [{ name: 'max', value: '160' }],
    pin: true,
  },
];

const Q_EXISTANTES = `
  query definitions($ownerType: MetafieldOwnerType!) {
    metafieldDefinitions(first: 100, ownerType: $ownerType, namespace: "custom") {
      nodes { id key name type { name } }
    }
  }
`;

const M_CREER = `
  mutation creer($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id key }
      userErrors { field message code }
    }
  }
`;

const M_MAJ = `
  mutation majDefinition($definition: MetafieldDefinitionUpdateInput!) {
    metafieldDefinitionUpdate(definition: $definition) {
      updatedDefinition { id key }
      userErrors { field message code }
    }
  }
`;

async function main() {
  const parType = new Map();
  for (const type of new Set(DEFINITIONS.map((d) => d.ownerType))) {
    const { metafieldDefinitions } = await graphql(Q_EXISTANTES, { ownerType: type });
    parType.set(type, new Map(metafieldDefinitions.nodes.map((n) => [n.key, n])));
  }

  for (const def of DEFINITIONS) {
    const existante = parType.get(def.ownerType).get(def.key);
    const action = existante ? 'maj' : 'création';
    console.log(`${action.padEnd(9)} ${def.ownerType.toLowerCase()}.custom.${def.key} (${def.type})`);

    if (!APPLIQUER) continue;

    if (existante) {
      // Le type d'une définition est immuable chez Shopify : on le signale
      // plutôt que d'échouer sur une erreur cryptique.
      if (existante.type.name !== def.type) {
        console.error(
          `  x type figé à « ${existante.type.name} », demandé « ${def.type} ». ` +
          'Supprimer la définition à la main dans l admin, puis relancer.'
        );
        process.exitCode = 1;
        continue;
      }
      const { key, ownerType, name, description, validations, pin } = def;
      await graphql(M_MAJ, { definition: { key, ownerType, namespace: 'custom', name, description, validations, pin } });
    } else {
      await graphql(M_CREER, { definition: def });
    }
  }

  if (!APPLIQUER) {
    console.log('\nSimulation. Relancer avec --appliquer.');
  }
}

main().catch((e) => {
  console.error(`\nÉchec : ${e.message}`);
  process.exit(1);
});
