---
tags: [index, fournisseur]
---

# Fournisseurs

Aucun fournisseur documenté pour l'instant. Créer une note par fournisseur à
partir de [[Modele fournisseur]]. Vue d'ensemble : [[Carte Fournisseurs et logistique]].

```dataview
TABLE pays, delai, univers, statut
FROM "docs/06 Fournisseurs" AND #fournisseur AND -#index
SORT statut ASC
```
