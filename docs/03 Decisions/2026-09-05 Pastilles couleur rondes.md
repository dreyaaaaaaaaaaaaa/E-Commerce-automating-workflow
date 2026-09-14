---
tags: [decision, theme, design]
date: 2026-09-05
domaine: design
statut: decide
---

# Pastilles couleur rondes plutôt qu'étiquettes texte

## Contexte

Sur la fiche produit et les cartes de grille, les variantes de couleur étaient
rendues comme des étiquettes texte. Comparaison avec des captures du comp
original : c'était hors DA.

## Décision

Pastilles rondes via `snippets/couleur-swatch.liquid`, sur la fiche et sur
les cartes. Commit `0dbcd79`.

## Leçon

Comparer avec les captures du comp avant de considérer un composant terminé ;
theme check ne voit pas ce genre d'écart.
