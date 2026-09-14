# Corrections techniques après audit Astra : lot 2

Date : 5 septembre 2026.

Ce lot ne touche pas à l'esthétique des produits ni à Shopify.

## Identité et idempotence

- `Possible items` persiste désormais `source_id`, `source_url` et `opportunity_id`.
- `Found items online` persiste `opportunity_id`, `product_id`, destination, devise et
  `evaluation_key`.
- `ai selected products` persiste la même clé d'évaluation ainsi que la version du prompt.
- Les upserts des phases 3 et 4 utilisent `evaluation_key`; un même produit peut donc être
  évalué indépendamment pour plusieurs problèmes.
- Les deux opportunités acceptées et leurs lignes produit existantes ont été rétro-remplies
  dans le Google Sheet. Le lien historique erroné du `Flat Dust Sweeper` a été réconcilié
  avec l'ID et le lien utilisés par sa décision Phase 3.

## Reprises bornées

- Phase 2 persiste les IDs AliExpress restants, le run, l'erreur, le nombre d'essais et la
  prochaine date de reprise.
- Une reprise Phase 2 collecte directement les IDs restants sans refaire la recherche.
- `PHASE2_NO_MATCH` est terminal. Les retries utilisent un délai exponentiel de 30 minutes
  à 24 heures et deviennent `PHASE2_FAILED` après cinq essais.
- Phase 3 applique le même plafond et le même délai aux erreurs de format IA.

## Marchés AliExpress

- SQLite sépare l'identité produit des marchés `(product_id, country, currency)`.
- Les variantes sont séparées par produit, variante, pays et devise.
- Les comparaisons de snapshots se font dans le même marché.
- `GET /products/<id>?country=FR&currency=EUR` retourne exactement le marché demandé.
- La fraîcheur est conservée par champ dans `field_fetched_at`.

## Configuration n8n

- Les URLs sont définies par `ALIEXPRESS_API_BASE` et `DISCOVERY_API_BASE` dans les
  variables n8n, avec les valeurs Docker Desktop comme fallback.
- Chaque workflow principal commence par un appel `/health` et échoue rapidement si le
  collecteur nécessaire est indisponible.
- Valeurs de référence : `config/n8n-runtime.env.example`.

## Sauvegardes cohérentes

Les deux CLI utilisent l'API de sauvegarde SQLite, compatible avec le mode WAL :

```powershell
python -m problem_discovery backup --output "backups/problem-discovery.sqlite3"
python -m aliexpress_collector backup --output "backups/aliexpress.sqlite3"
```

Une simple copie du fichier `.sqlite3` pendant une écriture n'est pas utilisée.
