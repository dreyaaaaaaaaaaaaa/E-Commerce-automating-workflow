---
tags: [carte, design]
---

# Carte : Direction artistique

> Option **1a « Lumière rasante »** : ivoire chaud, air, filets laiton,
> éditorial doux, produit posé dans le décor. La DA est un contrat exécutable,
> pas une convention (voir [[Carte Theme]] et [[Carte Catalogue]]).

## Tokens

| | |
|---|---|
| Fonds | ivoire `#faf6ef`, ivoire secondaire `#f0eae0`, crème `#ede4d6` |
| Texte | encre `#1a1512`, noir profond `#13100d` |
| Accents | laiton `#a9803c`, laiton clair `#c49a55`, bleu nuit `#15203a` (univers 03) |
| Titres | Instrument Serif 400 : 78 / 62 / 46 / 44 / 25 / 21 px |
| Courant | Jost 300 : 15,5 px / 1,75 |
| Libellés | Jost 400, 10 à 11,5 px, capitales, interlettrage .10 à .24 em |
| Gouttière | 56 px desktop, fluide jusqu'à 20 px |
| Grilles | accueil `repeat(3, 1fr)` · univers `1fr 560px` · produit `96px 1fr 470px` |
| Filets | 1 px `rgba(26,21,18,.12)`, jamais plus épais |
| Motion | 320 ms, `cubic-bezier(.22,.61,.36,1)`, rien ne rebondit |

Source unique dans le code : `theme/assets/base.css`. Référence complète :
[[ARCHITECTURE#1. La direction artistique, en données]].

## Les trois univers

- [[Table et Lumiere]] (`01`, `table-et-lumiere`)
- [[Terre et Gres]] (`02`, `terre-et-gres`)
- [[Nuit et Laiton]] (`03`, `nuit-et-laiton`, accent bleu nuit)

## Le placeholder est un composant

Quand l'image manque, `snippets/media.liquid` rend la hachure crème 135° et
le brief de prise de vue (`custom.brief_photo`). Le site est présentable avant
la production photo. Ne pas toucher au système tant que les photos ne sont pas
choisies : [[2026-09-08 Trois zones en pause]].

## Maquettes

- Canvas Claude Design (6 artboards : accueil / univers / produit, desktop 1440
  et mobile 390) : https://claude.ai/code/artifact/0dbcff47-35f5-46b9-b864-805ac74279ea
- Sources : `.design-canvas/*.dc.html` + `canvas.json`, hors Git (`.gitignore`)
- Trois photos d'ambiance fournies par le client (v1, pas encore rattachées à
  un univers) : `cuisine-v1.webp`, `salle-de-bain-v1.webp`, `salon-v1.webp`
- Pour mettre à jour : éditer les `.dc.html`, reseeder avec le skill `design`,
  republier avec l'URL ci-dessus (pas un nouveau lien)

## Décisions liées

- [[2026-09-05 Theme custom plutot que Dawn ou Hydrogen]]
- [[2026-09-05 Polices auto-hebergees]]
- [[2026-09-05 Pastilles couleur rondes]]
- [[2026-09-07 Vendre des objets, pas une ambiance]]

## Questions ouvertes

- [ ] Ordre des sections de l'accueil : univers avant nouveautés (actuel) ou l'inverse (comp) ? À trancher au design.
- [ ] Rattacher les trois photos d'ambiance v1 à un univers, ou les remplacer.
