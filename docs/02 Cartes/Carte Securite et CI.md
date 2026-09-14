---
tags: [carte, securite, ci]
---

# Carte : Sécurité et CI

> La question utile : qu'est-ce que Shopify couvre, et qu'est-ce qui reste
> réellement de notre côté ? Référence : [[ARCHITECTURE#6. Sécurité]].

## Ce que Shopify couvre

Checkout, stockage des paiements, PCI-DSS, fraude, TLS, WAF, anti-DDoS. Le
thème ne touche jamais une donnée de paiement.

## Ce qui reste chez nous

- **Comptes** : 2FA obligatoire, pas de compte partagé, permissions au strict nécessaire, le compte propriétaire n'est pas un compte de travail.
- **Apps** : chaque app est un jeton permanent. Lire les scopes avant d'installer. Rien qui demande `read_customers` ou `read_all_orders` sans que ce soit son métier. Revue trimestrielle.
- **Jetons du pipeline** : app personnalisée dédiée, scopes produits / fichiers / traductions / publications uniquement. Deux jetons : lecture (diff sur PR) et écriture (environnement protégé).
- **Thème** : `escape` partout, aucun script tiers, formulaires natifs.

## Environnements GitHub

| Environnement | Secret | Usage |
|---|---|---|
| `boutique-lecture` | jeton lecture seule | diff sur PR, simulations |
| `boutique-ecriture` | jeton écriture, relecture obligatoire | écrire, finaliser, publier |
| `boutique-theme` | jeton CLI thème | aperçus de PR, sauvegarde des réglages |
| `boutique-production` | jeton CLI thème, relecture obligatoire | publication du thème |

## Workflows

| Fichier | Rôle |
|---|---|
| `theme.yml` | theme check, refus des couleurs en dur, aperçu `PR-<n>`, déploiement, sauvegarde des JSON marchands |
| `catalogue-verifier.yml` | conformité + diff sur PR |
| `catalogue-lot.yml` | `workflow_dispatch` seul, retaper le domaine en confirmation |

## Ce que la CI ne fait délibérément pas

- pas de `pull_request_target`
- actions épinglées par SHA
- aucune dépendance npm dans `ops/`
- aucune suppression automatique de produit : signalé, jamais supprimé

## Apps installées

Tenir la liste à jour ici, avec les scopes et la date d'installation.

| App | Scopes | Installée le | Pourquoi |
|---|---|---|---|
| (aucune pour l'instant) | | | |

## À faire

- [ ] Créer l'app personnalisée et les deux jetons
- [ ] Configurer les quatre environnements GitHub avec relecture obligatoire
- [ ] Noter ici la version d'API épinglée (`SHOPIFY_API_VERSION`) et la date de relevé trimestriel
