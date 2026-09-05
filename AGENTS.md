# Guide pour agents (humains ou LLM)

Ce fichier est le point d'entree rapide. Lire dans cet ordre :

1. [README.md](README.md) : demarrage en 2 minutes.
2. [ARCHITECTURE.md](ARCHITECTURE.md) : la reference complete (decisions,
   modele de donnees, securite, pipeline). Tout ce qui n'est pas evident dans
   le code y est explique, avec le pourquoi.
3. Le code lui-meme : chaque fichier non trivial commence par un commentaire
   qui dit son role et, quand ce n'est pas evident, pourquoi il est ecrit
   ainsi plutot qu'autrement.

## Regles de ce depot, a respecter dans toute contribution

- **Francais dans le code et les commentaires**, anglais uniquement dans les
  identifiants techniques imposes par Shopify (`productSet`, `handle`,
  `SKU`...). Les noms de variables, fonctions, fichiers Liquid et CSS sont en
  francais (`entete.liquid`, `carte-produit.liquid`, `couleur_accent`).
- **Pas de tiret cadratin** (le caractere U+2014, souvent appele "em dash")
  dans le code, les commentaires ou la documentation. Utiliser la virgule,
  le deux-points ou reformuler.
- **Aucune couleur, taille ou police en dur** dans `theme/sections/` et
  `theme/snippets/`. Tout passe par les variables CSS de
  `theme/assets/base.css`. Un job CI (`theme.yml`) refuse toute couleur
  litterale hors de `reglages-css.liquid`.
- **La DA est un contrat verifie, pas une convention.** Toute regle de mise
  en forme du catalogue (longueur de titre, ratio d'image, prix rond) vit
  dans `ops/schema/regles-da.mjs`, en donnees, pas eparpillee dans le code.
- **Le pipeline catalogue ne fait jamais d'ecriture par defaut.** Chaque
  script accepte `--appliquer` ; sans ce flag, il ne fait que lire et
  afficher une simulation.
- **Un produit arrive toujours en DRAFT.** La bascule en ligne est une etape
  separee (`publier.mjs`) qui publie le lot entier ou rien.
- **Pas de dependance npm dans `ops/`.** Le pipeline tourne avec `fetch`,
  `fs` et le parseur JSON natif de Node uniquement. Une dependance
  supplementaire est une surface d'attaque de plus dans un job qui a le
  droit d'ecrire dans le catalogue de production.

## Verifications avant toute proposition de changement

```bash
# Thème
shopify theme check --path theme
node tools/verifier-theme.mjs

# Catalogue
cd ops && node src/valider.mjs
```

Les deux doivent sortir en code 0. `tools/verifier-theme.mjs` verifie entre
autres que chaque cle de traduction utilisee existe en francais et en
anglais : c'est le controle le plus utile a lancer apres avoir touche une
section ou une locale.

## Etat du projet

Ce depot contient un theme fonctionnel pour les trois gabarits maquettes
(accueil, page univers, fiche produit), plus panier, journal (liste et
article), recherche predictive, tiroir de panier, compte client complet
(connexion, inscription, mot de passe, commandes, adresses), page de
contenu, 404, en-tete et pied. Les polices sont deposees. Le pipeline
catalogue est complet et teste (validation positive et negative).
Lighthouse CI tourne sur le theme d'apercu de chaque PR. La section 10 de
`ARCHITECTURE.md` liste precisement ce qui reste a faire, dans l'ordre de
priorite. Commencer par la, plutot que de re-decouvrir l'etat d'avancement
en lisant tout le code.

Aucun de ces elements n'a ete verifie dans un navigateur reel ou contre une
boutique Shopify live (pas d'acces a une boutique de developpement depuis
cette session). Avant de considerer une fonctionnalite terminee, la tester
avec `shopify theme dev` : theme check et le verificateur de coherence
attrapent les erreurs structurelles, pas les erreurs de rendu ou de
comportement au clic.

## Se reperer sans lire tout le depot

| Question | Reponse dans |
|---|---|
| Quelles sont les couleurs, tailles, espacements de la marque ? | `theme/assets/base.css` |
| Comment une image s'affiche-t-elle (ratio, placeholder) ? | `theme/snippets/media.liquid` |
| Quels champs un produit doit-il avoir pour etre accepte ? | `ops/schema/regles-da.mjs` |
| Comment un lot de produits passe du fichier JSON a la boutique ? | `ARCHITECTURE.md` section 7, puis `ops/src/*.mjs` dans l'ordre |
| Qui a le droit d'ecrire dans la boutique en production ? | `ARCHITECTURE.md` section 8, `.github/workflows/*.yml` |
| Quelles regles RGPD et de droit francais sont deja couvertes ? | `ARCHITECTURE.md` section 6 |
