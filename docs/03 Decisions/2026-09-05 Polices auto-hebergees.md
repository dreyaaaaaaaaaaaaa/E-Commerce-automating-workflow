---
tags: [decision, theme, rgpd, performance]
date: 2026-09-05
domaine: theme
statut: decide
---

# Polices auto-hébergées

## Décision

Instrument Serif et Jost sont déposées dans `theme/assets/*.woff2` (licence
SIL OFL), avec deux familles de repli à métriques ajustées (`size-adjust`)
pour éviter le décalage de mise en page au *swap*.

## Pourquoi

- ni l'une ni l'autre n'est dans la bibliothèque Shopify Fonts ;
- pointer `fonts.googleapis.com` ajoute un domaine sur le chemin critique **et** transfère l'IP du visiteur à Google : sujet RGPD documenté en UE.

## Conséquence

Zéro requête tierce hors CDN Shopify, budget tenu (voir
[[ARCHITECTURE#9. Performance et SEO]]).
