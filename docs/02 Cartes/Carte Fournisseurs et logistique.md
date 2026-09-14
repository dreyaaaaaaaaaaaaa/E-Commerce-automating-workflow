---
tags: [carte, fournisseurs, logistique]
---

# Carte : Fournisseurs et logistique

> Le volet dropshipping proprement dit (import produit, routage des commandes)
> vit dans un **autre dépôt**, pas encore fusionné. Ne pas supposer qu'un flux
> d'approvisionnement existe ici : `ops/` écrit un catalogue, il ne parle à
> aucun fournisseur.

## Fournisseurs

Une note par fournisseur dans `docs/06 Fournisseurs/`, à partir du modèle
[[Modele fournisseur]].

```dataview
TABLE pays, delai, univers, statut
FROM "docs/06 Fournisseurs"
SORT statut ASC
```

## Ce que le thème prévoit déjà

- Suivi de colis sur la page commande (`order.fulfillments`) : en dropshipping le délai est plus long et plus variable, c'est la première inquiétude du client.
- Sélecteur de marché / devise dans l'en-tête, si plusieurs marchés Shopify sont configurés.

## Questions ouvertes

- [ ] Où est l'autre dépôt (automatisation fournisseur) et quel est son état ?
- [ ] Comment un produit fournisseur devient-il un JSON conforme aux règles DA (titre 48 car., photo 4:5, prix multiple de 50) ? Étape de transformation à définir.
- [ ] Délais annoncés sur la fiche produit et dans les CGV : à décider avec les vrais fournisseurs.
- [ ] Politique de retour en dropshipping (qui reçoit le colis retourné ?)
