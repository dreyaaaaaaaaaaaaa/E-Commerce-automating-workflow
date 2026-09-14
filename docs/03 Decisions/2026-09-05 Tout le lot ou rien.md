---
tags: [decision, catalogue, pipeline]
date: 2026-09-05
domaine: catalogue
statut: decide
---

# Tout le lot, ou rien

## Contexte

Le besoin central : pousser des centaines de produits depuis un workflow, en un
grand lot, sans jamais montrer un univers à moitié rempli.

## Décision

1. **Tout arrive en `DRAFT`** via `productSet` en opération de masse (`bulkOperationRunMutation`, idempotent par `handle`).
2. **`publier.mjs` bascule l'ensemble**, et refuse de commencer si un seul produit du lot n'est pas publiable. Ce contrôle final interroge la boutique, pas le dépôt.
3. Chaque script simule par défaut et n'écrit qu'avec `--appliquer`.
4. Aucune suppression automatique : un produit en boutique absent du dépôt est signalé, jamais supprimé.

## Pourquoi

Une collection à moitié remplie est une collection cassée. On préfère un site
inchangé à un univers incomplet.

Référence : [[ARCHITECTURE#7.4 Tout le lot, ou rien]].
