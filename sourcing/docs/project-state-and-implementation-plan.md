# État du projet et plan d'implémentation

Date de l'audit : 2026-09-02

Ce document synthétise l'inspection du dépôt, du méga-prompt et des quatre exports
n8n. Aucun scraping réseau et aucune mutation Google Sheets n'ont été effectués
pendant l'audit.

## Principes d'implémentation retenus

1. Conserver les deux scrapers Python qui fonctionnent.
2. Utiliser n8n comme orchestrateur, pas comme moteur de scraping.
3. Préserver les données brutes et échanger du JSON normalisé entre les étapes.
4. Filtrer, dédupliquer et calculer avec du code avant tout appel IA.
5. Limiter et mesurer chaque appel IA.
6. Garder une validation humaine avant la recherche fournisseur coûteuse, les
   commandes, la publicité ou la mise en vente.
7. Ne mettre en place aucune suppression automatique de données sans proposition
   séparée et accord explicite.

## État réel des scrapers

### Reddit / Problem Discovery

- Exécution actuelle : CLI Python avec navigateur Playwright et profil Chrome dédié.
- Modes : normal, `--test-mode` et `--safe-run`.
- Entrée : configuration JSON des catégories, communautés, limites et filtres.
- Sortie normalisée : `source`, `source_type`, `source_id`, `title`, `content`, `url`,
  dates, engagement, métadonnées et statut.
- Données brutes : conservées dans SQLite et dans les archives de pages.
- Filtrage déterministe actuel : longueur, âge et signaux textuels configurables.
- Déduplication : contrainte unique `(source, source_id)`.
- API : absente pour l'instant ; CLI et export JSONL uniquement.

État mesuré :

```text
507 éléments stockés
365 READY_FOR_AI
142 FILTERED
3 exécutions enregistrées
Dernière exécution : 500 récupérés, 487 nouveaux, 13 doublons, 3 erreurs
```

Limite actuelle : l'engagement est conservé mais ne participe pas encore au
pré-score. Il n'existe pas encore de statut post-IA ni d'API permettant à n8n de
réserver et confirmer les éléments traités.

### AliExpress Collector

- Exécution actuelle : CLI ou API JSON locale sur `127.0.0.1:8787`.
- Entrées : requête de recherche, identifiant/URL produit, pays de destination,
  limites et options de navigateur.
- Sorties : résultats de recherche, snapshots détaillés, fournisseur, variantes,
  prix, avis, commandes, avertissements et métadonnées de capture.
- Données brutes : HTML et réponses réseau archivés.
- Stockage : SQLite avec historique et détection des changements.
- CAPTCHA : capture réseau immédiate ; un snapshot peut être conservé si le JSON
  produit principal est arrivé avant le challenge. Sinon le résultat est bloqué.

État mesuré :

```text
8 produits détaillés
8 recherches enregistrées
4 recherches OK
4 recherches partielles
```

Limite actuelle : l'API est synchrone et sans authentification, donc uniquement
locale. Les lots s'arrêtent sur un challenge non résolu, même lorsqu'un premier
snapshot a déjà été conservé.

### Vérification

Les 20 tests unitaires du dépôt passent.

## État réel des workflows n8n

Les quatre exports sont inactifs et déclenchés manuellement.

### Phase 1 : découverte de tendances

Flux actuel :

```text
Google Trends RSS US
→ conversion XML
→ agrégation de toutes les tendances
→ IA de qualification
→ append dans Trends
→ relecture de Trends
→ filtre sur la recommandation
→ IA générant 3 à 5 idées
→ append dans Possible items
```

Points positifs : structure compréhensible, JSON demandé aux modèles, première
séparation entre tendance et idée produit.

Écarts : Reddit n'est pas intégré ; tous les anciens éléments sont relus ; pas
d'upsert ni de clé de déduplication ; deux appels IA peuvent analyser des données
faibles ; aucune mesure de tokens ; plusieurs scores demandent des informations
absentes ; les champs source/date/statut sont incomplets.

### Phase 2 : recherche de marché

Flux actuel :

```text
Possible items avec statut NEW
→ Google Shopping via SerpAPI
→ cinq résultats
→ aplatissement
→ append dans Found items online
```

Écarts : AliExpress n'est pas utilisé ; le statut source n'est jamais mis à jour,
donc les mêmes produits sont retraités ; pas de déduplication ; pas de gestion des
résultats vides ; la clé SerpAPI est intégrée en clair dans l'export.

### Phase 3 : sélection IA

Flux actuel :

```text
Found items online
→ regroupement par nom
→ statistiques de prix
→ réduction du payload
→ agrégation
→ analyse IA
→ suppression des REJECT
→ append dans ai selected products
```

Blocages et risques :

- Le prompt exige un objet JSON, mais le parseur exige un tableau JSON.
- Le modèle configuré est un modèle vision alors qu'aucune image n'est transmise.
- Aucun filtre de statut : toutes les lignes sont retraitées.
- Les prix de devises différentes sont agrégés sans conversion ni contrôle.
- Le parseur de prix traite mal certains séparateurs de milliers.
- L'IA estime marge et potentiel fournisseur sans coût fournisseur réel.
- Pas de sortie structurée native, de validation de schéma ou de suivi de tokens.

## Mesure de sécurité immédiate

Les secrets visibles dans les exports historiques doivent être révoqués et ne pas être
réutilisés. Les éventuelles nouvelles valeurs devront résider dans des credentials n8n
ou des variables d'environnement, jamais dans les JSON exportés ni dans Git.

## Architecture MVP proposée

```text
Phase 1 : Discovery
API locale Reddit uniquement
→ normalisation commune
→ filtres et pré-score déterministes
→ déduplication
→ lot borné pour IA
→ extraction d'opportunités structurées
→ upsert Product Opportunities

Phase 2 : Product Research
Opportunités NEW
→ requêtes AliExpress
→ recherche AliExpress sans détails
→ filtre déterministe et déduplication product_id
→ détail de cinq produits maximum
→ upsert Product Research

Phase 3 : Evaluation
opportunité + preuves Reddit + snapshots AliExpress
→ métriques déterministes
→ lot borné pour IA
→ scoring prudent et JSON validé
→ READY_FOR_REVIEW
→ validation humaine
```

Google Trends est retiré du nouveau workflow en raison de son faible rendement observé.
SerpAPI peut rester comme signal optionnel de concurrence retail. Il ne remplace pas
le scraper AliExpress et ne doit pas être obligatoire pour faire fonctionner le MVP.

## Méthode d'intégration n8n

Le MVP utilisera une API Python locale appelée par des nœuds HTTP Request. L'API sera
lancée dans la session Windows de l'utilisateur afin que Playwright puisse ouvrir un
Chrome visible.

```text
n8n local : http://127.0.0.1:<port>
n8n Docker : http://host.docker.internal:<port>
```

Le premier incrément ajoutera les routes Reddit manquantes et conservera les routes
AliExpress existantes. Les scrapers resteront inchangés autant que possible. Les
réponses de machine seront du JSON sans logs mélangés ; les logs iront sur stderr ou
dans un journal séparé.

Pour le mode test, les limites par défaut resteront petites et tous les jobs navigateur
seront exécutés avec une concurrence de un.

## Flux IA

Deux tâches IA maximum :

1. Extraction/rejet d'une opportunité à partir d'un lot compact de sources filtrées.
2. Évaluation de produits à partir de faits AliExpress détaillés.

Les prompts seront courts, versionnés et validés par schéma. Aucun agent autonome ne
sera nécessaire pour le MVP.

## Suivi tokens et coûts

Chaque appel produira un enregistrement :

```text
run_id, timestamp, workflow, prompt_version, model, status,
input_tokens, output_tokens, total_tokens, token_source,
estimated_cost_usd
```

`token_source` distinguera `actual` de `estimated`. Les tarifs seront dans une
configuration unique et modifiable. Les synthèses par run, jour, workflow et modèle
seront calculées par code, pas par IA.

## Google Sheets MVP

Structure minimale proposée :

- `Product Opportunities`
- `Product Research`
- `Human Review`
- `AI Usage Log`

Les données brutes restent dans les SQLite/archives Python ; elles n'ont pas besoin
d'être dupliquées intégralement dans Sheets. Les écritures seront des upserts basés sur
`source + source_id`, `cluster_id` et `product_id`.

Aucune politique de nettoyage automatique n'est incluse dans ce plan.

## Fichiers à modifier lors de l'implémentation

- `src/problem_discovery/storage.py` : statuts post-traitement et lecture incrémentale.
- `src/problem_discovery/cli.py` ou une façade API : sorties propres pour n8n.
- `src/aliexpress_collector/api.py` : politique CAPTCHA explicite et réponses n8n.
- `config/problem_discovery.json` : pré-score et limites test configurables.
- `README.md` : commandes, API, n8n, environnement et mode test.
- Les trois exports n8n : credentials, déduplication, statuts, appels scraper et
  prompts cohérents.

## Fichiers à créer lors de l'implémentation

- une petite façade API locale commune ou des routes Discovery dans l'API existante ;
- configuration IA/prix/limites ;
- module de pré-score et préparation compacte des entrées IA ;
- module/journal de suivi des appels IA ;
- tests de contrat JSON et d'intégration API ;
- exports n8n v2 importables sans secrets.

## Ordre d'implémentation

1. Sécuriser les credentials exposés.
2. Figer les contrats JSON réels avec des tests.
3. Ajouter l'accès API Reddit et les statuts incrémentaux.
4. Ajouter pré-score, préparation compacte et métriques de réduction.
5. Refaire Phase 1 avec Reddit uniquement et déduplication.
6. Refaire Phase 2 autour de la recherche AliExpress.
7. Refaire Phase 3 avec données AliExpress détaillées et schéma IA cohérent.
8. Ajouter le journal tokens/coûts et le rapport par run.
10. Tester en petit volume, mesurer, puis seulement augmenter les limites.
