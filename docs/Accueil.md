---
tags: [accueil, tableau-de-bord]
aliases: [Home, Dashboard, Tableau de bord]
---

# Lumière rasante : tableau de bord

> Boutique Shopify de dropshipping, art de la table et décoration, FR/EN.
> Ce coffre Obsidian est la mémoire vivante du projet. Le code et la doc
> technique de référence vivent à côté, dans le même dépôt.

## Lire en premier (doc technique du dépôt)

| Fichier | Rôle |
|---|---|
| [[AGENTS]] | point d'entrée pour reprendre le projet, règles du dépôt, zones en pause |
| [[README]] | démarrage en deux minutes |
| [[ARCHITECTURE]] | la référence complète : décisions, modèle de données, sécurité, pipeline |

## Navigation

| Carte | Contenu |
|---|---|
| [[Carte Direction artistique]] | palette, typographie, grilles, univers, maquettes |
| [[Carte Theme]] | fichiers du thème, garde-fous, vérifications |
| [[Carte Catalogue]] | pipeline en cinq étapes, règles DA, produits |
| [[Carte Securite et CI]] | jetons, environnements, ce que la CI refuse |
| [[Carte Fournisseurs et logistique]] | le volet dropshipping (autre dépôt, à fusionner) |
| [[Carte Marketing]] | acquisition, contenu, infolettre |
| [[Carte Legal et RGPD]] | pages obligatoires, consentement, en pause |

## État du projet

**Livré** : thème complet (accueil, univers, fiche produit, panier, journal,
recherche, compte client, 404), pipeline catalogue testé, trois workflows CI,
Lighthouse CI. Détail dans [[ARCHITECTURE#10. Ce qui est livré, et ce qui reste]].

**Reste à faire, dans l'ordre** (voir [[Carte Catalogue#Prochaines étapes]]) :
1. créer les trois collections univers et appliquer les métachamps
2. valider l'ordre des sections de l'accueil au design
3. habillage du checkout (en pause)
4. pages légales (en pause)

**Trois zones volontairement en pause**, décision du client, ne pas les faire
avancer sans qu'il le redemande : [[2026-09-08 Trois zones en pause]].

## Liens externes

- Dépôt GitHub : https://github.com/dreyaaaaaaaaaaaaa/E-commerce (branche `main`)
- Canvas Claude Design (maquettes) : https://claude.ai/code/artifact/0dbcff47-35f5-46b9-b864-805ac74279ea
- Sources du canvas sur disque : `.design-canvas/` (hors Git)

## Tableaux dynamiques (plugin Dataview requis)

### Décisions
```dataview
TABLE date, domaine, statut
FROM "docs/03 Decisions"
SORT date DESC
```

### Produits du catalogue
```dataview
TABLE reference, univers, prix, statut
FROM "docs/04 Produits"
SORT univers ASC, file.name ASC
```

### Journal des sessions
```dataview
TABLE resume
FROM "docs/01 Journal"
SORT file.name DESC
LIMIT 10
```

### Tâches ouvertes
```dataview
TASK
FROM "docs"
WHERE !completed
```
