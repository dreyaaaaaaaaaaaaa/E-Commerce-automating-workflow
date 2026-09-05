#!/usr/bin/env node
/**
 * Contrôles de cohérence du thème que Theme Check ne fait pas.
 *
 * Lancé en CI avant tout déploiement, et localement avant une PR :
 *   node tools/verifier-theme.mjs
 *
 * Cinq vérifications :
 *   1. tous les JSON du thème parsent ;
 *   2. toute clé `| t` utilisée existe dans fr.default.json ;
 *   3. fr.default.json et en.json ont exactement les mêmes clés ;
 *   4. tout `render 'x'` a son snippet ;
 *   5. toute section référencée par un gabarit existe.
 *
 * Le point 3 est celui qui compte le plus au quotidien : une clé ajoutée en
 * français et oubliée en anglais fait retomber la page EN en français, en
 * silence, sur un seul mot. Personne ne le voit avant un client.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const THEME = 'theme';
let problemes = 0;

const signaler = (message) => { console.error(`x ${message}`); problemes++; };

/** Liste récursive des fichiers d'une extension donnée. */
function lister(racine, extension) {
  if (!existsSync(racine)) return [];
  return readdirSync(racine, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(racine, e.name);
    if (e.isDirectory()) return lister(chemin, extension);
    return extname(e.name) === extension ? [chemin] : [];
  });
}

/* ---- 1. JSON valides ---- */
const fichiersJson = lister(THEME, '.json');
for (const f of fichiersJson) {
  try {
    JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    signaler(`JSON invalide : ${f} : ${e.message}`);
  }
}

/* ---- Aplatissement des locales ---- */
const PLURIELS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

function aplatir(objet, prefixe = '', sortie = new Set()) {
  for (const [cle, valeur] of Object.entries(objet)) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    const estPluriel =
      valeur && typeof valeur === 'object' &&
      Object.keys(valeur).every((k) => PLURIELS.has(k));

    if (valeur && typeof valeur === 'object' && !estPluriel) {
      aplatir(valeur, chemin, sortie);
    } else {
      sortie.add(chemin);
    }
  }
  return sortie;
}

const cheminFr = join(THEME, 'locales', 'fr.default.json');
const cheminEn = join(THEME, 'locales', 'en.json');
const clesFr = aplatir(JSON.parse(readFileSync(cheminFr, 'utf8')));
const clesEn = aplatir(JSON.parse(readFileSync(cheminEn, 'utf8')));

/* ---- 2 & 4. Clés et snippets utilisés dans les .liquid ---- */
const fichiersLiquid = lister(THEME, '.liquid');
const snippets = new Set(
  lister(join(THEME, 'snippets'), '.liquid').map((f) => basename(f, '.liquid'))
);

for (const f of fichiersLiquid) {
  const source = readFileSync(f, 'utf8');

  for (const m of source.matchAll(/'([a-z0-9_.]+)'\s*\|\s*t\b/g)) {
    if (!clesFr.has(m[1])) signaler(`clé de traduction absente de fr.default.json : « ${m[1]} » (${f})`);
  }
  for (const m of source.matchAll(/render\s+'([a-z0-9_-]+)'/g)) {
    if (!snippets.has(m[1])) signaler(`snippet introuvable : « ${m[1]} » (${f})`);
  }
}

/* ---- 3. Parité fr / en ---- */
for (const cle of clesFr) {
  if (!clesEn.has(cle)) signaler(`clé absente de en.json : « ${cle} » : la page EN retomberait en français`);
}
for (const cle of clesEn) {
  if (!clesFr.has(cle)) signaler(`clé présente en EN mais absente de fr.default.json : « ${cle} »`);
}

/* ---- 5. Sections référencées ---- */
const sections = new Set(
  lister(join(THEME, 'sections'), '.liquid').map((f) => basename(f, '.liquid'))
);

for (const f of fichiersJson) {
  const dansGabarits = f.includes(join(THEME, 'templates'));
  const estGroupe = basename(f).endsWith('-groupe.json');
  if (!dansGabarits && !estGroupe) continue;

  const contenu = JSON.parse(readFileSync(f, 'utf8'));
  for (const bloc of Object.values(contenu.sections || {})) {
    if (!sections.has(bloc.type)) signaler(`section introuvable : « ${bloc.type} » (${f})`);
  }
}

/* ---- Avertissement : assets référencés mais absents ---- */
const assets = new Set(
  existsSync(join(THEME, 'assets')) ? readdirSync(join(THEME, 'assets')) : []
);
for (const f of fichiersLiquid) {
  const source = readFileSync(f, 'utf8');
  for (const m of source.matchAll(/'([A-Za-z0-9._-]+\.(?:css|js|woff2|svg|png))'\s*\|\s*asset_url/g)) {
    if (!assets.has(m[1])) console.warn(`~ asset à déposer : ${m[1]} (${f})`);
  }
}

/* ---- Verdict ---- */
if (problemes) {
  console.error(`\n${problemes} problème(s). Le thème n est pas déployable.`);
  process.exit(1);
}
console.log(`Thème cohérent : ${fichiersLiquid.length} fichiers liquid, ${clesFr.size} clés de traduction, parité FR/EN vérifiée.`);
