#!/usr/bin/env node
/**
 * Étape 4, la dernière : basculer le lot entier en ligne.
 *
 * C'est LE point où la contrainte « un grand lot, pour ne pas perdre la DA »
 * se traduit en code. Avant ce script, tous les produits du lot sont en
 * DRAFT : ils existent, ils sont complets, ils sont relus : mais aucun
 * visiteur ne les voit. Ce script fait deux choses, sur l'ensemble du lot
 * ou sur rien :
 *
 *   1. status DRAFT → ACTIVE
 *   2. publication sur le canal Boutique en ligne
 *
 * Si un seul produit du lot échoue, on s'arrête et on ne publie pas la
 * suite : une collection à moitié remplie est une collection cassée.
 * On préfère un site inchangé à un univers incomplet.
 *
 * Usage : node src/publier.mjs --appliquer [--lot <handle,handle,...>]
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { graphql } from './shopify.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const APPLIQUER = process.argv.includes('--appliquer');

const indexLot = process.argv.indexOf('--lot');
const LOT_CIBLE = indexLot > -1 ? process.argv[indexLot + 1]?.split(',') : null;

const Q_CANAL = `
  query canal {
    publications(first: 25, catalogType: APP) {
      nodes { id name }
    }
  }
`;

const Q_PRODUITS = `
  query produits($requete: String!) {
    products(first: 250, query: $requete) {
      nodes {
        id
        handle
        status
        media(first: 1) { nodes { ... on MediaImage { image { url } } } }
        variants(first: 1) { nodes { sku price } }
        metafields(first: 10, namespace: "custom") { nodes { key value } }
        collections(first: 5) { nodes { handle } }
      }
    }
  }
`;

const M_ACTIVER = `
  mutation activer($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id handle status }
      userErrors { field message }
    }
  }
`;

const M_PUBLIER = `
  mutation publier($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable { availablePublicationsCount { count } }
      userErrors { field message }
    }
  }
`;

const CHAMPS_OBLIGATOIRES = ['matiere', 'dimensions', 'entretien', 'brief_photo'];

function chargerSource() {
  const dossier = join(RACINE, 'data', 'produits');
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dossier, f), 'utf8')))
    .filter((p) => !LOT_CIBLE || LOT_CIBLE.includes(p.handle));
}

async function resoudre(handles) {
  const trouves = new Map();
  for (let i = 0; i < handles.length; i += 40) {
    const requete = handles.slice(i, i + 40).map((h) => `handle:${h}`).join(' OR ');
    const { products } = await graphql(Q_PRODUITS, { requete });
    for (const n of products.nodes) trouves.set(n.handle, n);
  }
  return trouves;
}

/**
 * Contrôle final côté Shopify : et non côté dépôt.
 * Le validateur vérifie la source ; ici on vérifie ce qui est réellement
 * arrivé en boutique. Un média rejeté par Shopify, un métachamp perdu en
 * route : c'est le dernier filet avant la mise en ligne.
 */
function verifierEnBoutique(distant, handle) {
  const griefs = [];

  if (!distant.media.nodes.length || !distant.media.nodes[0]?.image?.url) {
    griefs.push('aucun visuel attaché en boutique');
  }
  if (!distant.collections.nodes.length) {
    griefs.push('rattaché à aucun univers (lancer `npm run finaliser -- --appliquer`)');
  }
  const presents = new Set(distant.metafields.nodes.map((m) => m.key));
  const absents = CHAMPS_OBLIGATOIRES.filter((c) => !presents.has(c));
  if (absents.length) griefs.push(`métachamps absents : ${absents.join(', ')}`);

  if (!distant.variants.nodes[0]?.price) griefs.push('prix manquant');

  return griefs.length ? { handle, griefs } : null;
}

async function main() {
  const source = chargerSource();
  if (!source.length) {
    throw new Error('Aucun produit dans le lot. Vérifier ops/data/produits ou --lot.');
  }

  console.log(`Lot : ${source.length} produit(s)\n`);

  const distants = await resoudre(source.map((p) => p.handle));

  const introuvables = source.filter((p) => !distants.has(p.handle));
  if (introuvables.length) {
    throw new Error(`Introuvables en boutique : ${introuvables.map((p) => p.handle).join(', ')}`);
  }

  /* ---- Contrôle avant / arrêt total en cas de grief ---- */
  const griefs = source
    .map((p) => verifierEnBoutique(distants.get(p.handle), p.handle))
    .filter(Boolean);

  if (griefs.length) {
    console.error(`- ${griefs.length} produit(s) non publiables -`);
    for (const g of griefs) {
      console.error(`  ${g.handle}`);
      for (const m of g.griefs) console.error(`    x ${m}`);
    }
    console.error('\nAucune publication effectuée. Le lot est publié en entier ou pas du tout.');
    process.exit(1);
  }

  const aPublier = source.filter((p) => distants.get(p.handle).status !== 'ACTIVE');
  console.log(`Prêts à publier : ${aPublier.length} · déjà en ligne : ${source.length - aPublier.length}`);

  if (!APPLIQUER) {
    console.log('\nSimulation. Relancer avec --appliquer pour publier le lot.');
    for (const p of aPublier) console.log(`  → ${p.handle}`);
    return;
  }

  /* ---- Canal Boutique en ligne ---- */
  const { publications } = await graphql(Q_CANAL);
  const canal = publications.nodes.find((n) => /online store|boutique en ligne/i.test(n.name));
  if (!canal) {
    throw new Error(`Canal « Boutique en ligne » introuvable. Canaux : ${publications.nodes.map((n) => n.name).join(', ')}`);
  }

  /* ---- Bascule ---- */
  const publies = [];
  for (const p of aPublier) {
    const distant = distants.get(p.handle);
    await graphql(M_ACTIVER, { input: { id: distant.id, status: 'ACTIVE' } });
    await graphql(M_PUBLIER, { id: distant.id, input: [{ publicationId: canal.id }] });
    publies.push(p.handle);
    if (publies.length % 25 === 0) console.log(`  ${publies.length}/${aPublier.length}…`);
  }

  mkdirSync(join(RACINE, 'rapports'), { recursive: true });
  const chemin = join(RACINE, 'rapports', `publication-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(chemin, JSON.stringify({
    date: new Date().toISOString(),
    canal: canal.name,
    publies,
    total_lot: source.length,
  }, null, 2) + '\n');

  console.log(`\n${publies.length} produit(s) en ligne sur « ${canal.name} ».`);
  console.log(`Rapport : ${chemin}`);
}

main().catch((e) => {
  console.error(`\nÉchec : ${e.message}`);
  process.exit(1);
});
