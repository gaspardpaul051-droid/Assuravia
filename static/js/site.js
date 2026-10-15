/* Assuravia : suivi des campagnes, formulaires en étapes, calculateurs. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  // 0. Une nouvelle page s'ouvre toujours en haut (sauf ancre ou retour arrière).
  //    scrollIntoView remonte aussi la page qui contient le site quand il est affiché dans un cadre (aperçu).
  var allerEnHaut = function () {
    if (window.location.hash) return;
    window.scrollTo(0, 0);
    try { document.documentElement.scrollIntoView({ block: "start", behavior: "instant" }); } catch (e) { document.documentElement.scrollIntoView(true); }
  };
  try {
    var nav0 = performance.getEntriesByType("navigation")[0];
    if (!nav0 || nav0.type !== "back_forward") {
      allerEnHaut();
      document.addEventListener("DOMContentLoaded", allerEnHaut);
      window.addEventListener("load", allerEnHaut);
    }
  } catch (e) { /* navigateur ancien */ }

  // 0a. Confettis aux couleurs de la marque (fin de formulaire, prime affichée)
  var lancerConfettis = function (duree) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var c = document.createElement("canvas"), ctx = c.getContext("2d");
    c.className = "confettis"; c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    var dpr = window.devicePixelRatio || 1;
    var taille = function () { c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    taille();
    var couleurs = ["#1565A8", "#3A9AE0", "#C9A227", "#E2BE52", "#0B2545", "#2E9E5B", "#FFFFFF"];
    var parts = [];
    for (var k = 0; k < 160; k++) {
      var gauche = k % 2 === 0;
      parts.push({ x: gauche ? -10 : innerWidth + 10, y: innerHeight * (0.55 + Math.random() * 0.3),
        vx: (gauche ? 1 : -1) * (6 + Math.random() * 9), vy: -(10 + Math.random() * 12),
        r: 4 + Math.random() * 6, a: Math.random() * 6.28, va: -0.2 + Math.random() * 0.4,
        c: couleurs[k % couleurs.length], forme: k % 3 });
    }
    var t0 = performance.now(), fin = duree || 3200;
    var pas = function (t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(function (p) {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - (t - t0) / fin);
        if (p.forme === 0) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        else if (p.forme === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, 6.28); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r, p.r); ctx.lineTo(-p.r, p.r); ctx.fill(); }
        ctx.restore();
      });
      if (t - t0 < fin) requestAnimationFrame(pas); else c.remove();
    };
    requestAnimationFrame(pas);
  };
  if (document.querySelector("[data-celebration]")) setTimeout(function () { lancerConfettis(3600); }, 350);

  // 0b. Apparition douce des blocs au défilement
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var aAnimer = document.querySelectorAll(".bloc__entete, .carte, .domaine, .cas, .atouts > div, .etapes > li, .obligations li, .retenir, .encart, .pour-qui, .quiz, .encadre, .texte-long table, .faq details, .checkup, .illu-questions, .article-carte");
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (en) {
        if (en.isIntersecting) {
          var el = en.target;
          el.classList.add("vu"); obs.unobserve(el);
          setTimeout(function () { el.classList.remove("apparait", "vu"); el.style.transitionDelay = ""; }, 900);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    aAnimer.forEach(function (el, n) {
      if (el.getBoundingClientRect().top < window.innerHeight) return; // déjà visible : pas d'effet
      el.classList.add("apparait");
      el.style.transitionDelay = ((n % 3) * 80) + "ms";
      obs.observe(el);
    });
  }

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
  // E-mail : nom@domaine.ch (extension d'au moins 2 lettres). Téléphone : 0XX XXX XX XX ou +41 / 0041, +33…
  var RE_EMAIL = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
  // Numéro saisi sans indicatif (l'indicatif est choisi dans la liste), ou avec +.. / 00.. qui prime.
  var telValide = function (v, indicatif) {
    var n = v.replace(/[\s.\-()\/]/g, "");
    if (/^(\+|00)41/.test(n)) return /^(\+|00)41[1-9]\d{8}$/.test(n);   // +41 79 123 45 67
    if (/^(\+|00)/.test(n)) return /^(\+|00)[1-9]\d{7,13}$/.test(n);    // autre pays saisi en entier
    if ((indicatif || "+41") === "+41") return /^0?[1-9]\d{8}$/.test(n);  // 079 123 45 67 ou 79 123 45 67
    return /^0?\d{4,14}$/.test(n);                                          // numéro national d'un autre pays
  };
  var telComplet = function (bloc) {
    var ind = bloc.querySelector("[data-tel-indicatif]").value;
    var n = bloc.querySelector("[data-tel-numero]").value.replace(/[\s.\-()\/]/g, "");
    if (!n) return "";
    if (/^(\+|00)/.test(n)) return n.replace(/^00/, "+");
    return ind + n.replace(/^0/, "");
  };
  function controleFormat(el) {
    if (!el.setCustomValidity) return;
    var v = (el.value || "").trim();
    var erreur = "";
    if (v && el.type === "email" && !RE_EMAIL.test(v)) erreur = "email";
    if (v && el.type === "tel") {
      var bloc = el.closest("[data-tel]");
      var ind = bloc ? bloc.querySelector("[data-tel-indicatif]").value : "+41";
      if (!telValide(v, ind)) erreur = "tel";
      if (bloc) bloc.querySelector("[data-tel-complet]").value = telComplet(bloc);
    }
    el.setCustomValidity(erreur);
  }

  function verifier(conteneur) {
    var ok = true, premier = null;
    conteneur.querySelectorAll("input, select, textarea").forEach(function (el) {
      if (el.type === "hidden" || el.closest("[hidden]")) return;
      controleFormat(el);
      var groupeRadio = el.type === "radio" ? el.closest(".choix-cartes, .formules") : null;
      var msg;
      if (groupeRadio) { var suivant = groupeRadio.nextElementSibling; msg = suivant && suivant.classList.contains("champ__erreur") ? suivant : null; }
      else { var zoneMsg = el.type === "radio" ? (el.closest("fieldset") || el.parentElement) : (el.closest(".champ") || el.parentElement); msg = zoneMsg.querySelector(".champ__erreur"); }
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
        (el.closest("[data-tel]") || (el.type === "radio" ? el.closest(".choix-cartes, .formules") : null) || el).insertAdjacentElement("afterend", msg);
      }
      if (msg) {
        msg.textContent = el.validity.valueMissing && el.hasAttribute("data-adresse-recherche") ? "Choisissez votre adresse dans la liste, ou saisissez-la à la main."
          : el.validity.valueMissing && el.type === "radio" ? "Choisissez une réponse pour continuer."
          : el.validity.valueMissing ? "Ce champ est nécessaire pour préparer votre offre."
          : el.type === "email" ? "Adresse e-mail non valide. Exemple : jean.dupont@gmail.com"
          : el.type === "tel" ? "Numéro non valide. Choisissez l'indicatif du pays, puis le numéro, par exemple 79 123 45 67."
          : (el.validity.rangeUnderflow || el.validity.rangeOverflow || el.validity.badInput) && (el.type === "date" || el.type === "number") && el.min && el.max
            ? (/naissance/.test(el.name)
                ? "Indiquez " + (el.type === "date" ? "une date de naissance" : "une année") + " entre " + el.min.slice(0, 4) + " et " + el.max.slice(0, 4) + "."
                : el.type === "date"
                  ? "Indiquez une date entre le " + el.min.split("-").reverse().join(".") + " et le " + el.max.split("-").reverse().join(".") + "."
                  : "Indiquez une valeur entre " + el.min + " et " + el.max + ".")
          : "Vérifiez cette valeur.";
      }
    });
    // Groupes de cases à cocher : au moins une case (data-groupe-requis="nom")
    var groupes = {};
    conteneur.querySelectorAll("[data-groupe-requis]").forEach(function (c) { if (!c.closest("[hidden]")) groupes[c.getAttribute("data-groupe-requis")] = true; });
    Object.keys(groupes).forEach(function (g) {
      var cases = conteneur.querySelectorAll('[data-groupe-requis="' + g + '"]');
      var zone = cases[0].closest(".choix-cartes, .formules, .volet, .sante__niveaux") || cases[0].parentElement;
      var msg = zone.nextElementSibling && zone.nextElementSibling.classList.contains("champ__erreur") ? zone.nextElementSibling : null;
      var coche = Array.prototype.some.call(cases, function (c) { return c.checked; });
      if (coche) { if (msg) msg.remove(); return; }
      ok = false;
      if (!premier) premier = cases[0];
      if (!msg) { msg = document.createElement("p"); msg.className = "champ__erreur"; zone.insertAdjacentElement("afterend", msg); }
      msg.textContent = "Cochez au moins une réponse pour continuer.";
    });
    if (premier) premier.focus();
    return ok;
  }

  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    form.noValidate = true;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!verifier(form)) return;
      // Envoi en arrière-plan à Netlify Forms, puis page de remerciement
      var bouton = e.submitter || form.querySelector('button[type="submit"]');
      var texte = bouton ? bouton.textContent : "";
      if (bouton) { bouton.setAttribute("aria-busy", "true"); bouton.textContent = "Envoi en cours…"; bouton.disabled = true; }
      var ancienne = form.querySelector(".envoi-erreur"); if (ancienne) ancienne.remove();
      var donnees = new URLSearchParams(new FormData(form));
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: donnees.toString() })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          window.location.href = form.action;
        })
        .catch(function () {
          if (bouton) { bouton.disabled = false; bouton.removeAttribute("aria-busy"); bouton.textContent = texte; }
          var msg = document.createElement("p");
          msg.className = "envoi-erreur";
          msg.setAttribute("role", "alert");
          msg.innerHTML = "L'envoi n'a pas fonctionné. Réessayez dans un instant, ou écrivez-nous sur <a href=\"https://wa.me/41782653473\" target=\"_blank\" rel=\"noopener\">WhatsApp</a> ou à <a href=\"mailto:info@assuravia.ch\">info@assuravia.ch</a>.";
          (bouton || form.lastElementChild).insertAdjacentElement("afterend", msg);
        });
    });
    // Corriger un champ retire son message d'erreur
    form.addEventListener("change", function (e) {
      var el = e.target;
      controleFormat(el);
      if (el.getAttribute && el.getAttribute("aria-invalid") === "true" && el.checkValidity()) {
        el.removeAttribute("aria-invalid");
        var msg = (el.closest(".champ") || el.parentElement).querySelector(".champ__erreur");
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

  // 2a. Téléphone : exemple adapté à l'indicatif choisi
  document.querySelectorAll("[data-tel]").forEach(function (bloc) {
    var ind = bloc.querySelector("[data-tel-indicatif]"), num = bloc.querySelector("[data-tel-numero]");
    var maj = function () {
      num.placeholder = ind.value === "+41" ? "79 123 45 67" : "Numéro sans l'indicatif";
      bloc.querySelector("[data-tel-complet]").value = telComplet(bloc);
    };
    ind.addEventListener("change", function () { maj(); if (num.value) controleFormat(num); });
    num.addEventListener("input", maj);
  });

  // 2a bis. Mesure : une demande envoyée compte comme « generate_lead » dans Google Analytics (si accepté)
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (f.matches && f.matches("form[data-lead]") && typeof window.gtag === "function") {
      window.gtag("event", "generate_lead", { form_name: f.getAttribute("name"), page_path: location.pathname });
      // Événement clé déjà déclaré dans Google Analytics (repris de l'ancien site) : alimente la conversion Google Ads existante
      window.gtag("event", "demande_confirmee", { form_name: f.getAttribute("name"), page_path: location.pathname });
      if (window.ADS_CONV) window.gtag("event", "conversion", { send_to: window.ADS_CONV });
    }
  }, true);

  // 2b. Téléphone : liste des pays avec drapeaux (le select reste en place pour l'envoi et le repli sans JS)
  var lienCss = document.querySelector('link[href$="css/site.css"]');
  var baseDrapeaux = lienCss ? lienCss.getAttribute("href").replace(/css\/site\.css.*$/, "") + "drapeaux/" : "/drapeaux/";
  var drapeau = function (iso) {
    return iso ? '<img class="tel__drapeau" src="' + baseDrapeaux + iso + '.svg" alt="" width="24" height="18" loading="lazy">' : '<span class="tel__drapeau tel__drapeau--vide"></span>';
  };
  var sansAccent = function (s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
  document.querySelectorAll("[data-tel]").forEach(function (bloc, n) {
    var sel = bloc.querySelector("[data-tel-indicatif]");
    if (!sel) return;
    bloc.classList.add("tel--drapeaux");
    var bouton = document.createElement("button");
    bouton.type = "button"; bouton.className = "tel__pays";
    bouton.setAttribute("aria-haspopup", "listbox"); bouton.setAttribute("aria-expanded", "false");
    var panneau = document.createElement("div");
    panneau.className = "tel__liste"; panneau.hidden = true;
    var html = '<input type="search" class="tel__recherche" placeholder="Rechercher un pays" aria-label="Rechercher un pays" autocomplete="off"><ul role="listbox" aria-label="Indicatif du pays">';
    Array.prototype.forEach.call(sel.querySelectorAll("optgroup"), function (g, gi) {
      html += '<li class="tel__groupe" role="presentation">' + g.label + "</li>";
      Array.prototype.forEach.call(g.querySelectorAll("option"), function (o) {
        var i = Array.prototype.indexOf.call(sel.options, o);
        var pays = o.textContent.replace(/^\+\d+\s*/, "");
        html += '<li role="option" tabindex="-1" data-g="' + gi + '" data-i="' + i + '" data-cherche="' + sansAccent(pays + " " + o.value) + '">' + drapeau(o.getAttribute("data-iso")) + '<span class="tel__nom">' + pays + '</span><span class="tel__code">' + o.value + "</span></li>";
      });
    });
    panneau.innerHTML = html + "</ul>";
    sel.insertAdjacentElement("afterend", bouton);
    bouton.insertAdjacentElement("afterend", panneau);
    var recherche = panneau.querySelector(".tel__recherche");
    var afficher = function () {
      var o = sel.options[sel.selectedIndex];
      bouton.innerHTML = drapeau(o.getAttribute("data-iso")) + '<span class="tel__code">' + o.value + '</span><svg class="tel__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      bouton.setAttribute("aria-label", "Indicatif : " + o.textContent);
    };
    var fermer = function (focus) {
      panneau.hidden = true; bouton.setAttribute("aria-expanded", "false");
      if (focus) bouton.focus();
    };
    var ouvrir = function () {
      panneau.hidden = false; bouton.setAttribute("aria-expanded", "true");
      recherche.value = ""; filtrer();
      var actif = panneau.querySelector('[data-i="' + sel.selectedIndex + '"]');
      panneau.querySelectorAll('[aria-selected]').forEach(function (x) { x.removeAttribute("aria-selected"); });
      if (actif) { actif.setAttribute("aria-selected", "true"); actif.scrollIntoView({ block: "nearest" }); }
      recherche.focus();
    };
    var filtrer = function () {
      var q = sansAccent(recherche.value.trim());
      panneau.querySelectorAll("[role=option]").forEach(function (li) { li.hidden = q && (li.getAttribute("data-g") === "0" || li.getAttribute("data-cherche").indexOf(q) < 0); });
      panneau.querySelectorAll(".tel__groupe").forEach(function (li) { li.hidden = !!q; });
    };
    var choisir = function (li) {
      sel.selectedIndex = Number(li.getAttribute("data-i"));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      afficher(); fermer(false);
      var num = bloc.querySelector("[data-tel-numero]"); if (num) num.focus();
    };
    bouton.addEventListener("click", function () { panneau.hidden ? ouvrir() : fermer(true); });
    recherche.addEventListener("input", filtrer);
    panneau.addEventListener("click", function (e) { var li = e.target.closest("[role=option]"); if (li) choisir(li); });
    panneau.addEventListener("keydown", function (e) {
      var vis = Array.prototype.filter.call(panneau.querySelectorAll("[role=option]"), function (x) { return !x.hidden; });
      var pos = vis.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); (vis[pos + 1] || vis[0]).focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (pos <= 0) recherche.focus(); else vis[pos - 1].focus(); }
      else if (e.key === "Enter") { e.preventDefault(); if (pos >= 0) choisir(vis[pos]); else if (vis.length) choisir(vis[0]); }
      else if (e.key === "Escape") { e.preventDefault(); fermer(true); }
    });
    document.addEventListener("click", function (e) { if (!panneau.hidden && !bloc.contains(e.target)) fermer(false); });
    sel.addEventListener("change", afficher);
    afficher();
  });

  // 2c. Avancée en pourcentage des formulaires d'une seule page (les simulations ont la leur)
  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    if (form.closest("[data-funnel]")) return;
    var bloc = document.createElement("div");
    bloc.className = "avancee";
    bloc.innerHTML = '<div class="avancee__texte"><span data-avancee-libelle>Votre demande</span><strong class="avancee__pct" data-avancee-pct>0 %</strong></div>' +
      '<div class="avancee__barre" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="Avancée du formulaire"><span></span></div>';
    var premier = form.querySelector(":scope > :not([type=hidden]):not(.cache)");
    form.insertBefore(bloc, premier);
    var pctEl = bloc.querySelector("[data-avancee-pct]"), barre = bloc.querySelector(".avancee__barre"), libelle = bloc.querySelector("[data-avancee-libelle]");
    var rempli = function (el) {
      if (el.type === "radio" || el.type === "checkbox") return !!form.querySelector('[name="' + el.name + '"]:checked');
      if (!el.value.trim()) return false;
      if (el.matches("[data-tel-numero]")) { var b = el.closest("[data-tel]"); return telValide(el.value, b ? b.querySelector("[data-tel-indicatif]").value : "+41"); }
      return el.checkValidity();
    };
    var maj = function () {
      var vus = {}, total = 0, ok = 0;
      form.querySelectorAll("input[required], select[required], textarea[required]").forEach(function (el) {
        if (el.disabled || el.type === "hidden" || el.closest("[hidden]:not([data-etape]), template, .cache")) return;
        var cle = (el.type === "radio" || el.type === "checkbox") ? "n:" + el.name : el;
        if (typeof cle === "string") { if (vus[cle]) return; vus[cle] = 1; }
        total++; if (rempli(el)) ok++;
      });
      var pct = total ? Math.round(ok / total * 100) : 0;
      pctEl.textContent = pct + " %";
      barre.firstChild.style.width = pct + "%";
      barre.setAttribute("aria-valuenow", pct);
      libelle.textContent = pct === 100 ? "Tout est prêt, il ne reste qu'à envoyer" : pct >= 50 ? "Plus que quelques champs" : "Votre demande";
      bloc.classList.toggle("avancee--complet", pct === 100);
    };
    form.addEventListener("input", maj);
    form.addEventListener("change", maj);
    document.addEventListener("click", function () { setTimeout(maj, 0); });
    maj();
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

  // 4b. Simulateur de capital 3e pilier
  var cap = document.querySelector("[data-capital]");
  if (cap) {
    var capVal = function (k) { return Number(cap.querySelector('[data-cap="' + k + '"]').value) || 0; };
    var capSortie = function (k) { return cap.querySelector('[data-cap-sortie="' + k + '"]'); };
    var anim = {};
    var compter = function (el, cible) {
      var depart = Number(el.getAttribute("data-val")) || 0, t0 = null, cle = el.dataset.cle;
      cancelAnimationFrame(anim[cle]);
      var pas = function (t) {
        if (!t0) t0 = t;
        var k = Math.min((t - t0) / 500, 1);
        el.textContent = chf(depart + (cible - depart) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) anim[cle] = requestAnimationFrame(pas);
      };
      el.setAttribute("data-val", cible);
      anim[cle] = requestAnimationFrame(pas);
    };
    var majCapital = function () {
      var age = capVal("age"), v = capVal("versement"), c0 = capVal("depart");
      var annees = Math.max(65 - age, 1);
      capSortie("age").textContent = age + " ans";
      capSortie("versement").textContent = chf(v);
      capSortie("depart").textContent = chf(c0);
      var lignes = cap.querySelectorAll("[data-profil]"), resultats = [];
      lignes.forEach(function (li) {
        var r = Number(li.getAttribute("data-profil")), k = c0;
        for (var n = 0; n < annees; n++) k = (k + v) * (1 + r);
        resultats.push(k);
      });
      var max = Math.max.apply(null, resultats);
      lignes.forEach(function (li, n) {
        li.querySelector(".capital__barre span").style.width = (resultats[n] / max * 100) + "%";
        var s = li.querySelector("strong"); s.dataset.cle = "c" + n; compter(s, resultats[n]);
      });
      var verse = c0 + v * annees;
      capSortie("verse").innerHTML = "Vous aurez versé <strong>" + chf(verse) + "</strong> en " + annees + " ans.";
      capSortie("ecart").innerHTML = "Écart entre le compte épargne et la profil dynamique : <strong>" + chf(resultats[3] - resultats[0]) + "</strong>, dans cette hypothèse.";
    };
    cap.querySelectorAll("[data-cap]").forEach(function (el) { el.addEventListener("input", majCapital); });
    majCapital();
  }

  // Prime mensuelle indicative d'une complémentaire maladie (grille content/complementaires.json)
  var prixLca = function (T, cle, p) {
    var m = T.modules[cle];
    var age = p.annee > 1900 ? T.annee - p.annee : 35, f = 1;
    T.courbes[m.courbe].forEach(function (b) { if (age >= b[0] && age <= b[1]) f = b[2]; });
    var fem = T.femme[m.courbe];
    if (p.sexe === "Femme" && fem && age >= fem[0] && age <= fem[1]) f *= fem[2];
    f *= T.cantons[p.canton] || 1;
    if (m.famille === "Ambulatoire" && T.niveaux_amb) f *= T.niveaux_amb[p.niveau] || 1;
    return Math.round(m.base * f * 20) / 20;
  };

  // 4f. Simulateur global des complémentaires (page Privé) : prime en direct
  var sante = document.querySelector("[data-sante]");
  if (sante) {
    var G = JSON.parse(sante.querySelector("[data-sante-grille]").textContent);
    var chfS = function (x) { return "CHF " + x.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'"); };
    var elTotal = sante.querySelector("[data-sante-total]"), affiche = 0, anim = null;
    var COULEURS = { hop: "#1565A8", amb: "#3A9AE0", dent: "#E2BE52", ij: "#9CC9EE", pj_sante: "#8798AE" };
    var majSante = function () {
      var profil = {
        annee: Number(sante.querySelector('[data-sante-champ="annee"]').value),
        canton: sante.querySelector('[data-sante-champ="canton"]').value,
        sexe: (sante.querySelector('[data-sante-champ="sexe"]:checked') || {}).value
      };
      var choix = [];
      profil.niveau = (sante.querySelector('[name="sante-niveau"]:checked') || {}).value || "Standard";
      ["hop", "dent", "ij"].forEach(function (fam) {
        var r = sante.querySelector('[name="sante-' + fam + '"]:checked');
        sante.querySelector('[data-sante-famille="' + fam + '"]').classList.toggle("sante__famille--active", !!(r && r.value));
        if (r && r.value) choix.push({ cle: r.value, fam: fam });
      });
      var amb = sante.querySelectorAll("[data-sante-amb]:checked");
      sante.querySelector('[data-sante-famille="amb"]').classList.toggle("sante__famille--active", amb.length > 0);
      amb.forEach(function (x) { choix.push({ cle: x.value, fam: "amb" }); });
      sante.querySelectorAll("[data-sante-extra]:checked").forEach(function (x) { choix.push({ cle: x.value, fam: x.value }); });
      choix.forEach(function (c) { c.mois = prixLca(G, c.cle, profil); });
      var total = choix.reduce(function (t, c) { return t + c.mois; }, 0);
      // Compteur animé vers le nouveau total
      var depart = affiche, t0 = null;
      if (anim) cancelAnimationFrame(anim);
      var pas = function (t) {
        if (!t0) t0 = t;
        var k = Math.min((t - t0) / 450, 1);
        affiche = depart + (total - depart) * (1 - Math.pow(1 - k, 3));
        elTotal.textContent = chfS(affiche);
        if (k < 1) anim = requestAnimationFrame(pas);
      };
      anim = requestAnimationFrame(pas);
      var champAn = sante.querySelector('[data-sante-champ="annee"]');
      var anOk = champAn.checkValidity() && profil.annee > 0;
      champAn.setAttribute("aria-invalid", String(!anOk));
      sante.querySelector("[data-sante-an]").textContent = !anOk ? "Indiquez une année de naissance entre " + champAn.min + " et " + champAn.max + "."
        : total ? "soit environ CHF " + Math.round(total * 12).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'") + " par an" : "Choisissez au moins une couverture.";
      sante.querySelector("[data-sante-barre]").innerHTML = choix.map(function (c) {
        return '<span style="flex:' + c.mois + ";background:" + COULEURS[c.fam] + '" title="' + G.modules[c.cle].nom + '"></span>';
      }).join("");
      var lignes = choix.map(function (c) {
        return '<li><span><i style="background:' + COULEURS[c.fam] + '"></i>' + G.modules[c.cle].nom + "</span><strong>" + chfS(c.mois) + "</strong></li>";
      }).join("");
      sante.querySelector("[data-sante-detail]").innerHTML = lignes;
      document.querySelectorAll("[data-sante-prestations]").forEach(function (zone) {
        zone.innerHTML = choix.length ? choix.map(function (c) {
          var m = G.modules[c.cle];
          return '<article class="sante__prestation" style="--teinte:' + COULEURS[c.fam] + '"><h4>' + m.nom + '</h4><ul>' + (m.details || m.points).map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></article>";
        }).join("") : "<p>Choisissez au moins une couverture pour voir les prestations.</p>";
      });
      // Résumé envoyé avec la demande de rappel
      var res = function (k, v) { var el = document.querySelector('[data-sante-resume="' + k + '"]'); if (el) el.value = v; };
      res("couverture", choix.map(function (c) { return G.modules[c.cle].nom + " (" + chfS(c.mois) + "/mois)"; }).join(" + "));
      res("prime", total.toFixed(2));
      res("profil", "Né(e) en " + (profil.annee || "?") + ", " + (profil.sexe || "") + ", canton " + profil.canton + ", niveau ambulatoire " + profil.niveau);
      var recap = document.querySelector("[data-sante-recap]");
      if (recap) recap.innerHTML = '<ul class="sante__detail">' + lignes + '</ul><p class="sante__recap-total"><span>Total estimé</span><span><strong>' + chfS(total) + "</strong> par mois</span></p>";
      // La simulation détaillée reprend les choix faits ici
      var q = new URLSearchParams({ annee_naissance: profil.annee || "", canton: profil.canton, sexe: profil.sexe || "" });
      choix.forEach(function (c) {
        var m = G.modules[c.cle];
        if (c.fam === "hop") { q.set("fam_hop", "oui"); q.set("division", m.court); }
        else if (c.fam === "amb") { q.set("fam_amb", "oui"); q.append("besoins_amb", m.court); q.set("niveau_amb", profil.niveau); }
        else if (c.fam === "dent") { q.set("fam_dent", "oui"); q.set("dentaire", m.court); }
        else if (c.fam === "ij") { q.set("fam_ij", "oui"); q.set("indemnite", m.court); }
        else if (c.cle === "pj_sante") q.set("fam_pj", "oui");
      });
      var cta = sante.querySelector("[data-sante-cta]");
      cta.href = cta.getAttribute("href").split("?")[0] + "?" + q.toString();
    };
    sante.addEventListener("input", majSante);
    sante.addEventListener("change", majSante);
    majSante();
  }

  // 4g. Intérêts composés (page Placements) : capitalisation mensuelle, versements en fin de mois
  var interets = document.querySelector("[data-interets]");
  if (interets) {
    var chfI = function (x) { return "CHF " + Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'"); };
    var lireI = function (k) { var el = interets.querySelector('[data-interets-champ="' + k + '"]'); return el ? Number(el.value) : 0; };
    // Les profils servent d'exemples : ils règlent le curseur d'intérêt
    interets.querySelectorAll("[data-interets-profil]").forEach(function (r) {
      r.addEventListener("change", function () { interets.querySelector('[data-interets-champ="taux"]').value = r.value; majI(); });
    });
    var projeter = function (depart, mensuel, annees, taux) {
      var r = Math.pow(1 + taux / 100, 1 / 12) - 1, capital = depart, verse = depart, serie = [];
      for (var m = 1; m <= annees * 12; m++) {
        capital = capital * (1 + r) + mensuel; verse += mensuel;
        if (m % 12 === 0) serie.push({ capital: capital, verse: verse });
      }
      return serie;
    };
    var majI = function () {
      var depart = lireI("depart"), mensuel = 0, duree = lireI("duree"), taux = lireI("taux");
      interets.querySelector('[data-interets-val="depart"]').textContent = chfI(depart);
      interets.querySelector('[data-interets-val="taux"]').textContent = taux.toFixed(1).replace(".", ",") + " % par an";
      interets.querySelectorAll("[data-interets-profil]").forEach(function (r) { r.checked = Number(r.value) === taux; });
      interets.querySelector('[data-interets-val="duree"]').textContent = duree + (duree > 1 ? " ans" : " an");
      var serie = projeter(depart, mensuel, duree, taux), fin = serie[serie.length - 1];
      interets.querySelector("[data-interets-total]").textContent = chfI(fin.capital);
      interets.querySelector("[data-interets-verse]").textContent = chfI(fin.verse);
      interets.querySelector("[data-interets-gain]").textContent = chfI(fin.capital - fin.verse);
      var compte = projeter(depart, mensuel, duree, 0.5).pop().capital;
      interets.querySelector("[data-interets-ecart]").textContent = taux > 0.5 && fin.capital > compte
        ? "Soit " + chfI(fin.capital - compte) + " de plus qu'un compte épargne, dans cette hypothèse." : "Placer selon un profil adapté peut faire croître davantage votre épargne sur le long terme.";
      var max = fin.capital || 1, pas = Math.max(1, Math.ceil(serie.length / 20));
      interets.querySelector("[data-interets-graphe]").innerHTML = serie.filter(function (x, k) { return (k + 1) % pas === 0 || k === serie.length - 1; }).map(function (x) {
        return '<span class="interets__an" style="height:' + (x.capital / max * 100) + '%"><i style="height:' + (x.verse / x.capital * 100) + '%"></i></span>';
      }).join("");
    };
    interets.addEventListener("input", majI);
    majI();
  }

  // 4h. Fenêtres (dialog) ouvertes par un bouton [data-ouvrir-modale="nom"], formulaires en étapes [data-etape]
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-ouvrir-modale]");
    if (!b) return;
    var modale = document.querySelector('[data-modale="' + b.getAttribute("data-ouvrir-modale") + '"]');
    if (!modale || !modale.showModal) return;
    ev.preventDefault();
    // Le résumé de la simulation d'intérêts accompagne la demande
    var resume = modale.querySelector("[data-interets-resume]"), sim = document.querySelector("[data-interets]");
    if (resume && sim) {
      var v = function (k) { var el = sim.querySelector('[data-interets-val="' + k + '"]'); return el ? el.textContent : ""; };
      resume.value = "Capital " + v("depart") + ", intérêt " + v("taux") + ", " + v("duree") + " : " + sim.querySelector("[data-interets-total]").textContent;
    }
    modale.showModal();
    document.body.classList.add("modale-ouverte");
  });
  document.querySelectorAll("dialog.modale, [data-etapes]").forEach(function (modale) {
    if (modale.tagName === "DIALOG") {
      var fermer = function () { modale.close(); };
      modale.querySelectorAll("[data-fermer-modale]").forEach(function (b) { b.addEventListener("click", fermer); });
      modale.addEventListener("click", function (ev) { if (ev.target === modale) fermer(); });
      modale.addEventListener("close", function () { document.body.classList.remove("modale-ouverte"); });
    }
    var etapes = Array.prototype.slice.call(modale.querySelectorAll("[data-etape]"));
    var reperes = modale.querySelectorAll(".modale__etapes li");
    var compteur = modale.querySelector("[data-etape-compteur]"), barre = modale.querySelector("[data-etape-barre]");
    var aller = function (n) {
      etapes.forEach(function (e, k) { e.hidden = k !== n; });
      reperes.forEach(function (r, k) { r.classList.toggle("actif", k === n); r.classList.toggle("fait", k < n); });
      if (compteur) compteur.textContent = n === etapes.length - 1 ? "Dernière étape" : "Question " + (n + 1) + " sur " + (etapes.length - 1);
      if (barre) barre.style.width = ((n + 1) / etapes.length * 100) + "%";
      etapes[n].classList.remove("fe--entree"); void etapes[n].offsetWidth; etapes[n].classList.add("fe--entree");
      if (modale.tagName === "DIALOG") modale.scrollTop = 0;
      else if (n > 0) { var haut = modale.getBoundingClientRect().top + window.scrollY - 100; if (window.scrollY > haut) window.scrollTo({ top: haut, behavior: "smooth" }); }
      var champ = etapes[n].querySelector("input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select");
      if (champ && (n > 0 || modale.tagName === "DIALOG")) champ.focus({ preventScroll: true });
    };
    modale.querySelectorAll("[data-etape-suivante]").forEach(function (b) {
      b.addEventListener("click", function () { var k = etapes.indexOf(b.closest("[data-etape]")); if (verifier(etapes[k])) aller(k + 1); });
    });
    modale.querySelectorAll("[data-etape-auto]").forEach(function (r) {
      r.addEventListener("change", function () { var k = etapes.indexOf(r.closest("[data-etape]")); setTimeout(function () { aller(k + 1); }, 250); });
    });
    if (etapes.length) aller(0);
    modale.querySelectorAll("[data-etape-precedente]").forEach(function (b) {
      b.addEventListener("click", function () { aller(Math.max(etapes.indexOf(b.closest("[data-etape]")) - 1, 0)); });
    });
  });

  // 4c. Simulation en plusieurs écrans (funnel), ex. assurance ménage
  var funnel = document.querySelector("[data-funnel]");
  if (funnel) {
    var formF = funnel.querySelector("form");
    var etapesF = Array.prototype.slice.call(funnel.querySelectorAll("[data-fe]"));
    var barreF = funnel.querySelector("[data-funnel-barre]");
    var compteurF = funnel.querySelector("[data-funnel-compteur]");
    var retourF = funnel.querySelector("[data-funnel-retour]");
    var historique = [];
    var courante = 0;
    var valeur = function (nom) {
      var el = formF.querySelector('[name="' + nom + '"]:checked') || formF.querySelector('[name="' + nom + '"]:not([type=radio])');
      return el ? el : null;
    };
    var nombre = function (nom) { var el = valeur(nom); return el ? Number(el.value) || 0 : 0; };
    var arrondi = function (x) { return Math.round(x * 20) / 20; };
    var chf2 = function (x) { return "CHF " + x.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'"); };
    // Complémentaires maladie : grille indicative (content/complementaires.json) selon l'âge, le sexe et le canton
    var tarifLca = funnel.querySelector("[data-tarif-lca]");
    var T = tarifLca ? JSON.parse(tarifLca.textContent) : null;
    var arrondi05 = function (x) { return Math.round(x * 20) / 20; };
    var primeLca = function (cle) {
      var an = nombre("annee_naissance"), sexe = valeur("sexe"), canton = formF.querySelector('[name="canton"]'), niv = valeur("niveau_amb");
      return prixLca(T, cle, { annee: an, sexe: sexe ? sexe.value : "", canton: canton ? canton.value : "", niveau: niv ? niv.value : "Standard" });
    };
    var modulesLca = function () {
      var liste = [];
      formF.querySelectorAll("[data-lca]:checked").forEach(function (el) {
        if (el.closest("[hidden]:not(.fe)")) return;
        var cle = el.getAttribute("data-lca");
        liste.push({ cle: cle, nom: T.modules[cle].nom, mois: primeLca(cle) });
      });
      return liste;
    };
    var calculer = function () {
      if (T) {
        var mods = modulesLca();
        var totalMois = mods.reduce(function (t, x) { return t + x.mois; }, 0);
        return { sommeCalc: 0, somme: 0, formule: "", nom: mods.length ? mods[0].nom : "Complémentaires", surMesure: false, lca: mods,
          principale: mods.length ? mods[0].mois : 0, options: mods.slice(1).map(function (x) { return { nom: x.nom, prix: x.mois }; }), total: totalMois };
      }
      // Somme assurée : ménage (pièces × inventaire) ou somme des champs [data-somme] (valeur du bâtiment, objets…)
      var inv = valeur("inventaire"), sommeCalc = 0;
      if (inv) sommeCalc = nombre("pieces") * Number(inv.getAttribute("data-valeur"));
      else formF.querySelectorAll("[data-somme]").forEach(function (el) { if (!el.closest("template")) sommeCalc += Number(el.value) || 0; });
      var ok = valeur("somme_ok");
      var somme = ok && ok.value === "non" && nombre("somme_corrigee") > 0 ? nombre("somme_corrigee") : sommeCalc;
      var form = valeur("formule");
      var taux = form ? Number(form.getAttribute("data-taux")) : Number(funnel.getAttribute("data-taux-fixe")) || 0;
      var surMesure = !!form && !taux;
      var principale = 0;
      var base = Number(funnel.getAttribute("data-prime-base")) || 0;
      var prixBase = formF.querySelector("[data-prix-base]:checked");
      if (base) principale = base;
      else if (prixBase) {
        principale = Number(prixBase.getAttribute("data-prix-base"));
        formF.querySelectorAll("[data-facteur]:checked").forEach(function (el) { principale *= Number(el.getAttribute("data-facteur")); });
        principale = arrondi(principale);
      } else if (taux) principale = arrondi(somme / 1000 * taux);
      var options = [];
      formF.querySelectorAll("[data-option-nom]:checked").forEach(function (el) {
        options.push({ nom: el.getAttribute("data-option-nom"), prix: Number(el.getAttribute("data-prix")) || 0 });
      });
      var total = principale + options.reduce(function (t, o) { return t + o.prix; }, 0);
      var nom = funnel.getAttribute("data-prime-nom") || "Prime";
      return { sommeCalc: sommeCalc, somme: somme, formule: form ? form.value : "", nom: nom, surMesure: surMesure, principale: principale, options: options, total: total };
    };
    var afficher = function () {
      var c = calculer();
      var set = function (cle, html) { funnel.querySelectorAll('[data-affiche="' + cle + '"]').forEach(function (el) { el.innerHTML = html; }); };
      set("somme_calculee", chf(c.sommeCalc));
      set("somme_objets", chf(c.sommeCalc));
      funnel.querySelectorAll("[data-prix-formule]").forEach(function (el) {
        el.textContent = chf(arrondi(c.somme / 1000 * Number(el.getAttribute("data-prix-formule")))) + " / an";
      });
      set("total_floute", c.surMesure ? "Sur mesure" : chf2(c.total));
      var prenom = valeur("prenom");
      set("prenom", prenom && prenom.value ? prenom.value.replace(/</g, "") : "Bonjour");
      if (T) {
        funnel.querySelectorAll("[data-prix-lca]").forEach(function (el) { el.textContent = "≈ " + chf2(primeLca(el.getAttribute("data-prix-lca"))) + " / mois"; });
        set("total_floute", chf2(c.total));
        set("total", chf2(c.total));
        set("mois", "par mois, soit environ " + chf(Math.round(c.total * 12)) + " par an");
        // D'autres solutions : les autres niveaux de la même couverture, avec leur prime, à choisir en un clic
        var sol = [];
        c.lca.forEach(function (x) {
          var el = formF.querySelector('[data-lca="' + x.cle + '"]');
          if (!el || el.type !== "radio") return;
          var freres = Array.prototype.slice.call(formF.querySelectorAll('[name="' + el.name + '"][data-lca]'));
          if (freres.length < 2) return;
          sol.push('<div class="solutions-lca__groupe"><p>' + T.modules[x.cle].famille + "</p><div>" + freres.map(function (fr) {
            var k = fr.getAttribute("data-lca"), actif = k === x.cle;
            return '<button type="button" class="solution-lca' + (actif ? " solution-lca--actif" : "") + '" data-lca-choisir="' + k + '"' + (actif ? ' aria-pressed="true"' : "") + "><span>" + T.modules[k].court + "</span><strong>" + chf2(primeLca(k)) + "</strong><small>par mois</small></button>";
          }).join("") + "</div></div>");
        });
        var niv = valeur("niveau_amb");
        if (niv && c.lca.some(function (x) { return T.modules[x.cle].famille === "Ambulatoire"; })) {
          var ambs = c.lca.filter(function (x) { return T.modules[x.cle].famille === "Ambulatoire"; }).map(function (x) { return x.cle; });
          sol.push('<div class="solutions-lca__groupe"><p>Niveau des soins ambulatoires</p><div>' + Object.keys(T.niveaux_amb).map(function (n) {
            var total = ambs.reduce(function (t, k) { return t + Math.round(T.modules[k].base * (primeLca(k) / T.modules[k].base) / (T.niveaux_amb[niv.value] || 1) * T.niveaux_amb[n] * 20) / 20; }, 0);
            var actif = n === niv.value;
            return '<button type="button" class="solution-lca' + (actif ? " solution-lca--actif" : "") + '" data-niveau-choisir="' + n + '"><span>' + n + "</span><strong>" + chf2(total) + "</strong><small>par mois</small></button>";
          }).join("") + "</div></div>");
        }
        set("solutions", sol.length ? '<p class="fe__sous-question">D\'autres solutions pour vous</p><p class="fe__aide">Comparez les niveaux en un clic : votre estimation se met à jour.</p>' + sol.join("") : "");
        set("prestations", c.lca.map(function (x) {
          var m = T.modules[x.cle];
          return '<div class="resultat-prestations__bloc"><p>' + m.nom + "</p><ul>" + (m.details || m.points).map(function (pt) { return "<li>" + pt + "</li>"; }).join("") + "</ul></div>";
        }).join(""));
      } else if (!c.surMesure) {
        set("total", chf2(c.total));
        set("mois", "soit environ " + chf2(c.total / 12) + " par mois");
      } else {
        set("total", "Sur mesure");
        set("mois", c.options.length ? "Options choisies : " + chf2(c.total) + " par an, plus votre offre personnalisée" : "Un spécialiste construit votre offre avec vous");
      }
      var libelle = c.nom + (c.formule ? ", formule " + c.formule : "") + (c.somme ? " <small>somme assurée " + chf(c.somme) + "</small>" : "");
      var lignes = ["<li><span>" + libelle + "</span><strong>" + (c.surMesure ? "sur mesure" : chf2(c.principale)) + "</strong></li>"];
      c.options.forEach(function (o) { lignes.push("<li><span>" + o.nom + "</span><strong>" + chf2(o.prix) + "</strong></li>"); });
      set("detail", lignes.join(""));
      var cache = function (k, v) { var el = formF.querySelector('[data-calc="' + k + '"]'); if (el) el.value = v; };
      cache("somme", Math.round(c.somme)); cache("formule", c.formule); cache("prime_principale", c.surMesure ? "sur mesure" : c.principale.toFixed(2)); cache("prime_totale", c.total.toFixed(2));
      if (T) cache("formule", c.lca.map(function (x) { return x.nom + " (" + chf2(x.mois) + "/mois)"; }).join(" + "));
    };
    var montrer = function (n, enArriere) {
      etapesF.forEach(function (e, k) { e.hidden = k !== n; });
      courante = n;
      barreF.style.width = ((n + 1) / etapesF.length * 100) + "%";
      var finale = etapesF[etapesF.length - 1].hasAttribute("data-fe-final");
      var total = finale ? etapesF.length - 1 : etapesF.length;
      var pctF = Math.round((n + 1) / etapesF.length * 100);
      compteurF.innerHTML = (finale && n === etapesF.length - 1 ? "Résultat" : "Étape " + (n + 1) + " sur " + total) + ' <span class="avancee__pct">' + pctF + " %</span>";
      barreF.parentNode.setAttribute("aria-valuenow", pctF);
      retourF.hidden = n === 0 || (finale && n === etapesF.length - 1);
      afficher();
      etapesF[n].classList.remove("fe--entree", "fe--retour");
      void etapesF[n].offsetWidth;
      etapesF[n].classList.add(enArriere ? "fe--retour" : "fe--entree");
      var top = funnel.getBoundingClientRect().top + window.scrollY - 90;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" });
      var champ = etapesF[n].querySelector("input:not([type=hidden]):not([type=radio]):not([readonly])");
      if (champ && !enArriere) champ.focus({ preventScroll: true });
    };
    var sauter = {};
    var avancer = function () {
      if (!verifier(etapesF[courante])) return;
      historique.push(courante);
      var suivante = Math.min(courante + 1, etapesF.length - 1);
      while (sauter[suivante] && suivante < etapesF.length - 1) { delete sauter[suivante]; suivante++; }
      montrer(suivante);
    };
    var encoder = function () {
      var donnees = new FormData(formF), paires = [];
      donnees.forEach(function (v, k) { paires.push(encodeURIComponent(k) + "=" + encodeURIComponent(v)); });
      return paires.join("&");
    };
    funnel.querySelectorAll("[data-fe-suivant]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.hasAttribute("data-fe-envoi")) {
          if (!verifier(etapesF[courante])) return;
          funnel.removeAttribute("data-sans-contact");
          afficher();
          funnel.querySelector("[data-funnel-etat]").value = "prime affichée";
          // Le lead est enregistré dès que la prime est affichée ; on continue même hors ligne.
          try { fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: encoder() }).catch(function () {}); } catch (e) {}
          historique.push(courante);
          montrer(courante + 1);
          // Révélation de la prime : compteur qui monte et confettis
          var cTot = calculer();
          var elTot = funnel.querySelector('[data-affiche="total"]');
          if (elTot && !cTot.surMesure && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            var t0 = null;
            var monter = function (t) { if (!t0) t0 = t; var k = Math.min((t - t0) / 1200, 1); elTot.textContent = chf2(cTot.total * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(monter); };
            requestAnimationFrame(monter);
          }
          setTimeout(function () { lancerConfettis(2600); }, 500);
          return;
        }
        avancer();
      });
    });
    // Changer de niveau depuis le résultat (complémentaires)
    funnel.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-lca-choisir], [data-niveau-choisir]");
      if (!b) return;
      var el = b.hasAttribute("data-lca-choisir") ? formF.querySelector('[data-lca="' + b.getAttribute("data-lca-choisir") + '"]') : formF.querySelector('[name="niveau_amb"][value="' + b.getAttribute("data-niveau-choisir") + '"]');
      if (el) { el.checked = true; afficher(); var tot = funnel.querySelector('[data-affiche="total"]'); if (tot) { tot.classList.remove("pulse"); void tot.offsetWidth; tot.classList.add("pulse"); } }
    });
    // Voir le résultat sans laisser ses coordonnées (le rappel reste proposé ensuite)
    funnel.querySelectorAll("[data-fe-sans-contact]").forEach(function (b) {
      b.addEventListener("click", function () {
        funnel.setAttribute("data-sans-contact", "");
        funnel.querySelector("[data-funnel-etat]").value = "prime affichée sans coordonnées";
        etapesF[courante].querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
        etapesF[courante].querySelectorAll(".champ__erreur").forEach(function (el) { el.remove(); });
        historique.push(courante);
        montrer(courante + 1);
      });
    });
    funnel.querySelectorAll("[data-fe-auto]").forEach(function (r) {
      r.addEventListener("change", function () { setTimeout(avancer, 250); });
    });
    retourF.addEventListener("click", function () { if (historique.length) montrer(historique.pop(), true); });
    // Un autre bloc de la page peut faire avancer la simulation (ex. calculateur du haut de page)
    funnel.addEventListener("funnel:suivant", avancer);
    funnel.querySelectorAll("[data-fe-modifier]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cle = b.getAttribute("data-fe-modifier");
        var cible = etapesF.findIndex(function (e) { return e.getAttribute("data-fe") === cle; });
        if (cible < 0) cible = 0;
        historique = []; for (var k = 0; k < cible; k++) historique.push(k);
        montrer(cible, true);
      });
    });
    // Liste d'objets (objets de valeur) : ajout, retrait, texte récapitulatif envoyé avec la demande
    var zoneObjets = funnel.querySelector("[data-objets]");
    if (zoneObjets) {
      var modele = zoneObjets.querySelector("[data-objet-modele]");
      var texteObjets = formF.querySelector("[data-objets-texte]");
      var majObjets = function () {
        var lignes = [];
        zoneObjets.querySelectorAll("[data-objet]").forEach(function (o, k) {
          o.querySelector("[data-objet-num]").textContent = k + 1;
          o.querySelector("[data-objet-retirer]").hidden = zoneObjets.querySelectorAll("[data-objet]").length < 2;
          var v = function (c) { return o.querySelector('[data-objet-champ="' + c + '"]').value.trim(); };
          lignes.push((k + 1) + ". " + [v("marque"), v("modele"), v("description")].filter(Boolean).join(", ") + " : CHF " + (v("prix") || "?"));
        });
        texteObjets.value = lignes.join("\n");
        afficher();
      };
      var ajouterObjet = function () {
        zoneObjets.appendChild(modele.content.cloneNode(true));
        var dernier = zoneObjets.querySelector("[data-objet]:last-of-type");
        dernier.querySelectorAll("input").forEach(function (c, k) { c.id = "objet-" + Date.now() + "-" + k; var l = c.parentElement.querySelector("label"); if (l) l.setAttribute("for", c.id); });
        dernier.querySelector("[data-objet-retirer]").addEventListener("click", function () { dernier.remove(); majObjets(); });
        majObjets();
      };
      funnel.querySelector("[data-objet-ajouter]").addEventListener("click", function () { ajouterObjet(); zoneObjets.querySelector("[data-objet]:last-of-type input").focus(); });
      zoneObjets.addEventListener("input", majObjets);
      ajouterObjet();
    }
    funnel.querySelectorAll("[data-fe-action]").forEach(function (b) {
      b.addEventListener("click", function () {
        funnel.querySelector("[data-funnel-action]").value = b.getAttribute("data-fe-action") === "souscription" ? "Demande de souscription" : "Être recontacté";
        funnel.querySelector("[data-funnel-etat]").value = "demande envoyée";
      });
    });
    // Blocs affichés selon une réponse : data-montre-si="nom=valeur" ou "nom!=valeur"
    var majConditions = function () {
      formF.querySelectorAll("[data-montre-si]").forEach(function (bloc) {
        var regle = bloc.getAttribute("data-montre-si"), neg = regle.indexOf("!=") > -1;
        var parts = regle.split(neg ? "!=" : "="), nom = parts[0], attendu = parts[1];
        var el = formF.querySelector('[name="' + nom + '"]:checked');
        var v = el ? el.value : "";
        bloc.hidden = neg ? v === attendu : v !== attendu;
      });
    };
    // Préremplissage depuis l'adresse (ex. simulateur de la page Privé) : ?nom=valeur
    new URLSearchParams(location.search).forEach(function (v, k) {
      if (k === "logement") return;
      formF.querySelectorAll('[name="' + k.replace(/"/g, "") + '"]').forEach(function (el) {
        if (el.type === "radio" || el.type === "checkbox") { if (el.value === v) el.checked = true; }
        else if (el.type !== "hidden" && !el.value) el.value = v;
      });
    });
    formF.addEventListener("change", majConditions);
    majConditions();
    // Compteurs + / −
    funnel.querySelectorAll("[data-compteur]").forEach(function (c) {
      var champ = c.querySelector("input"), pas = Number(c.getAttribute("data-pas")) || 1;
      var regler = function (d) {
        var v = Math.min(Math.max(Number(champ.value) + d, Number(champ.min)), Number(champ.max));
        champ.value = v;
        c.classList.remove("compteur--pulse"); void c.offsetWidth; c.classList.add("compteur--pulse");
      };
      c.querySelector("[data-compteur-moins]").addEventListener("click", function () { regler(-pas); });
      c.querySelector("[data-compteur-plus]").addEventListener("click", function () { regler(pas); });
    });
    // Entrée directe depuis la page produit (?logement=Appartement)
    var log = params.get("logement");
    montrer(0);
    if (log) {
      var r = formF.querySelector('[name="logement"][value="' + CSS.escape(log) + '"]');
      if (r) { r.checked = true; sauter[etapesF.indexOf(r.closest("[data-fe]"))] = true; }
    }
  }

  // 4d. Garantie de loyer : comparaison des offres (tarifs publiés par les assureurs) et récapitulatif
  var gar = document.querySelector("[data-garantie]");
  if (gar) {
    var TIMBRE = 0.05;
    var OFFRES_GL = [
      { id: "helvetia", nom: "Helvetia", taux: 0.04, min: 120, frais: 0, plafond: 18000, reco: true },
      { id: "swisscaution", nom: "SwissCaution", taux: 0.05, min: 0, frais: 20, plafond: null },
      { id: "firstcaution", nom: "Firstcaution", taux: 0.05, min: 0, frais: 20, plafond: null, surDemande: 15000, mensuel: 0.055 }
    ];
    var chf5 = function (n) {
      var r = Math.round(n * 20) / 20;
      return Math.abs(r - Math.round(r)) < 0.001 ? chf(r) : "CHF " + r.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    };
    var calcGL = function (o, g) {
      if (!(g > 0)) return null;
      if (o.plafond && g > o.plafond) return { dispo: false };
      var prime = Math.max(g * o.taux, o.min || 0);
      return { dispo: true, total: (prime + o.frais) * (1 + TIMBRE), mensuel: o.mensuel ? ((g * o.mensuel + o.frais) * (1 + TIMBRE)) / 12 : null, surDemande: !!(o.surDemande && g > o.surDemande) };
    };
    var gLoyer = gar.querySelector('[data-gl="loyer"]'), gMontant = gar.querySelector('[data-gl="montant"]');
    var liste = gar.querySelector("[data-gl-offres]"), recap = gar.querySelector("[data-gl-recap]");
    var montantTouche = false;
    var rendre = function () {
      var g = Number(gMontant.value) || 0, l = Number(gLoyer.value) || 0;
      var alerte = gar.querySelector("[data-gl-alerte]");
      alerte.hidden = !(l > 0 && g > l * 3 + 0.5);
      alerte.textContent = "Ce montant dépasse 3 mois de loyer, le maximum légal pour un logement d'habitation.";
      gar.querySelector("[data-gl-comparaison]").hidden = !(g > 0);
      var nbDispo = OFFRES_GL.filter(function (o) { var r = calcGL(o, g); return r && r.dispo; }).length;
      gar.querySelector("[data-gl-titre-offres]").textContent = g > 0 ? nbDispo + (nbDispo > 1 ? " offres" : " offre") + " pour " + chf(g) : "Vos offres de garantie de loyer";
      gar.querySelector('[data-gl-sortie="bloque"]').textContent = chf(g) + " bloqués";
      var res = OFFRES_GL.map(function (o) { return { o: o, r: calcGL(o, g) }; });
      var chiffrables = res.filter(function (x) { return x.r && x.r.dispo && !x.r.surDemande; });
      var min = chiffrables.length ? Math.min.apply(null, chiffrables.map(function (x) { return x.r.total; })) : null;
      res.sort(function (a, b) {
        var da = a.r && a.r.dispo, db = b.r && b.r.dispo;
        if (da !== db) return da ? -1 : 1;
        if (!da) return 0;
        if (!!a.o.reco !== !!b.o.reco) return a.o.reco ? -1 : 1;
        return a.r.total - b.r.total;
      });
      // Réordonner seulement si l'ordre change (déplacer une carte pendant un clic ferait perdre le clic)
      var ordreVoulu = res.map(function (x) { return x.o.id; }).join();
      var ordreActuel = Array.prototype.map.call(liste.querySelectorAll("[data-offre]:not([data-offre=conseil])"), function (c) { return c.getAttribute("data-offre"); }).join();
      if (ordreVoulu !== ordreActuel) {
        res.forEach(function (x) { liste.insertBefore(liste.querySelector('[data-offre="' + x.o.id + '"]'), liste.querySelector('[data-offre="conseil"]')); });
      }
      var rang = 0;
      res.forEach(function (x) {
        var carte = liste.querySelector('[data-offre="' + x.o.id + '"]'), r = x.r;
        var radio = carte.querySelector("input"), prix = carte.querySelector("[data-prix]"), detail = carte.querySelector("[data-prix-detail]");
        var dispo = r && r.dispo;
        radio.disabled = !!r && !dispo;
        carte.classList.toggle("offre-gl--off", !!r && !dispo);
        carte.querySelector(".offre-gl__rang").textContent = dispo ? ++rang : "–";
        carte.querySelector("[data-badge]").hidden = !(dispo && !r.surDemande && min !== null && Math.abs(r.total - min) < 0.01);
        var eco = carte.querySelector("[data-economie]");
        eco.hidden = true;
        if (!r) { prix.textContent = "—"; detail.textContent = "Indiquez le montant"; return; }
        if (!dispo) { prix.textContent = "Non disponible"; detail.textContent = "Au-delà de " + chf(x.o.plafond); return; }
        if (r.surDemande) { prix.textContent = "Sur demande"; detail.textContent = "Au-delà de " + chf(x.o.surDemande); return; }
        prix.textContent = chf5(r.total);
        detail.textContent = "par an, timbre compris · " + (r.mensuel ? "ou " + chf5(r.mensuel) + " par mois" : "soit " + chf5(r.total / 12) + " par mois");
        if (x.o.reco) {
          var autres = chiffrables.filter(function (y) { return y.o !== x.o; }).map(function (y) { return y.r.total; });
          var m = autres.length ? Math.min.apply(null, autres) : null;
          if (m !== null && m - r.total >= 1) { eco.hidden = false; eco.innerHTML = "Vous économisez <strong>" + chf5(m - r.total) + " par an</strong> par rapport à la meilleure alternative."; }
        }
      });
      // Récapitulatif
      var choix = gar.querySelector('[name="offre"]:checked');
      var o = choix && OFFRES_GL.filter(function (y) { return y.id === choix.value; })[0];
      var r2 = o ? calcGL(o, g) : null;
      var prime = r2 && r2.dispo && !r2.surDemande ? chf5(r2.total) + " / an" : (choix && choix.value === "conseil" ? "selon l'offre conseillée" : "–");
      gar.querySelector('[data-recap="offre"]').textContent = o ? o.nom : (choix ? "Conseil demandé" : "–");
      gar.querySelector('[data-recap="montant"]').textContent = g > 0 ? chf(g) : "–";
      gar.querySelector('[data-recap="prime"]').textContent = prime;
      gar.querySelector('[data-recap="libre"]').textContent = g > 0 ? chf(g) : "CHF 0";
      gar.querySelector('[data-gl-cache="prime"]').value = prime;
      gar.querySelector('[data-gl-cache="offre"]').value = o ? o.nom : (choix ? "Conseil demandé" : "");
      recap.hidden = !(g > 0 && choix);
    };
    gLoyer.addEventListener("input", function () {
      var l = Number(gLoyer.value) || 0;
      if (!montantTouche) gMontant.value = l > 0 ? Math.round(l * 3) : "";
      rendre();
    });
    gMontant.addEventListener("input", function () { montantTouche = true; rendre(); });
    gar.addEventListener("change", rendre);
    // Date de début : entre aujourd'hui et dans 12 mois
    var debut = gar.querySelector("[data-gl-debut]");
    if (debut) {
      var auj = new Date(), dans12 = new Date(); dans12.setFullYear(auj.getFullYear() + 1);
      var iso = function (d) { return d.toISOString().slice(0, 10); };
      debut.min = iso(auj); debut.max = iso(dans12);
    }
    // Valeurs venant de l'URL (?loyer=2100, ?montant=6300, ?offre=helvetia)
    var qL = Number(params.get("loyer")) || 0, qG = Number(params.get("montant")) || 0;
    if (qL > 0) gLoyer.value = Math.round(qL);
    if (qG > 0) { gMontant.value = Math.round(qG); montantTouche = true; } else if (qL > 0) gMontant.value = Math.round(qL * 3);
    rendre();
  }

  // 4d-bis. Mini-calculateur du haut de page garantie de loyer
  var mini = document.querySelector("[data-gl-mini]");
  if (mini) {
    var mLoyer = mini.querySelector("[data-gl-mini-loyer]");
    var majMini = function () { mini.querySelector("[data-gl-mini-depot]").textContent = chf((Number(mLoyer.value) || 0) * 3); };
    mLoyer.addEventListener("input", majMini); majMini();
    mini.querySelector("[data-gl-mini-bouton]").addEventListener("click", function () {
      var cible = document.querySelector('[data-gl="loyer"]'), f = document.querySelector("[data-funnel]");
      if (!cible || !f) return;
      cible.value = mLoyer.value;
      cible.dispatchEvent(new Event("input", { bubbles: true }));
      f.dispatchEvent(new Event("funnel:suivant"));
      document.getElementById("calcul").scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  // Réutilisé par l'estimation en direct de /particuliers/3e-pilier/demande/
  window.Assuravia3a = { tauxMarginal: tauxMarginal, MAX_SALARIE: MAX_SALARIE, MAX_INDEPENDANT: MAX_INDEPENDANT };

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
  // 3e pilier : le bouton mène à la page de demande avec les valeurs du calcul
  document.querySelectorAll("[data-sim-suite]").forEach(function (suite) {
    var sim = suite.previousElementSibling, lien = suite.querySelector("[data-sim-lien]");
    var maj = function () {
      var v = function (n) { var el = sim.querySelector('[data-sim="' + n + '"]'); return el ? el.value : ""; };
      var eco = (sim.querySelector('[data-sim-sortie="economie"]').textContent || "").replace(/[^\d]/g, "");
      var q = new URLSearchParams({ canton: v("canton"), situation: v("situation"), statut: v("statut"), revenu: v("revenu"), versement: v("versement"), economie: eco });
      lien.href = lien.getAttribute("href").split("?")[0] + "?" + q.toString();
      document.querySelectorAll('a[href^="/particuliers/3e-pilier/demande/"]').forEach(function (a) { if (a !== lien) a.href = lien.href; });
    };
    sim.addEventListener("input", function () { setTimeout(maj, 0); });
    sim.addEventListener("change", function () { setTimeout(maj, 0); });
    maj();
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
  // 6. Menu principal : Privé et Professionnel mènent à leur page, la flèche ouvre la liste des produits
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

  // 9a. Accueil : choix Particulier / Professionnel (titre, texte, bilan, questions, bandeau)
  // Volet de produits à cocher (formulaire de demande) : résumé et champ « produit » envoyé avec le lead
  var majVolets = function () {
    document.querySelectorAll("[data-volet]").forEach(function (v) {
      var coches = Array.prototype.filter.call(v.querySelectorAll("input[type=checkbox]"), function (c) { return c.checked && !c.disabled; }).map(function (c) { return c.value; });
      v.querySelector("[data-volet-resume]").textContent = coches.length ? coches.length + (coches.length > 1 ? " assurances choisies" : " assurance choisie") + " : " + coches.slice(0, 2).join(", ") + (coches.length > 2 ? "…" : "") : "Choisissez une ou plusieurs assurances";
      var cache = v.closest("form") && v.closest("form").querySelector("[data-produit]");
      if (cache && !v.querySelector("input").disabled) cache.value = coches.join(" ; ");
    });
  };
  document.addEventListener("change", function (e) { if (e.target.closest && e.target.closest("[data-volet]")) majVolets(); });

  var choixUnivers = document.querySelectorAll("[data-choix-univers]");
  var definirUnivers = function (u, memoriser) {
    document.querySelectorAll("[data-univers]").forEach(function (el) {
      el.hidden = el.getAttribute("data-univers") !== u;
      // Les champs d'un univers masqué ne sont ni vérifiés ni envoyés
      el.querySelectorAll("input, select, textarea").forEach(function (c) { c.disabled = el.hidden; });
    });
    majVolets();
    choixUnivers.forEach(function (b) {
      var actif = b.getAttribute("data-choix-univers") === u;
      if (b.getAttribute("role") === "tab") {
        b.setAttribute("aria-selected", actif ? "true" : "false");
        b.tabIndex = actif ? 0 : -1;
        document.getElementById(b.getAttribute("aria-controls")).hidden = !actif;
      } else {
        b.setAttribute("aria-pressed", actif ? "true" : "false");
      }
    });
    var accueil = document.querySelector(".accueil");
    if (accueil) accueil.classList.toggle("accueil--pro", u === "pro");
    if (memoriser) { try { localStorage.setItem("assuravia-univers", u); } catch (e) {} }
  };
  if (choixUnivers.length) {
    var depart = null;
    var param = new URLSearchParams(location.search).get("univers");
    if (param === "pro" || param === "prive") depart = param;
    if (!depart) { try { depart = localStorage.getItem("assuravia-univers"); } catch (e) {} }
    // Formulaire de demande : produit coché d'avance depuis l'URL (?produit=...)
    var produitDemande = params.get("produit");
    if (produitDemande) {
      var caseProduit = document.querySelector('[data-volet] input[data-slug="' + CSS.escape(produitDemande) + '"]');
      if (caseProduit) { caseProduit.checked = true; depart = caseProduit.closest("[data-univers]").getAttribute("data-univers"); }
    }
    definirUnivers(depart === "pro" ? "pro" : "prive", false);
    choixUnivers.forEach(function (b) {
      if (b.getAttribute("role") !== "tab") {
        b.addEventListener("click", function () { definirUnivers(b.getAttribute("data-choix-univers"), true); });
      }
    });
  }

  // 9. Exemples de bilan : onglets Particulier / Professionnel
  document.querySelectorAll("[data-onglets]").forEach(function (zone) {
    var onglets = zone.querySelectorAll("[data-onglet]");
    var activer = function (o, focus) {
      if (o.hasAttribute("data-choix-univers")) {
        definirUnivers(o.getAttribute("data-choix-univers"), true);
        if (focus) o.focus();
        return;
      }
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

  // 11. Carrousel de cas types : défilement automatique, pause au survol, au focus ou sur demande
  var mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-carrousel]").forEach(function (car) {
    var piste = car.querySelector("[data-carrousel-piste]");
    // Ordre aléatoire à chaque visite : on ne voit pas toujours les trois mêmes cas en premier
    var items = Array.prototype.slice.call(piste.children);
    for (var k = items.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var t = items[k]; items[k] = items[j]; items[j] = t; }
    items.forEach(function (li, n) { li.setAttribute("aria-label", (n + 1) + " sur " + items.length); piste.appendChild(li); });
    var pause = car.querySelector("[data-carrousel-pause]");
    var arrete = mouvementReduit, survol = false, minuterie = null;
    var pas = function () { var c = piste.querySelector(".cas"); return c ? c.getBoundingClientRect().width + 24 : piste.clientWidth; };
    var avancer = function (sens) {
      var fin = piste.scrollLeft + piste.clientWidth >= piste.scrollWidth - 4;
      if (sens > 0 && fin) piste.scrollTo({ left: 0 });
      else if (sens < 0 && piste.scrollLeft <= 4) piste.scrollTo({ left: piste.scrollWidth });
      else piste.scrollBy({ left: sens * pas() });
    };
    var majPause = function () { pause.setAttribute("aria-pressed", arrete ? "true" : "false"); pause.setAttribute("aria-label", arrete ? "Reprendre le défilement" : "Mettre en pause le défilement"); };
    var lancer = function () { clearInterval(minuterie); minuterie = setInterval(function () { if (!arrete && !survol && !document.hidden) avancer(1); }, 5000); };
    car.querySelector("[data-carrousel-suivant]").addEventListener("click", function () { avancer(1); });
    car.querySelector("[data-carrousel-precedent]").addEventListener("click", function () { avancer(-1); });
    pause.addEventListener("click", function () { arrete = !arrete; majPause(); });
    car.addEventListener("mouseenter", function () { survol = true; });
    car.addEventListener("mouseleave", function () { survol = false; });
    car.addEventListener("focusin", function () { survol = true; });
    car.addEventListener("focusout", function () { survol = false; });
    majPause(); lancer();
  });

  // 11b. Pages produit : « Est-ce pour vous ? »
  document.querySelectorAll("[data-pour-qui]").forEach(function (zone) {
    var cases = zone.querySelectorAll("[data-pour-qui-case]");
    var jauge = zone.querySelector("[data-pour-qui-jauge]");
    var message = zone.querySelector("[data-pour-qui-message]");
    var bouton = zone.querySelector("[data-pour-qui-bouton]");
    var maj = function () {
      var n = 0;
      cases.forEach(function (c) { if (c.checked) n++; c.closest("li").classList.toggle("coche", c.checked); });
      jauge.style.width = (n / cases.length * 100) + "%";
      if (n === 0) message.textContent = "Cochez les situations qui vous ressemblent.";
      else if (n === 1) message.textContent = "Une situation vous concerne : cette assurance mérite un coup d'œil. Un spécialiste vous dit en quelques minutes si elle vous est utile.";
      else if (n < cases.length) message.textContent = n + " situations vous concernent : cette assurance est probablement utile pour vous. Faites vérifier votre couverture actuelle, c'est gratuit.";
      else message.textContent = "Toutes les situations vous concernent : cette assurance est faite pour vous. Demandez des propositions adaptées, sans engagement.";
      bouton.hidden = n === 0;
      zone.classList.toggle("pour-qui--fort", n >= 2);
    };
    cases.forEach(function (c) { c.addEventListener("change", maj); });
  });

  // 11c. Articles : félicitations en fin de lecture
  var bravo = document.querySelector("[data-bravo]");
  if (bravo) {
    var corpsArticle = document.querySelector(".article__corps"), bravoVu = false;
    var verifierBravo = function () {
      if (bravoVu) return;
      var r = corpsArticle.getBoundingClientRect();
      if (r.bottom < window.innerHeight * 1.05) { bravoVu = true; bravo.hidden = false; requestAnimationFrame(function () { bravo.classList.add("bravo--visible"); }); }
    };
    window.addEventListener("scroll", verifierBravo, { passive: true });
    bravo.querySelector("[data-bravo-fermer]").addEventListener("click", function () { bravo.hidden = true; });
  }

  // 12. Articles : barre de progression, sommaire actif, quiz vrai ou faux
  var barre = document.querySelector("[data-progression]");
  if (barre) {
    var corps = document.querySelector(".article__corps");
    var liens = document.querySelectorAll("[data-sommaire-lien]");
    var majLecture = function () {
      var r = corps.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      var fait = Math.min(Math.max(-r.top / (total > 0 ? total : 1), 0), 1);
      barre.style.width = (fait * 100) + "%";
      var courant = null;
      liens.forEach(function (l) {
        var cible = document.getElementById(l.getAttribute("href").slice(1));
        if (cible && cible.getBoundingClientRect().top < 140) courant = l;
      });
      liens.forEach(function (l) { l.classList.toggle("actif", l === courant); });
    };
    window.addEventListener("scroll", majLecture, { passive: true });
    majLecture();
  }
  document.querySelectorAll("[data-quiz]").forEach(function (quiz) {
    var questions = quiz.querySelectorAll("[data-quiz-question]");
    var score = 0, repondues = 0;
    var sortie = quiz.querySelector("[data-quiz-score]");
    questions.forEach(function (q) {
      var boutons = q.querySelectorAll("[data-choix]");
      boutons.forEach(function (b) {
        b.addEventListener("click", function () {
          var bon = b.getAttribute("data-choix") === q.getAttribute("data-reponse");
          boutons.forEach(function (x) {
            x.disabled = true;
            if (x.getAttribute("data-choix") === q.getAttribute("data-reponse")) x.classList.add("juste");
          });
          if (!bon) b.classList.add("faux");
          q.querySelector("[data-quiz-verdict]").textContent = bon ? "Bonne réponse." : "Pas tout à fait.";
          q.querySelector("[data-quiz-explication]").hidden = false;
          repondues++; if (bon) score++;
          sortie.textContent = "Votre score : " + score + " sur " + repondues + (repondues === questions.length ? (score === questions.length ? ". Parfait !" : ". Un conseiller peut compléter vos connaissances.") : "");
        });
      });
    });
  });

  // 8. Page de remerciement : message adapté au formulaire envoyé
  if (params.get("f") === "contact" || params.get("f") === "contact-rapide") {
    var titre = document.querySelector(".merci h1");
    var texte = document.querySelector(".merci .chapeau");
    if (titre) titre.textContent = "Merci pour votre message !";
    if (texte) texte.textContent = "Il est bien arrivé. Un expert vous répond rapidement, par téléphone ou par e-mail.";
  }
})();
