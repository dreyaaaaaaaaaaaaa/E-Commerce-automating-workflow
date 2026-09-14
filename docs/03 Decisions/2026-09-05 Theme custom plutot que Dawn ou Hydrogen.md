---
tags: [decision, theme]
date: 2026-09-05
domaine: theme
statut: decide
---

# Thème custom plutôt que Dawn ou Hydrogen

## Contexte

Il fallait choisir la base technique du thème pour porter la DA « Lumière
rasante » sans qu'elle dérive au fil des réglages marchands.

## Options

- **Fork de Dawn** : ~300 fichiers, un système de design complet à désapprendre, chaque section porte des réglages de couleur / bordure / rayon que la DA n'utilise pas.
- **Thème custom Online Store 2.0** : ~30 fichiers, un seul langage visuel, budget JS 8 Ko. Coût : réimplémenter panier, recherche prédictive et filtres, 3 à 4 jours, une fois.
- **Hydrogen / headless** : déporte hébergement, CI, SEO technique et rendu serveur sur l'équipe. Pour quelques centaines de références et deux langues, la Storefront API n'apporte rien que Liquid ne fasse déjà.

## Décision

Thème custom. Conséquence : tout ce qui n'est pas dans le comp n'existe pas
dans le thème. Pas de carrousel générique, pas de sélecteur de rayon.

## À reconsidérer si

Le site doit un jour servir autre chose que du commerce (headless).

Référence : [[ARCHITECTURE#2.1 Thème custom, pas un fork de Dawn : et pas Hydrogen]].
