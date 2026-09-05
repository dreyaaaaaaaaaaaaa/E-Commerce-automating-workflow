#!/usr/bin/env node
/**
 * Validation du catalogue source avant tout envoi vers Shopify.
 *
 * Exécuté :
 *  - sur chaque pull request touchant ops/data/** (bloquant) ;
 *  - au début de pousser.mjs (bloquant, même en local) ;
 *  - par la suite de tests (tests/valider.test.mjs), sur des dossiers
 *    temporaires plutôt que sur le vrai catalogue.
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

/* ------------------------------------------------------------------ *
 * Chaque appel à validerCatalogue() crée son propre collecteur
 * d'erreurs/avertissements, passé en paramètre à chaque fonction de
 * contrôle. Rien n'est partagé au niveau du module : deux appels
 * successifs (dans un test, ou si pousser.mjs validait deux lots dans
 * le même process) ne se contaminent jamais l'un l'autre.
 * ------------------------------------------------------------------ */

function compterPhrases(texte) {
  return texte.split(/[.!?]+\s|[.!?]+$/).filter((s) => s.trim().length > 3).length;
}

/* ---------- Chargement ---------- */

function chargerProduits(dossierProduits, ctx) {
  if (!existsSync(dossierProduits)) {
    throw new Error(`Dossier introuvable : ${dossierProduits}`);
  }
  return readdirSync(dossierProduits)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const chemin = join(dossierProduits, f);
      try {
        return { fichier: f, ...JSON.parse(readFileSync(chemin, 'utf8')) };
      } catch (e) {
        ctx.erreur(f, 'fichier', `JSON invalide : ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

/* ---------- Contrôles ---------- */

function validerTexte(p, ctx) {
  const { handle, titre, description } = p;

  if (!handle || !REGLES.handle.motif.test(handle)) {
    ctx.erreur(handle || p.fichier, 'handle', REGLES.handle.message);
  } else if (handle.length > REGLES.handle.longueurMax) {
    ctx.erreur(handle, 'handle', `plus de ${REGLES.handle.longueurMax} caractères`);
  }

  if (!titre) {
    ctx.erreur(handle, 'titre', 'manquant');
  } else {
    if (titre.length < REGLES.titre.min || titre.length > REGLES.titre.max) {
      ctx.erreur(handle, 'titre', `${titre.length} caractères : attendu entre ${REGLES.titre.min} et ${REGLES.titre.max} (au-delà, le titre passe sur trois lignes et écrase le prix)`);
    }
    for (const { motif, message } of REGLES.titre.interdits) {
      if (motif.test(titre)) ctx.erreur(handle, 'titre', message);
    }
  }

  if (!description) {
    ctx.erreur(handle, 'description', 'manquante');
  } else {
    const nu = description.replace(/<[^>]+>/g, '').trim();
    if (nu.length < REGLES.description.min || nu.length > REGLES.description.max) {
      ctx.erreur(handle, 'description', `${nu.length} caractères : attendu entre ${REGLES.description.min} et ${REGLES.description.max}`);
    }
    const phrases = compterPhrases(nu);
    if (phrases < REGLES.description.phrasesMin || phrases > REGLES.description.phrasesMax) {
      ctx.avertir(handle, 'description', `${phrases} phrases : la maquette est calée sur ${REGLES.description.phrasesMin} à ${REGLES.description.phrasesMax}`);
    }
  }
}

function validerMetachamps(p, ctx) {
  const m = p.metachamps || {};
  for (const { cle, min, max, libelle } of REGLES.metachampsRequis) {
    const valeur = m[cle];
    if (!valeur || !String(valeur).trim()) {
      ctx.erreur(p.handle, `metachamps.${cle}`, `${libelle} manquant : l'accordéon de la fiche resterait vide`);
      continue;
    }
    const longueur = String(valeur).replace(/<[^>]+>/g, '').length;
    if (longueur < min || longueur > max) {
      ctx.erreur(p.handle, `metachamps.${cle}`, `${longueur} caractères : attendu entre ${min} et ${max}`);
    }
  }

  if (p.reference && !REGLES.reference.motif.test(p.reference)) {
    ctx.erreur(p.handle, 'reference', REGLES.reference.message);
  }
}

function validerUnivers(p, ctx) {
  if (!p.univers) {
    ctx.erreur(p.handle, 'univers', 'manquant : un produit hors univers n a pas de page où apparaître');
    return;
  }
  if (!REGLES.universAutorises.includes(p.univers)) {
    ctx.erreur(
      p.handle,
      'univers',
      `« ${p.univers} » inconnu : univers autorisés : ${REGLES.universAutorises.join(', ')}`
    );
  }
}

function validerPrix(p, ctx) {
  for (const [i, v] of (p.variantes || []).entries()) {
    const prefixe = `variantes[${i}]`;
    if (typeof v.prix_centimes !== 'number' || !Number.isInteger(v.prix_centimes)) {
      ctx.erreur(p.handle, `${prefixe}.prix_centimes`, 'doit être un entier en centimes');
      continue;
    }
    if (v.prix_centimes < REGLES.prix.minCentimes || v.prix_centimes > REGLES.prix.maxCentimes) {
      ctx.erreur(p.handle, `${prefixe}.prix_centimes`, `${v.prix_centimes} hors bornes [${REGLES.prix.minCentimes}, ${REGLES.prix.maxCentimes}]`);
    }
    if (v.prix_centimes % REGLES.prix.multipleDe !== 0) {
      ctx.avertir(p.handle, `${prefixe}.prix_centimes`, `non multiple de ${REGLES.prix.multipleDe} centimes`);
    }
    if (!v.sku) ctx.erreur(p.handle, `${prefixe}.sku`, 'manquant');
  }

  if (!p.variantes?.length) {
    ctx.erreur(p.handle, 'variantes', 'au moins une variante est requise');
  }
}

function validerImages(p, ctx, dossierImages) {
  const images = p.images || [];
  const { nombreMin, nombreMax, ratioAttendu, toleranceRatio, largeurMin, poidsMaxKo, formats, altMin, altMax } = REGLES.images;

  if (images.length < nombreMin) {
    ctx.erreur(p.handle, 'images', `${images.length} image(s) : minimum ${nombreMin}`);
    return;
  }
  if (images.length > nombreMax) {
    ctx.erreur(p.handle, 'images', `${images.length} images : maximum ${nombreMax} (la colonne de vignettes en affiche ${nombreMax})`);
  }

  images.forEach((img, i) => {
    const prefixe = `images[${i}]`;

    if (!img.fichier) {
      ctx.erreur(p.handle, `${prefixe}.fichier`, 'chemin manquant');
      return;
    }
    if (!formats.includes(extname(img.fichier).toLowerCase())) {
      ctx.erreur(p.handle, `${prefixe}.fichier`, `extension non autorisée : accepté : ${formats.join(', ')}`);
    }

    const chemin = join(dossierImages, img.fichier);
    if (!existsSync(chemin)) {
      ctx.erreur(p.handle, `${prefixe}.fichier`, `introuvable : ${chemin}`);
      return;
    }

    try {
      const { largeur, hauteur, octets } = dimensionsImage(chemin);
      const ratio = largeur / hauteur;

      if (Math.abs(ratio - ratioAttendu) > toleranceRatio) {
        ctx.erreur(
          p.handle,
          `${prefixe}.ratio`,
          `${formaterRatio(largeur, hauteur)} (${largeur}×${hauteur}) : la fiche produit est en 4:5 strict, recadrer avant import`
        );
      }
      if (largeur < largeurMin) {
        ctx.erreur(p.handle, `${prefixe}.largeur`, `${largeur}px : minimum ${largeurMin}px pour le srcset 2×`);
      }
      const ko = Math.round(octets / 1024);
      if (ko > poidsMaxKo) {
        ctx.avertir(p.handle, `${prefixe}.poids`, `${ko} Ko : au-delà de ${poidsMaxKo} Ko, recompresser (Shopify re-encode, mais le téléversement du lot devient long)`);
      }
    } catch (e) {
      ctx.erreur(p.handle, `${prefixe}.fichier`, e.message);
    }

    // Le alt est du contenu, pas du décor : il porte la DA et le SEO.
    for (const langue of ['fr', ...REGLES.languesRequises]) {
      const alt = img.alt?.[langue];
      if (!alt) {
        ctx.erreur(p.handle, `${prefixe}.alt.${langue}`, 'texte alternatif manquant');
      } else if (alt.length < altMin || alt.length > altMax) {
        ctx.erreur(p.handle, `${prefixe}.alt.${langue}`, `${alt.length} caractères : attendu entre ${altMin} et ${altMax}`);
      }
    }
  });
}

function validerTraductions(p, ctx) {
  for (const langue of REGLES.languesRequises) {
    const t = p.traductions?.[langue];
    if (!t) {
      ctx.erreur(p.handle, `traductions.${langue}`, 'bloc de traduction manquant');
      continue;
    }
    if (!t.titre) ctx.erreur(p.handle, `traductions.${langue}.titre`, 'manquant');
    if (!t.description) ctx.erreur(p.handle, `traductions.${langue}.description`, 'manquante');
    if (t.titre && t.titre.length > REGLES.titre.max) {
      ctx.erreur(p.handle, `traductions.${langue}.titre`, `${t.titre.length} caractères : maximum ${REGLES.titre.max}`);
    }
  }
}

function validerUnicite(produits, ctx) {
  const vus = new Map();
  const refs = new Map();
  const skus = new Map();

  for (const p of produits) {
    if (vus.has(p.handle)) {
      ctx.erreur(p.handle, 'handle', `doublon avec ${vus.get(p.handle)}`);
    } else {
      vus.set(p.handle, p.fichier);
    }

    if (p.reference) {
      if (refs.has(p.reference)) {
        ctx.erreur(p.handle, 'reference', `déjà utilisée par ${refs.get(p.reference)}`);
      } else {
        refs.set(p.reference, p.handle);
      }
    }

    for (const v of p.variantes || []) {
      if (!v.sku) continue;
      if (skus.has(v.sku)) {
        ctx.erreur(p.handle, 'variantes.sku', `SKU ${v.sku} déjà utilisé par ${skus.get(v.sku)}`);
      } else {
        skus.set(v.sku, p.handle);
      }
    }
  }
}

/* ---------- Exécution ---------- */

/**
 * @param {{ dossierProduits?: string, dossierImages?: string }} [options]
 *   Surcharges de chemin, utilisées par la suite de tests pour valider
 *   des fixtures plutôt que le vrai catalogue. Le CLI n'en passe aucune.
 */
export function validerCatalogue(options = {}) {
  const dossierProduits = options.dossierProduits ?? DOSSIER_PRODUITS;
  const dossierImages = options.dossierImages ?? DOSSIER_IMAGES;

  const problemes = [];
  const avertissements = [];
  const ctx = {
    erreur: (handle, champ, message) => problemes.push({ handle, champ, message }),
    avertir: (handle, champ, message) => avertissements.push({ handle, champ, message }),
  };

  const produits = chargerProduits(dossierProduits, ctx);

  for (const p of produits) {
    validerTexte(p, ctx);
    validerMetachamps(p, ctx);
    validerUnivers(p, ctx);
    validerPrix(p, ctx);
    validerImages(p, ctx, dossierImages);
    validerTraductions(p, ctx);
  }
  validerUnicite(produits, ctx);

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

// Exécution directe (pas quand le module est importé par pousser.mjs ou
// par la suite de tests).
if (process.argv[1]?.endsWith('valider.mjs')) {
  try {
    process.exit(rapporter(validerCatalogue()));
  } catch (e) {
    console.error(`\nÉchec : ${e.message}`);
    process.exit(1);
  }
}
