/* Comparateur LAMal : primes OFSP (static/data/lamal/), calcul dans le navigateur. */
(function () {
  "use strict";
  var script = document.currentScript;
  var DONNEES = script && script.src ? new URL("../data/lamal/", script.src).href : "/data/lamal/";
  var racine = document.querySelector("[data-cmp]");
  if (!racine) return;

  var $ = function (sel) { return racine.querySelector(sel); };
  var page = document.querySelector(".cmp-page");
  var TYPES = { BASE: "Standard", PRAXIS: "Médecin de famille ou HMO", TEL_DIG: "Télémédecine", FLEX: "Mixte", PHARM: "Pharmacie" };
  var PAR_PAGE = 20;
  var etat = { index: null, donnees: null, lieu: null, personnes: [], limite: PAR_PAGE, offres: [], choisie: null };
  var cache = {};

  var chf = function (x, dec) {
    var s = (dec === false ? Math.round(x).toString() : x.toFixed(2));
    var p = s.split(".");
    return "CHF " + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'") + (p[1] ? "." + p[1] : "");
  };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var norm = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").trim(); };
  var annee = Number(racine.getAttribute("data-annee"));

  /* ---------- Personnes ---------- */
  var classe = function (naissance) {
    var age = annee - naissance;
    return age <= 18 ? "K" : age <= 25 ? "J" : "E";
  };
  var LIB_CLASSE = { K: "enfant", J: "jeune adulte", E: "adulte" };
  var boitePersonnes = $("[data-cmp-personnes]");

  var franchisesDe = function (c) { return (etat.index ? etat.index.franchises[c] : (c === "K" ? [0, 100, 200, 300, 400, 500, 600] : [300, 500, 1000, 1500, 2000, 2500])); };

  var dessinerPersonnes = function () {
    boitePersonnes.innerHTML = "";
    etat.personnes.forEach(function (p, k) {
      var carte = document.createElement("div");
      carte.className = "cmp-personne";
      var c = p.naissance ? classe(p.naissance) : null;
      var fr = franchisesDe(c || "E");
      carte.innerHTML =
        '<div class="cmp-personne__haut"><strong>Personne ' + (k + 1) + '</strong><span class="cmp-personne__classe">' + (c ? LIB_CLASSE[c] : "") + "</span>" +
        (etat.personnes.length > 1 ? '<button type="button" class="cmp-personne__retirer" aria-label="Retirer la personne ' + (k + 1) + '">Retirer</button>' : "") + "</div>" +
        '<div class="grille-champs">' +
        '<div class="champ"><label for="cmp-naiss-' + k + '">Année de naissance</label><input id="cmp-naiss-' + k + '" type="number" inputmode="numeric" min="1900" max="' + annee + '" placeholder="Ex. 1988" value="' + (p.naissance || "") + '" data-p="naissance"></div>' +
        '<div class="champ"><label for="cmp-fr-' + k + '">Franchise</label><select id="cmp-fr-' + k + '" data-p="franchise">' +
        fr.map(function (f) { return '<option value="' + f + '"' + (f === p.franchise ? " selected" : "") + ">" + chf(f, false) + "</option>"; }).join("") + "</select></div>" +
        "</div>" +
        '<label class="cmp-personne__accident"><input type="checkbox" data-p="accident"' + (p.accident ? " checked" : "") + "> Avec couverture accidents" +
        '<span class="fe__aide">À décocher si vous travaillez au moins 8 heures par semaine chez le même employeur.</span></label>';
      carte.addEventListener("input", function (ev) {
        var el = ev.target, cle = el.getAttribute("data-p");
        if (cle === "naissance") {
          var v = Number(el.value);
          var ancien = p.naissance ? classe(p.naissance) : null;
          p.naissance = v >= 1900 && v <= annee && String(v).length === 4 ? v : null;
          var nouveau = p.naissance ? classe(p.naissance) : null;
          if (nouveau && nouveau !== ancien) {
            var liste = franchisesDe(nouveau);
            if (!ancien || liste.indexOf(p.franchise) < 0) p.franchise = liste[0];
            var pos = el.selectionStart;
            dessinerPersonnes();
            var champ = boitePersonnes.querySelector("#cmp-naiss-" + k);
            champ.focus(); try { champ.setSelectionRange(pos, pos); } catch (e) {}
          }
        } else if (cle === "franchise") p.franchise = Number(el.value);
        else if (cle === "accident") p.accident = el.checked;
        calculer();
      });
      var retirer = carte.querySelector(".cmp-personne__retirer");
      if (retirer) retirer.addEventListener("click", function () { etat.personnes.splice(k, 1); dessinerPersonnes(); calculer(); });
      boitePersonnes.appendChild(carte);
    });
  };
  $("[data-cmp-ajouter]").addEventListener("click", function () {
    etat.personnes.push({ naissance: null, franchise: 300, accident: true });
    dessinerPersonnes();
    boitePersonnes.querySelector("#cmp-naiss-" + (etat.personnes.length - 1)).focus();
  });
  etat.personnes.push({ naissance: null, franchise: 300, accident: true });
  dessinerPersonnes();

  /* ---------- Lieu ---------- */
  var selCanton = $("[data-cmp-canton]"), selRegion = $("[data-cmp-region]"), blocRegion = $("[data-cmp-region-bloc]");
  var charger = function (canton) {
    if (cache[canton]) return Promise.resolve(cache[canton]);
    return fetch(DONNEES + canton + ".json").then(function (r) { return r.json(); }).then(function (d) { cache[canton] = d; return d; });
  };
  var choisirCanton = function (canton, region, extra) {
    if (!canton) { etat.donnees = null; etat.lieu = null; blocRegion.hidden = true; $("[data-cmp-region-aide]").hidden = true; calculer(); return; }
    $("[data-cmp-chargement]").hidden = false;
    charger(canton).then(function (d) {
      $("[data-cmp-chargement]").hidden = true;
      etat.donnees = d;
      selCanton.value = canton;
      var multi = d.regions.length > 1;
      selRegion.innerHTML = d.regions.map(function (r) { return '<option value="' + r + '">Région ' + r + "</option>"; }).join("");
      if (region && d.regions.indexOf(region) >= 0) selRegion.value = region;
      blocRegion.hidden = !multi || !!(extra && extra.bfs);
      $("[data-cmp-region-aide]").hidden = !multi || !!(extra && extra.bfs);
      etat.lieu = { canton: canton, region: selRegion.value, bfs: extra ? extra.bfs : null, libelle: extra ? extra.libelle : canton + (multi ? ", région " + selRegion.value : "") };
      remplirActuelle();
      calculer();
    }).catch(function () {
      $("[data-cmp-chargement]").textContent = "Les primes n'ont pas pu être chargées. Vérifiez votre connexion et réessayez.";
    });
  };
  selCanton.addEventListener("change", function () { choisirCanton(selCanton.value); });
  selRegion.addEventListener("change", function () {
    if (!etat.lieu) return;
    etat.lieu.region = selRegion.value;
    etat.lieu.libelle = etat.lieu.canton + ", région " + selRegion.value;
    calculer();
  });

  // Recherche par NPA ou localité (fichier des régions de primes de l'OFSP)
  var initRecherche = function () {
    var communes = etat.index.communes || [];
    if (!communes.length) return;
    var bloc = $("[data-cmp-lieu-recherche]"), champ = $("[data-cmp-lieu]"), liste = $("[data-cmp-suggestions]"), choisi = $("[data-cmp-lieu-choisi]");
    bloc.hidden = false;
    $("[data-cmp-manuel]").hidden = true;
    var lien = document.createElement("button");
    lien.type = "button"; lien.className = "lien-bouton cmp__manuel"; lien.textContent = "Choisir le canton et la région à la place";
    lien.addEventListener("click", function () { $("[data-cmp-manuel]").hidden = false; lien.hidden = true; });
    bloc.appendChild(lien);
    var index = communes.map(function (c) { return { c: c, cle: norm(c[0] + " " + c[1] + " " + c[2]) }; });
    var actives = [], pos = -1;
    var fermer = function () { liste.hidden = true; champ.setAttribute("aria-expanded", "false"); pos = -1; };
    var appliquer = function (c) {
      var lib = c[0] + " " + c[1] + (c[2] && norm(c[2]) !== norm(c[1]) ? " (commune de " + c[2] + ")" : "") + ", " + c[4];
      champ.value = c[0] + " " + c[1];
      choisi.hidden = false;
      choisi.textContent = lib + " · région de primes " + c[5];
      fermer();
      choisirCanton(c[4], c[5], { bfs: Number(c[3]) || null, libelle: lib + ", région " + c[5] });
    };
    champ.addEventListener("input", function () {
      var q = norm(champ.value);
      if (q.length < 2) { fermer(); return; }
      var mots = q.split(/\s+/);
      actives = index.filter(function (x) { return mots.every(function (m) { return x.cle.indexOf(m) === 0 || x.cle.indexOf(" " + m) >= 0; }); }).slice(0, 8);
      liste.innerHTML = actives.length ? actives.map(function (x, k) {
        return '<li role="option" id="cmp-s-' + k + '" data-k="' + k + '"><strong>' + esc(x.c[0]) + "</strong> " + esc(x.c[1]) + (x.c[2] && norm(x.c[2]) !== norm(x.c[1]) ? ' <span>' + esc(x.c[2]) + "</span>" : "") + " <em>" + esc(x.c[4]) + "</em></li>";
      }).join("") : '<li class="cmp__aucun">Aucune localité trouvée</li>';
      liste.hidden = false; champ.setAttribute("aria-expanded", "true"); pos = -1;
    });
    liste.addEventListener("mousedown", function (ev) {
      var li = ev.target.closest("[data-k]");
      if (li) { ev.preventDefault(); appliquer(actives[Number(li.getAttribute("data-k"))].c); }
    });
    champ.addEventListener("keydown", function (ev) {
      if (liste.hidden || !actives.length) return;
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        pos = (pos + (ev.key === "ArrowDown" ? 1 : -1) + actives.length) % actives.length;
        liste.querySelectorAll("[data-k]").forEach(function (li, k) { li.classList.toggle("actif", k === pos); });
        champ.setAttribute("aria-activedescendant", "cmp-s-" + pos);
      } else if (ev.key === "Enter") { ev.preventDefault(); appliquer(actives[Math.max(pos, 0)].c); }
      else if (ev.key === "Escape") fermer();
    });
    champ.addEventListener("blur", function () { setTimeout(fermer, 150); });
  };

  /* ---------- Caisse actuelle ---------- */
  var selActuelle = $("[data-cmp-actuelle]");
  var actuelleVoulue = "";
  var remplirActuelle = function () {
    var val = actuelleVoulue || selActuelle.value, vus = {};
    actuelleVoulue = "";
    var opts = ['<option value="">Je ne sais pas ou je n\'en ai pas</option>'];
    (etat.donnees ? etat.donnees.offres : []).forEach(function (o) { vus[o.c] = 1; });
    Object.keys(vus).map(function (c) { return [c, etat.index.caisses[c]]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1], "fr"); })
      .forEach(function (x) { opts.push('<option value="' + x[0] + '">' + esc(x[1]) + "</option>"); });
    selActuelle.innerHTML = opts.join("");
    if (vus[val]) selActuelle.value = val;
  };
  selActuelle.addEventListener("change", function () { calculer(); });

  /* ---------- Calcul ---------- */
  var modeles = function () { return Array.prototype.slice.call(racine.querySelectorAll("[data-cmp-modele]:checked")).map(function (x) { return x.value; }); };
  racine.querySelectorAll("[data-cmp-modele]").forEach(function (x) { x.addEventListener("change", calculer); });
  $("[data-cmp-tri]").addEventListener("change", function () { trier(); afficher(); });

  // Sous-groupe d'âge des enfants selon les rabais famille de la caisse
  var groupeEnfant = function (o, rang, nb) {
    if (o.p.K4 && nb >= 2) return "K4";
    if (o.p.K5 && nb >= 3) return "K5";
    if (o.p.K3 && rang >= 3) return "K3";
    return "K1";
  };
  var primeOffre = function (o, personnes) {
    var total = 0, detail = [], nbEnfants = 0, rang = 0;
    personnes.forEach(function (p) { if (classe(p.naissance) === "K") nbEnfants++; });
    for (var k = 0; k < personnes.length; k++) {
      var p = personnes[k], c = classe(p.naissance);
      var g = c === "K" ? groupeEnfant(o, ++rang, nbEnfants) : c + "1";
      var serie = o.p[g] && o.p[g][p.accident ? "A" : "S"];
      var idx = etat.index.franchises[c].indexOf(p.franchise);
      var montant = serie ? serie[idx] : null;
      if (montant == null) return null;
      total += montant;
      detail.push({ personne: k + 1, classe: c, franchise: p.franchise, accident: p.accident, prime: montant, rabais: g === "K3" || g === "K4" || g === "K5" });
    }
    return { total: Math.round(total * 100) / 100, detail: detail };
  };

  var trier = function () {
    var tri = $("[data-cmp-tri]").value;
    etat.offres.sort(function (a, b) {
      return tri === "caisse" ? (a.caisse.localeCompare(b.caisse, "fr") || a.total - b.total) : (a.total - b.total || a.caisse.localeCompare(b.caisse, "fr"));
    });
  };

  var reference = null;
  function calculer() {
    var vide = $("[data-cmp-vide]"), blocListe = $("[data-cmp-liste-bloc]");
    var personnes = etat.personnes.filter(function (p) { return p.naissance; });
    majChamps();
    if (!etat.index || !etat.donnees || !etat.lieu) {
      vide.hidden = false; blocListe.hidden = true;
      vide.querySelector("p").innerHTML = "<strong>Commencez par votre lieu de domicile.</strong> Les primes dépendent du canton et de la région de primes.";
      return;
    }
    if (!personnes.length || personnes.length < etat.personnes.length) {
      vide.hidden = false; blocListe.hidden = true;
      vide.querySelector("p").innerHTML = "<strong>Indiquez l'année de naissance" + (etat.personnes.length > 1 ? " de chaque personne" : "") + ".</strong> La prime dépend de la classe d'âge : enfant, jeune adulte ou adulte.";
      return;
    }
    var types = modeles(), lieu = etat.lieu;
    etat.offres = [];
    reference = null;
    etat.donnees.offres.forEach(function (o) {
      if (o.r !== lieu.region) return;
      if (o.b && lieu.bfs && o.b.indexOf(lieu.bfs) < 0) return;
      var calc = primeOffre(o, personnes);
      if (!calc) return;
      var offre = { o: o, caisse: etat.index.caisses[o.c] || o.c, total: calc.total, detail: calc.detail };
      if (selActuelle.value === o.c && o.y === "BASE") reference = offre;
      if (types.indexOf(o.y) >= 0) etat.offres.push(offre);
    });
    trier();
    etat.limite = PAR_PAGE;
    vide.hidden = true; blocListe.hidden = false;
    afficher();
  }

  var afficher = function () {
    var liste = $("[data-cmp-liste]"), offres = etat.offres;
    var synthese = $("[data-cmp-synthese]");
    if (!offres.length) {
      synthese.innerHTML = "<p><strong>Aucune offre ne correspond.</strong> Cochez d'autres modèles d'assurance ou vérifiez les franchises choisies.</p>";
      liste.innerHTML = ""; $("[data-cmp-plus]").hidden = true; $("[data-cmp-compte]").textContent = ""; $("[data-cmp-franchise]").hidden = true;
      return;
    }
    var prix = offres.map(function (x) { return x.total; });
    var min = Math.min.apply(null, prix), max = Math.max.apply(null, prix);
    var nbCaisses = {}; offres.forEach(function (x) { nbCaisses[x.o.c] = 1; });
    synthese.innerHTML =
      '<div class="cmp__chiffre"><span>Offres</span><strong>' + offres.length + "</strong><small>" + Object.keys(nbCaisses).length + " caisses</small></div>" +
      '<div class="cmp__chiffre"><span>Prime la plus basse</span><strong>' + chf(min) + "</strong><small>par mois</small></div>" +
      '<div class="cmp__chiffre"><span>Écart entre les offres</span><strong>' + chf((max - min) * 12, false) + "</strong><small>par an</small></div>" +
      (reference ? '<div class="cmp__chiffre cmp__chiffre--ref"><span>' + esc(reference.caisse) + ", modèle standard</span><strong>" + chf(reference.total) + "</strong><small>par mois en " + annee + "</small></div>" : "");
    $("[data-cmp-compte]").textContent = etat.lieu.libelle;
    var html = [];
    offres.slice(0, etat.limite).forEach(function (x, k) {
      var o = x.o, diff = reference ? (x.total - reference.total) * 12 : null;
      var ecart = diff === null ? "" : Math.abs(diff) < 1 ? '<span class="cmp-offre__diff">même prime que votre caisse actuelle</span>' :
        '<span class="cmp-offre__diff' + (diff < 0 ? " cmp-offre__diff--moins" : "") + '">' + (diff < 0 ? "−" : "+") + chf(Math.abs(diff), false) + " par an par rapport à votre caisse actuelle</span>";
      var restreint = o.b && !etat.lieu.bfs ? '<span class="cmp-offre__note">Disponible seulement dans certaines communes</span>' : "";
      var detail = x.detail.map(function (d) {
        return "<li><span>Personne " + d.personne + " (" + LIB_CLASSE[d.classe] + "), franchise " + chf(d.franchise, false) + (d.accident ? ", avec accidents" : ", sans accidents") + (d.rabais ? ", rabais famille" : "") + "</span><strong>" + chf(d.prime) + "</strong></li>";
      }).join("");
      html.push(
        '<li class="cmp-offre' + (k === 0 && $("[data-cmp-tri]").value === "prix" ? " cmp-offre--premiere" : "") + '">' +
        '<div class="cmp-offre__rang">' + (k + 1) + "</div>" +
        '<div class="cmp-offre__infos"><p class="cmp-offre__caisse">' + esc(x.caisse) + '</p><p class="cmp-offre__modele">' + esc(o.n) + ' <span class="cmp-offre__type cmp-offre__type--' + o.y.toLowerCase() + '">' + TYPES[o.y] + "</span></p>" + restreint + ecart + "</div>" +
        '<div class="cmp-offre__prix"><strong>' + chf(x.total) + "</strong><span>par mois · " + chf(x.total * 12, false) + " par an</span></div>" +
        '<div class="cmp-offre__actions"><button type="button" class="bouton bouton--prive" data-conseil="' + k + '">Être conseillé</button>' +
        '<details class="cmp-offre__detail"><summary>Détail</summary><ul>' + detail + "</ul></details></div>" +
        "</li>");
    });
    liste.innerHTML = html.join("");
    $("[data-cmp-plus]").hidden = offres.length <= etat.limite;
    $("[data-cmp-plus]").textContent = "Voir plus d'offres (" + (offres.length - etat.limite) + " restantes)";
    franchise();
  };
  $("[data-cmp-plus]").addEventListener("click", function () { etat.limite += PAR_PAGE; afficher(); });

  /* ---------- Quelle franchise ? ---------- */
  var frais = $("[data-cmp-frais]");
  var franchise = function () {
    var bloc = $("[data-cmp-franchise]");
    var meilleure = etat.offres.slice().sort(function (a, b) { return a.total - b.total; })[0];
    var k = etat.personnes.findIndex(function (p) { return p.naissance && classe(p.naissance) !== "K"; });
    if (!meilleure || k < 0) { bloc.hidden = true; return; }
    var p = etat.personnes[k], c = classe(p.naissance), serie = meilleure.o.p[c + "1"] && meilleure.o.p[c + "1"][p.accident ? "A" : "S"];
    if (!serie) { bloc.hidden = true; return; }
    bloc.hidden = false;
    var f = Number(frais.value);
    $("[data-cmp-frais-val]").textContent = chf(f, false);
    $("[data-cmp-franchise-intro]").textContent = "Pour la personne " + (k + 1) + ", avec l'offre la moins chère (" + meilleure.caisse + ", " + meilleure.o.n + ") : coût total sur une année selon la franchise.";
    var couts = etat.index.franchises[c].map(function (fr, i) {
      if (serie[i] == null) return null;
      var primes = serie[i] * 12, partFr = Math.min(f, fr), quote = Math.min(Math.max(f - fr, 0) * 0.1, 700);
      return { fr: fr, total: primes + partFr + quote, primes: primes };
    });
    var min = Math.min.apply(null, couts.filter(Boolean).map(function (x) { return x.total; }));
    $("[data-cmp-franchise-grille]").innerHTML = couts.map(function (x) {
      if (!x) return "";
      return '<div class="cmp-fr' + (x.total === min ? " cmp-fr--meilleure" : "") + '"><span>Franchise ' + chf(x.fr, false) + "</span><strong>" + chf(x.total, false) + '</strong><small>dont primes ' + chf(x.primes, false) + "</small>" + (x.total === min ? '<em>La plus avantageuse</em>' : "") + "</div>";
    }).join("");
  };
  frais.addEventListener("input", franchise);

  /* ---------- Demande de conseil : page séparée avec l'offre choisie ---------- */
  var pageConseil = /index\.html$/.test(location.pathname) ? "conseil/index.html" : "/particuliers/comparateur-lamal/conseil/";
  var contexte = function () {
    return {
      lieu: etat.lieu ? etat.lieu.libelle : "",
      personnes: etat.personnes.map(function (p, k) {
        return "Personne " + (k + 1) + " : " + (p.naissance || "?") + ", franchise " + p.franchise + (p.accident ? ", avec accidents" : ", sans accidents");
      }).join(" | "),
      modeles: modeles().map(function (m) { return TYPES[m]; }).join(", "),
      actuelle: selActuelle.value && etat.index ? etat.index.caisses[selActuelle.value] : ""
    };
  };
  function majChamps() {
    try {
      sessionStorage.setItem("assuravia-cmp", JSON.stringify({ lieu: etat.lieu, personnes: etat.personnes, modeles: modeles(), actuelle: selActuelle.value }));
    } catch (e) {}
    var lien = document.querySelector("[data-cmp-conseil-general]");
    if (lien) lien.href = pageConseil + "?" + new URLSearchParams(contexte()).toString();
  }
  $("[data-cmp-liste]").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-conseil]");
    if (!b) return;
    var x = etat.offres[Number(b.getAttribute("data-conseil"))];
    var c = contexte(), nb = etat.personnes.length;
    c.caisse = x.caisse;
    c.modele = x.o.n + " (" + TYPES[x.o.y] + ")";
    c.offre = x.caisse + " – " + x.o.n + " (" + TYPES[x.o.y] + ")";
    c.prime = x.total.toFixed(2);
    c.resume = nb + (nb > 1 ? " personnes" : " personne") + ", franchise " + etat.personnes.map(function (p) { return p.franchise; }).join(" / ");
    location.href = pageConseil + "?" + new URLSearchParams(c).toString();
  });

  /* ---------- Démarrage ---------- */
  fetch(DONNEES + "index.json").then(function (r) { return r.json(); }).then(function (idx) {
    etat.index = idx;
    annee = idx.annee || annee;
    initRecherche();
    var q = new URLSearchParams(location.search);
    var sauve = null;
    try { sauve = JSON.parse(sessionStorage.getItem("assuravia-cmp") || "null"); } catch (e) {}
    if (q.get("canton")) choisirCanton(q.get("canton").toUpperCase(), q.get("region"));
    else if (sauve && sauve.lieu) {
      // Retour depuis la page de conseil : on retrouve les mêmes réglages
      if (sauve.personnes && sauve.personnes.length) { etat.personnes = sauve.personnes; dessinerPersonnes(); }
      racine.querySelectorAll("[data-cmp-modele]").forEach(function (x) { x.checked = (sauve.modeles || []).indexOf(x.value) >= 0; });
      actuelleVoulue = sauve.actuelle || "";
      var l = sauve.lieu;
      if (l.bfs) { var ch = $("[data-cmp-lieu]"), ok = $("[data-cmp-lieu-choisi]"); if (ch) ch.value = l.libelle.split(",")[0]; if (ok) { ok.hidden = false; ok.textContent = l.libelle; } }
      choisirCanton(l.canton, l.region, l.bfs ? { bfs: l.bfs, libelle: l.libelle } : null);
    }
    else calculer();
  }).catch(function () {
    $("[data-cmp-vide]").querySelector("p").textContent = "Les primes n'ont pas pu être chargées. Vérifiez votre connexion et réessayez.";
  });
  if (page) page.classList.add("cmp-pret");
})();
