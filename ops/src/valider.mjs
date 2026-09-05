#!/usr/bin/env node
/**
 * Validation du catalogue source avant tout envoi vers Shopify.
 *
 * Exécuté :
 *  - sur chaque pull request touchant ops/data/** (bloquant) ;
 *  - au début de pousser.mjs (bloquant, même en local).
 *
 * Ce script ne parle jamais à Shopify. Il ne lit que des fichiers.
 * Conséquence pratique : n'importe qui peut le lancer sans jeton d'accès.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGLES, formaterRatio } from '../schema/regles-da.mjs';
import { dimensionsImage } from './dimensions-image.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const DOSSIER_PRODUITS = join(RACINE, 'data', 'produits');
const DOSSIER_IMAGES = join(RACINE, 'data', 'images');

/* ------------------------------------------------------------------ */

const problemes = [];
const avertissements = [];

const erreur = (handle, champ, message) => problemes.push({ handle, champ, message });
const avertir = (handle, champ, message) => avertissements.push({ handle, champ, message });

function compterPhrases(texte) {
  return texte.split(/[.!?]+\s|[.!?]+$/).filter((s) => s.trim().length > 3).length;
}

/* ---------- Chargement ---------- */

function chargerProduits() {
  if (!existsSync(DOSSIER_PRODUITS)) {
    console.error(`Dossier introuvable : ${DOSSIER_PRODUITS}`);
    process.exit(1);
  }
  return readdirSync(DOSSIER_PRODUITS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const chemin = join(DOSSIER_PRODUITS, f);
      try {
        return { fichier: f, ...JSON.parse(readFileSync(chemin, 'utf8')) };
      } catch (e) {
        erreur(f, 'fichier', `JSON invalide : ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

/* ---------- Contrôles ---------- */

function validerTexte(p) {
  const { handle, titre, description } = p;

  if (!handle || !REGLES.handle.motif.test(handle)) {
    erreur(handle || p.fichier, 'handle', REGLES.handle.message);
  } else if (handle.length > REGLES.handle.longueurMax) {
    erreur(handle, 'handle', `plus de ${REGLES.handle.longueurMax} caractères`);
  }

  if (!titre) {
    erreur(handle, 'titre', 'manquant');
  } else {
    if (titre.length < REGLES.titre.min || titre.length > REGLES.titre.max) {
      erreur(handle, 'titre', `${titre.length} caractères : attendu entre ${REGLES.titre.min} et ${REGLES.titre.max} (au-delà, le titre passe sur trois lignes et écrase le prix)`);
    }
    for (const { motif, message } of REGLES.titre.interdits) {
      if (motif.test(titre)) erreur(handle, 'titre', message);
    }
  }

  if (!description) {
    erreur(handle, 'description', 'manquante');
  } else {
    const nu = description.replace(/<[^>]+>/g, '').trim();
    if (nu.length < REGLES.description.min || nu.length > REGLES.description.max) {
      erreur(handle, 'description', `${nu.length} caractères : attendu entre ${REGLES.description.min} et ${REGLES.description.max}`);
    }
    const phrases = compterPhrases(nu);
    if (phrases < REGLES.description.phrasesMin || phrases > REGLES.description.phrasesMax) {
      avertir(handle, 'description', `${phrases} phrases : la maquette est calée sur ${REGLES.description.phrasesMin} à ${REGLES.description.phrasesMax}`);
    }
  }
}

function validerMetachamps(p) {
  const m = p.metachamps || {};
  for (const { cle, min, max, libelle } of REGLES.metachampsRequis) {
    const valeur = m[cle];
    if (!valeur || !String(valeur).trim()) {
      erreur(p.handle, `metachamps.${cle}`, `${libelle} manquant : l'accordéon de la fiche resterait vide`);
      continue;
    }
    const longueur = String(valeur).replace(/<[^>]+>/g, '').length;
    if (longueur < min || longueur > max) {
      erreur(p.handle, `metachamps.${cle}`, `${longueur} caractères : attendu entre ${min} et ${max}`);
    }
  }

  if (p.reference && !REGLES.reference.motif.test(p.reference)) {
    erreur(p.handle, 'reference', REGLES.reference.message);
  }
}

function validerUnivers(p) {
  if (!p.univers) {
    erreur(p.handle, 'univers', 'manquant : un produit hors univers n a pas de page où apparaître');
    return;
  }
  if (!REGLES.universAutorises.includes(p.univers)) {
    erreur(
      p.handle,
      'univers',
      `« ${p.univers} » inconnu : univers autorisés : ${REGLES.universAutorises.join(', ')}`
    );
  }
}

function validerPrix(p) {
  for (const [i, v] of (p.variantes || []).entries()) {
    const prefixe = `variantes[${i}]`;
    if (typeof v.prix_centimes !== 'number' || !Number.isInteger(v.prix_centimes)) {
      erreur(p.handle, `${prefixe}.prix_centimes`, 'doit être un entier en centimes');
      continue;
    }
    if (v.prix_centimes < REGLES.prix.minCentimes || v.prix_centimes > REGLES.prix.maxCentimes) {
      erreur(p.handle, `${prefixe}.prix_centimes`, `${v.prix_centimes} hors bornes [${REGLES.prix.minCentimes}, ${REGLES.prix.maxCentimes}]`);
    }
    if (v.prix_centimes % REGLES.prix.multipleDe !== 0) {
      avertir(p.handle, `${prefixe}.prix_centimes`, `non multiple de ${REGLES.prix.multipleDe} centimes`);
    }
    if (!v.sku) erreur(p.handle, `${prefixe}.sku`, 'manquant');
  }

  if (!p.variantes?.length) {
    erreur(p.handle, 'variantes', 'au moins une variante est requise');
  }
}

function validerImages(p) {
  const images = p.images || [];
  const { nombreMin, nombreMax, ratioAttendu, toleranceRatio, largeurMin, poidsMaxKo, formats, altMin, altMax } = REGLES.images;

  if (images.length < nombreMin) {
    erreur(p.handle, 'images', `${images.length} image(s) : minimum ${nombreMin}`);
    return;
  }
  if (images.length > nombreMax) {
    erreur(p.handle, 'images', `${images.length} images : maximum ${nombreMax} (la colonne de vignettes en affiche ${nombreMax})`);
  }

  images.forEach((img, i) => {
    const prefixe = `images[${i}]`;

    if (!img.fichier) {
      erreur(p.handle, `${prefixe}.fichier`, 'chemin manquant');
      return;
    }
    if (!formats.includes(extname(img.fichier).toLowerCase())) {
      erreur(p.handle, `${prefixe}.fichier`, `extension non autorisée : accepté : ${formats.join(', ')}`);
    }

    const chemin = join(DOSSIER_IMAGES, img.fichier);
    if (!existsSync(chemin)) {
      erreur(p.handle, `${prefixe}.fichier`, `introuvable : data/images/${img.fichier}`);
      return;
    }

    try {
      const { largeur, hauteur, octets } = dimensionsImage(chemin);
      const ratio = largeur / hauteur;

      if (Math.abs(ratio - ratioAttendu) > toleranceRatio) {
        erreur(
          p.handle,
          `${prefixe}.ratio`,
          `${formaterRatio(largeur, hauteur)} (${largeur}×${hauteur}) : la fiche produit est en 4:5 strict, recadrer avant import`
        );
      }
      if (largeur < largeurMin) {
        erreur(p.handle, `${prefixe}.largeur`, `${largeur}px : minimum ${largeurMin}px pour le srcset 2×`);
      }
      const ko = Math.round(octets / 1024);
      if (ko > poidsMaxKo) {
        avertir(p.handle, `${prefixe}.poids`, `${ko} Ko : au-delà de ${poidsMaxKo} Ko, recompresser (Shopify re-encode, mais le téléversement du lot devient long)`);
      }
    } catch (e) {
      erreur(p.handle, `${prefixe}.fichier`, e.message);
    }

    // Le alt est du contenu, pas du décor : il porte la DA et le SEO.
    for (const langue of ['fr', ...REGLES.languesRequises]) {
      const alt = img.alt?.[langue];
      if (!alt) {
        erreur(p.handle, `${prefixe}.alt.${langue}`, 'texte alternatif manquant');
      } else if (alt.length < altMin || alt.length > altMax) {
        erreur(p.handle, `${prefixe}.alt.${langue}`, `${alt.length} caractères : attendu entre ${altMin} et ${altMax}`);
      }
    }
  });
}

function validerTraductions(p) {
  for (const langue of REGLES.languesRequises) {
    const t = p.traductions?.[langue];
    if (!t) {
      erreur(p.handle, `traductions.${langue}`, 'bloc de traduction manquant');
      continue;
    }
    if (!t.titre) erreur(p.handle, `traductions.${langue}.titre`, 'manquant');
    if (!t.description) erreur(p.handle, `traductions.${langue}.description`, 'manquante');
    if (t.titre && t.titre.length > REGLES.titre.max) {
      erreur(p.handle, `traductions.${langue}.titre`, `${t.titre.length} caractères : maximum ${REGLES.titre.max}`);
    }
  }
}

function validerUnicite(produits) {
  const vus = new Map();
  const refs = new Map();
  const skus = new Map();

  for (const p of produits) {
    if (vus.has(p.handle)) {
      erreur(p.handle, 'handle', `doublon avec ${vus.get(p.handle)}`);
    } else {
      vus.set(p.handle, p.fichier);
    }

    if (p.reference) {
      if (refs.has(p.reference)) {
        erreur(p.handle, 'reference', `déjà utilisée par ${refs.get(p.reference)}`);
      } else {
        refs.set(p.reference, p.handle);
      }
    }

    for (const v of p.variantes || []) {
      if (!v.sku) continue;
      if (skus.has(v.sku)) {
        erreur(p.handle, 'variantes.sku', `SKU ${v.sku} déjà utilisé par ${skus.get(v.sku)}`);
      } else {
        skus.set(v.sku, p.handle);
      }
    }
  }
}

/* ---------- Exécution ---------- */

export function validerCatalogue() {
  const produits = chargerProduits();

  for (const p of produits) {
    validerTexte(p);
    validerMetachamps(p);
    validerUnivers(p);
    validerPrix(p);
    validerImages(p);
    validerTraductions(p);
  }
  validerUnicite(produits);

  return { produits, problemes, avertissements };
}

function rapporter({ produits, problemes, avertissements }) {
  const grouper = (liste) => {
    const par = new Map();
    for (const item of liste) {
      if (!par.has(item.handle)) par.set(item.handle, []);
      par.get(item.handle).push(item);
    }
    return par;
  };

  console.log(`\nCatalogue source : ${produits.length} produit(s)\n`);

  if (avertissements.length) {
    console.log(`- ${avertissements.length} avertissement(s) -`);
    for (const [handle, items] of grouper(avertissements)) {
      console.log(`  ${handle}`);
      for (const i of items) console.log(`    ~ ${i.champ} : ${i.message}`);
    }
    console.log('');
  }

  if (problemes.length) {
    console.log(`- ${problemes.length} erreur(s) bloquante(s) -`);
    for (const [handle, items] of grouper(problemes)) {
      console.log(`  ${handle}`);
      for (const i of items) console.log(`    x ${i.champ} : ${i.message}`);
    }
    console.log('\nLe lot est refusé. Aucun appel n a été fait vers Shopify.\n');
    return 1;
  }

  console.log('Catalogue conforme à la DA. Le lot peut être poussé.\n');
  return 0;
}

// Exécution directe (pas quand le module est importé par pousser.mjs).
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('valider.mjs')) {
  process.exit(rapporter(validerCatalogue()));
}
