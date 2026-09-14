---
tags: [decision, catalogue, donnees]
date: 2026-09-05
domaine: catalogue
statut: decide
---

# Un univers est une collection enrichie, pas un métaobjet

## Contexte

Les trois univers (`01 Table & Lumière`, `02 Terre & Grès`, `03 Nuit & Laiton`)
ont besoin d'un numéro, d'un chapô, d'un crédit stylisme, d'une image
éditoriale et d'un brief photo.

## Décision

Une **collection** Shopify portant cinq métachamps (`custom.numero`, `chapo`,
`stylisme`, `image_editoriale`, `brief_photo`). La collection est déjà l'objet
que Shopify sait paginer, filtrer, trier et référencer ; un métaobjet
obligerait à recoder tout cela.

## Conséquences

- La page univers est `templates/collection.json` + `main-collection.liquid`.
- Le rattachement produit / univers passe par `collectionAddProducts` dans `finaliser.mjs`.
- Les définitions de métachamps sont en code (`appliquer-metachamps.mjs`), idempotentes, validées côté serveur même en édition manuelle dans l'admin.

Référence : [[ARCHITECTURE#5.1 Un « univers » est une collection enrichie]].
