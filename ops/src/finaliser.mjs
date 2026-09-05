#!/usr/bin/env node
/**
 * Étape 3 du lot : rattacher chaque produit à son univers et enregistrer
 * les traductions anglaises.
 *
 * Deux choses que `productSet` ne fait pas et qui font pourtant partie
 * intégrante de la DA :
 *  - un produit sans univers n'a aucune page où apparaître ;
 *  - un produit sans traduction EN casse la version anglaise du site,
 *    qui retomberait sur le français au milieu d'une page anglaise.
 *
 * Le validateur les impose déjà en amont ; ce script les applique.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { graphql } from './shopify.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const APPLIQUER = process.argv.includes('--appliquer');

const Q_PRODUITS = `
  query resoudre($requete: String!) {
    products(first: 250, query: $requete) {
      nodes {
        id
        handle
        title
        translations(locale: "en") { key value }
      }
    }
  }
`;

const Q_COLLECTIONS = `
  query collections($requete: String!) {
    collections(first: 50, query: $requete) { nodes { id handle title } }
  }
`;

const M_AJOUTER = `
  mutation rattacher($id: ID!, $produits: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $produits) {
      collection { id handle productsCount { count } }
      userErrors { field message }
    }
  }
`;

const M_TRADUIRE = `
  mutation traduire($id: ID!, $traductions: [TranslationInput!]!) {
    translationsRegister(resourceId: $id, translations: $traductions) {
      translations { key locale value }
      userErrors { field message }
    }
  }
`;

function chargerSource() {
  const dossier = join(RACINE, 'data', 'produits');
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dossier, f), 'utf8')));
}

/** Résout les handles en ID Shopify par paquets, sans requête par produit. */
async function resoudreProduits(handles) {
  const trouves = new Map();
  const PAQUET = 40;

  for (let i = 0; i < handles.length; i += PAQUET) {
    const requete = handles.slice(i, i + PAQUET).map((h) => `handle:${h}`).join(' OR ');
    const { products } = await graphql(Q_PRODUITS, { requete });
    for (const n of products.nodes) trouves.set(n.handle, n);
  }
  return trouves;
}

async function resoudreCollections(handles) {
  const requete = handles.map((h) => `handle:${h}`).join(' OR ');
  const { collections } = await graphql(Q_COLLECTIONS, { requete });
  return new Map(collections.nodes.map((n) => [n.handle, n]));
}

/**
 * `translationsRegister` exige le digest de la valeur source pour éviter
 * d'attacher une traduction à un texte qui a changé entre-temps. On le
 * récupère via l'API : c'est aussi un garde-fou contre une traduction
 * qui prendrait silencieusement du retard sur le français.
 */
const Q_DIGESTS = `
  query digests($id: ID!) {
    translatableResource(resourceId: $id) {
      translatableContent { key value digest locale }
    }
  }
`;

async function main() {
  const source = chargerSource();
  const produits = await resoudreProduits(source.map((p) => p.handle));

  const manquants = source.filter((p) => !produits.has(p.handle));
  if (manquants.length) {
    throw new Error(
      `${manquants.length} produit(s) introuvable(s) en boutique : ${manquants.map((p) => p.handle).join(', ')}. ` +
      'Lancer `npm run pousser:reel` d abord.'
    );
  }

  /* ---- Rattachement aux univers ---- */
  const parUnivers = new Map();
  for (const p of source) {
    if (!parUnivers.has(p.univers)) parUnivers.set(p.univers, []);
    parUnivers.get(p.univers).push(produits.get(p.handle).id);
  }

  const collections = await resoudreCollections([...parUnivers.keys()]);
  for (const handle of parUnivers.keys()) {
    if (!collections.has(handle)) {
      throw new Error(`Collection univers « ${handle} » absente de la boutique. La créer avant le lot.`);
    }
  }

  console.log('- Rattachement aux univers -');
  for (const [handle, ids] of parUnivers) {
    console.log(`  ${handle} : ${ids.length} produit(s)`);
    if (!APPLIQUER) continue;

    // collectionAddProducts accepte des paquets ; 250 est la limite sûre.
    for (let i = 0; i < ids.length; i += 100) {
      await graphql(M_AJOUTER, { id: collections.get(handle).id, produits: ids.slice(i, i + 100) });
    }
  }

  /* ---- Traductions EN ---- */
  console.log('\n- Traductions EN -');
  let traduits = 0;

  for (const p of source) {
    const distant = produits.get(p.handle);
    const t = p.traductions?.en;
    if (!t) continue;

    if (!APPLIQUER) {
      traduits++;
      continue;
    }

    const { translatableResource } = await graphql(Q_DIGESTS, { id: distant.id });
    const parCle = new Map(
      translatableResource.translatableContent.map((c) => [c.key, c])
    );

    const traductions = [
      ['title', t.titre],
      ['body_html', t.description],
    ]
      .filter(([cle, valeur]) => valeur && parCle.has(cle))
      .map(([cle, valeur]) => ({
        key: cle,
        locale: 'en',
        value: valeur,
        translatableContentDigest: parCle.get(cle).digest,
      }));

    if (!traductions.length) continue;
    await graphql(M_TRADUIRE, { id: distant.id, traductions });
    traduits++;
    if (traduits % 25 === 0) console.log(`  ${traduits} produit(s) traduits…`);
  }

  console.log(`  ${traduits} produit(s) ${APPLIQUER ? 'traduits' : 'à traduire'}`);

  if (!APPLIQUER) {
    console.log('\nSimulation terminée. Relancer avec --appliquer.');
  } else {
    console.log('\nÉtape suivante : `npm run publier` pour basculer le lot en ligne.');
  }
}

main().catch((e) => {
  console.error(`\nÉchec : ${e.message}`);
  process.exit(1);
});
