/**
 * Règles de direction artistique, exprimées en données.
 *
 * C'est le contrat entre le catalogue et le design. Un produit qui ne
 * respecte pas ces règles n'entre pas dans la boutique : pas « entre en
 * étant un peu moche », n'entre pas. C'est ce qui permet de pousser un
 * lot de 400 références sans relire 400 fiches.
 *
 * Les valeurs viennent directement du comp 1a « Lumière rasante ».
 */

export const REGLES = {
  /* ---- Identité ---- */
  handle: {
    motif: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    longueurMax: 60,
    message: 'handle en minuscules, mots séparés par des tirets',
  },

  reference: {
    motif: /^[A-Z]{2,4}-\d{3,5}$/,
    message: 'référence interne au format AB-1234',
  },

  /* ---- Texte : les longueurs sont celles que la maquette encaisse ---- */
  titre: {
    min: 3,
    max: 48,
    // Le comp affiche le titre en Instrument Serif 46px sur 470px de large :
    // au-delà de 48 caractères il passe sur trois lignes et écrase le prix.
    interdits: [
      { motif: /[A-ZÀ-Ý]{4,}/, message: 'pas de mot en capitales (la DA met les capitales aux libellés, pas aux titres)' },
      { motif: /[.!]$/, message: 'pas de ponctuation finale dans un titre' },
      { motif: /\s{2,}/, message: 'espaces multiples' },
      { motif: /["']{1}/, message: 'utiliser les guillemets typographiques « » ou l apostrophe courbe' },
    ],
  },

  description: {
    min: 120,
    max: 420,
    // 2 à 3 phrases : le gabarit réserve 46ch × 4 lignes.
    phrasesMin: 2,
    phrasesMax: 4,
  },

  chapoUnivers: { min: 80, max: 220 },

  /* ---- Métachamps obligatoires ---- */
  metachampsRequis: [
    { cle: 'matiere', min: 12, max: 220, libelle: 'Matière' },
    { cle: 'dimensions', min: 8, max: 220, libelle: 'Dimensions' },
    { cle: 'entretien', min: 20, max: 400, libelle: 'Entretien' },
    { cle: 'brief_photo', min: 10, max: 160, libelle: 'Brief photo' },
  ],

  /* ---- Images ---- */
  images: {
    nombreMin: 1,
    nombreMax: 6,
    // Le gabarit produit est en 4:5 strict. Une image 1:1 casse la colonne.
    ratioAttendu: 4 / 5,
    toleranceRatio: 0.02,
    largeurMin: 1400,
    poidsMaxKo: 2600,
    formats: ['.jpg', '.jpeg', '.png', '.webp'],
    altMin: 12,
    altMax: 125,
  },

  /* ---- Prix ---- */
  prix: {
    minCentimes: 500,        // en dessous de 5 €, on est sur un accessoire : à valider à la main
    maxCentimes: 500_000,
    // La DA affiche « 00,00 € » : un prix rond au centime près uniquement.
    multipleDe: 50,          // pas de 12,37 € dans une maison de décoration
  },

  /* ---- Univers : la liste fermée du design ---- */
  universAutorises: ['table-et-lumiere', 'terre-et-gres', 'nuit-et-laiton'],

  /* ---- Traductions : FR est la langue source, EN est obligatoire ---- */
  languesRequises: ['en'],

  /* ---- Statut à la création ---- */
  // Tout produit arrive en DRAFT. La bascule vers ACTIVE est une opération
  // séparée, sur le lot entier, après relecture visuelle. Voir publier.mjs.
  statutInitial: 'DRAFT',
};

/** Ratio d'une image, arrondi, pour messages d'erreur lisibles. */
export function formaterRatio(largeur, hauteur) {
  const r = largeur / hauteur;
  const connus = [
    ['4:5', 4 / 5], ['1:1', 1], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9], ['2:3', 2 / 3],
  ];
  const proche = connus.find(([, v]) => Math.abs(v - r) < 0.02);
  return proche ? proche[0] : r.toFixed(3);
}
