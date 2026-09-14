---
tags: [carte, legal, rgpd]
---

# Carte : Légal et RGPD

> **En pause sur décision du client.** Ne pas rédiger les pages légales, même
> en brouillon : il faut les vraies informations de l'entreprise, qui n'ont pas
> été fournies. Voir [[2026-09-08 Trois zones en pause]].

## Ce qu'il faudra du client

- [ ] Raison sociale, forme juridique, SIRET, capital
- [ ] Adresse du siège
- [ ] Nom de l'hébergeur (Shopify International Ltd, à confirmer selon le contrat)
- [ ] Médiateur de la consommation choisi
- [ ] Adresse e-mail de contact et DPO le cas échéant

## Pages obligatoires (à lier dans le menu légal du pied)

- Mentions légales
- CGV
- Politique de confidentialité
- Droit de rétractation 14 jours
- Coordonnées du médiateur de la consommation

## Déjà couvert par le thème

- Bandeau de consentement branché sur la Customer Privacy API (`setTrackingConsent`), pas sur une app.
- Aucun script tiers dans la page : la mesure passe par les pixels sandboxés.
- Polices auto-hébergées : aucune IP visiteur transmise à Google.
- Demandes d'accès et d'effacement : webhooks RGPD de Shopify.
- Consentement marketing explicite sur l'infolettre.

Référence : [[ARCHITECTURE#6. Sécurité]], sous-section RGPD.

## Spécificités dropshipping à traiter dans les CGV

- délais de livraison réels et variables
- pays d'expédition, droits de douane éventuels
- modalités de retour (adresse de retour, qui paie)
