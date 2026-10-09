/* Assuravia : suivi des campagnes, formulaires en étapes, calculateurs. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var stockage = {
    lire: function (cle) { try { return window.sessionStorage.getItem(cle); } catch (e) { return null; } },
    ecrire: function (cle, val) { try { window.sessionStorage.setItem(cle, val); } catch (e) { /* stockage indisponible */ } }
  };

  // 1. Mémoriser la source de la visite (pub Google, etc.) pour la joindre au lead.
  var params = new URLSearchParams(window.location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "gclid"].forEach(function (cle) {
    var val = params.get(cle);
    if (val) stockage.ecrire("av_" + cle, val);
  });
  document.querySelectorAll("[data-champ]").forEach(function (champ) {
    var cle = champ.getAttribute("data-champ");
    champ.value = cle === "page" ? window.location.pathname : (stockage.lire("av_" + cle) || "");
  });

  var chf = function (n) {
    return "CHF " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  };

  // 2. Validation lisible : message sous le champ plutôt que la bulle du navigateur.
  function verifier(conteneur) {
    var ok = true, premier = null;
    conteneur.querySelectorAll("input, select, textarea").forEach(function (el) {
      if (el.type === "hidden" || el.closest("[hidden]")) return;
      var msg = el.parentElement.querySelector(".champ__erreur");
      if (el.checkValidity()) {
        el.removeAttribute("aria-invalid");
        if (msg) msg.remove();
        return;
      }
      ok = false;
      if (!premier) premier = el;
      el.setAttribute("aria-invalid", "true");
      if (!msg && el.type !== "checkbox") {
        msg = document.createElement("p");
        msg.className = "champ__erreur";
        msg.id = (el.id || el.name) + "-erreur";
        el.setAttribute("aria-describedby", msg.id);
        el.insertAdjacentElement("afterend", msg);
      }
      if (msg) {
        msg.textContent = el.validity.valueMissing ? "Ce champ est nécessaire pour préparer votre offre."
          : el.type === "email" ? "Vérifiez l'adresse e-mail, par exemple nom@exemple.ch."
          : el.type === "tel" ? "Indiquez un numéro de téléphone complet, par exemple 079 123 45 67."
          : "Vérifiez cette valeur.";
      }
    });
    if (premier) premier.focus();
    return ok;
  }

  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    form.noValidate = true;
    form.addEventListener("submit", function (e) {
      if (!verifier(form)) { e.preventDefault(); return; }
      var bouton = form.querySelector('button[type="submit"]');
      if (bouton) {
        bouton.setAttribute("aria-busy", "true");
        bouton.textContent = "Envoi en cours…";
        setTimeout(function () { bouton.disabled = true; }, 0);
      }
    });
    // Corriger un champ retire son message d'erreur
    form.addEventListener("change", function (e) {
      var el = e.target;
      if (el.getAttribute && el.getAttribute("aria-invalid") === "true" && el.checkValidity()) {
        el.removeAttribute("aria-invalid");
        var msg = el.parentElement.querySelector(".champ__erreur");
        if (msg) msg.remove();
      }
    });

    // Formulaires en étapes
    var etapes = form.querySelectorAll(".etape");
    if (etapes.length > 1) {
      etapes.forEach(function (et, i) { if (i > 0) et.hidden = true; });
      form.querySelectorAll("[data-suivant]").forEach(function (b) {
        b.addEventListener("click", function () {
          var courante = b.closest(".etape");
          if (!verifier(courante)) return;
          courante.hidden = true;
          var suivante = courante.nextElementSibling;
          suivante.hidden = false;
          var champ = suivante.querySelector("input:not([type=hidden]), select");
          if (champ) champ.focus();
          form.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      });
      form.querySelectorAll("[data-precedent]").forEach(function (b) {
        b.addEventListener("click", function () {
          var courante = b.closest(".etape");
          courante.hidden = true;
          courante.previousElementSibling.hidden = false;
        });
      });
    }
  });

  // 2b. Démarreur de demande (accueil) : filtre les besoins selon « pour qui », puis ouvre la bonne page
  var demarreur = document.querySelector("[data-demarreur]");
  if (demarreur) {
    var selectBesoin = demarreur.querySelector("select");
    var filtrer = function () {
      var pour = demarreur.querySelector('input[name="pour"]:checked').value;
      selectBesoin.querySelectorAll("optgroup").forEach(function (g) {
        var visible = g.getAttribute("data-groupe") === pour;
        g.hidden = !visible;
        g.disabled = !visible;
      });
      var opt = selectBesoin.selectedOptions[0];
      if (opt && opt.parentElement.disabled) selectBesoin.value = "";
    };
    demarreur.querySelectorAll('input[name="pour"]').forEach(function (r) { r.addEventListener("change", filtrer); });
    filtrer();
    demarreur.addEventListener("submit", function (e) {
      var opt = selectBesoin.selectedOptions[0];
      if (!selectBesoin.value) {
        e.preventDefault();
        verifier(demarreur);
        return;
      }
      e.preventDefault();
      window.location.href = opt.getAttribute("data-url");
    });
  }

  // 3. Formulaire général : produit présélectionné depuis l'URL (?produit=...)
  var choix = document.querySelector("[data-choix-produit]");
  if (choix) {
    var cache = choix.form.querySelector("[data-produit]");
    var blocEntreprise = choix.form.querySelector("[data-si-entreprise]");
    var majChoix = function () {
      cache.value = choix.value;
      var opt = choix.selectedOptions[0];
      var estEntreprise = opt && opt.parentElement.label === "Entreprises";
      blocEntreprise.hidden = !estEntreprise;
      blocEntreprise.querySelector("input").required = estEntreprise;
    };
    var demande = params.get("produit");
    if (demande && choix.querySelector('option[value="' + CSS.escape(demande) + '"]')) choix.value = demande;
    choix.addEventListener("change", majChoix);
    majChoix();
  }

  // 4. Simulateur 3e pilier
  // Taux marginaux indicatifs (impôt fédéral + cantonal + communal au chef-lieu, personne seule).
  var PALIERS = [30000, 50000, 75000, 100000, 125000, 150000, 200000, 250000];
  var TAUX = {
    GE: [20, 27, 32, 36, 38, 40, 43, 45],
    VD: [22, 29, 34, 37, 39, 41, 43, 45],
    NE: [22, 29, 33, 36, 38, 39, 41, 42],
    JU: [22, 28, 32, 35, 37, 38, 40, 41],
    FR: [19, 26, 31, 34, 36, 37, 39, 40],
    VS: [16, 23, 28, 31, 33, 35, 37, 38],
    BE: [21, 28, 32, 35, 37, 38, 40, 41]
  };
  var MAX_SALARIE = 7258, MAX_INDEPENDANT = 36288;

  function tauxMarginal(canton, revenuImposable) {
    var t = TAUX[canton] || TAUX.VD;
    if (revenuImposable <= PALIERS[0]) return t[0] * Math.max(revenuImposable, 0) / PALIERS[0];
    for (var i = 1; i < PALIERS.length; i++) {
      if (revenuImposable <= PALIERS[i]) {
        var r = (revenuImposable - PALIERS[i - 1]) / (PALIERS[i] - PALIERS[i - 1]);
        return t[i - 1] + r * (t[i] - t[i - 1]);
      }
    }
    return t[t.length - 1];
  }

  document.querySelectorAll("[data-simulateur]").forEach(function (sim) {
    var get = function (n) { return sim.querySelector('[data-sim="' + n + '"]'); };
    var sortie = function (n) { return sim.querySelector('[data-sim-sortie="' + n + '"]'); };
    var form = sim.nextElementSibling;
    var versementTouche = false;
    get("versement").addEventListener("input", function () { versementTouche = true; });

    function calculer() {
      var canton = get("canton").value;
      var couple = get("situation").value === "couple";
      var independant = get("statut").value === "independant";
      var revenu = Math.max(0, parseFloat(get("revenu").value) || 0);
      var plafond = independant ? Math.min(MAX_INDEPENDANT, revenu * 0.2) : MAX_SALARIE;
      sim.querySelector("[data-sim-plafond]").textContent = independant
        ? "Votre maximum 2026 : " + chf(plafond) + " (20 % du revenu net, au plus CHF 36'288)."
        : "Maximum 2026 : CHF 7'258.";
      if (!versementTouche) get("versement").value = Math.round(plafond);
      var versement = Math.min(Math.max(0, parseFloat(get("versement").value) || 0), plafond);
      // Revenu imposable approximatif : environ 15 % de déductions usuelles ; pour un couple, effet du barème commun.
      var imposable = revenu * 0.85 * (couple ? 0.62 : 1);
      var taux = tauxMarginal(canton, imposable) / 100;
      var economie = versement * taux;
      sortie("economie").textContent = chf(Math.round(economie / 10) * 10);
      sortie("detail").textContent = versement > 0
        ? "Pour un versement de " + chf(versement) + ", avec un taux marginal estimé d'environ " + Math.round(taux * 100) + " %."
        : "Indiquez un montant versé pour voir l'économie.";
      if (form) {
        var cache = function (n, v) { var el = form.querySelector('[data-sim-cache="' + n + '"]'); if (el) el.value = v; };
        cache("canton", canton); cache("situation", couple ? "couple" : "seul");
        cache("statut", independant ? "independant" : "salarie");
        cache("revenu", Math.round(revenu)); cache("versement", Math.round(versement));
        cache("economie", Math.round(economie));
      }
    }
    sim.addEventListener("input", calculer);
    sim.addEventListener("change", calculer);
    calculer();
  });

  // 5. Garantie de loyer
  document.querySelectorAll("[data-calcul-loyer]").forEach(function (bloc) {
    var loyer = bloc.querySelector('[data-gl="loyer"]');
    var form = bloc.nextElementSibling;
    var montant = form && form.querySelector('[data-gl="montant"]');
    var montantTouche = false;
    if (montant) montant.addEventListener("input", function () { montantTouche = true; });
    function calculer() {
      var l = Math.max(0, parseFloat(loyer.value) || 0);
      var depot = l * 3;
      bloc.querySelector('[data-gl-sortie="depot"]').textContent = chf(depot);
      bloc.querySelector('[data-gl-sortie="prime"]').textContent = chf(depot * 0.04);
      if (form) {
        form.querySelector('[data-gl-cache="loyer"]').value = Math.round(l);
        if (montant && !montantTouche) montant.value = Math.round(depot);
      }
    }
    loyer.addEventListener("input", calculer);
    calculer();
  });
  // 6. Menu principal : Privé et Pro mènent à leur page, la flèche ouvre la liste des produits
  var sousMenus = document.querySelectorAll("[data-sous-menu]");
  var fermerSousMenu = function (m) {
    m.classList.remove("ouvert");
    m.querySelector("[data-sous-menu-bascule]").setAttribute("aria-expanded", "false");
  };
  sousMenus.forEach(function (m) {
    var bascule = m.querySelector("[data-sous-menu-bascule]");
    bascule.addEventListener("click", function () {
      var ouvrir = !m.classList.contains("ouvert");
      sousMenus.forEach(fermerSousMenu);
      if (ouvrir) { m.classList.add("ouvert"); bascule.setAttribute("aria-expanded", "true"); }
    });
  });
  document.addEventListener("click", function (e) {
    sousMenus.forEach(function (m) { if (m.classList.contains("ouvert") && !m.contains(e.target) && window.matchMedia("(min-width: 1081px)").matches) fermerSousMenu(m); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    sousMenus.forEach(function (m) {
      if (m.classList.contains("ouvert")) { fermerSousMenu(m); m.querySelector("[data-sous-menu-bascule]").focus(); }
    });
    var nav = document.getElementById("navigation");
    var bouton = document.querySelector("[data-menu-bouton]");
    if (nav && nav.classList.contains("nav--ouverte")) { nav.classList.remove("nav--ouverte"); bouton.setAttribute("aria-expanded", "false"); bouton.focus(); }
  });
  var boutonMenu = document.querySelector("[data-menu-bouton]");
  if (boutonMenu) {
    boutonMenu.addEventListener("click", function () {
      var nav = document.getElementById("navigation");
      var ouvert = nav.classList.toggle("nav--ouverte");
      boutonMenu.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });
  }

  // 7. Catalogue : filtres par catégorie
  document.querySelectorAll("[data-catalogue]").forEach(function (cat) {
    var boutons = cat.querySelectorAll("[data-filtre]");
    var cartes = cat.querySelectorAll("[data-categorie]");
    var statut = cat.querySelector("[data-catalogue-statut]");
    boutons.forEach(function (b) {
      b.addEventListener("click", function () {
        var choix = b.getAttribute("data-filtre");
        boutons.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        var n = 0;
        cartes.forEach(function (c) {
          var visible = !choix || c.getAttribute("data-categorie") === choix;
          c.hidden = !visible;
          if (visible) n++;
        });
        if (statut) statut.textContent = n + " assurance" + (n > 1 ? "s" : "") + " affichée" + (n > 1 ? "s" : "");
      });
    });
  });

  // 7b. Glossaire : filtre par domaine
  document.querySelectorAll("[data-glossaire]").forEach(function (g) {
    var boutons = g.querySelectorAll("[data-filtre-glossaire]");
    boutons.forEach(function (b) {
      b.addEventListener("click", function () {
        var choix = b.getAttribute("data-filtre-glossaire");
        boutons.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        g.querySelectorAll("[data-categorie-glossaire]").forEach(function (t) {
          t.hidden = !!choix && t.getAttribute("data-categorie-glossaire") !== choix;
        });
        g.querySelectorAll(".glossaire__lettre").forEach(function (sec) {
          sec.hidden = !sec.querySelector("[data-categorie-glossaire]:not([hidden])");
        });
      });
    });
  });

  // 9. Exemples de bilan : onglets Particulier / Professionnel
  document.querySelectorAll("[data-onglets]").forEach(function (zone) {
    var onglets = zone.querySelectorAll("[data-onglet]");
    var activer = function (o, focus) {
      onglets.forEach(function (x) {
        var actif = x === o;
        x.setAttribute("aria-selected", actif ? "true" : "false");
        x.tabIndex = actif ? 0 : -1;
        document.getElementById(x.getAttribute("aria-controls")).hidden = !actif;
      });
      if (focus) o.focus();
    };
    onglets.forEach(function (o, n) {
      o.addEventListener("click", function () { activer(o, false); });
      o.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          activer(onglets[(n + (e.key === "ArrowRight" ? 1 : onglets.length - 1)) % onglets.length], true);
        }
      });
    });
  });

  // 10. Contact volant : WhatsApp et message rapide
  var volant = document.querySelector("[data-contact-volant]");
  if (volant) {
    var boutonVolant = volant.querySelector("[data-contact-volant-bouton]");
    var panneau = document.getElementById("contact-volant");
    var basculer = function (ouvrir) {
      panneau.hidden = !ouvrir;
      boutonVolant.setAttribute("aria-expanded", ouvrir ? "true" : "false");
      if (ouvrir) { var champ = panneau.querySelector("a, input"); if (champ) champ.focus(); } else { boutonVolant.focus(); }
    };
    boutonVolant.addEventListener("click", function () { basculer(panneau.hidden); });
    volant.querySelector("[data-contact-volant-fermer]").addEventListener("click", function () { basculer(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panneau.hidden) basculer(false); });
  }

  // 8. Page de remerciement : message adapté au formulaire envoyé
  if (params.get("f") === "contact" || params.get("f") === "contact-rapide") {
    var titre = document.querySelector(".merci h1");
    var texte = document.querySelector(".merci .chapeau");
    if (titre) titre.textContent = "Message envoyé";
    if (texte) texte.textContent = "Merci. Nous vous répondons par e-mail dans les meilleurs délais.";
  }
})();
