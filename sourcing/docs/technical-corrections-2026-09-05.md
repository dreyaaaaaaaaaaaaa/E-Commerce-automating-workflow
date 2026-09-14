# Corrections techniques après audit Astra : lot 1

Date : 5 septembre 2026.

Ce lot ne concerne ni l'esthétique des produits, ni Shopify, ni les scènes visuelles.
Il corrige les huit défauts n8n reproduits par l'audit.

## Corrections appliquées

- Phase 1 émet maintenant `PHASE1_QUALIFIED`; Phase 2 ne lit que ce statut et
  `PHASE2_RETRY`, afin d'isoler les nouvelles décisions des anciennes lignes de test.
- La validation et le journal de tokens Phase 1 parcourent tous les lots et les
  associent par index de lot, au lieu d'utiliser `$input.first()`.
- Les réponses Phase 1 doivent couvrir chaque `source_id` exactement une fois. Une
  réponse incomplète, dupliquée ou inconnue devient `uncertain` avec
  `AI_FORMAT_ERROR`.
- L'écriture Phase 1 est un `appendOrUpdate` sur `product_name + search_query` et les
  identifiants Reddit sont récupérés depuis le contexte amont après succès de Sheets.
- Phase 2 exclut les candidats AliExpress dont le recouvrement lexical avec la
  requête est nul avant la collecte détaillée.
- Phase 3 lit `RESEARCHED` et `PHASE3_RETRY`, et construit une clé incluant le besoin,
  le produit et la destination.
- La validation Phase 3 exige des scores entiers, finis et compris entre 0 et 100,
  des identifiants connus et uniques, un verdict et un code autorisés, ainsi qu'un
  raisonnement non vide. Toute sortie invalide devient `AI_FORMAT_ERROR` et repart
  en retry.
- La Phase 4 conserve les valeurs absentes à `null`, sépare les prix par devise et
  calcule une couverture réellement exploitable à partir des classifications ayant
  une confiance d'au moins 60. Une couverture insuffisante produit
  `INSUFFICIENT_DATA`, jamais `LOW`.

L'ancien calcul Phase 4 est conservé dans un nœud déconnecté nommé
`Calculate measured competition LEGACY - disabled`.

La Phase 4 regroupe désormais les produits par opportunité, destination et requête.
Une recherche AliExpress et une classification IA sont exécutées par groupe, puis
la mesure obtenue est réappliquée à chaque produit HOLD/SHORTLIST avec sa propre
`evaluation_key`. Cela évite de relancer la même recherche pour chaque fournisseur.

## Vérification

```powershell
node docs/audit-2026-09-05-regression.cjs
python -m unittest discover -s tests -v
```

Le test de non-régression couvre A01 à A08. Le script original
`audit-2026-09-05-checks.cjs` reste inchangé comme preuve historique des défauts.

## Prochain lot technique

1. Persister `opportunity_id`, `source_id`, `source_url`, destination et clés
   d'évaluation dans Sheets sans utiliser les titres comme identifiants.
2. Persister les `remaining_product_ids`, le nombre d'essais et la prochaine date de
   reprise Phase 2/3.
3. Séparer dans SQLite l'identité produit des offres par pays et devise.
4. Centraliser les URLs des APIs locales et ajouter des health checks depuis le
   runtime n8n.
