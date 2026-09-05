# Maison : boutique Shopify

Thème Shopify custom et pipeline catalogue, d'après la direction artistique
**1a « Lumière rasante »** (art de la table & décoration, FR/EN).

L'architecture complète (décisions, modèle de données, sécurité, pipeline)
est dans **[ARCHITECTURE.md](ARCHITECTURE.md)**. Ce fichier ne donne que de
quoi démarrer, et **[AGENTS.md](AGENTS.md)** est le point d'entrée pour un
autre agent qui reprendrait le travail.

## Prérequis

- Node 20+
- Shopify CLI 3 (`npm i -g @shopify/cli@3`)
- Une boutique de développement et une app personnalisée (scopes en § 6.2 de
  l'architecture)

## Démarrer sur le thème

```bash
shopify theme dev --path theme --store <boutique>.myshopify.com
```

Les polices (Instrument Serif, Jost, SIL OFL) sont déjà dans `theme/assets/`,
rien à télécharger.

## Démarrer sur le catalogue

```bash
cd ops
cp .env.example .env      # puis renseigner le jeton
npm run valider           # conformité DA, aucun appel réseau
npm run pousser           # diff avec la boutique, aucune écriture
```

Rien n'écrit dans la boutique sans `--appliquer`. Rien n'est visible en
boutique avant `npm run publier:reel`, qui bascule le lot entier ou rien.

## Le principe à retenir

La DA n'est pas une couche de finition posée sur le thème : elle est
**exécutable**. Les tokens vivent dans un seul fichier, la CI refuse les
couleurs en dur, les sections plafonnent le nombre de blocs, et le validateur
de catalogue refuse un produit dont le titre est trop long ou l'image au
mauvais ratio. C'est ce qui permet d'importer un gros lot de références sans
relire chaque fiche.
