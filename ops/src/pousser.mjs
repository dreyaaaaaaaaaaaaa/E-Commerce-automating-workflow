#!/usr/bin/env node
/**
 * Étape 2 du lot : écrire tout le catalogue en une opération.
 *
 * Choix d'architecture : pourquoi une opération en masse et pas une boucle
 * de mutations :
 *  - le coût GraphQL d'un `productSet` complet est élevé ; 400 appels
 *    successifs passent la moitié du temps en attente de seau à jetons ;
 *  - `bulkOperationRunMutation` prend un JSONL, s'exécute côté Shopify et
 *    renvoie un fichier de résultats ligne à ligne : on obtient un rapport
 *    exploitable, et un seul point de reprise en cas d'échec ;
 *  - `productSet` est idempotent quand on l'adresse par `handle` : rejouer
 *    le même lot ne crée pas de doublon. C'est ce qui rend l'opération
 *    rejouable sans peur, et donc réellement automatisable.
 *
 * Sécurité de la donnée : tous les produits sont écrits en DRAFT. Rien
 * n'apparaît en boutique avant `publier.mjs`, qui bascule le lot entier
 * après relecture visuelle. Un lot à moitié publié n'existe pas.
 *
 * Usage :
 *   node src/pousser.mjs              → simulation + diff, aucun appel d'écriture
 *   node src/pousser.mjs --appliquer   → exécute réellement
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { graphql, televerserVersCible } from './shopify.mjs';
import { validerCatalogue } from './valider.mjs';
import { REGLES } from '../schema/regles-da.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const MANIFESTE = join(RACINE, 'data', 'manifeste-images.json');
const DOSSIER_RAPPORTS = join(RACINE, 'rapports');

const APPLIQUER = process.argv.includes('--appliquer');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 * Mutation exécutée pour chaque ligne du JSONL.
 * `synchronous: false` laisse Shopify traiter les médias en tâche de fond.
 * ------------------------------------------------------------------ */
const M_PRODUCT_SET = `
  mutation ecrireProduit($input: ProductSetInput!) {
    productSet(input: $input, synchronous: false) {
      product { id handle status }
      userErrors { field message code }
    }
  }
`;

const M_BULK = `
  mutation lancerLot($mutation: String!, $chemin: String!) {
    bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $chemin) {
      bulkOperation { id status url }
      userErrors { field message }
    }
  }
`;

const M_STAGED = `
  mutation preparerJsonl($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }
`;

const Q_OPERATION = `
  query suivreLot($id: ID!) {
    node(id: $id) {
      ... on BulkOperation {
        id status errorCode objectCount rootObjectCount url partialDataUrl
      }
    }
  }
`;

const Q_EXISTANTS = `
  query catalogueExistant($apres: String) {
    products(first: 100, after: $apres) {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        title
        status
        variants(first: 20) { nodes { sku price } }
      }
    }
  }
`;

/* ------------------------------------------------------------------ */

function chargerProduitsSource() {
  const dossier = join(RACINE, 'data', 'produits');
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dossier, f), 'utf8')));
}

function chargerManifeste() {
  if (!existsSync(MANIFESTE)) {
    throw new Error('manifeste-images.json absent. Lancer `npm run images -- --appliquer` avant.');
  }
  return JSON.parse(readFileSync(MANIFESTE, 'utf8')).images;
}

/**
 * Traduit un produit source en ProductSetInput.
 * Adressage par `handle` : c'est la clé d'idempotence du lot.
 */
function versProductSet(p, manifeste) {
  const options = [];
  const nomsOptions = Object.keys(p.variantes[0]?.options || {});

  for (const nom of nomsOptions) {
    const valeurs = [...new Set(p.variantes.map((v) => v.options[nom]))];
    options.push({ name: nom, values: valeurs.map((v) => ({ name: v })) });
  }

  const medias = (p.images || [])
    .map((img) => manifeste[img.fichier])
    .filter((m) => m?.url)
    .map((m, i) => ({
      originalSource: m.url,
      alt: (p.images[i].alt?.fr) || p.titre,
      mediaContentType: 'IMAGE',
    }));

  return {
    // `handle` sert d'identifiant naturel : Shopify met à jour s'il existe,
    // crée sinon. Aucun ID Shopify à stocker côté dépôt.
    handle: p.handle,
    title: p.titre,
    descriptionHtml: p.description,
    vendor: p.marque || undefined,
    productType: p.type || undefined,
    tags: p.etiquettes || [],
    status: REGLES.statutInitial,
    files: medias,
    productOptions: options.length ? options : undefined,
    variants: p.variantes.map((v) => ({
      price: (v.prix_centimes / 100).toFixed(2),
      compareAtPrice: v.prix_barre_centimes ? (v.prix_barre_centimes / 100).toFixed(2) : undefined,
      sku: v.sku,
      barcode: v.code_barres || undefined,
      inventoryPolicy: 'DENY',
      optionValues: nomsOptions.map((nom) => ({
        optionName: nom,
        name: v.options[nom],
      })),
    })),
    metafields: [
      champ('matiere', p.metachamps.matiere, 'multi_line_text_field'),
      champ('dimensions', p.metachamps.dimensions, 'multi_line_text_field'),
      champ('entretien', p.metachamps.entretien, 'multi_line_text_field'),
      champ('brief_photo', p.metachamps.brief_photo, 'single_line_text_field'),
      champ('reference_interne', p.reference, 'single_line_text_field'),
    ].filter(Boolean),
  };
}

const champ = (cle, valeur, type) =>
  valeur ? { namespace: 'custom', key: cle, value: String(valeur), type } : null;

/* ---------- Diff avant application ---------- */

async function diff(source) {
  const existants = new Map();
  let apres = null;

  do {
    const { products } = await graphql(Q_EXISTANTS, { apres });
    for (const n of products.nodes) existants.set(n.handle, n);
    apres = products.pageInfo.hasNextPage ? products.pageInfo.endCursor : null;
  } while (apres);

  const crees = [];
  const modifies = [];
  const inchanges = [];

  for (const p of source) {
    const dejaLa = existants.get(p.handle);
    if (!dejaLa) {
      crees.push(p.handle);
      continue;
    }
    const changements = [];
    if (dejaLa.title !== p.titre) changements.push(`titre : « ${dejaLa.title} » → « ${p.titre} »`);

    for (const v of p.variantes) {
      const distante = dejaLa.variants.nodes.find((x) => x.sku === v.sku);
      const attendu = (v.prix_centimes / 100).toFixed(2);
      if (!distante) changements.push(`variante ${v.sku} : nouvelle`);
      else if (distante.price !== attendu) {
        changements.push(`prix ${v.sku} : ${distante.price} → ${attendu}`);
      }
    }
    if (changements.length) modifies.push({ handle: p.handle, changements });
    else inchanges.push(p.handle);
  }

  // Les produits en boutique absents du dépôt : jamais supprimés
  // automatiquement. On les signale, la décision reste humaine.
  const orphelins = [...existants.keys()].filter(
    (h) => !source.some((p) => p.handle === h)
  );

  return { crees, modifies, inchanges, orphelins };
}

/* ---------- Exécution du lot ---------- */

async function lancerLot(jsonl) {
  const { stagedUploadsCreate } = await graphql(M_STAGED, {
    input: [{
      filename: 'lot-produits.jsonl',
      mimeType: 'text/jsonl',
      resource: 'BULK_MUTATION_VARIABLES',
      httpMethod: 'POST',
    }],
  });

  const cible = stagedUploadsCreate.stagedTargets[0];
  await televerserVersCible(cible, jsonl, 'lot-produits.jsonl', 'text/jsonl');

  // `stagedUploadPath` est la valeur du paramètre `key`, pas l'URL complète.
  const chemin = cible.parameters.find((p) => p.name === 'key').value;

  const { bulkOperationRunMutation } = await graphql(M_BULK, {
    mutation: M_PRODUCT_SET,
    chemin,
  });

  const operation = bulkOperationRunMutation.bulkOperation;
  console.log(`Lot lancé : ${operation.id}`);
  return operation;
}

async function suivre(id) {
  // Shopify n'autorise qu'une opération en masse d'écriture à la fois par
  // boutique : ce sondage est aussi la file d'attente du pipeline.
  const debut = Date.now();
  let dernierStatut = null;

  while (true) {
    const { node } = await graphql(Q_OPERATION, { id });
    if (node.status !== dernierStatut) {
      const minutes = ((Date.now() - debut) / 60_000).toFixed(1);
      console.log(`  ${node.status} : ${node.objectCount || 0} objet(s) : ${minutes} min`);
      dernierStatut = node.status;
    }

    if (node.status === 'COMPLETED') return node;
    if (['FAILED', 'CANCELED', 'EXPIRED'].includes(node.status)) {
      throw new Error(`Lot ${node.status} : errorCode : ${node.errorCode}`);
    }
    await attendre(5000);
  }
}

async function lireResultats(url) {
  if (!url) return [];
  const texte = await fetch(url).then((r) => r.text());
  return texte
    .split('\n')
    .filter(Boolean)
    .map((ligne) => JSON.parse(ligne));
}

/* ---------- Point d'entrée ---------- */

async function main() {
  // 1. Validation : bloquante, hors ligne.
  const { problemes, avertissements } = validerCatalogue();
  if (problemes.length) {
    console.error(`${problemes.length} erreur(s) de conformité DA. Lot refusé, aucun appel Shopify.`);
    console.error('Détail : npm run valider');
    process.exit(1);
  }
  if (avertissements.length) {
    console.warn(`${avertissements.length} avertissement(s) : non bloquants. Détail : npm run valider`);
  }

  const source = chargerProduitsSource();
  console.log(`${source.length} produit(s) dans le dépôt.\n`);

  // 2. Diff : lecture seule, toujours exécuté.
  const resume = await diff(source);
  console.log('- Diff avec la boutique -');
  console.log(`  créations   : ${resume.crees.length}${resume.crees.length ? ' → ' + resume.crees.join(', ') : ''}`);
  console.log(`  mises à jour: ${resume.modifies.length}`);
  for (const m of resume.modifies) {
    console.log(`    ${m.handle}`);
    for (const c of m.changements) console.log(`      · ${c}`);
  }
  console.log(`  inchangés   : ${resume.inchanges.length}`);
  if (resume.orphelins.length) {
    console.log(`  en boutique mais absents du dépôt (non touchés) : ${resume.orphelins.join(', ')}`);
  }
  console.log('');

  if (!APPLIQUER) {
    console.log('Simulation terminée. Relancer avec --appliquer pour écrire.');
    return;
  }

  // 3. Construction du JSONL : une ligne = un ProductSetInput.
  const manifeste = chargerManifeste();
  const jsonl = source
    .map((p) => JSON.stringify({ input: versProductSet(p, manifeste) }))
    .join('\n');

  console.log(`JSONL : ${source.length} ligne(s), ${(jsonl.length / 1024).toFixed(0)} Ko\n`);

  // 4. Lancement et suivi.
  const operation = await lancerLot(jsonl);
  const fini = await suivre(operation.id);
  const resultats = await lireResultats(fini.url || fini.partialDataUrl);

  const echecs = resultats.filter((r) => r.data?.productSet?.userErrors?.length || r.errors);
  const reussis = resultats.length - echecs.length;

  // 5. Rapport horodaté, conservé comme artefact CI.
  mkdirSync(DOSSIER_RAPPORTS, { recursive: true });
  const chemin = join(DOSSIER_RAPPORTS, `lot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(chemin, JSON.stringify({
    operation: fini.id,
    statut: fini.status,
    date: new Date().toISOString(),
    total: resultats.length,
    reussis,
    echecs,
    diff: resume,
  }, null, 2) + '\n');

  console.log(`\n${reussis}/${resultats.length} produit(s) écrits en ${REGLES.statutInitial}.`);
  console.log(`Rapport : ${chemin}`);

  if (echecs.length) {
    console.error(`\n${echecs.length} échec(s) :`);
    for (const e of echecs.slice(0, 20)) console.error('  ' + JSON.stringify(e));
    process.exit(1);
  }

  console.log('\nÉtape suivante : relire l aperçu, puis `npm run publier` pour basculer le lot en ligne.');
}

main().catch((e) => {
  console.error(`\nÉchec : ${e.message}`);
  process.exit(1);
});
