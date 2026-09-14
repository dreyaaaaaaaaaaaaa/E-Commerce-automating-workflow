---
tags: [carte, theme]
---

# Carte : Thème Shopify

> Thème custom Online Store 2.0, ~30 fichiers, budget JS 8 Ko, aucune
> dépendance. Tout ce qui n'est pas dans le comp n'existe pas dans le thème.

## Où est quoi

| Question | Fichier |
|---|---|
| Couleurs, tailles, espacements | `theme/assets/base.css` |
| Le seul endroit où un réglage devient une couleur | `theme/snippets/reglages-css.liquid` |
| Affichage d'image, ratio, placeholder | `theme/snippets/media.liquid` |
| Nav, recherche prédictive, tiroir panier | `theme/sections/entete.liquid` |
| Fiche produit | `theme/sections/main-product.liquid` |
| Page univers | `theme/sections/main-collection.liquid` |
| Pastilles couleur | `theme/snippets/couleur-swatch.liquid` |
| Web Components (panier, quantité, variante, nav mobile) | `theme/assets/theme.js` |
| Chaînes FR / EN | `theme/locales/fr.default.json`, `en.json` |

Arborescence complète : [[ARCHITECTURE#3. Arborescence]].

## Garde-fous (ce que la CI et le code refusent)

- aucune couleur, taille ou police en dur dans `sections/` et `snippets/` : job CI *Refuser les couleurs en dur*
- typographie figée dans le code, pas de `font_picker`
- `univers.liquid` : `max_blocks: 3` ; réassurance produit : 3 blocs max
- accordéons produit alimentés par métachamps, jamais par la description libre
- toute sortie éditable passe par `escape` ou `json`
- aucun script tiers dans `theme.liquid` : mesure via Pixels personnalisés Shopify
- formulaires natifs uniquement (`form 'customer'`, `'product'`, `'cart'`)

## Vérifications avant tout changement

```bash
shopify theme check --path theme
node tools/verifier-theme.mjs
```

`verifier-theme.mjs` vérifie la parité des clés de traduction FR/EN, les
snippets et les sections référencés. C'est le contrôle le plus utile après
avoir touché une section ou une locale.

## Ce qui n'a pas encore été fait

Aucun gabarit n'a été vérifié dans un navigateur réel ni contre une boutique
Shopify live. Avant de considérer une fonctionnalité terminée : `shopify theme
dev`. Theme check attrape les erreurs structurelles, pas les erreurs de rendu.

- [ ] Première passe `shopify theme dev` sur les trois gabarits maquettés
- [ ] Valider l'ordre hero / nouveautés / univers dans `index.json`

## Décisions liées

- [[2026-09-05 Theme custom plutot que Dawn ou Hydrogen]]
- [[2026-09-05 Polices auto-hebergees]]
- [[2026-09-05 Pastilles couleur rondes]]
