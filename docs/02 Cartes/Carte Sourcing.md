---
tags: [carte, sourcing, n8n]
---

# Carte : Sourcing et recherche produit

> Comment un produit est choisi avant d'entrer dans le catalogue. Cinq
> workflows n8n autour de deux collecteurs Python locaux. Référence :
> `sourcing/README.md`, puis `sourcing/docs/project-state-and-implementation-plan.md`.

## Public / privé

| | Où | Pourquoi |
|---|---|---|
| Workflows n8n, prompts, audits, runbooks, config | `sourcing/` (public) | montrent l'orchestration et le raisonnement, pas la collecte |
| Collecteurs Reddit et AliExpress (Playwright), tests, `pyproject` | dépôt privé `sourcing-collectors` | décision du client : ne pas lâcher ce code, voir [[2026-09-14 Depot public unique, collecteurs prives]] |
| Données (SQLite, HTML bruts, profils navigateur) | nulle part en ligne | gitignorées dans le dépôt privé aussi |

## Les cinq phases

1. **Extraction des problèmes** (Reddit, subreddits maison / rangement / nettoyage) : prompts `01`, `02`
2. **Recherche de marché** (AliExpress) : candidats classés en code, sans IA
3. **Évaluation IA** par lots bornés : prompt `03`
4. **Analyse de la concurrence** : classification direct / adjacent / bruit, médianes par devise : prompt `04`
5. **Validation** : SKU exact, coût livré en France, prise, fret ; décision humaine

Un produit validé devient un JSON dans `ops/data/produits/` et doit passer
`npm run valider` ([[Carte Catalogue]]).

## Principes retenus après les audits

- n8n orchestre, ne scrape pas
- filtrer, dédupliquer, calculer en code avant l'IA ; mesurer les tokens
- les absences restent `null`, jamais 0 ; échantillon insuffisant = `INSUFFICIENT_DATA`
- validation humaine avant toute dépense (échantillon, commande, pub, mise en vente)
- aucune suppression automatique
- pages publiques uniquement, volume faible, APIs locales jamais exposées

## État (audit du 2026-09-05)

Huit défauts n8n reproduits et corrigés en deux lots
(`sourcing/docs/technical-corrections-2026-09-05*.md`). 28 tests Python au
vert côté collecteurs. Benchmark Qwen pour la porte de phase 1 :
`sourcing/docs/qwen-opportunity-gate-benchmark.md`.

## Questions ouvertes

- [ ] Relancer les phases 1 à 5 sur les univers réels (art de la table, décoration) plutôt que sur les catégories Reddit d'origine (nettoyage, rangement)
- [ ] Étape de transformation « fiche AliExpress validée » vers « JSON conforme aux règles DA » : à écrire
- [ ] Le secret Google Sheet des anciens exports n8n est à considérer comme compromis : vérifier qu'il a été révoqué

Voir aussi [[Carte Fournisseurs et logistique]].
