#!/usr/bin/env node
/**
 * Étape 1 du lot : téléverser les visuels et produire un manifeste
 * « fichier local → URL Shopify ».
 *
 * Séparée de l'écriture des produits pour deux raisons :
 *  - un téléversement d'image est long et peut échouer sur un seul fichier ;
 *    on ne veut pas rejouer 400 produits pour une image ;
 *  - le manifeste est versionné, donc un second passage ne re-téléverse
 *    que les visuels nouveaux ou modifiés (comparaison par empreinte).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { graphql, televerserVersCible } from './shopify.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const DOSSIER_IMAGES = join(RACINE, 'data', 'images');
const MANIFESTE = join(RACINE, 'data', 'manifeste-images.json');

const APPLIQUER = process.argv.includes('--appliquer');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const M_STAGED = `
  mutation preparerTeleversement($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }
`;

const M_FICHIER = `
  mutation creerFichiers($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id fileStatus alt ... on MediaImage { image { url width height } } }
      userErrors { field message }
    }
  }
`;

const Q_STATUT = `
  query statutFichiers($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on MediaImage {
        id
        fileStatus
        image { url width height }
      }
    }
  }
`;

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function empreinte(chemin) {
  return createHash('sha256').update(readFileSync(chemin)).digest('hex').slice(0, 16);
}

function chargerManifeste() {
  return existsSync(MANIFESTE) ? JSON.parse(readFileSync(MANIFESTE, 'utf8')) : { images: {} };
}

/** Les visuels référencés par au moins un produit, avec leur alt FR. */
function collecterVisuels() {
  const dossierProduits = join(RACINE, 'data', 'produits');
  const utilises = new Map();

  for (const f of readdirSync(dossierProduits).filter((x) => x.endsWith('.json'))) {
    const p = JSON.parse(readFileSync(join(dossierProduits, f), 'utf8'));
    for (const img of p.images || []) {
      if (img.fichier) utilises.set(img.fichier, img.alt?.fr || p.titre);
    }
  }
  return utilises;
}

async function main() {
  const manifeste = chargerManifeste();
  const visuels = collecterVisuels();

  const aTeleverser = [];
  for (const [fichier, alt] of visuels) {
    const chemin = join(DOSSIER_IMAGES, fichier);
    if (!existsSync(chemin)) {
      console.error(`x Introuvable : data/images/${fichier}`);
      process.exitCode = 1;
      continue;
    }
    const sha = empreinte(chemin);
    const connu = manifeste.images[fichier];
    if (connu?.sha === sha && connu.url) continue;   // inchangé
    aTeleverser.push({ fichier, chemin, alt, sha });
  }

  console.log(`${visuels.size} visuel(s) référencé(s) : ${aTeleverser.length} à téléverser.`);
  if (process.exitCode === 1) {
    console.error('Des fichiers manquent : arrêt avant tout appel Shopify.');
    return;
  }
  if (!aTeleverser.length) return;

  if (!APPLIQUER) {
    console.log('\nSimulation (--appliquer absent). Seraient téléversés :');
    for (const v of aTeleverser) console.log(`  + ${v.fichier}`);
    return;
  }

  // On procède par paquets : stagedUploadsCreate accepte plusieurs cibles,
  // fileCreate aussi, et on reste largement sous le plafond de coût GraphQL.
  const TAILLE_PAQUET = 20;

  for (let i = 0; i < aTeleverser.length; i += TAILLE_PAQUET) {
    const paquet = aTeleverser.slice(i, i + TAILLE_PAQUET);
    console.log(`\nPaquet ${i / TAILLE_PAQUET + 1} : ${paquet.length} visuel(s)`);

    const { stagedUploadsCreate } = await graphql(M_STAGED, {
      input: paquet.map((v) => ({
        filename: basename(v.fichier),
        mimeType: MIME[extname(v.fichier).toLowerCase()],
        resource: 'IMAGE',
        httpMethod: 'POST',
      })),
    });

    const sources = [];
    for (const [j, cible] of stagedUploadsCreate.stagedTargets.entries()) {
      const v = paquet[j];
      const contenu = readFileSync(v.chemin);
      const ressource = await televerserVersCible(
        cible,
        contenu,
        basename(v.fichier),
        MIME[extname(v.fichier).toLowerCase()]
      );
      sources.push({ v, ressource });
      console.log(`  ↑ ${v.fichier}`);
    }

    const { fileCreate } = await graphql(M_FICHIER, {
      files: sources.map(({ v, ressource }) => ({
        originalSource: ressource,
        alt: v.alt,
        contentType: 'IMAGE',
        filename: basename(v.fichier),
      })),
    });

    // Shopify traite les fichiers en asynchrone : on attend READY pour
    // obtenir l'URL CDN définitive, sinon productSet référencerait un vide.
    const ids = fileCreate.files.map((f) => f.id);
    const prets = await attendrePrets(ids);

    sources.forEach(({ v }, j) => {
      const pret = prets[j];
      manifeste.images[v.fichier] = {
        sha: v.sha,
        id: pret?.id ?? ids[j],
        url: pret?.image?.url ?? null,
        largeur: pret?.image?.width ?? null,
        hauteur: pret?.image?.height ?? null,
        televerse_le: new Date().toISOString(),
      };
    });

    writeFileSync(MANIFESTE, JSON.stringify(manifeste, null, 2) + '\n');
  }

  console.log(`\nManifeste mis à jour : ${MANIFESTE}`);
}

async function attendrePrets(ids, maxSecondes = 180) {
  const debut = Date.now();
  while ((Date.now() - debut) / 1000 < maxSecondes) {
    const { nodes } = await graphql(Q_STATUT, { ids });
    const enCours = nodes.filter((n) => n && n.fileStatus !== 'READY' && n.fileStatus !== 'FAILED');
    const echecs = nodes.filter((n) => n?.fileStatus === 'FAILED');
    if (echecs.length) {
      throw new Error(`Shopify a rejeté ${echecs.length} visuel(s) : ${echecs.map((e) => e.id).join(', ')}`);
    }
    if (!enCours.length) return nodes;
    await attendre(3000);
  }
  throw new Error('Délai dépassé : des visuels sont encore en traitement chez Shopify.');
}

main().catch((e) => {
  console.error(`\nÉchec : ${e.message}`);
  process.exit(1);
});
