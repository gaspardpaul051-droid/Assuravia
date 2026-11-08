/* Comparateur LAMal en étapes : primes OFSP (static/data/lamal/), calcul dans le navigateur.
   Le parcours (étapes, envoi de la demande, conversion) est géré par site.js ; ce script remplit les écrans
   propres au comparateur et les champs cachés envoyés avec la demande. */
(function () {
  "use strict";
  var script = document.currentScript;
  var DONNEES = script && script.src ? new URL("../data/lamal/", script.src).href : "/data/lamal/";
  var funnel = document.querySelector("[data-funnel]");
  var form = funnel && funnel.querySelector("form[name='comparateur-lamal']");
  if (!form) return;

  var $ = function (sel) { return funnel.querySelector(sel); };
  var TYPES = { BASE: "Standard", PRAXIS: "Médecin de famille ou HMO", TEL_DIG: "Télémédecine", FLEX: "Mixte", PHARM: "Pharmacie" };
  var LIB_CLASSE = { K: "enfant", J: "jeune adulte", E: "adulte" };
  var PAR_PAGE = 10;
  var etat = { index: null, donnees: null, canton: "", region: "", personnes: [], offres: [], reference: null, limite: PAR_PAGE };
  var cache = {};
  var anneeCourante = new Date().getFullYear(), annee = anneeCourante + 1;
  var anneeMin = anneeCourante - 100, anneeMax = anneeCourante;

  var chf = function (x, dec) {
    var s = (dec === false ? Math.round(x).toString() : x.toFixed(2));
    var p = s.split(".");
    return "CHF " + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'") + (p[1] ? "." + p[1] : "");
  };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var champ = function (nom, v) { var el = form.querySelector('[data-lamal-champ="' + nom + '"]'); if (el) el.value = v == null ? "" : v; };
  var coche = function (nom) { var el = form.querySelector('[name="' + nom + '"]:checked'); return el ? el.value : ""; };
  var classe = function (naissance) { var age = annee - naissance; return age <= 18 ? "K" : age <= 25 ? "J" : "E"; };

  var charger = function (fichier) {
    if (cache[fichier]) return Promise.resolve(cache[fichier]);
    return fetch(DONNEES + fichier + ".json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { cache[fichier] = d; return d; });
  };
  var pret = charger("index").then(function (idx) { etat.index = idx; annee = idx.annee || annee; return idx; });

  /* ---------- Étape « Où habitez-vous ? » ---------- */
  var blocRegion = $("[data-lamal-region-bloc]"), zoneRegions = $("[data-lamal-regions]"), autre = $("[data-lamal-autre]"), selAutre = $("[data-lamal-canton-autre]");
  var erreurLieu = $("[data-lamal-erreur-lieu]");
  var cantonChoisi = function () { var c = coche("canton_choix"); return c === "autre" ? selAutre.value : c; };
  var majCanton = function () {
    var c = coche("canton_choix");
    autre.hidden = c !== "autre";
    var canton = cantonChoisi();
    if (!canton) { blocRegion.hidden = true; zoneRegions.innerHTML = ""; return; }
    erreurLieu.hidden = true;
    charger(canton).then(function (d) {
      etat.donnees = d; etat.canton = canton;
      if (d.regions.length > 1) {
        zoneRegions.innerHTML = d.regions.map(function (r) {
          return '<label class="choix-carte choix-carte--compact"><input type="radio" name="region_choix" value="' + r + '" required><span>Région ' + r + "</span></label>";
        }).join("") + '<label class="choix-carte choix-carte--compact"><input type="radio" name="region_choix" value="?" required><span>Je ne sais pas</span></label>';
        blocRegion.hidden = false;
      } else { zoneRegions.innerHTML = ""; blocRegion.hidden = true; }
      remplirActuelle();
    }).catch(function () {
      erreurLieu.hidden = false;
      erreurLieu.textContent = "Les primes n'ont pas pu être chargées. Vérifiez votre connexion et réessayez.";
    });
  };
  form.addEventListener("change", function (ev) {
    if (ev.target.name === "canton_choix" || ev.target === selAutre) majCanton();
  });
  var regionChoisie = function () {
    if (!etat.donnees) return "";
    if (etat.donnees.regions.length === 1) return etat.donnees.regions[0];
    var r = coche("region_choix");
    return r === "?" ? etat.donnees.regions[0] : r;
  };

  /* ---------- Étape « Années de naissance » ---------- */
  var boite = $("[data-lamal-personnes]"), boutonAjout = $("[data-lamal-ajouter]");
  var dernierAssures = "";
  var preparerPersonnes = function () {
    var a = coche("assures") || "Moi";
    if (a === dernierAssures && etat.personnes.length) return;
    dernierAssures = a;
    var roles = a === "Couple" ? ["Vous", "Votre conjoint"] : a === "Famille" ? ["Vous", "Votre conjoint", "Enfant 1"] : a === "Enfant" ? ["Votre enfant"] : ["Vous"];
    etat.personnes = roles.map(function (r) { return { role: r, naissance: null, employeur: false }; });
    boutonAjout.hidden = a !== "Famille" && a !== "Enfant";
    boutonAjout.textContent = a === "Famille" ? "+ Ajouter un enfant" : "+ Ajouter un autre enfant";
    dessiner();
  };
  var dessiner = function () {
    boite.innerHTML = etat.personnes.map(function (p, k) {
      var retirable = etat.personnes.length > 1 && /Enfant|enfant/.test(p.role) && k > 0;
      return '<div class="lamal-personne" data-k="' + k + '">' +
        '<div class="champ"><label for="cmp-naiss-' + k + '">' + esc(p.role) + " : année de naissance</label>" +
        '<input id="cmp-naiss-' + k + '" name="naissance_' + (k + 1) + '" type="number" inputmode="numeric" required min="' + anneeMin + '" max="' + anneeMax + '" placeholder="Ex. ' + (/nfant/.test(p.role) ? "2015" : "1988") + '" value="' + (p.naissance || "") + '"></div>' +
        '<label class="lamal-personne__employeur" data-employeur' + (p.naissance && classe(p.naissance) === "K" ? " hidden" : "") + '><input type="checkbox"' + (p.employeur ? " checked" : "") + "> Travaille au moins 8 h par semaine chez le même employeur <small>(accidents couverts par l'employeur : prime plus basse)</small></label>" +
        (retirable ? '<button type="button" class="lien-bouton lamal-personne__retirer">Retirer</button>' : "") +
        "</div>";
    }).join("");
  };
  boite.addEventListener("input", function (ev) {
    var bloc = ev.target.closest("[data-k]"); if (!bloc) return;
    var p = etat.personnes[Number(bloc.getAttribute("data-k"))];
    if (ev.target.type === "number") {
      var v = Number(ev.target.value);
      p.naissance = v >= anneeMin && v <= anneeMax ? v : null;
      bloc.querySelector("[data-employeur]").hidden = !!(p.naissance && classe(p.naissance) === "K");
    } else if (ev.target.type === "checkbox") p.employeur = ev.target.checked;
  });
  boite.addEventListener("click", function (ev) {
    if (!ev.target.closest(".lamal-personne__retirer")) return;
    etat.personnes.splice(Number(ev.target.closest("[data-k]").getAttribute("data-k")), 1);
    renommerEnfants(); dessiner();
  });
  var renommerEnfants = function () {
    var n = 0;
    etat.personnes.forEach(function (p) { if (/^Enfant|^Votre enfant|^Autre enfant/.test(p.role)) { n++; p.role = coche("assures") === "Enfant" ? (n === 1 ? "Votre enfant" : "Enfant " + n) : "Enfant " + n; } });
  };
  boutonAjout.addEventListener("click", function () {
    etat.personnes.push({ role: "Enfant", naissance: null, employeur: false });
    renommerEnfants(); dessiner();
    boite.querySelector("#cmp-naiss-" + (etat.personnes.length - 1)).focus();
  });

  /* ---------- Caisse actuelle ---------- */
  var selActuelle = $("[data-lamal-actuelle]");
  var remplirActuelle = function () {
    if (!etat.index || !etat.donnees) return;
    var val = selActuelle.value, vus = {};
    etat.donnees.offres.forEach(function (o) { vus[o.c] = 1; });
    selActuelle.innerHTML = ['<option value="">Je ne sais pas ou je n\'en ai pas</option>'].concat(
      Object.keys(vus).map(function (c) { return [c, etat.index.caisses[c] || c]; })
        .sort(function (a, b) { return a[1].localeCompare(b[1], "fr"); })
        .map(function (x) { return '<option value="' + esc(x[1]) + '" data-code="' + x[0] + '">' + esc(x[1]) + "</option>"; })
    ).join("");
    if (val) selActuelle.value = val;
  };

  /* ---------- Calcul des offres ---------- */
  var franchiseAdulte = function () { var f = coche("franchise"); return f === "conseil" || !f ? 2500 : Number(f); };
  var groupeEnfant = function (o, rang, nb) {
    if (o.p.K4 && nb >= 2) return "K4";
    if (o.p.K5 && nb >= 3) return "K5";
    if (o.p.K3 && rang >= 3) return "K3";
    return "K1";
  };
  var primeOffre = function (o, personnes, fa) {
    var total = 0, detail = [], nbEnfants = 0, rang = 0;
    personnes.forEach(function (p) { if (classe(p.naissance) === "K") nbEnfants++; });
    for (var k = 0; k < personnes.length; k++) {
      var p = personnes[k], c = classe(p.naissance), fr = c === "K" ? 0 : fa;
      var g = c === "K" ? groupeEnfant(o, ++rang, nbEnfants) : c + "1";
      var accident = c === "K" || !p.employeur;
      var serie = o.p[g] && o.p[g][accident ? "A" : "S"];
      var idx = etat.index.franchises[c].indexOf(fr);
      var montant = serie ? serie[idx] : null;
      if (montant == null) return null;
      total += montant;
      detail.push({ role: p.role, classe: c, franchise: fr, accident: accident, prime: montant });
    }
    return { total: Math.round(total * 100) / 100, detail: detail };
  };
  var calculer = function () {
    etat.offres = []; etat.reference = null; etat.limite = PAR_PAGE;
    if (!etat.index || !etat.donnees) return;
    var region = regionChoisie(), personnes = etat.personnes.filter(function (p) { return p.naissance; });
    if (!personnes.length) return;
    var modele = coche("modele") || "TOUS", fa = franchiseAdulte();
    var codeActuelle = (selActuelle.selectedOptions[0] || {}).getAttribute ? selActuelle.selectedOptions[0].getAttribute("data-code") : null;
    etat.donnees.offres.forEach(function (o) {
      if (o.r !== region) return;
      var calc = primeOffre(o, personnes, fa);
      if (!calc) return;
      var offre = { o: o, caisse: etat.index.caisses[o.c] || o.c, total: calc.total, detail: calc.detail };
      if (codeActuelle && codeActuelle === o.c && o.y === "BASE") etat.reference = offre;
      if (modele === "TOUS" || o.y === modele || (modele === "PRAXIS" && o.y === "FLEX")) etat.offres.push(offre);
    });
    etat.offres.sort(function (a, b) { return a.total - b.total || a.caisse.localeCompare(b.caisse, "fr"); });
  };
  var resume = function () {
    var fa = franchiseAdulte();
    return etat.personnes.map(function (p) {
      var c = p.naissance ? classe(p.naissance) : "E";
      return p.role + " : " + (p.naissance || "?") + ", franchise " + (c === "K" ? 0 : fa) + (c !== "K" && p.employeur ? ", sans accidents" : ", avec accidents");
    }).join(" | ");
  };
  var remplirChamps = function () {
    var lieu = [form.querySelector('[name="domicile_npa"]').value, form.querySelector('[name="domicile_localite"]').value].join(" ").trim();
    champ("canton", etat.canton);
    champ("region_primes", coche("region_choix") === "?" ? "inconnue (calcul avec la région " + regionChoisie() + ")" : regionChoisie());
    champ("lieu", lieu + (etat.canton ? ", " + etat.canton : ""));
    champ("personnes", resume() + (coche("franchise") === "conseil" ? " (franchise à conseiller)" : ""));
    var m = coche("modele");
    champ("modeles", m === "TOUS" ? "Tous les modèles" : TYPES[m] || "");
    champ("nb_offres", etat.offres.length);
    var best = etat.offres[0];
    champ("meilleure_offre", best ? best.caisse + " – " + best.o.n + " (" + TYPES[best.o.y] + ")" : "");
    champ("prime_la_plus_basse", best ? best.total.toFixed(2) : "");
    champ("economie_possible", best && etat.reference ? Math.round((etat.reference.total - best.total) * 12) : "");
  };

  /* ---------- Aperçu flouté avant les coordonnées ---------- */
  var masque = function (x) { return chf(x).replace(/\d/g, "8"); };
  var apercu = function () {
    var zone = $("[data-lamal-apercu]"), offres = etat.offres;
    if (!offres.length) { zone.innerHTML = '<p class="fe__aide">Vos offres s\'affichent dès que vous indiquez vos coordonnées.</p>'; return; }
    var nbCaisses = {}; offres.forEach(function (x) { nbCaisses[x.o.c] = 1; });
    var ecart = (offres[offres.length - 1].total - offres[0].total) * 12;
    var eco = etat.reference ? (etat.reference.total - offres[0].total) * 12 : 0;
    zone.innerHTML =
      '<p class="lamal-apercu__titre"><strong>' + offres.length + " offres</strong> de " + Object.keys(nbCaisses).length + " caisses pour votre situation" +
      (eco > 50 ? ', jusqu\'à <strong class="lamal-apercu__eco">' + chf(eco, false) + " d'économie par an</strong> par rapport à votre caisse actuelle" :
        ecart > 50 ? ', avec jusqu\'à <strong class="lamal-apercu__eco">' + chf(ecart, false) + " d'écart par an</strong> entre les caisses" : "") + ".</p>" +
      '<ol class="lamal-apercu__liste" aria-hidden="true">' + offres.slice(0, 3).map(function (x, k) {
        return "<li><span>" + (k + 1) + '</span><span class="lamal-apercu__flou">Caisse maladie ' + "●●●●●".slice(0, 3 + k) + '</span><strong class="lamal-apercu__flou">' + masque(x.total) + "</strong></li>";
      }).join("") + "</ol>" +
      '<p class="apercu-prime__mois">' + '<svg class="icone icone--petite" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="2"/></svg> Affichées dès que vous indiquez vos coordonnées et votre adresse</p>';
  };

  /* ---------- Résultat ---------- */
  var afficherResultat = function () {
    var liste = $("[data-lamal-liste]"), synthese = $("[data-lamal-synthese]"), offres = etat.offres;
    if (!offres.length) {
      synthese.innerHTML = "<p><strong>Aucune offre ne correspond.</strong> Modifiez le modèle ou la franchise, ou demandez conseil : un conseiller vous rappelle.</p>";
      liste.innerHTML = ""; $("[data-lamal-plus]").hidden = true; $("[data-lamal-franchise]").hidden = true;
      return;
    }
    var min = offres[0].total, max = offres[offres.length - 1].total;
    synthese.innerHTML =
      '<div class="cmp__chiffre"><span>Prime la plus basse</span><strong>' + chf(min) + "</strong><small>par mois</small></div>" +
      '<div class="cmp__chiffre"><span>Écart entre les offres</span><strong>' + chf((max - min) * 12, false) + "</strong><small>par an</small></div>" +
      (etat.reference ? '<div class="cmp__chiffre cmp__chiffre--ref"><span>' + esc(etat.reference.caisse) + ", modèle standard</span><strong>" + chf(etat.reference.total) + "</strong><small>par mois en " + annee + "</small></div>" : "");
    liste.innerHTML = offres.slice(0, etat.limite).map(function (x, k) {
      var o = x.o, diff = etat.reference ? (x.total - etat.reference.total) * 12 : null;
      var ecart = diff === null ? "" : Math.abs(diff) < 1 ? '<span class="cmp-offre__diff">même prime que votre caisse actuelle</span>' :
        '<span class="cmp-offre__diff' + (diff < 0 ? " cmp-offre__diff--moins" : "") + '">' + (diff < 0 ? "−" : "+") + chf(Math.abs(diff), false) + " par an par rapport à votre caisse actuelle</span>";
      var restreint = o.b ? '<span class="cmp-offre__note">Disponible seulement dans certaines communes</span>' : "";
      var detail = x.detail.map(function (d) {
        return "<li><span>" + esc(d.role) + " (" + LIB_CLASSE[d.classe] + "), franchise " + chf(d.franchise, false) + (d.accident ? ", avec accidents" : ", sans accidents") + "</span><strong>" + chf(d.prime) + "</strong></li>";
      }).join("");
      return '<li class="cmp-offre' + (k === 0 ? " cmp-offre--premiere" : "") + '">' +
        '<div class="cmp-offre__rang">' + (k + 1) + "</div>" +
        '<div class="cmp-offre__infos"><p class="cmp-offre__caisse">' + esc(x.caisse) + '</p><p class="cmp-offre__modele">' + esc(o.n) + ' <span class="cmp-offre__type cmp-offre__type--' + o.y.toLowerCase() + '">' + TYPES[o.y] + "</span></p>" + restreint + ecart + "</div>" +
        '<div class="cmp-offre__prix"><strong>' + chf(x.total) + "</strong><span>par mois · " + chf(x.total * 12, false) + " par an</span></div>" +
        '<div class="cmp-offre__actions"><button type="submit" class="bouton bouton--prive" data-lamal-offre="' + k + '">Je choisis cette offre</button>' +
        '<details class="cmp-offre__detail"><summary>Détail</summary><ul>' + detail + "</ul></details></div></li>";
    }).join("");
    var plus = $("[data-lamal-plus]");
    plus.hidden = offres.length <= etat.limite;
    plus.textContent = "Voir plus d'offres (" + (offres.length - etat.limite) + " restantes)";
    franchise();
  };
  $("[data-lamal-plus]").addEventListener("click", function () { etat.limite += PAR_PAGE; afficherResultat(); });
  // Choisir une offre : la demande finale part avec l'offre choisie (fusionnée avec le lead déjà enregistré)
  $("[data-lamal-liste]").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-lamal-offre]");
    if (!b) return;
    var x = etat.offres[Number(b.getAttribute("data-lamal-offre"))];
    champ("offre_choisie", x.caisse + " – " + x.o.n + " (" + TYPES[x.o.y] + ")");
    champ("prime_mensuelle", x.total.toFixed(2));
    var action = form.querySelector("[data-funnel-action]"); if (action) action.value = "Offre choisie : être accompagné pour le changement";
    var etape = form.querySelector("[data-funnel-etat]"); if (etape) etape.value = "offre choisie";
  });

  /* ---------- Quelle franchise ? ---------- */
  var frais = $("[data-lamal-frais]");
  var franchise = function () {
    var bloc = $("[data-lamal-franchise]"), meilleure = etat.offres[0];
    var p = etat.personnes.filter(function (q) { return q.naissance && classe(q.naissance) !== "K"; })[0];
    if (!meilleure || !p) { bloc.hidden = true; return; }
    var c = classe(p.naissance), serie = meilleure.o.p[c + "1"] && meilleure.o.p[c + "1"][p.employeur ? "S" : "A"];
    if (!serie) { bloc.hidden = true; return; }
    bloc.hidden = false;
    var f = Number(frais.value);
    $("[data-lamal-frais-val]").textContent = chf(f, false);
    $("[data-lamal-franchise-intro]").textContent = p.role + ", avec l'offre la moins chère (" + meilleure.caisse + ", " + meilleure.o.n + ") : coût total sur une année selon la franchise.";
    var couts = etat.index.franchises[c].map(function (fr, i) {
      if (serie[i] == null) return null;
      var primes = serie[i] * 12;
      return { fr: fr, total: primes + Math.min(f, fr) + Math.min(Math.max(f - fr, 0) * 0.1, 700), primes: primes };
    });
    var min = Math.min.apply(null, couts.filter(Boolean).map(function (x) { return x.total; }));
    $("[data-lamal-franchise-grille]").innerHTML = couts.map(function (x) {
      if (!x) return "";
      return '<div class="cmp-fr' + (x.total === min ? " cmp-fr--meilleure" : "") + '"><span>Franchise ' + chf(x.fr, false) + "</span><strong>" + chf(x.total, false) + "</strong><small>dont primes " + chf(x.primes, false) + "</small>" + (x.total === min ? "<em>La plus avantageuse</em>" : "") + "</div>";
    }).join("");
  };
  frais.addEventListener("input", franchise);

  /* ---------- Suivi des étapes (événement envoyé par site.js) ---------- */
  var entrer = function (cle) {
    if (cle === "naissances") preparerPersonnes();
    if (cle === "adresse") {
      $("[data-lamal-rappel-lieu]").textContent = "Domicile : " + [form.querySelector('[name="domicile_npa"]').value, form.querySelector('[name="domicile_localite"]').value].join(" ") + (etat.canton ? " (" + etat.canton + ")" : "") + ".";
    }
    if (cle === "coordonnees" || cle === "resultat" || cle === "actuelle" || cle === "adresse") {
      pret.then(function () {
        if (!etat.donnees && cantonChoisi()) return charger(cantonChoisi()).then(function (d) { etat.donnees = d; etat.canton = cantonChoisi(); remplirActuelle(); });
      }).then(function () {
        calculer(); remplirChamps();
        if (cle === "coordonnees") apercu();
        if (cle === "resultat") afficherResultat();
      });
    }
  };
  funnel.addEventListener("funnel:etape", function (ev) { entrer(ev.detail.cle); });
  // Les champs cachés restent à jour avant l'envoi (bouton « Voir mes offres »)
  form.addEventListener("change", function () { if (etat.donnees && etat.personnes.length) { calculer(); remplirChamps(); } });
  // Étape visible au chargement (site.js a déjà démarré le parcours)
  var visible = funnel.querySelector("[data-fe]:not([hidden])");
  if (visible) entrer(visible.getAttribute("data-fe"));
})();
