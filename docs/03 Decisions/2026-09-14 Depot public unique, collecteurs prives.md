---
tags: [decision, perimetre, securite]
date: 2026-09-14
domaine: perimetre
statut: decide
---

# Un dépôt public unique, les collecteurs en privé

## Contexte

Le projet vivait dans deux dossiers : la boutique (ce dépôt, public sur
GitHub) et la partie recherche / sourcing (`ChatGPT/Site dropship`, jamais
commitée). Le client veut tout sur GitHub, présentable pour un portfolio,
mais ne veut pas publier le code de scraping.

## Options

- **Deux dépôts publics** : simple, mais expose les collecteurs.
- **Un dépôt public avec tout** : idem.
- **Un dépôt public (boutique + orchestration + docs) et un dépôt privé (collecteurs)** : ce qui se montre est l'architecture et le raisonnement ; ce qui pose question (Playwright sur des sites tiers) reste privé mais sauvegardé.

## Décision

Troisième option. Le dépôt public est renommé
`E-Commerce-automating-workflow`. Le dossier `sourcing/` y reçoit les
workflows n8n (ID Google Sheet remplacé par un placeholder), les prompts,
les audits et guides, la config. Le dépôt privé `sourcing-collectors` reçoit
l'intégralité de `Site dropship` (données exclues), premier commit `1ad5c56`.

## Conséquences

- Les workflows publiés se lisent mais ne tournent pas sans les APIs locales des collecteurs ; `sourcing/README.md` le dit explicitement.
- Toute mise à jour d'un workflow se fait dans n8n, se re-exporte dans les deux dépôts, avec le placeholder dans le public.
- Le README racine devient la page portfolio (anglais, résumé français), avec les rendus des six maquettes dans `docs/_pieces-jointes/captures/`.
