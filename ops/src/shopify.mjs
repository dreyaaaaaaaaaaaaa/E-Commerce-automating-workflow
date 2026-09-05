/**
 * Client Admin GraphQL minimal.
 *
 * Trois responsabilités, et rien d'autre :
 *  1. ne jamais logger le jeton d'accès ;
 *  2. respecter le seau à jetons de Shopify (coût GraphQL) ;
 *  3. faire échouer bruyamment sur `userErrors` : une mutation qui renvoie
 *     200 avec des userErrors est un échec, pas un succès.
 */

const VERSION_API = process.env.SHOPIFY_API_VERSION || '2025-07';

function lireEnv() {
  const boutique = process.env.SHOPIFY_SHOP;   // ex. maison.myshopify.com
  const jeton = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!boutique || !jeton) {
    throw new Error(
      'SHOPIFY_SHOP et SHOPIFY_ADMIN_TOKEN sont requis. ' +
      'En CI ils viennent des secrets GitHub ; en local, du fichier .env non versionné.'
    );
  }
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(boutique)) {
    throw new Error(`SHOPIFY_SHOP invalide : ${boutique}`);
  }
  return { boutique, jeton };
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Masque toute occurrence du jeton dans un texte destiné aux logs. */
export function assainir(texte) {
  const jeton = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!jeton) return texte;
  return String(texte).replaceAll(jeton, '«jeton masqué»');
}

/**
 * Exécute une requête GraphQL avec relance sur throttling.
 * @param {string} requete
 * @param {object} variables
 * @param {{tentatives?: number}} options
 */
export async function graphql(requete, variables = {}, options = {}) {
  const { boutique, jeton } = lireEnv();
  const maxTentatives = options.tentatives ?? 6;
  const url = `https://${boutique}/admin/api/${VERSION_API}/graphql.json`;

  for (let tentative = 1; tentative <= maxTentatives; tentative++) {
    const reponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': jeton,
      },
      body: JSON.stringify({ query: requete, variables }),
    });

    // 429 / 5xx : on relance avec un back-off exponentiel plafonné.
    if (reponse.status === 429 || reponse.status >= 500) {
      const attente = Math.min(2 ** tentative * 500, 20_000);
      console.warn(`HTTP ${reponse.status} : nouvelle tentative dans ${attente} ms (${tentative}/${maxTentatives})`);
      await attendre(attente);
      continue;
    }

    if (!reponse.ok) {
      throw new Error(assainir(`HTTP ${reponse.status} : ${await reponse.text()}`));
    }

    const corps = await reponse.json();

    // Throttling applicatif : Shopify répond 200 avec un code THROTTLED.
    const estThrottle = corps.errors?.some((e) => e.extensions?.code === 'THROTTLED');
    if (estThrottle) {
      const seau = corps.extensions?.cost?.throttleStatus;
      const manquant = (seau?.maximumAvailable ?? 1000) * 0.5 - (seau?.currentlyAvailable ?? 0);
      const attente = Math.max(1000, (manquant / (seau?.restoreRate ?? 50)) * 1000);
      console.warn(`Coût GraphQL épuisé : pause ${Math.round(attente)} ms`);
      await attendre(attente);
      continue;
    }

    if (corps.errors?.length) {
      throw new Error(assainir(`GraphQL : ${JSON.stringify(corps.errors)}`));
    }

    // userErrors : présentes sur toutes les mutations Shopify. On échoue.
    const erreursUtilisateur = collecterUserErrors(corps.data);
    if (erreursUtilisateur.length) {
      throw new Error(`userErrors : ${JSON.stringify(erreursUtilisateur, null, 2)}`);
    }

    return corps.data;
  }

  throw new Error(`Abandon après ${maxTentatives} tentatives (throttling persistant).`);
}

function collecterUserErrors(data, chemin = []) {
  const trouvees = [];
  if (!data || typeof data !== 'object') return trouvees;

  for (const [cle, valeur] of Object.entries(data)) {
    if (cle === 'userErrors' && Array.isArray(valeur) && valeur.length) {
      trouvees.push({ mutation: chemin.join('.'), erreurs: valeur });
    } else if (valeur && typeof valeur === 'object') {
      trouvees.push(...collecterUserErrors(valeur, [...chemin, cle]));
    }
  }
  return trouvees;
}

/** Téléverse un fichier vers une cible signée renvoyée par stagedUploadsCreate. */
export async function televerserVersCible(cible, contenu, nomFichier, typeMime) {
  const formulaire = new FormData();
  for (const { name, value } of cible.parameters) formulaire.append(name, value);
  formulaire.append('file', new Blob([contenu], { type: typeMime }), nomFichier);

  const reponse = await fetch(cible.url, { method: 'POST', body: formulaire });
  if (!reponse.ok) {
    throw new Error(`Téléversement échoué (${reponse.status}) : ${await reponse.text()}`);
  }
  return cible.resourceUrl;
}
