/* ============================================================
   MAISON : JS du thème
   Contraintes : aucun framework, aucune dépendance externe,
   budget ~8 Ko non compressé. Tout est en Web Components natifs
   pour que le rendu de section (Section Rendering API) puisse
   remplacer du HTML sans réinitialisation manuelle.
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
          this.rafraichirSections(resultat.sections);
          annonce(this.dataset.libelleAjoute || 'Ajouté au panier');
          document.dispatchEvent(new CustomEvent('panier:modifie'));
        }
      } catch {
        this.afficherErreur(this.dataset.libelleErreur || 'Une erreur est survenue.');
      } finally {
        this.bouton.removeAttribute('aria-disabled');
        this.bouton.textContent = this.bouton.dataset.libelleInitial;
      }
    }

    rafraichirSections(sections) {
      if (!sections) return;
      Object.entries(sections).forEach(([id, html]) => {
        const source = new DOMParser()
          .parseFromString(html, 'text/html')
          .querySelector(`#shopify-section-${id}, [data-section="${id}"]`);
        const cible = document.querySelector(`#shopify-section-${id}, [data-section="${id}"]`);
        if (source && cible) cible.replaceWith(source);
      });
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

      const url = new URL(window.location);
      url.searchParams.set('variant', variante.id);
      window.history.replaceState({}, '', url);

      const reponse = await fetch(`${url.pathname}?variant=${variante.id}&section_id=${this.dataset.section}`);
      const html = new DOMParser().parseFromString(await reponse.text(), 'text/html');

      ['[data-prix]', '[data-bouton-achat]', '[data-disponibilite]'].forEach((sel) => {
        const src = html.querySelector(sel);
        const dst = document.querySelector(sel);
        if (src && dst) dst.innerHTML = src.innerHTML;
      });
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
      this.bouton = this.querySelector('[data-ouvrir]');
      this.panneau = this.querySelector('[data-panneau]');
      this.bouton?.addEventListener('click', () => this.basculer());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.ouvert) this.basculer(false);
      });
    }

    get ouvert() {
      return this.bouton?.getAttribute('aria-expanded') === 'true';
    }

    basculer(force) {
      const cible = force === undefined ? !this.ouvert : force;
      this.bouton.setAttribute('aria-expanded', String(cible));
      this.panneau.hidden = !cible;
      document.documentElement.style.overflow = cible ? 'hidden' : '';
      if (cible) this.panneau.querySelector('a, button')?.focus();
      else this.bouton.focus();
    }
  }
  customElements.define('nav-mobile', NavMobile);

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
