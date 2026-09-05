# Architecture : boutique Shopify « Lumière rasante »

Document de référence pour la construction du site. Il part de la direction
artistique validée (option **1a**, projet Claude Design *Direction Artistique*)
et décrit la plateforme, le modèle de données, le thème, la sécurité, et le
pipeline qui pousse le catalogue par lots.

---

## 1. La direction artistique, en données

Relevé sur le comp 1a « Lumière rasante » : ivoire chaud, air, filets laiton,
éditorial doux, produit posé dans le décor.

| | |
|---|---|
| **Fonds** | ivoire `#faf6ef`, ivoire secondaire `#f0eae0`, crème `#ede4d6` |
| **Texte** | encre (noir chaud) `#1a1512`, noir profond `#13100d` |
| **Accents** | laiton `#a9803c`, laiton clair `#c49a55`, bleu nuit `#15203a` (univers 03) |
| **Titres** | Instrument Serif 400 : 78 / 62 / 46 / 44 / 25 / 21 px |
| **Courant** | Jost 300 : 15,5 px / 1,75 |
| **Libellés** | Jost 400, 10–11,5 px, capitales, interlettrage .10 → .24 em |
| **Numérotation** | monospace 9,5–10 px, interlettrage .16 → .20 em |
| **Gouttière** | 56 px desktop, fluide jusqu'à 20 px |
| **Grilles** | accueil `repeat(3, 1fr)` · univers `1fr 560px` · produit `96px 1fr 470px` |
| **Hero** | 760 px, voile dégradé ivoire 72 % → 0 → 12 % → 86 % |
| **Filets** | 1 px `rgba(26,21,18,.12)` : jamais de bordure plus épaisse |
| **Motion** | 320 ms, `cubic-bezier(.22,.61,.36,1)` : rien ne rebondit |

Trois gabarits sont maquettés, en desktop 1440 et mobile 390 :
**Accueil** (FR + EN), **Page univers** « Table & Lumière », **Fiche produit**.
Trois univers sont nommés : `01 Table & Lumière`, `02 Terre & Grès`,
`03 Nuit & Laiton`.

Le comp affiche partout des placeholders **« PHOTO À VENIR »** avec un brief de
prise de vue. Ce n'est pas un trou dans la maquette : c'est un composant du
système, et il est implémenté comme tel (§ 4.3).

---

## 2. Décisions de plateforme

### 2.1 Thème custom, pas un fork de Dawn : et pas Hydrogen

| Option | Verdict | Pourquoi |
|---|---|---|
| Fork de Dawn | non | ~300 fichiers, un système de design complet à désapprendre. Chaque section porte des réglages de couleur, de bordure, de rayon que la DA n'utilise pas, autant de portes ouvertes pour la faire dériver. On passerait plus de temps à retirer qu'à écrire. |
| **Thème custom Online Store 2.0** | **retenu** | ~30 fichiers, un seul langage visuel, un budget JS de 8 Ko. La DA est le thème, pas une surcouche. Coût : réimplémenter panier, recherche prédictive et filtres, soit 3 à 4 jours, une fois. |
| Hydrogen / headless | non pour le MVP | déporte l'hébergement, la CI, le SEO technique et le rendu côté serveur sur l'équipe. Pour un catalogue de quelques centaines de références et deux langues, la Storefront API n'apporte rien que Liquid ne fasse déjà. À reconsidérer si un jour le site doit servir autre chose que du commerce. |

Conséquence directe : **tout ce qui n'est pas dans le comp n'existe pas dans le
thème**. Pas de carrousel générique, pas de sélecteur de rayon de bordure, pas
de section « colonnes de texte » à trois variantes.

### 2.2 Plan et fonctionnalités Shopify

- **Shopify (plan standard)** suffit : Markets pour FR/EN et le multi-devises,
  Search & Discovery pour les filtres, Translate & Adapt pour les contenus.
- **Shopify Payments** activé → 3-D Secure, analyse de fraude, Shop Pay.
- **Checkout Extensibility** pour la personnalisation du tunnel
  (`checkout.liquid` est mort). Sur le plan standard on habille le checkout via
  les réglages de marque de l'admin ; la palette y est reportée à la main.
- **Apps installées : le minimum.** Chaque app est un jeton d'accès permanent
  sur le catalogue et parfois sur les clients. Voir § 6.2.

---

## 3. Arborescence

```
maison/
├── ARCHITECTURE.md            ce document
├── theme/                     le thème Shopify (poussé par la CI)
│   ├── layout/theme.liquid
│   ├── assets/
│   │   ├── base.css           tokens + composants : la DA vit ici
│   │   ├── fonts.css          polices auto-hébergées
│   │   └── theme.js           ~8 Ko, Web Components natifs
│   ├── snippets/
│   │   ├── media.liquid       LE chemin unique d'affichage d'image
│   │   ├── carte-produit.liquid
│   │   ├── prix.liquid
│   │   ├── reglages-css.liquid
│   │   └── meta-tags.liquid   Open Graph + JSON-LD
│   ├── sections/
│   │   ├── entete.liquid  hero.liquid  univers.liquid  nouveautes.liquid
│   │   ├── main-collection.liquid   (page univers)
│   │   ├── main-product.liquid      (fiche)
│   │   ├── main-cart.liquid  main-page.liquid  pied.liquid
│   │   └── entete-groupe.json  pied-groupe.json
│   ├── templates/             index / collection / product / page / cart / 404
│   ├── config/                settings_schema.json  settings_data.json
│   └── locales/               fr.default.json  en.json
├── ops/                       pipeline catalogue (Node 20, zéro dépendance)
│   ├── schema/regles-da.mjs   les règles de DA, en données
│   ├── src/
│   │   ├── valider.mjs        conformité, hors ligne
│   │   ├── images.mjs         téléversement + manifeste
│   │   ├── pousser.mjs        diff + écriture en masse (DRAFT)
│   │   ├── finaliser.mjs      univers + traductions EN
│   │   ├── publier.mjs        bascule du lot entier en ligne
│   │   ├── appliquer-metachamps.mjs
│   │   ├── shopify.mjs        client Admin GraphQL
│   │   └── dimensions-image.mjs
│   └── data/
│       ├── produits/*.json    source de vérité du catalogue
│       ├── images/            visuels sources
│       └── manifeste-images.json
├── tools/verifier-theme.mjs   cohérence du thème (parité FR/EN, snippets…)
└── .github/workflows/
    ├── theme.yml              theme check, aperçu de PR, déploiement
    ├── catalogue-verifier.yml conformité + diff sur PR
    └── catalogue-lot.yml      lancement manuel du lot, par étape
```

---

## 4. Le thème

### 4.1 Une seule source pour le langage visuel

`assets/base.css` déclare la totalité des tokens (couleurs, échelle
typographique fluide, rythme spatial, courbes). Les sections **ne déclarent
jamais** une couleur ou une taille en dur : elles consomment `var(--…)`.

Trois verrous rendent cette règle exécutoire, et pas seulement souhaitable :

1. **`snippets/reglages-css.liquid`** est le seul endroit où un réglage
   marchand devient une couleur. Le schéma de réglages n'expose que des
   *rôles* (fond, encre, laiton…) : pas de `color_picker` libre par section.
2. **La typographie est figée dans le code.** Pas de `font_picker`. Ce n'est
   pas un oubli, c'est le point où la plupart des DA meurent.
3. **La CI refuse toute couleur littérale** dans `sections/` et `snippets/`
   (job *Refuser les couleurs en dur*, `theme.yml`). Un `#ff0000` collé dans
   une section fait échouer la PR.

### 4.2 Garde-fous de composition

- `sections/univers.liquid` : `max_blocks: 3`. La grille du comp est en trois
  colonnes ; un quatrième univers casserait le rythme, et l'éditeur ne peut
  pas l'ajouter.
- `main-product.liquid` : la réassurance est limitée à 3 blocs.
- Les accordéons produit sont alimentés par **métachamps**, jamais par la
  description libre : la fiche reste homogène quel que soit le rédacteur.
- Les longueurs de texte que la maquette encaisse sont écrites dans
  `ops/schema/regles-da.mjs` et vérifiées avant import (§ 7.3).

### 4.3 Le placeholder est un composant

`snippets/media.liquid` est le **chemin unique** d'affichage d'image : ratio,
`srcset`, `sizes`, lazy-loading et placeholder y sont décidés une fois. Quand
l'image manque, il rend la hachure crème 135° du comp et le brief de prise de
vue lu depuis `custom.brief_photo`.

Effet pratique : **le site est présentable avant la production photo.** La
composition ne dépend pas des données. La section « Nouveautés » va jusqu'à
rendre des cartes fantômes quand le catalogue est vide.

### 4.4 JavaScript

`assets/theme.js`, ~8 Ko non compressé, aucune dépendance. Quatre Web
Components (`formulaire-panier`, `selecteur-quantite`, `selecteur-variante`,
`nav-mobile`) plus un écouteur délégué pour la galerie produit.

Le principe : **le serveur reste la source de vérité**. L'ajout au panier
poste vers `/cart/add.js` avec `sections`, et remplace le HTML re-rendu par
Shopify. Aucun total, aucun prix, aucune disponibilité n'est recalculé côté
client : donc aucun écart possible entre ce qui est affiché et ce qui sera
facturé.

### 4.5 Polices

Instrument Serif et Jost sont **auto-hébergées** (`theme/assets/*.woff2`,
licence SIL OFL). Deux raisons :

- ni l'une ni l'autre n'est dans la bibliothèque Shopify Fonts ;
- pointer `fonts.googleapis.com` ajoute un domaine sur le chemin critique
  **et** transfère l'IP du visiteur à Google : sujet RGPD documenté en UE.

`fonts.css` déclare aussi deux familles de repli avec `size-adjust` et
métriques surchargées, pour que le *swap* ne décale pas la mise en page (CLS).

### 4.6 FR / EN

- **Markets** : FR marché principal, EN secondaire. Shopify émet les
  `hreflang` via `content_for_header` dès que les marchés sont configurés.
- **Chaînes du thème** : `locales/fr.default.json` et `locales/en.json`,
  versionnées dans le dépôt. Elles sont du code.
- **Contenus** (produits, collections, pages) : traduits via
  `translationsRegister` par le pipeline (§ 7.5), ou dans Translate & Adapt
  pour les pages éditoriales.
- Le sélecteur FR/EN de l'en-tête poste sur `/localization` : formulaire
  natif, fonctionne sans JS.

---

## 5. Modèle de données

### 5.1 Un « univers » est une collection enrichie

Plutôt qu'un métaobjet, l'univers est une **collection** portant des
métachamps. La collection est déjà l'objet que Shopify sait paginer, filtrer,
trier et référencer ; en faire un métaobjet obligerait à recoder tout cela.

| Métachamp collection | Type | Rôle |
|---|---|---|
| `custom.numero` | `number_integer` | le `01` / `02` / `03` du comp |
| `custom.chapo` | `multi_line_text_field` | sous le titre de la page univers |
| `custom.stylisme` | `single_line_text_field` | crédit « Stylisme maison » |
| `custom.image_editoriale` | `file_reference` | plan large 4:3 |
| `custom.brief_photo` | `single_line_text_field` | légende du placeholder |

### 5.2 Produit

| Métachamp produit | Type | Rôle |
|---|---|---|
| `custom.matiere` | `multi_line_text_field` | accordéon « Détails & dimensions » |
| `custom.dimensions` | `multi_line_text_field` | idem |
| `custom.entretien` | `multi_line_text_field` | accordéon « Entretien » |
| `custom.brief_photo` | `single_line_text_field` | placeholder |
| `custom.reference_interne` | `single_line_text_field` | `Réf.` sous le prix, format `AB-1234` |

Les **définitions** de métachamps sont déclarées en code
(`ops/src/appliquer-metachamps.mjs`) et appliquées de façon idempotente. Avec
définition, Shopify valide le type et les bornes côté serveur : c'est un
second filet, celui-là **impossible à contourner même en éditant un produit à
la main dans l'admin**.

### 5.3 Source de vérité du catalogue

Un fichier JSON par produit dans `ops/data/produits/`. Pas de CSV (les textes
éditoriaux multi-lignes y sont illisibles), pas de YAML (une dépendance de
parsing dans un job qui a le droit d'écrire dans le catalogue). Le JSON est
diffable en PR, ce qui rend la relecture éditoriale possible avant toute
écriture.

L'admin Shopify reste la source de vérité pour ce qui est **opérationnel** -
stock, commandes, prix promotionnels ponctuels. Le dépôt est la source de
vérité pour ce qui est **éditorial** : titres, textes, métachamps, visuels,
rattachement aux univers. Cette frontière est explicite parce que la confondre
est la première cause de pipeline qui écrase le travail d'un humain.

---

## 6. Sécurité

Le raisonnement utile est : *qu'est-ce que Shopify couvre, et qu'est-ce qui
reste réellement de notre côté ?*

### 6.1 Ce que Shopify couvre : et qu'il ne faut donc pas réimplémenter

Le tunnel de commande, le stockage des moyens de paiement, la conformité
PCI-DSS niveau 1, l'analyse de fraude, le TLS, le WAF et l'anti-DDoS en front
de CDN. **Le thème ne touche jamais une donnée de paiement** : le panier poste
vers le checkout Shopify et s'arrête là. C'est ce qui garde la surface de
conformité à zéro de notre côté, et c'est une raison de plus de ne pas partir
en headless pour ce projet.

### 6.2 Ce qui reste de notre côté

**Comptes et accès**
- 2FA obligatoire pour tout le personnel, sans exception ; aucun compte
  partagé. Un départ = une révocation le jour même.
- Permissions au strict nécessaire. Un rédacteur n'a pas besoin de
  « Gérer les paramètres » ni de voir les commandes.
- Le compte propriétaire n'est pas un compte de travail quotidien.

**Apps** : c'est le vrai vecteur de risque d'une boutique Shopify.
- Chaque app installée détient un jeton permanent et des scopes. Lire les
  scopes **avant** d'installer, pas après.
- Aucune app qui demande `read_customers` ou `read_all_orders` sans que ce
  soit son métier.
- Revue trimestrielle : désinstaller ce qui ne sert plus. Une app oubliée
  garde son accès.
- Éviter les apps qui injectent des `script_tags` dans la vitrine : c'est du
  JS tiers arbitraire dans la page, non versionné, non relu.

**Jetons du pipeline**
- Une **app personnalisée** dédiée, scopes stricts :
  `read/write_products`, `read/write_files`, `read/write_translations`,
  `read/write_publications`. Rien sur les clients, rien sur les commandes.
  Un jeton qui ne peut pas lire un client ne peut pas le fuiter.
- Deux jetons distincts : un **lecture seule** pour les jobs de diff sur PR,
  un **écriture** réservé à l'environnement protégé (§ 8).
- `ops/src/shopify.mjs` masque le jeton dans tout texte destiné aux logs
  (`assainir()`), y compris les messages d'erreur HTTP.
- Version d'API épinglée (`SHOPIFY_API_VERSION`), relevée sciemment une fois
  par trimestre.

**Thème**
- Toute donnée éditable passe par `escape` ou `json`. Aucune sortie brute
  dans un attribut HTML ni dans un bloc `<script>`.
- Aucun script tiers dans `theme.liquid`. La mesure passe par les
  **Pixels personnalisés** de Shopify, qui tournent dans une sandbox et
  respectent nativement le consentement visiteur.
- Formulaires natifs (`form 'customer'`, `form 'product'`, `form 'cart'`) :
  Shopify fournit le jeton anti-CSRF et le captcha. Ne jamais poster un
  formulaire de compte ou de contact vers un endpoint maison.
- `theme check --fail-level error` bloquant en CI.

**RGPD / droit français**
- Bandeau de consentement branché sur la **Customer Privacy API**
  (`setTrackingConsent`), pas sur une app qui pose ses propres cookies.
- Pages obligatoires liées dans le menu légal du pied : mentions légales,
  CGV, politique de confidentialité, droit de rétractation 14 jours,
  coordonnées du médiateur de la consommation.
- Demandes d'accès et d'effacement : traitées via les webhooks RGPD de
  Shopify, pas à la main.

**Sauvegardes et reprise**
- Le dépôt Git est la sauvegarde du thème *et* du catalogue éditorial.
- Les JSON édités par le marchand (`settings_data.json`, gabarits, groupes de
  sections) sont **récupérés** vers le dépôt après chaque déploiement
  (job `sauvegarder`) et archivés 180 jours. La CI ne les écrase jamais.
- Chaque lot catalogue produit un rapport horodaté, conservé 90 jours.

### 6.3 Ce que la CI ne fait délibérément pas

- Pas de `pull_request_target` : une PR venant d'un fork ne s'exécute jamais
  avec les secrets de la boutique.
- `permissions: contents: read` par défaut sur tous les workflows.
- Actions **épinglées par SHA**, pas par tag : un tag est mutable.
- Pipeline sans dépendance npm : rien à auditer dans un arbre transitif pour
  un job qui a le droit d'écrire dans le catalogue.
- Aucune suppression automatique de produit. Un produit en boutique absent du
  dépôt est **signalé**, jamais supprimé. La décision reste humaine.

---

## 7. Le pipeline catalogue

C'est la partie qui répond à : *pousser des produits depuis un workflow, en un
grand lot, sans perdre la DA.*

### 7.1 Vue d'ensemble

```
ops/data/produits/*.json                     (source de vérité, en PR)
        │
        ├─ 1. valider.mjs        conformité DA : hors ligne, zéro appel
        │
        ├─ 2. images.mjs         stagedUploadsCreate → fileCreate → manifeste
        │
        ├─ 3. pousser.mjs        diff, puis JSONL → bulkOperationRunMutation
        │                        (productSet) → tout en DRAFT
        │
        ├─ 4. finaliser.mjs      collectionAddProducts + translationsRegister
        │
        └─ 5. publier.mjs        contrôle final, puis ACTIVE + canal
                                 → tout le lot, ou rien
```

Chaque étape est indépendante et rejouable. Chacune accepte une **simulation**
par défaut et n'écrit qu'avec `--appliquer`.

### 7.2 Pourquoi une opération en masse

- Le coût GraphQL d'un `productSet` complet est élevé. 400 mutations
  successives passent la moitié du temps à attendre le seau à jetons.
- `bulkOperationRunMutation` prend un JSONL, s'exécute côté Shopify et rend un
  fichier de résultats **ligne à ligne** : un rapport exploitable et un seul
  point de reprise.
- `productSet` adressé par `handle` est **idempotent** : rejouer le même lot
  ne crée pas de doublon, il converge. C'est ce qui rend l'opération
  réellement automatisable : on peut relancer sans réfléchir.

Shopify n'autorise qu'une opération d'écriture en masse à la fois par
boutique : le `concurrency` du workflow sert de file d'attente.

### 7.3 Comment la DA survit à un lot de 400 références

`ops/schema/regles-da.mjs` est le contrat entre le catalogue et le design,
écrit en données. Un produit non conforme **n'entre pas** : pas « entre en
étant un peu moche », n'entre pas. C'est ce qui permet de pousser 400 fiches
sans en relire 400.

| Contrôle | Règle | Pourquoi cette valeur |
|---|---|---|
| Titre | 3–48 caractères | au-delà, Instrument Serif 46 px passe sur trois lignes dans la colonne de 470 px et écrase le prix |
| Titre | pas de mot en capitales | la DA met les capitales aux libellés, pas aux titres |
| Titre | pas de ponctuation finale, pas de guillemets droits | cohérence typographique |
| Description | 120–420 caractères, 2 à 4 phrases | le gabarit réserve 46 caractères × 4 lignes |
| Images | ratio **4:5 strict** (± 2 %) | la fiche produit et les cartes sont en 4:5 ; une image 1:1 casse la colonne |
| Images | largeur ≥ 1400 px | nécessaire au `srcset` 2× |
| Images | 1 à 6 | la colonne de vignettes en affiche 6 |
| `alt` | 12–125 caractères, **en FR et EN** | c'est du contenu, pas du décor |
| Métachamps | matière, dimensions, entretien, brief photo obligatoires | un accordéon vide est une fiche cassée |
| Univers | dans la liste fermée des trois univers | un produit hors univers n'a aucune page où apparaître |
| Prix | entier en centimes, multiple de 50 | la DA affiche `00,00 €` ; pas de 12,37 € dans une maison de décoration |
| Référence | `^[A-Z]{2,4}-\d{3,5}$` | affichée sous le prix |
| Unicité | handle, référence, SKU | un doublon de handle écraserait un produit existant |
| Traductions | titre + description EN obligatoires | sinon la page anglaise retombe en français en plein milieu |

Le validateur ne parle jamais à Shopify. N'importe qui peut le lancer sans
jeton, y compris un rédacteur sur sa machine.

### 7.4 Tout le lot, ou rien

Le point central du besoin. Deux mécanismes :

1. **Tout arrive en `DRAFT`.** `productSet` écrit les 400 produits, mais
   aucun visiteur n'en voit un seul. Le lot existe, complet, invisible.
2. **`publier.mjs` bascule l'ensemble** : et refuse de commencer si un seul
   produit du lot est non publiable : visuel non attaché côté Shopify,
   rattachement à un univers manquant, métachamp perdu en route, prix absent.
   Dans ce cas : zéro publication, message explicite, exit 1.

Ce contrôle final interroge **la boutique**, pas le dépôt. Le validateur
vérifie la source ; `publier.mjs` vérifie ce qui est réellement arrivé. Un
média rejeté par Shopify après téléversement ne passe pas ce filet.

Une collection à moitié remplie est une collection cassée. On préfère un site
inchangé à un univers incomplet.

### 7.5 Ce que `productSet` ne fait pas

Deux choses, traitées par `finaliser.mjs` :

- **Rattachement aux univers** (`collectionAddProducts`) : sans lui, le
  produit n'a pas de page.
- **Traductions EN** (`translationsRegister`) : avec le `digest` du contenu
  source, récupéré via `translatableResource`. Ce digest est un garde-fou :
  une traduction ne peut pas s'attacher silencieusement à un texte français
  qui a changé depuis.

### 7.6 Robustesse

- Back-off exponentiel sur 429 / 5xx ; pause calculée sur `throttleStatus`
  pour le throttling applicatif (Shopify répond **200** avec un code
  `THROTTLED` : le confondre avec un succès est l'erreur classique).
- Les `userErrors` sont collectées récursivement et lèvent une exception. Une
  mutation qui renvoie 200 avec des `userErrors` est un échec, pas un succès.
- `images.mjs` tient un manifeste `fichier → URL Shopify` avec empreinte
  SHA-256 : un second passage ne re-téléverse que ce qui a changé. Le
  téléversement est séparé de l'écriture des produits parce qu'une image qui
  échoue ne doit pas obliger à rejouer 400 fiches.
- Attente explicite du statut `READY` des médias : `productSet` ne référence
  jamais un fichier encore en traitement.

---

## 8. Environnements et déploiement

| | Boutique | Thème | Qui déploie |
|---|---|---|---|
| **Dev** | boutique de développement | `shopify theme dev` | chaque développeur |
| **Aperçu** | production | thème non publié `PR-<n>` | CI, sur chaque PR |
| **Production** | production | thème publié | CI, sur `main`, après relecture |

**Environnements GitHub** : c'est là que vit le contrôle humain :

| Environnement | Secret | Usage |
|---|---|---|
| `boutique-lecture` | jeton lecture seule | diff sur PR, simulations |
| `boutique-ecriture` | jeton écriture, **relecture obligatoire** | étapes `ecrire`, `finaliser`, `publier` |
| `boutique-theme` | jeton CLI thème | aperçus de PR, sauvegarde des réglages |
| `boutique-production` | jeton CLI thème, **relecture obligatoire** | publication du thème |

`catalogue-lot.yml` est en `workflow_dispatch` **seul** : écrire dans un
catalogue de production n'est pas un effet de bord d'un `git push`. Il exige
en plus de retaper le domaine de la boutique en confirmation.

---

## 9. Performance et SEO

Budgets, à vérifier en CI sur les trois gabarits :

| | Cible |
|---|---|
| JS transféré | < 15 Ko compressé |
| CSS | < 20 Ko compressé |
| LCP (mobile, 4G) | < 2,0 s |
| CLS | < 0,05 |
| Requêtes tierces | 0 hors CDN Shopify |
| Familles de polices | 2, trois graisses au total |

Moyens : `image_url` avec largeurs alignées sur les colonnes réelles du design
(AVIF/WebP servis automatiquement par Shopify), `width`/`height` explicites,
`fetchpriority=high` sur le seul visuel du hero, préchargement des deux fontes,
JSON-LD `Product` et `Organization`, `canonical` sur toutes les pages.

---

## 10. Ce qui est livré, et ce qui reste

**Livré et exécutable**
- Thème complet pour les trois gabarits maquettés + panier, page de contenu,
  404, en-tête, pied de page. Tokens, placeholders DA, i18n FR/EN.
- Pipeline catalogue en cinq étapes, validateur testé (les garde-fous ont été
  vérifiés en positif *et* en négatif : ratio 1:1 refusé, capitales refusées,
  doublons de handle/SKU détectés).
- Trois workflows CI avec séparation lecture / écriture et points de contrôle
  humains.

**Reste à faire : dans l'ordre**
1. **Déposer les deux `.woff2`** dans `theme/assets/` (Instrument Serif,
   Jost variable). Sans eux, le thème tombe sur les repli métriques.
2. **Créer les trois collections univers** (`table-et-lumiere`,
   `terre-et-gres`, `nuit-et-laiton`) et lancer
   `npm run metachamps -- --appliquer`.
3. **Le journal** (blog) : présent dans la navigation du comp, pas encore
   maquetté. Gabarits `blog.json` / `article.json` à écrire.
4. **Recherche prédictive** et **tiroir de panier** : le comp montre un lien
   « Recherche » et « Panier (0) », sans écran dédié. Actuellement des pages
   pleines, ce qui fonctionne mais n'est pas ce que la version finale voudra.
5. **Ordre des sections de l'accueil** : le comp fait suivre le hero de
   « Nouveautés » puis des univers, mais la maquette ne tranche pas nettement
   entre les deux. `index.json` place les univers avant les nouveautés ; c'est
   réordonnable en deux clics dans l'éditeur, à valider au design.
6. **Habillage du checkout** dans les réglages de marque de l'admin.
7. **Pages légales** à rédiger (mentions, CGV, rétractation, médiateur).
8. **Lighthouse CI** à brancher sur le thème d'aperçu.

---

## 11. Runbook

```bash
# : Thème -
shopify theme dev --path theme --store maison-dev.myshopify.com
shopify theme check --path theme
node tools/verifier-theme.mjs        # parité FR/EN, snippets, sections

# : Catalogue, en local (jeton dans ops/.env) -
cd ops
npm run valider                      # conformité DA, hors ligne
npm run metachamps                   # simulation des définitions
npm run metachamps -- --appliquer
npm run images                       # simulation
npm run images -- --appliquer        # téléverse + manifeste
npm run pousser                      # diff, aucune écriture
npm run pousser:reel                 # écrit tout le lot en DRAFT
npm run finaliser:reel               # univers + traductions EN
npm run publier                      # contrôle final, simulation
npm run publier:reel                 # bascule le lot en ligne

# : Un lot complet jusqu'au DRAFT, en une commande -
npm run lot
```

En CI : `Actions → Catalogue : pousser le lot → Run workflow`, choisir
l'étape, retaper le domaine de la boutique en confirmation, puis approuver
l'environnement `boutique-ecriture`.
