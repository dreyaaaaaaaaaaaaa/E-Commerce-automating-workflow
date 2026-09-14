---
tags: [carte, catalogue]
---

# Carte : Catalogue et pipeline

> Un fichier JSON par produit dans `ops/data/produits/`, source de vérité
> **éditoriale**. L'admin Shopify reste la source de vérité **opérationnelle**
> (stock, commandes, promos). Confondre les deux est la première cause de
> pipeline qui écrase le travail d'un humain.

## Les cinq étapes

```
ops/data/produits/*.json
  1. valider.mjs      conformité DA, hors ligne, zéro appel
  2. images.mjs       téléversement + manifeste SHA-256
  3. pousser.mjs      diff, puis bulk productSet, tout en DRAFT
  4. finaliser.mjs    rattachement aux univers + traductions EN
  5. publier.mjs      contrôle final contre la boutique, puis tout le lot ou rien
```

Chaque étape est rejouable, simule par défaut, n'écrit qu'avec `--appliquer`.
Détail : [[ARCHITECTURE#7. Le pipeline catalogue]].

## Règles DA vérifiées avant import

Contrat en données dans `ops/schema/regles-da.mjs`. Un produit non conforme
n'entre pas.

| Contrôle | Règle |
|---|---|
| Titre | 3 à 48 caractères, pas de mot en capitales, pas de ponctuation finale |
| Description | 120 à 420 caractères, 2 à 4 phrases |
| Images | ratio 4:5 strict (± 2 %), largeur ≥ 1400 px, 1 à 6 par produit |
| `alt` | 12 à 125 caractères, FR et EN |
| Métachamps | matière, dimensions, entretien, brief photo obligatoires |
| Univers | un des trois, liste fermée |
| Prix | entier en centimes, multiple de 50 |
| Référence | `^[A-Z]{2,4}-\d{3,5}$` |
| Unicité | handle, référence, SKU |
| Traductions | titre + description EN obligatoires |

## Produits

Une note par produit dans `docs/04 Produits/`, miroir du JSON (le JSON reste la
source de vérité, la note sert au suivi : sourcing, photos, statut).

```dataview
TABLE reference, univers, prix, statut
FROM "docs/04 Produits"
SORT univers ASC, file.name ASC
```

Sans Dataview : [[Bougeoir Rasant, laiton brosse]], [[Carafe Lumiere, verre souffle]].

## Commandes

```bash
cd ops
npm test                     # tests unitaires, aucun réseau ni jeton
npm run valider              # conformité DA
npm run pousser              # diff, aucune écriture
npm run lot                  # valider + images + pousser + finaliser, jusqu'au DRAFT
npm run publier:reel         # bascule le lot en ligne
```

## Prochaines étapes

- [ ] Créer les trois collections univers dans l'admin (`table-et-lumiere`, `terre-et-gres`, `nuit-et-laiton`)
- [ ] `npm run metachamps -- --appliquer` (définitions de métachamps, idempotent)
- [ ] Premier lot réel : les deux produits existants, jusqu'au DRAFT
- [ ] Peupler les univers 02 et 03 (aucun produit pour l'instant)

## Décisions liées

- [[2026-09-05 JSON par produit comme source de verite]]
- [[2026-09-05 Univers = collection enrichie, pas metaobjet]]
- [[2026-09-05 Tout le lot ou rien]]
