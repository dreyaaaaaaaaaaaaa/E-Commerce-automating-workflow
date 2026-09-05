/**
 * Lecture des dimensions d'une image depuis ses seuls octets d'en-tête.
 *
 * Pourquoi à la main plutôt qu'avec sharp : ce module tourne dans un job CI
 * qui a le droit d'écrire dans le catalogue. Moins de dépendances = moins de
 * surface d'attaque via la chaîne d'approvisionnement npm, et un job qui
 * démarre en 200 ms sans binaire natif à compiler.
 *
 * Formats couverts : JPEG, PNG, WebP (VP8/VP8L/VP8X), GIF.
 */

import { openSync, readSync, closeSync, statSync } from 'node:fs';

/**
 * @param {string} chemin
 * @returns {{largeur: number, hauteur: number, format: string, octets: number}}
 */
export function dimensionsImage(chemin) {
  const octets = statSync(chemin).size;
  const fd = openSync(chemin, 'r');
  try {
    // 64 Ko d'en-tête suffisent pour tous les formats visés.
    const tampon = Buffer.alloc(Math.min(65_536, octets));
    readSync(fd, tampon, 0, tampon.length, 0);

    const lu =
      lirePng(tampon) ||
      lireGif(tampon) ||
      lireWebp(tampon) ||
      lireJpeg(tampon);

    if (!lu) throw new Error(`Format d'image non reconnu : ${chemin}`);
    return { ...lu, octets };
  } finally {
    closeSync(fd);
  }
}

function lirePng(b) {
  if (b.length < 24) return null;
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20), format: 'png' };
}

function lireGif(b) {
  if (b.length < 10 || b.toString('ascii', 0, 3) !== 'GIF') return null;
  return { largeur: b.readUInt16LE(6), hauteur: b.readUInt16LE(8), format: 'gif' };
}

function lireWebp(b) {
  if (b.length < 30) return null;
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;

  const type = b.toString('ascii', 12, 16);
  if (type === 'VP8 ') {
    return { largeur: b.readUInt16LE(26) & 0x3fff, hauteur: b.readUInt16LE(28) & 0x3fff, format: 'webp' };
  }
  if (type === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return {
      largeur: (bits & 0x3fff) + 1,
      hauteur: ((bits >> 14) & 0x3fff) + 1,
      format: 'webp',
    };
  }
  if (type === 'VP8X') {
    return {
      largeur: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
      hauteur: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
      format: 'webp',
    };
  }
  return null;
}

function lireJpeg(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }

    const marqueur = b[i + 1];
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 portent les dimensions.
    const estSof =
      (marqueur >= 0xc0 && marqueur <= 0xc3) ||
      (marqueur >= 0xc5 && marqueur <= 0xc7) ||
      (marqueur >= 0xc9 && marqueur <= 0xcb) ||
      (marqueur >= 0xcd && marqueur <= 0xcf);

    if (estSof) {
      return { hauteur: b.readUInt16BE(i + 5), largeur: b.readUInt16BE(i + 7), format: 'jpeg' };
    }

    // Marqueurs sans charge utile.
    if (marqueur === 0xd8 || marqueur === 0xd9 || (marqueur >= 0xd0 && marqueur <= 0xd7)) {
      i += 2;
      continue;
    }
    const taille = b.readUInt16BE(i + 2);
    if (taille < 2) return null;
    i += 2 + taille;
  }
  return null;
}
