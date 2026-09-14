# Guide de lancement n8n : MVP Reddit + AliExpress

## 1. Mesures de sécurité

Révoquer les anciennes clés intégrées directement dans les exports historiques et ne
pas réimporter ces valeurs. Le nouveau pipeline n'utilise aucun service fournisseur
externe autre qu'AliExpress.

## 2. Démarrer les deux APIs locales

Ouvrir deux terminaux PowerShell dans le dépôt.

Terminal Reddit :

```powershell
$env:PYTHONPATH = "src"
python -m problem_discovery serve --host 127.0.0.1 --port 8789
```

Terminal AliExpress :

```powershell
$env:PYTHONPATH = "src"
python -m aliexpress_collector serve --host 127.0.0.1 --port 8787
```

Les terminaux doivent rester ouverts pendant les exécutions n8n. Les appels avec
`headless: false` ouvrent des fenêtres Chrome visibles.

Les exports utilisent les variables n8n `ALIEXPRESS_API_BASE` et
`DISCOVERY_API_BASE`, avec `http://host.docker.internal:8787` et
`http://host.docker.internal:8789` comme valeurs de secours pour Docker Desktop.
Les définir une fois dans **Settings > Variables**. Les APIs restent liées à
localhost et ne doivent pas être exposées directement à Internet. Chaque workflow
commence par `/health` avant de lire ou modifier les données.

## 3. Importer les workflows

Importer et tester dans cet ordre :

1. `Dropship phase 1 v2 Reddit.json`
2. `Dropship phase 2 v2 AliExpress.json`
3. `Dropship phase 3 v2 AI Evaluation.json`
4. `Dropship phase 4 v2 Competition Analysis.json`
5. `Dropship phase 5 v1 Product Validation.json`

Après l'import :

- sélectionner le credential IA existant dans les Phases 1, 3 et 4 ;
- sélectionner le credential Google Sheets existant dans chaque nœud Sheets ;
- ne pas activer de planification avant la réussite des tests manuels.

## 4. Comportement des phases

### Phase 1

- collecte Reddit en mode `safe_run` avec Chrome visible ;
- traite 15 communautés par exécution et fait tourner le point de départ sur les 63
  subreddits configurés, y compris les communautés d'espaces esthétiques, de bureaux
  et d'organisation visuelle ;
- recalcule les pré-scores ;
- lit les 150 posts `READY_FOR_AI` les plus récents au maximum ;
- envoie des lots de 5 à l'IA ;
- valide et journalise chaque lot séparément, sans ignorer les réponses suivantes ;
- écrit les opportunités acceptées dans `Possible items` ;
- utilise `PHASE1_QUALIFIED` comme statut canonique et fait l'upsert sur
  `opportunity_id + search_query` ;
- persiste `source_id`, `source_url` et `opportunity_id` dans le Sheet ;
- met le post Reddit à jour seulement après une écriture Sheets réussie ;
- journalise les tokens comme `estimated` lorsque le nœud modèle ne fournit pas
  l'usage réel.

### Phase 2

- lit uniquement les opportunités `PHASE1_QUALIFIED` ou `PHASE2_RETRY` ; le statut
  `PHASE1_QUALIFIED` constitue lui-même le contrat de sortie de la Phase 1 v4 ;
- appelle l'API AliExpress via `host.docker.internal:8787` depuis n8n Docker ;
- recherche jusqu'à vingt-cinq listings et les classe sans IA ;
- exclut réellement les résultats sans aucun recouvrement avec la requête, puis
  détaille les dix meilleurs dans une seule session Chrome persistante ;
- utilise Chrome visible, attend jusqu'à trois minutes si un CAPTCHA apparaît et
  exige une capture exploitable avant toute écriture ;
- fait un upsert dans `Found items online` sur `evaluation_key` ;
- marque chaque opportunité indépendamment `PHASE2_RESEARCHED`,
  `PHASE2_NO_MATCH`, `PHASE2_RETRY` ou `PHASE2_FAILED`, avec
  `opportunity_id + search_query` comme clé ;
- conserve séparément un même lien AliExpress lorsqu'il répond à plusieurs
  opportunités, grâce à la clé composée opportunité + lien.

Un lot interrompu persiste ses `remaining_product_ids`. Une nouvelle exécution
reprend directement ces IDs, sans refaire la recherche. Les reprises attendent de
30 minutes à 24 heures et s'arrêtent après cinq essais.
Une capture n'est exploitable que si elle contient un identifiant produit, un titre,
un prix EUR et au moins une variante éligible pour la destination. Les captures de
métadonnées avec prix absent ne sont jamais marquées `RESEARCHED`.

Commande PowerShell avant le test :

```powershell
cd "C:\Users\lepis\Documents\ChatGPT\Site dropship"
$env:PYTHONPATH = "src"
python -m aliexpress_collector --country FR serve --host 127.0.0.1 --port 8787
```

La recherche puis la collecte détaillée ouvrent Chrome successivement. Cette phase
n'utilise aucun modèle IA et ne consomme donc aucun token IA.

### Phase 3

- lit jusqu'à cinquante produits `RESEARCHED` et les preuves des opportunités
  `PHASE2_RESEARCHED` ;
- joint chaque produit à la preuve Reddit et à la contrainte produit d'origine ;
- récupère les snapshots détaillés depuis SQLite via l'API AliExpress ;
- demande explicitement le marché `FR/EUR`; SQLite conserve séparément les autres
  pays et devises ainsi que la fraîcheur de chaque champ ;
- regroupe les produits par opportunité et réalise des appels IA de cinq produits ;
- refuse une `SHORTLIST` lorsque les dimensions ou contraintes critiques ne sont
  pas prouvées par les données disponibles ;
- écrit toutes les décisions `SHORTLIST`, `HOLD`, `REJECT` et les erreurs de format
  dans `ai selected products` pour permettre l'audit du prompt ;
- reprend aussi les lignes `PHASE3_RETRY` et refuse toute sortie IA dont les scores,
  identifiants ou champs obligatoires ne respectent pas le contrat ;
- utilise `evaluation_key = opportunity_id + product_id + destination` pour les
  upserts et plafonne les erreurs de format à cinq reprises différées ;
- conserve le lien AliExpress déjà récupéré avant l'appel IA et marque chaque ligne
  source `PHASE3_SHORTLIST`, `PHASE3_HOLD`, `PHASE3_REJECT` ou `PHASE3_RETRY` ;
- écrit le lien direct dans `product_link` pour les décisions `HOLD` et `SHORTLIST`
  sans l'envoyer au modèle ;
- journalise l'usage fournisseur réel lorsqu'il est exposé, sinon une estimation
  explicitement étiquetée ;
- aucune décision d'achat ou de lancement n'est automatisée.

La Phase 3 nécessite les deux API locales : AliExpress sur le port 8787 et la
journalisation d'usage sur le port 8789. Dans n8n, sélectionner le même modèle Qwen
que celui validé pendant la Phase 1.

### Phase 4

- lit uniquement les décisions Phase 3 `HOLD` et `SHORTLIST` ;
- rejoint chaque décision avec sa requête et son lien dans `Found items online` ;
- regroupe les produits par `opportunity_id + destination + search_query` ;
- collecte un seul échantillon réel de cinquante résultats AliExpress par groupe,
  puis le réutilise pour tous les produits éligibles du groupe ;
- demande au modèle de classer chaque résultat comme concurrent direct, adjacent ou
  non comparable, sans lui demander d'estimer un niveau de concurrence ;
- calcule par code le nombre et la proportion de concurrents directs, les vendeurs
  distincts observés, la médiane des prix, la disponibilité des données de commandes
  et la concentration des commandes lorsque ces données existent ;
- conserve les valeurs absentes à `null`, ne mélange jamais les devises et exige au
  moins 80 % de classifications utilisables à confiance 60 avant d'afficher un
  niveau de concurrence ;
- écrit `LOW`, `MEDIUM`, `HIGH` ou `INSUFFICIENT_DATA` dans `competition_level` et
  conserve le détail mesuré dans `competition_evidence` ;
- le niveau représente uniquement la saturation de l'échantillon AliExpress, pas la
  concurrence globale du marché ;
- journalise un seul appel du classifieur par groupe sur le port 8789.

Le premier test utilise Chrome visible et ouvre au maximum une fenêtre par requête
unique. La
Phase 4 nécessite les mêmes deux APIs que la Phase 3. Sélectionner le même modèle Qwen
validé dans le nœud modèle avant l'exécution.

### Phase 5

- lit uniquement les produits dont la Phase 4 a produit une mesure exploitable ;
- récupère le dernier snapshot stocké pour le marché `FR/EUR`, sans ouvrir Chrome ;
- écrit ou met à jour les lignes dans l'onglet `Phase 5 validation` avec
  `evaluation_key` comme clé stable ;
- conserve à chaque relance les valeurs déjà validées dans la feuille ;
- récupère automatiquement les frais et le délai maximal d'une offre de livraison
  `FR/EUR` lorsqu'ils existent dans la capture AliExpress ;
- génère un scénario de prix et de marge avec des hypothèses centralisées. Les valeurs
  par défaut peuvent être remplacées une seule fois avec les variables n8n
  `PHASE5_PACKAGING_COST_EUR`, `PHASE5_IMPORT_DUTY_EUR`, `PHASE5_VAT_RATE_PCT`,
  `PHASE5_PAYMENT_FEE_PCT`, `PHASE5_PAYMENT_FEE_FIXED_EUR`,
  `PHASE5_RETURN_RESERVE_PCT`, `PHASE5_ACQUISITION_COST_EUR` et
  `PHASE5_TARGET_MARGIN_PCT` ;
- calcule le revenu hors TVA, les frais de paiement, les contributions avant et après
  acquisition, la marge contributive et le CAC maximal à l'équilibre ;
- laisse un calcul à `null` dès qu'un élément financier requis manque ;
- produit `MISSING_EVIDENCE`, `REJECTED_VALIDATION`, `REJECTED_ECONOMICS`,
  `READY_FOR_SAMPLE`, `SAMPLE_ORDERED` ou `READY_FOR_HUMAN_APPROVAL` ;
- ne commande, ne publie et ne transmet aucune donnée à un modèle IA.

La Phase 5 nécessite seulement l'API AliExpress sur le port 8787. Après une mise à
jour du collecteur, redémarrer l'API et relancer une collecte Phase 2 des anciens
produits afin d'enregistrer les nouvelles preuves de livraison. Les contrôles de
variante exacte, de conformité produit et d'échantillon restent des portes de preuve
humaines ; ils ne sont pas remplacés par les hypothèses économiques.

## 5. Contrôles API utiles

```text
http://127.0.0.1:8789/health
http://127.0.0.1:8789/summary
http://127.0.0.1:8789/ai-usage/summary
http://127.0.0.1:8787/health
```

### Exécution de bout en bout

Importer d'abord les versions à jour des workflows Phase 1 à Phase 5, puis importer
`Dropship end-to-end orchestrator v1.json`. Dans chacun des cinq nœuds `PHASE`,
sélectionner le workflow correspondant dans la liste n8n. Les sous-workflows gardent
leur déclencheur manuel et possèdent aussi un déclencheur réservé à l'orchestrateur.

L'orchestrateur vérifie les ports 8789 et 8787, exécute les cinq phases dans l'ordre
et attend la fin de chaque phase. Une erreur interrompt la chaîne ; une phase qui ne
produit aucun nouvel élément laisse tout de même la phase suivante vérifier son propre
stock de lignes éligibles.

## 6. Passage au volume supérieur

Ne changer les limites qu'après un cycle manuel complet. Mesurer d'abord le nombre de
posts collectés, filtrés, envoyés à l'IA, les tokens par workflow, les recherches
AliExpress partielles/bloquées et le nombre final de candidats humains.
