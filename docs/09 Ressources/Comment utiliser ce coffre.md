---
tags: [ressource, meta]
---

# Comment utiliser ce coffre

Le coffre Obsidian **est le dépôt Git** : ouvrir le dossier `Site Dropshipping`
comme coffre. Les dossiers de code (`theme/`, `ops/`, `tools/`, `.github/`)
sont exclus de l'index Obsidian dans les réglages, mais `AGENTS.md`,
`README.md` et `ARCHITECTURE.md` sont des notes à part entière et se lient en
`[[wikilink]]`.

## Où va quoi

| Dossier | Contenu | Modèle |
|---|---|---|
| `00 Boite de reception` | tout ce qui n'a pas encore de place (dossier par défaut des nouvelles notes) | |
| `01 Journal` | une note par jour de travail, humaine ou agent | [[Modele journal]] |
| `02 Cartes` | les cartes de navigation, une par domaine | |
| `03 Decisions` | une note par décision qui engage la suite, datée `AAAA-MM-JJ Titre` | [[Modele decision]] |
| `04 Produits` | une note de suivi par produit, miroir du JSON | [[Modele produit]] |
| `05 Univers` | une note par univers | |
| `06 Fournisseurs` | une note par fournisseur | [[Modele fournisseur]] |
| `07 Marketing` | campagnes, contenu, idées | [[Modele idee]] |
| `08 Legal et RGPD` | pièces reçues du client, brouillons quand la zone sera réactivée | |
| `09 Ressources` | liens, docs externes, ce fichier | |
| `10 Archive` | ce qui ne sert plus mais qu'on garde | |
| `_pieces-jointes` | images et fichiers collés dans les notes | |

## Règles

- **Français**, pas de tiret cadratin (même règle que le code).
- Une décision qui change le périmètre ou l'architecture va dans `03 Decisions`, pas seulement dans le journal.
- Le JSON produit reste la source de vérité éditoriale ; la note produit ne duplique pas le texte, elle suit l'avancement.
- Ne pas recopier `ARCHITECTURE.md` dans les cartes : lier vers la section (`[[ARCHITECTURE#7. Le pipeline catalogue]]`).
- Les fichiers `.obsidian/workspace*.json` ne sont pas versionnés ; le reste de la config l'est, pour retrouver le même coffre après un `git clone`.

## Plugins

Aucun plugin n'est requis. Les blocs `dataview` dans [[Accueil]] et les cartes
s'affichent comme du code tant que **Dataview** n'est pas installé ; chaque
bloc a une liste statique en secours. Les modèles utilisent la syntaxe du
plugin de base *Templates* (`{{date}}`, `{{title}}`), pas Templater.
