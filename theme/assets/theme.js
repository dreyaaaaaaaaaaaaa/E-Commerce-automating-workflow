/* ============================================================
   MAISON : JS du thème
   Contraintes : aucun framework, aucune dépendance externe. Tout est en
   Web Components natifs pour que le rendu de section (Section Rendering
   API) puisse remplacer du HTML sans réinitialisation manuelle : un
   composant remplacé se réattache tout seul via connectedCallback.
   Budget : moins de 15 Ko compressé (voir ARCHITECTURE.md section 9).
   ============================================================ */
(() => {
  'use strict';

  const config = JSON.parse(
    document.getElementById('donnees-boutique')?.textContent || '{}'
  );

  const annonce = (message) => {
    const zone = document.getElementById('annonce-live');
    if (zone) zone.textContent = message;
  };

  /* Verrou de defilement partage entre les panneaux superposables (nav
     mobile, recherche, tiroir de panier). Un compteur plutot qu'un simple
     booleen : si deux panneaux sont ouverts en meme temps (ex. "Panier"
     cliqué depuis le menu mobile encore ouvert), fermer l'un ne doit pas
     deverrouiller le defilement tant que l'autre reste ouvert. */
  let verrousDefilement = 0;
  const verrouillerDefilement = () => {
    verrousDefilement += 1;
    document.documentElement.style.overflow = 'hidden';
  };
  const deverrouillerDefilement = () => {
    verrousDefilement = Math.max(0, verrousDefilement - 1);
    if (verrousDefilement === 0) document.documentElement.style.overflow = '';
  };

  /* Remplace une section par sa version fraiche, rendue cote serveur.
     Partagee par l'ajout au panier et le tiroir de panier : c'est le meme
     mecanisme, Shopify accepte le parametre `sections` sur /cart/add.js
     comme sur /cart/change.js. */
  function rafraichirSections(sections) {
    if (!sections) return;
    Object.entries(sections).forEach(([id, html]) => {
      const source = new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector(`#shopify-section-${id}, [data-section="${id}"]`);
      const cible = document.querySelector(`#shopify-section-${id}, [data-section="${id}"]`);
      if (source && cible) cible.replaceWith(source);
    });
  }

  /* Confirmation avant une action destructrice (suppression d'adresse).
     Le bouton reste un vrai submit natif : sans JS, la suppression
     fonctionne quand meme, simplement sans la boite de confirmation. */
  document.addEventListener('submit', (e) => {
    const bouton = e.submitter;
    const message = bouton?.dataset.confirmer;
    if (message && !window.confirm(message)) e.preventDefault();
  });

  /* ---------- Ajout au panier ----------
     On poste vers /cart/add.js avec `sections` : Shopify renvoie
     le HTML re-rendu du compteur de panier, qu'on remplace tel quel.
     Pas de calcul de total côté client : la source de vérité reste
     le serveur, ce qui évite tout écart de prix affiché. */
  class FormulairePanier extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.bouton = this.querySelector('[type="submit"]');
      this.form?.addEventListener('submit', this.soumettre.bind(this));
    }

    async soumettre(event) {
      event.preventDefault();
      if (this.bouton.hasAttribute('aria-disabled')) return;

      this.bouton.setAttribute('aria-disabled', 'true');
      this.bouton.dataset.libelleInitial = this.bouton.textContent;
      this.bouton.textContent = this.dataset.libelleChargement || '…';

      const donnees = new FormData(this.form);
      donnees.append('sections', 'entete');
      donnees.append('sections_url', window.location.pathname);

      try {
        const reponse = await fetch(config.routes.cart_add, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: donnees,
        });
        const resultat = await reponse.json();

        if (resultat.status) {
          // Erreur métier renvoyée par Shopify (stock, variante inconnue…)
          annonce(resultat.description || resultat.message);
          this.afficherErreur(resultat.description || resultat.message);
        } else {
          rafraichirSections(resultat.sections);
          annonce(this.dataset.libelleAjoute || 'Ajouté au panier');
          document.dispatchEvent(new CustomEvent('panier:modifie'));
          // Le noeud <panier-tiroir> vient d'etre remplace par
          // rafraichirSections : on rouvre le nouveau, pas l'ancien.
          document.querySelector('panier-tiroir')?.ouvrir();
        }
      } catch {
        this.afficherErreur(this.dataset.libelleErreur || 'Une erreur est survenue.');
      } finally {
        this.bouton.removeAttribute('aria-disabled');
        this.bouton.textContent = this.bouton.dataset.libelleInitial;
      }
    }

    afficherErreur(message) {
      const zone = this.querySelector('[data-erreur]');
      if (zone) {
        zone.textContent = message;
        zone.hidden = false;
      }
    }
  }
  customElements.define('formulaire-panier', FormulairePanier);

  /* ---------- Sélecteur de quantité ---------- */
  class SelecteurQuantite extends HTMLElement {
    connectedCallback() {
      this.champ = this.querySelector('input');
      this.addEventListener('click', (e) => {
        const pas = e.target.closest('[data-pas]')?.dataset.pas;
        if (!pas) return;
        e.preventDefault();
        const min = Number(this.champ.min || 1);
        const suivant = Number(this.champ.value) + Number(pas);
        this.champ.value = Math.max(min, suivant);
        this.champ.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }
  customElements.define('selecteur-quantite', SelecteurQuantite);

  /* ---------- Sélection de variante ----------
     On met à jour l'URL (?variant=) sans recharger, et on re-rend la
     section produit côté serveur : prix, disponibilité et métachamps
     restent cohérents avec le back-office. */
  class SelecteurVariante extends HTMLElement {
    connectedCallback() {
      this.addEventListener('change', this.changer.bind(this));
    }

    async changer() {
      const options = Array.from(this.querySelectorAll('input:checked, select'))
        .map((el) => el.value);
      const variantes = JSON.parse(this.querySelector('[type="application/json"]').textContent);
      const variante = variantes.find((v) =>
        v.options.every((opt, i) => opt === options[i])
      );
      if (!variante) return;

      // Le formulaire doit suivre la variante choisie immédiatement. Le rendu
      // serveur ci-dessous reste la source de vérité pour le prix et le stock,
      // mais un réseau lent ne doit jamais laisser l'ancien identifiant partir
      // au panier.
      const champVariante = this.querySelector('input[name="id"]');
      if (champVariante) champVariante.value = variante.id;

      this.querySelectorAll('.produit__option').forEach((groupe, index) => {
        const valeur = groupe.querySelector('.produit__option-valeur');
        if (valeur && options[index]) valeur.textContent = options[index];
      });

      const url = new URL(window.location);
      url.searchParams.set('variant', variante.id);
      window.history.replaceState({}, '', url);

      const reponse = await fetch(`${url.pathname}?variant=${variante.id}&section_id=${this.dataset.section}`);
      const html = new DOMParser().parseFromString(await reponse.text(), 'text/html');

      // [data-prix] n'est pas dans <selecteur-variante> mais a cote, dans
      // la meme section produit : on retrouve la section par son id plutot
      // que de faire un closest (qui se matcherait lui-meme puisque
      // <selecteur-variante> porte aussi data-section).
      const sectionProduit = document.querySelector(`[data-section="${this.dataset.section}"]`);
      const prixSource = html.querySelector('[data-prix]');
      const prixCible = sectionProduit?.querySelector('[data-prix]');
      if (prixSource && prixCible) prixCible.innerHTML = prixSource.innerHTML;

      const boutonSource = html.querySelector('[data-bouton-achat]');
      const boutonCible = this.querySelector('[data-bouton-achat]');
      if (boutonSource && boutonCible) {
        boutonCible.innerHTML = boutonSource.innerHTML;
        boutonCible.disabled = boutonSource.disabled;
      }
    }
  }
  customElements.define('selecteur-variante', SelecteurVariante);

  /* ---------- Galerie produit ----------
     Écouteur délégué au document : survit au remplacement de la section
     par la Section Rendering API sans réattachement. */
  document.addEventListener('click', (e) => {
    const vignette = e.target.closest('.produit__vignette');
    if (!vignette) return;
    const galerie = vignette.closest('.produit__corps');
    if (!galerie) return;

    galerie.querySelectorAll('.produit__vignette').forEach((v) => {
      v.classList.toggle('est-actif', v === vignette);
    });
    galerie.querySelectorAll('.produit__vue').forEach((vue) => {
      vue.hidden = vue.dataset.index !== vignette.dataset.index;
    });
  });

  /* ---------- Navigation mobile ---------- */
  class NavMobile extends HTMLElement {
    connectedCallback() {
      this.controleurEvenements?.abort();
      this.controleurEvenements = new AbortController();
      this.bouton = this.querySelector('[data-ouvrir]');
      this.panneau = this.querySelector('[data-panneau]');
      this.bouton?.addEventListener('click', () => this.basculer(), {
        signal: this.controleurEvenements.signal,
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.ouvert) this.basculer(false);
      }, { signal: this.controleurEvenements.signal });
    }

    disconnectedCallback() {
      this.controleurEvenements?.abort();
      if (this.verrouille) {
        this.verrouille = false;
        deverrouillerDefilement();
      }
    }

    get ouvert() {
      return this.bouton?.getAttribute('aria-expanded') === 'true';
    }

    basculer(force) {
      const cible = force === undefined ? !this.ouvert : force;
      this.bouton.setAttribute('aria-expanded', String(cible));
      this.panneau.hidden = !cible;
      if (cible && !this.verrouille) {
        this.verrouille = true;
        verrouillerDefilement();
      } else if (!cible && this.verrouille) {
        this.verrouille = false;
        deverrouillerDefilement();
      }
      if (cible) this.panneau.querySelector('a, button')?.focus();
      else this.bouton.focus();
    }
  }
  customElements.define('nav-mobile', NavMobile);

  /* ---------- Recherche predictive ----------
     Un seul tiroir dans le document, ouvert par n'importe quel lien
     [data-ouvrir-recherche] (desktop, mobile). Rien n'est envoye a Shopify
     tant que le visiteur n'a pas tape : la premiere frappe suffit a
     declencher l'appel a /search/suggest.json, avec un debounce pour ne
     pas spammer l'API a chaque caractere. Sans JS, les liens gardent leur
     href vers /search et fonctionnent normalement. */
  class RecherchePredictive extends HTMLElement {
    connectedCallback() {
      this.controleurEvenements?.abort();
      this.controleurEvenements = new AbortController();
      this.champ = this.querySelector('[data-champ-recherche]');
      this.zoneResultats = this.querySelector('[data-resultats-recherche]');
      this.urlSuggestions = this.dataset.urlSuggestions;
      this.urlRecherche = this.dataset.urlRecherche;
      this.libelleVide = this.dataset.libelleVide;
      this.libelleProduits = this.dataset.libelleProduits;
      this.libelleVoirTout = this.dataset.libelleVoirTout;
      this.controleur = null;
      this.minuteur = null;

      document.addEventListener('click', (e) => {
        const declencheur = e.target.closest('[data-ouvrir-recherche]');
        if (declencheur) {
          e.preventDefault();
          this.ouvrir(declencheur);
        }
      }, { signal: this.controleurEvenements.signal });
      this.querySelectorAll('[data-fermer-recherche]').forEach((el) =>
        el.addEventListener('click', () => this.fermer(), {
          signal: this.controleurEvenements.signal,
        })
      );
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.hidden) this.fermer();
      }, { signal: this.controleurEvenements.signal });
      this.champ?.addEventListener('input', () => this.planifier(), {
        signal: this.controleurEvenements.signal,
      });
    }

    disconnectedCallback() {
      this.controleurEvenements?.abort();
      this.controleur?.abort();
      clearTimeout(this.minuteur);
      if (this.verrouille) {
        this.verrouille = false;
        deverrouillerDefilement();
      }
    }

    ouvrir(declencheur) {
      this.declencheur = declencheur || null;
      this.hidden = false;
      if (!this.verrouille) {
        this.verrouille = true;
        verrouillerDefilement();
      }
      this.champ?.focus();
    }

    fermer() {
      this.hidden = true;
      if (this.verrouille) {
        this.verrouille = false;
        deverrouillerDefilement();
      }
      if (this.declencheur?.isConnected) this.declencheur.focus();
      this.declencheur = null;
    }

    planifier() {
      clearTimeout(this.minuteur);
      const terme = this.champ.value.trim();
      if (terme.length < 2) {
        this.zoneResultats.replaceChildren();
        return;
      }
      this.minuteur = setTimeout(() => this.chercher(terme), 220);
    }

    async chercher(terme) {
      this.controleur?.abort();
      this.controleur = new AbortController();

      const url = `${this.urlSuggestions}?q=${encodeURIComponent(terme)}` +
        '&resources[type]=product,collection,page' +
        '&resources[limit]=6' +
        '&resources[options][unavailable_products]=last';

      let donnees;
      try {
        const reponse = await fetch(url, { signal: this.controleur.signal });
        donnees = await reponse.json();
      } catch (e) {
        if (e.name === 'AbortError') return;
        return;
      }

      this.afficher(donnees?.resources?.results, terme);
    }

    afficher(resultats, terme) {
      this.zoneResultats.replaceChildren();
      if (!resultats) return;

      const produits = resultats.products || [];
      const collections = resultats.collections || [];
      const pages = resultats.pages || [];
      const total = produits.length + collections.length + pages.length;

      if (total === 0) {
        const vide = document.createElement('p');
        vide.className = 'rp-vide';
        vide.textContent = (this.libelleVide || '%s').replace('%s', terme);
        this.zoneResultats.append(vide);
        return;
      }

      if (produits.length) {
        const groupe = document.createElement('div');
        groupe.className = 'rp-groupe';

        const titre = document.createElement('p');
        titre.className = 'label label--fin rp-groupe__titre';
        titre.textContent = this.libelleProduits || '';
        groupe.append(titre);

        const grille = document.createElement('div');
        grille.className = 'rp-produits';
        for (const p of produits) grille.append(this.carteProduit(p));
        groupe.append(grille);
        this.zoneResultats.append(groupe);
      }

      if (collections.length || pages.length) {
        const groupe = document.createElement('div');
        groupe.className = 'rp-groupe rp-liens';
        for (const c of [...collections, ...pages]) {
          const a = document.createElement('a');
          a.className = 'lien-filet';
          a.href = c.url;
          a.textContent = c.title;
          groupe.append(a);
        }
        this.zoneResultats.append(groupe);
      }

      const voirTout = document.createElement('a');
      voirTout.className = 'label label--nav lien-filet rp-voir-tout';
      voirTout.href = `${this.urlRecherche}?q=${encodeURIComponent(terme)}`;
      voirTout.textContent = this.libelleVoirTout || '';
      this.zoneResultats.append(voirTout);
    }

    carteProduit(p) {
      const a = document.createElement('a');
      a.className = 'rp-produit';
      a.href = p.url;

      if (p.image) {
        const img = document.createElement('img');
        img.src = p.image;
        img.alt = '';
        img.loading = 'lazy';
        img.width = 200;
        img.height = 250;
        img.style.aspectRatio = '4 / 5';
        img.style.objectFit = 'cover';
        a.append(img);
      }

      const titre = document.createElement('span');
      titre.className = 'rp-produit__titre';
      titre.textContent = p.title;
      a.append(titre);

      if (p.price) {
        const prix = document.createElement('span');
        prix.className = 'rp-produit__prix';
        prix.textContent = p.price;
        a.append(prix);
      }

      return a;
    }
  }
  customElements.define('recherche-predictive', RecherchePredictive);

  /* ---------- Tiroir de panier ----------
     Le contenu est rendu cote serveur au chargement de la page (le panier
     est disponible partout en Liquid, pas seulement sur /cart). Le JS ne
     fait que : ouvrir/fermer le tiroir, et poster les changements de
     quantite vers /cart/change.js en redemandant la section "entete" pour
     rester synchronise avec le serveur, jamais recalculer un prix ici. */
  class PanierTiroir extends HTMLElement {
    connectedCallback() {
      this.controleurEvenements?.abort();
      this.controleurEvenements = new AbortController();
      this.enCours = false;

      document.addEventListener('click', (e) => {
        const declencheur = e.target.closest('[data-ouvrir-panier]');
        if (declencheur) {
          e.preventDefault();
          this.ouvrir(declencheur);
        }
      }, { signal: this.controleurEvenements.signal });
      // Pas de preventDefault ici : les liens "voir le panier" et
      // "continuer mes achats" doivent naviguer normalement.
      this.addEventListener('click', (e) => {
        if (e.target.closest('[data-fermer-panier]')) this.fermer();
      }, { signal: this.controleurEvenements.signal });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.hidden) this.fermer();
      }, { signal: this.controleurEvenements.signal });

      this.addEventListener('click', (e) => {
        const retirer = e.target.closest('[data-retirer-panier]');
        if (retirer) this.changerQuantite(retirer.dataset.index, 0);
      }, { signal: this.controleurEvenements.signal });

      // selecteur-quantite gere deja le clic sur +/- et redispatch un
      // 'change' sur l'input (bulle) : on n'a qu'a l'ecouter ici, pas
      // besoin de dupliquer la logique de pas.
      this.addEventListener('change', (e) => {
        const champ = e.target.closest('[data-quantite-panier] input');
        if (!champ) return;
        const groupe = champ.closest('[data-quantite-panier]');
        this.changerQuantite(groupe.dataset.index, champ.value);
      }, { signal: this.controleurEvenements.signal });
    }

    disconnectedCallback() {
      this.controleurEvenements?.abort();
      if (this.verrouille) {
        this.verrouille = false;
        deverrouillerDefilement();
      }
    }

    ouvrir(declencheur) {
      // ouvrir() est aussi rappele en interne apres un changement de
      // quantite (le noeud est remplace par rafraichirSections) : on ne
      // doit ecraser le declencheur d'origine que si un nouveau nous est
      // explicitement fourni, sinon le focus ne pourrait plus jamais y
      // retourner a la fermeture.
      if (declencheur) this.declencheur = declencheur;
      this.hidden = false;
      if (!this.verrouille) {
        this.verrouille = true;
        verrouillerDefilement();
      }
      // [data-fermer-panier] est aussi porte par le voile et les liens
      // "continuer mes achats" / "voir le panier" : cibler explicitement
      // le bouton de fermeture pour que le focus entre bien dans le
      // dialogue (un <div> n'est pas focusable, .focus() y echouerait
      // silencieusement).
      this.querySelector('[data-fermer-panier-focus]')?.focus();
    }

    fermer() {
      this.hidden = true;
      if (this.verrouille) {
        this.verrouille = false;
        deverrouillerDefilement();
      }
      if (this.declencheur?.isConnected) this.declencheur.focus();
      this.declencheur = null;
    }

    async changerQuantite(ligne, quantite) {
      if (this.enCours) return;
      this.enCours = true;
      this.setAttribute('aria-busy', 'true');

      try {
        const reponse = await fetch(config.routes.cart_change, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            line: Number(ligne),
            quantity: Number(quantite),
            sections: ['entete'],
            sections_url: window.location.pathname,
          }),
        });
        const resultat = await reponse.json();

        if (resultat.status) {
          annonce(resultat.description || resultat.message);
          return;
        }
        rafraichirSections(resultat.sections);
        document.dispatchEvent(new CustomEvent('panier:modifie'));
        // Meme remplacement de noeud que pour l'ajout : le nouveau tiroir
        // doit rester ouvert, l'ancien va disparaitre.
        document.querySelector('panier-tiroir')?.ouvrir();
      } catch {
        annonce(this.dataset.libelleErreur || 'Une erreur est survenue.');
      } finally {
        this.enCours = false;
      }
    }
  }
  customElements.define('panier-tiroir', PanierTiroir);

  /* ---------- Selecteur pays / region (carnet d'adresses) ----------
     Le select pays est rendu par Shopify (`country_option_tags`), chaque
     <option> porte ses regions dans data-provinces (JSON). On peuple le
     select region a partir de ca, et on le masque entierement pour les
     pays qui n'ont pas de decoupage regional dans Shopify. */
  class SelecteurPays extends HTMLElement {
    connectedCallback() {
      this.champPays = this.querySelector('select[name="address[country]"]');
      this.groupeRegion = this.querySelector('[data-groupe-region]');
      this.champRegion = this.querySelector('select[name="address[province]"]');
      if (!this.champPays || !this.champRegion) return;

      const paysDefaut = this.champPays.dataset.paysDefaut;
      if (paysDefaut) this.champPays.value = paysDefaut;

      this.peupler(this.champRegion.dataset.regionDefaut);
      this.champPays.addEventListener('change', () => this.peupler());
    }

    peupler(regionAConserver) {
      const option = this.champPays.selectedOptions[0];
      let regions = [];
      try {
        regions = JSON.parse(option?.dataset.provinces || '[]');
      } catch {
        regions = [];
      }

      this.champRegion.replaceChildren();

      if (!regions.length) {
        this.groupeRegion.hidden = true;
        return;
      }

      this.groupeRegion.hidden = false;
      for (const [nom] of regions) {
        const opt = document.createElement('option');
        opt.value = nom;
        opt.textContent = nom;
        if (nom === regionAConserver) opt.selected = true;
        this.champRegion.append(opt);
      }
    }
  }
  customElements.define('selecteur-pays', SelecteurPays);

  /* ---------- Consentement (Customer Privacy API de Shopify) ----------
     On ne charge aucun pixel tiers depuis le thème : les pixels passent
     par les Custom Pixels de Shopify, qui respectent nativement ce
     consentement. Ici on ne fait que capter le choix visiteur. */
  class BandeauConsentement extends HTMLElement {
    connectedCallback() {
      window.Shopify?.loadFeatures?.(
        [{ name: 'consent-tracking-api', version: '0.1' }],
        (erreur) => {
          if (erreur) return;
          const api = window.Shopify.customerPrivacy;
          if (api.shouldShowBanner?.()) this.hidden = false;
          this.addEventListener('click', (e) => {
            const choix = e.target.closest('[data-consentement]')?.dataset.consentement;
            if (!choix) return;
            const accepte = choix === 'accepter';
            api.setTrackingConsent(
              {
                analytics: accepte,
                marketing: accepte,
                preferences: accepte,
                sale_of_data: accepte,
              },
              () => { this.hidden = true; }
            );
          });
        }
      );
    }
  }
  customElements.define('bandeau-consentement', BandeauConsentement);
})();
