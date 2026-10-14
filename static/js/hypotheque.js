/* Comparateur de taux hypothécaires : cartes, calculateur, tableau et graphique.
   Données : static/data/hypotheques.json (BNS), intégrées à la page dans [data-hypo-taux]. */
(function () {
  "use strict";
  var source = document.querySelector("[data-hypo-taux]");
  var racine = document.querySelector("[data-hypo]");
  if (!source || !racine) return;
  var T = JSON.parse(source.textContent);
  var parCle = {};
  T.taux.forEach(function (t) { parCle[t.cle] = t; });

  var chf = function (x) { return "CHF " + Math.round(x).toLocaleString("fr-CH").replace(/ |\s/g, "'"); };
  var pct = function (x, d) { return x.toFixed(d === undefined ? 2 : d).replace(".", ",") + " %"; };
  var champ = function (n) { return racine.querySelector('[data-hypo-champ="' + n + '"]'); };
  var sortie = function (n, v) { var el = racine.querySelector('[data-hypo-sortie="' + n + '"]'); if (el) el.textContent = v; };
  var nombre = function (n) { var v = Number(champ(n).value); return isFinite(v) && v > 0 ? v : 0; };

  var jauge = function (nom, ratio, etat) {
    var j = racine.querySelector('[data-hypo-jauge="' + nom + '"]');
    j.querySelector("div > span").style.width = Math.min(100, Math.max(0, ratio * 100)) + "%";
    j.setAttribute("data-etat", etat);
  };

  function calculer() {
    var prix = nombre("prix"), fp = Math.min(nombre("fp"), prix), revenu = nombre("revenu");
    var t = parCle[champ("produit").value] || T.taux[0];
    var montant = Math.max(0, prix - fp);
    var interetsAn = montant * t.moyenne / 100;
    // Amortissement du 2e rang : la part au-delà des 2/3 du prix, en 15 ans
    var amortAn = Math.max(0, montant - prix * 2 / 3) / 15;
    var entretienAn = prix * 0.01;
    var mensuel = (interetsAn + amortAn + entretienAn) / 12;
    sortie("mensuel", chf(mensuel));
    sortie("montant", chf(montant));
    sortie("taux", "à " + pct(t.moyenne));
    sortie("interets", chf(interetsAn / 12) + " / mois");
    sortie("amort", chf(amortAn / 12) + " / mois");
    sortie("entretien", chf(entretienAn / 12) + " / mois");
    sortie("fourchette", t.q1 != null ? "Selon votre dossier, les intérêts se situent le plus souvent entre " + chf(montant * t.q1 / 1200) + " et " + chf(montant * t.q3 / 1200) + " par mois." : "");

    var ltv = prix ? montant / prix : 0;
    sortie("ltv", pct(ltv * 100, 0));
    var fpOk = ltv <= 0.8;
    jauge("financement", ltv / 0.8 * 0.8, fpOk ? "ok" : "alerte");
    sortie("ltv-msg", fpOk ? "Dans la limite usuelle de 80 % du prix." : "Au-delà de 80 % : il faut en principe au moins " + chf(prix * 0.2) + " de fonds propres.");

    var chargesTheo = montant * 0.05 + amortAn + entretienAn;
    var ratio = revenu ? chargesTheo / revenu : 1;
    sortie("capacite", revenu ? pct(ratio * 100, 0) : "–");
    var etat = ratio <= 1 / 3 ? "ok" : ratio <= 0.38 ? "attention" : "alerte";
    jauge("capacite", ratio, etat);
    sortie("capacite-msg", !revenu ? "Indiquez votre revenu pour vérifier votre capacité." :
      etat === "ok" ? "Dans la limite usuelle d'un tiers du revenu brut." :
      etat === "attention" ? "Légèrement au-dessus d'un tiers : un spécialiste peut étudier des solutions." :
      "Au-dessus de la limite usuelle d'un tiers. Il faudrait plus de fonds propres ou un revenu plus élevé.");

    document.querySelectorAll("[data-hypo-table] tr").forEach(function (tr) {
      var x = parCle[tr.getAttribute("data-cle")];
      tr.querySelector("[data-an]").textContent = chf(montant * x.moyenne / 100);
      tr.querySelector("[data-mois]").textContent = chf(montant * x.moyenne / 1200);
      tr.classList.toggle("hypo-table__choisie", x.cle === t.cle);
    });
    document.querySelectorAll("[data-hypo-choisir]").forEach(function (b) {
      var oui = b.getAttribute("data-hypo-choisir") === t.cle;
      b.classList.toggle("hypo-carte--choisie", oui);
      b.setAttribute("aria-pressed", oui ? "true" : "false");
    });
  }

  racine.addEventListener("input", calculer);
  racine.addEventListener("change", calculer);
  document.querySelectorAll("[data-hypo-choisir]").forEach(function (b) {
    b.addEventListener("click", function () {
      champ("produit").value = b.getAttribute("data-hypo-choisir");
      calculer();
      document.getElementById("calcul").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  calculer();

  // Petites courbes sur les cartes
  var H = T.historique;
  document.querySelectorAll("[data-hypo-courbe]").forEach(function (svg) {
    var v = H[svg.getAttribute("data-hypo-courbe")];
    if (!v || v.length < 2) return;
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), e = (mx - mn) || 1;
    var pts = v.map(function (y, k) { return (k / (v.length - 1) * 100).toFixed(1) + "," + (26 - (y - mn) / e * 24).toFixed(1); }).join(" ");
    svg.innerHTML = '<polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>';
  });

  // Graphique d'évolution
  var g = document.querySelector("[data-hypo-graphe] svg");
  if (g && H.mois.length > 1) {
    var series = ["saron", "fixe5", "fixe10"];
    var toutes = [];
    series.forEach(function (s) { toutes = toutes.concat(H[s]); });
    var bas = Math.floor(Math.min.apply(null, toutes) * 4) / 4, haut = Math.ceil(Math.max.apply(null, toutes) * 4) / 4;
    if (haut - bas < 0.5) haut = bas + 0.5;
    var W = 640, Hh = 260, ml = 48, mr = 12, mt = 12, mb = 32;
    var x = function (k) { return ml + k / (H.mois.length - 1) * (W - ml - mr); };
    var y = function (v) { return mt + (haut - v) / (haut - bas) * (Hh - mt - mb); };
    var MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    var svg = "";
    for (var v = bas; v <= haut + 1e-9; v += 0.25) {
      svg += '<line class="hypo-graphe__grille" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      svg += '<text class="hypo-graphe__axe" x="' + (ml - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v.toFixed(2).replace(".", ",") + " %</text>";
    }
    var pas = Math.ceil(H.mois.length / 8);
    H.mois.forEach(function (m, k) {
      if (k % pas && k !== H.mois.length - 1) return;
      svg += '<text class="hypo-graphe__axe" x="' + x(k) + '" y="' + (Hh - 10) + '" text-anchor="' + (k === H.mois.length - 1 ? "end" : k === 0 ? "start" : "middle") + '">' + MOIS[Number(m.slice(5, 7)) - 1] + " " + m.slice(2, 4) + "</text>";
    });
    series.forEach(function (s) {
      var pts = H[s].map(function (val, k) { return x(k).toFixed(1) + "," + y(val).toFixed(1); }).join(" ");
      svg += '<polyline class="hypo-graphe__ligne hypo-graphe__ligne--' + s + '" points="' + pts + '"/>';
      var dernier = H[s][H[s].length - 1];
      svg += '<circle class="hypo-graphe__point hypo-graphe__ligne--' + s + '" cx="' + x(H.mois.length - 1) + '" cy="' + y(dernier) + '" r="4"><title>' + pct(dernier) + "</title></circle>";
    });
    g.innerHTML = svg;
  }
})();
