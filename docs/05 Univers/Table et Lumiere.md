---
tags: [univers]
numero: 1
handle: table-et-lumiere
accent: laiton
statut: a-creer-dans-admin
---

# 01 Table & Lumière

Art de la table sous une lumière rasante : carafes, bougeoirs, verres, linge.
Le seul univers qui a déjà des produits.

## Métachamps de la collection (à renseigner dans l'admin)

| Champ | Valeur |
|---|---|
| `custom.numero` | 1 |
| `custom.chapo` | |
| `custom.stylisme` | Stylisme maison |
| `custom.image_editoriale` | plan large 4:3, à venir |
| `custom.brief_photo` | |

## Produits

```dataview
LIST
FROM "docs/04 Produits"
WHERE contains(univers, "Table et Lumiere")
```

Sans Dataview : [[Bougeoir Rasant, laiton brosse]], [[Carafe Lumiere, verre souffle]].

## À faire

- [ ] Créer la collection `table-et-lumiere` dans l'admin
- [ ] Rédiger le chapô (voir [[2026-09-07 Vendre des objets, pas une ambiance]])
- [ ] Choisir l'image éditoriale (une des photos v1 ?)
