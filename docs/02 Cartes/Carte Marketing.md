---
tags: [carte, marketing]
---

# Carte : Marketing

> Ce que le site sait déjà faire, et ce qui reste à décider côté acquisition.

## Déjà en place dans le thème

- Infolettre avec consentement marketing réel (`contact[accepts_marketing]`) : double opt-in là où le marché l'exige.
- Le journal (liste + article) pour le contenu éditorial.
- Open Graph et JSON-LD `Product` / `Organization` (`snippets/meta-tags.liquid`), `canonical` partout.
- Mesure via Pixels personnalisés Shopify, sandboxés, respectent le consentement.
- FR / EN via Markets, `hreflang` émis par Shopify.

## Ton de la marque

Vendre des objets, pas une ambiance : [[2026-09-07 Vendre des objets, pas une ambiance]].
Le texte hero et les univers nomment ce qu'on achète.

## À décider

- [ ] Canaux d'acquisition (Instagram / Pinterest sont naturels pour la décoration)
- [ ] Calendrier éditorial du journal
- [ ] Outil d'emailing (vérifier les scopes avant d'installer, voir [[Carte Securite et CI#Apps installées]])
- [ ] Pixels à déclarer (Meta, Google) et texte du bandeau de consentement

## Notes

Les notes de campagne, idées de contenu et références concurrentes vont dans
`docs/07 Marketing/`.
