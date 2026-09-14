---
tags: [decision, catalogue, donnees]
date: 2026-09-05
domaine: catalogue
statut: decide
---

# Un fichier JSON par produit comme source de vérité éditoriale

## Options

- **CSV** : les textes éditoriaux multi-lignes y sont illisibles.
- **YAML** : une dépendance de parsing dans un job qui a le droit d'écrire dans le catalogue.
- **JSON, un fichier par produit** : diffable en PR, parseur natif de Node, relecture éditoriale possible avant toute écriture.

## Décision

JSON, un fichier par produit dans `ops/data/produits/`.

## Frontière explicite

Le dépôt est la source de vérité pour l'**éditorial** (titres, textes,
métachamps, visuels, univers). L'admin Shopify reste la source de vérité pour
l'**opérationnel** (stock, commandes, prix promotionnels ponctuels). Le
pipeline ne touche jamais à la seconde catégorie.

Référence : [[ARCHITECTURE#5.3 Source de vérité du catalogue]].
