/* Espace conseillers Assuravia : leads, statuts, commentaires, rappels, administration.
   Données : Supabase (règles d'accès dans espace/schema.sql). Configuration : /espace/config.js (généré au build). */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var C = window.ESPACE || {};

  var STATUTS = [
    { cle: "nouveau", nom: "Nouveau", couleur: "bleu" },
    { cle: "a_rappeler", nom: "À rappeler", couleur: "or" },
    { cle: "injoignable", nom: "Injoignable", couleur: "gris" },
    { cle: "faux_numero", nom: "Faux numéro", couleur: "rouge" },
    { cle: "rdv", nom: "RDV prévu", couleur: "violet" },
    { cle: "offre", nom: "Offre envoyée", couleur: "cyan" },
    { cle: "signe", nom: "Signé", couleur: "vert" },
    { cle: "pas_interesse", nom: "Pas intéressé", couleur: "rouge" },
    { cle: "doublon", nom: "Doublon", couleur: "gris" }
  ];
  var statut = function (cle) { return STATUTS.filter(function (s) { return s.cle === cle; })[0] || { cle: cle, nom: cle, couleur: "gris" }; };

  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var date = function (iso, heure) {
    if (!iso) return "";
    var d = new Date(iso);
    var j = d.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
    return heure === false ? j : j + " " + d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
  };
  var depuis = function (iso) {
    var m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return "il y a " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "il y a " + h + " h";
    var j = Math.round(h / 24);
    return "il y a " + j + " j";
  };
  var libelle = function (k) {
    var s = k.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  var produitNom = function (l) {
    var noms = (window.ESPACE && window.ESPACE.produits) || {};
    var k = l.produit || l.formulaire || "";
    return noms[k] || noms[(l.formulaire || "").replace(/^simulation-/, "")] || libelle(k || "Demande");
  };
  var pourInput = function (iso) { if (!iso) return ""; var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  if (!C.url || !C.anon || !window.supabase) {
    app.innerHTML = '<div class="ecran-centre"><div class="carte-connexion"><h1>Espace conseillers</h1><p>L\'espace n\'est pas encore configuré. Ajoutez SUPABASE_URL et SUPABASE_ANON_KEY dans les variables d\'environnement Netlify, puis relancez une publication.</p></div></div>';
    return;
  }

  // Lien d'invitation ou de réinitialisation : on demandera de choisir un mot de passe
  var typeLien = (location.hash.match(/type=([a-z_]+)/) || [])[1] || "";
  var sb = window.supabase.createClient(C.url, C.anon, { auth: { persistSession: true, detectSessionInUrl: true } });

  var etat = { moi: null, profil: null, conseillers: [], leads: [], regles: [], brouillons: [], selection: {}, vue: "leads", filtre: "tous", recherche: "", conseillerFiltre: "", leadOuvert: null, commentaires: [], message: "" };
  var estAdmin = function () { return etat.profil && etat.profil.role === "admin"; };
  var nomConseiller = function (id) { var c = etat.conseillers.filter(function (x) { return x.id === id; })[0]; return c ? c.nom : "Non attribué"; };

  function toast(texte, erreur) {
    var t = document.createElement("div");
    t.className = "toast" + (erreur ? " toast--erreur" : "");
    t.textContent = texte;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("toast--sortie"); }, 2600);
    setTimeout(function () { t.remove(); }, 3100);
  }

  // ---------- Connexion ----------
  function ecranConnexion(msg) {
    app.innerHTML =
      '<div class="ecran-centre"><form class="carte-connexion" data-connexion>' +
      '<div class="marque"><img src="/marque/embleme.svg" alt="" width="40" height="40"><div><strong>Assuravia</strong><span>Espace conseillers</span></div></div>' +
      '<h1>Connexion</h1>' + (msg ? '<p class="info">' + esc(msg) + "</p>" : "") +
      '<label>E-mail<input type="email" name="email" required autocomplete="username"></label>' +
      '<label>Mot de passe<input type="password" name="mdp" required autocomplete="current-password"></label>' +
      '<button class="btn btn--plein" type="submit">Se connecter</button>' +
      '<button class="lien" type="button" data-oubli>Mot de passe oublié ?</button>' +
      '<p class="erreur" data-erreur hidden></p></form></div>';
    var f = app.querySelector("[data-connexion]");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = f.querySelector("button[type=submit]"); b.disabled = true; b.textContent = "Connexion…";
      sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.mdp.value }).then(function (r) {
        if (r.error) { b.disabled = false; b.textContent = "Se connecter"; var er = f.querySelector("[data-erreur]"); er.hidden = false; er.textContent = "E-mail ou mot de passe incorrect."; return; }
        demarrer();
      });
    });
    f.querySelector("[data-oubli]").addEventListener("click", function () {
      var email = f.email.value.trim();
      if (!email) { f.email.focus(); toast("Indiquez d'abord votre e-mail.", true); return; }
      sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/espace/" }).then(function () { toast("Si ce compte existe, un e-mail vient d'être envoyé."); });
    });
  }

  function ecranMotDePasse(raison) {
    var titre = raison === "premiere" ? "Choisissez votre mot de passe personnel" : "Choisissez votre mot de passe";
    var texte = raison === "premiere" ? "Votre compte a été créé avec un mot de passe provisoire. Choisissez maintenant le vôtre (au moins 10 caractères) : vous seul le connaîtrez." : "Au moins 10 caractères.";
    app.innerHTML =
      '<div class="ecran-centre"><form class="carte-connexion" data-mdp>' +
      '<div class="marque"><img src="/marque/embleme.svg" alt="" width="40" height="40"><div><strong>Assuravia</strong><span>Espace conseillers</span></div></div>' +
      "<h1>" + titre + '</h1><p class="info">' + texte + "</p>" +
      '<label>Nouveau mot de passe<input type="password" name="mdp" required minlength="10" autocomplete="new-password"></label>' +
      '<label>Confirmer<input type="password" name="mdp2" required minlength="10" autocomplete="new-password"></label>' +
      '<button class="btn btn--plein" type="submit">Enregistrer</button>' + (raison === "changer" ? '<button class="lien" type="button" data-annuler>Annuler</button>' : "") + '<p class="erreur" data-erreur hidden></p></form></div>';
    var f = app.querySelector("[data-mdp]");
    var annuler = f.querySelector("[data-annuler]"); if (annuler) annuler.onclick = function () { demarrer(); };
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var er = f.querySelector("[data-erreur]");
      if (f.mdp.value !== f.mdp2.value) { er.hidden = false; er.textContent = "Les deux mots de passe sont différents."; return; }
      if (f.mdp.value.length < 10) { er.hidden = false; er.textContent = "Au moins 10 caractères."; return; }
      sb.auth.updateUser({ password: f.mdp.value, data: { doit_changer: false } }).then(function (r) {
        if (r.error) { er.hidden = false; er.textContent = /different|same/i.test(r.error.message) ? "Choisissez un mot de passe différent du mot de passe provisoire." : r.error.message; return; }
        history.replaceState(null, "", location.pathname);
        typeLien = "";
        toast("Mot de passe enregistré.");
        demarrer();
      });
    });
  }

  // ---------- Données ----------
  function chargerConseillers() {
    return sb.from("conseillers").select("*").order("nom").then(function (r) { etat.conseillers = r.data || []; });
  }
  function chargerLeads() {
    var q = sb.from("leads").select("*").order("cree_le", { ascending: false }).limit(1000);
    if (!estAdmin()) q = q.eq("conseiller_id", etat.moi.id);
    return q.then(function (r) { if (r.error) toast("Chargement impossible : " + r.error.message, true); etat.leads = r.data || []; });
  }

  function demarrer() {
    sb.auth.getUser().then(function (r) {
      if (!r.data || !r.data.user) { ecranConnexion(); return; }
      etat.moi = r.data.user;
      if (typeLien === "invite" || typeLien === "recovery") { ecranMotDePasse(); return; }
      if (etat.moi.user_metadata && etat.moi.user_metadata.doit_changer) { ecranMotDePasse("premiere"); return; }
      sb.from("conseillers").select("*").eq("id", etat.moi.id).single().then(function (p) {
        etat.profil = p.data;
        if (!etat.profil) { app.innerHTML = '<div class="ecran-centre"><div class="carte-connexion"><h1>Compte sans fiche</h1><p>Votre compte n\'est pas encore activé comme conseiller. Contactez l\'administrateur.</p><button class="btn" data-sortir>Se déconnecter</button></div></div>'; app.querySelector("[data-sortir]").onclick = sortir; return; }
        Promise.all([chargerConseillers(), chargerLeads(), estAdmin() ? chargerRegles() : null]).then(rendre);
      });
    });
  }
  function sortir() { sb.auth.signOut().then(function () { etat = { moi: null, profil: null, conseillers: [], leads: [], regles: [], brouillons: [], selection: {}, vue: "leads", filtre: "tous", recherche: "", conseillerFiltre: "", leadOuvert: null, commentaires: [] }; ecranConnexion("Vous êtes déconnecté."); }); }

  // ---------- Mise en page ----------
  function rendre() {
    var onglets = [["leads", estAdmin() ? "Tous les leads" : "Mes leads"]];
    if (estAdmin()) onglets.push(["conseillers", "Conseillers et répartition"], ["stats", "Statistiques"]);
    app.innerHTML =
      '<header class="barre"><div class="marque"><img src="/marque/embleme.svg" alt="" width="34" height="34"><div><strong>Assuravia</strong><span>Espace conseillers</span></div></div>' +
      '<nav class="onglets">' + onglets.map(function (o) { return '<button class="onglet' + (etat.vue === o[0] ? " onglet--actif" : "") + '" data-vue="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</nav>" +
      '<div class="moi"><span class="avatar">' + esc((etat.profil.nom || "?").charAt(0).toUpperCase()) + '</span><span class="moi__nom">' + esc(etat.profil.nom) + (estAdmin() ? ' <small>Admin</small>' : "") + '</span><button class="btn btn--petit" data-mon-mdp title="Changer mon mot de passe">Mot de passe</button><button class="btn btn--petit" data-sortir>Déconnexion</button></div></header>' +
      '<main class="contenu" data-contenu></main><aside class="fiche" data-fiche hidden></aside><div class="voile" data-voile hidden></div>';
    app.querySelectorAll("[data-vue]").forEach(function (b) { b.onclick = function () { etat.vue = b.getAttribute("data-vue"); rendre(); }; });
    app.querySelector("[data-sortir]").onclick = sortir;
    app.querySelector("[data-mon-mdp]").onclick = function () { ecranMotDePasse("changer"); };
    app.querySelector("[data-voile]").onclick = fermerFiche;
    if (etat.vue === "conseillers") vueConseillers(); else if (etat.vue === "stats") vueStats(); else vueLeads();
    if (etat.leadOuvert) ouvrirFiche(etat.leadOuvert, true);
  }

  // ---------- Liste des leads ----------
  function aRappeler(l) { return l.rappel_le && new Date(l.rappel_le) <= new Date(new Date().setHours(23, 59, 59, 999)) && ["signe", "pas_interesse", "faux_numero", "doublon"].indexOf(l.statut) < 0; }
  function leadsFiltres() {
    var q = etat.recherche.toLowerCase();
    return etat.leads.filter(function (l) {
      if (etat.filtre === "rappel" && !aRappeler(l)) return false;
      if (etat.filtre !== "tous" && etat.filtre !== "rappel" && l.statut !== etat.filtre) return false;
      if (etat.conseillerFiltre && (l.conseiller_id || "") !== (etat.conseillerFiltre === "aucun" ? "" : etat.conseillerFiltre)) return false;
      if (!q) return true;
      return [l.prenom, l.nom, l.email, l.telephone, l.produit, l.formulaire, l.canton].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }
  function vueLeads() {
    var zone = app.querySelector("[data-contenu]");
    var compte = function (cle) { return etat.leads.filter(function (l) { return l.statut === cle; }).length; };
    var nbRappel = etat.leads.filter(aRappeler).length;
    var puces = [["tous", "Tous", etat.leads.length, ""], ["rappel", "À rappeler aujourd'hui", nbRappel, "or"]].concat(STATUTS.map(function (s) { return [s.cle, s.nom, compte(s.cle), s.couleur]; }));
    zone.innerHTML =
      '<div class="tete"><div><h1>' + (estAdmin() ? "Tous les leads" : "Mes leads") + '</h1><p class="sous">' + etat.leads.length + " lead" + (etat.leads.length > 1 ? "s" : "") + (nbRappel ? " · <strong>" + nbRappel + " à rappeler aujourd'hui</strong>" : "") + '</p></div>' +
      '<div class="tete__actions"><input class="recherche" type="search" placeholder="Rechercher un nom, un e-mail, un téléphone…" value="' + esc(etat.recherche) + '" data-recherche>' +
      (estAdmin() ? '<select class="select" data-conseiller-filtre><option value="">Tous les conseillers</option><option value="aucun"' + (etat.conseillerFiltre === "aucun" ? " selected" : "") + ">Non attribués</option>" + etat.conseillers.map(function (c) { return '<option value="' + c.id + '"' + (etat.conseillerFiltre === c.id ? " selected" : "") + ">" + esc(c.nom) + "</option>"; }).join("") + "</select>" : "") +
      '<button class="btn" data-rafraichir>Actualiser</button></div></div>' +
      '<div class="puces">' + puces.filter(function (p) { return p[2] || p[0] === "tous" || p[0] === etat.filtre; }).map(function (p) { return '<button class="puce puce--' + (p[3] || "neutre") + (etat.filtre === p[0] ? " puce--active" : "") + '" data-filtre="' + p[0] + '">' + p[1] + " <span>" + p[2] + "</span></button>"; }).join("") + "</div>" +
      (estAdmin() ? '<div class="selection-outils"><label class="tout"><input type="checkbox" data-tout> Tout sélectionner (liste affichée)</label></div>' +
        '<div class="barre-attribuer" data-barre-attribuer hidden><strong data-nb></strong><select class="select" data-vers><option value="">Attribuer à…</option>' + etat.conseillers.map(function (c) { return '<option value="' + c.id + '">' + esc(c.nom) + (c.actif ? "" : " (inactif)") + "</option>"; }).join("") + '<option value="aucun">Personne (retirer)</option></select><button class="btn btn--plein" data-appliquer>Attribuer</button><button class="lien" data-vider>Annuler la sélection</button></div>' : "") +
      '<div class="liste" data-liste></div>';
    var dessiner = function () {
      var liste = leadsFiltres();
      zone.querySelector("[data-liste]").innerHTML = liste.length ? liste.map(function (l) {
        var s = statut(l.statut);
        return '<div role="button" tabindex="0" class="ligne' + (estAdmin() ? " ligne--admin" : "") + (l.statut === "nouveau" ? " ligne--nouveau" : "") + (etat.selection[l.id] ? " ligne--choisie" : "") + '" data-lead="' + l.id + '">' +
          (estAdmin() ? '<label class="ligne__coche" title="Sélectionner"><input type="checkbox" data-coche="' + l.id + '"' + (etat.selection[l.id] ? " checked" : "") + "></label>" : "") +
          '<span class="ligne__qui"><strong>' + esc([l.prenom, l.nom].filter(Boolean).join(" ") || "Sans nom") + '</strong><small>' + esc(l.telephone || l.email || "") + "</small></span>" +
          '<span class="ligne__produit">' + esc(produitNom(l)) + (l.prime ? "<small>" + esc(l.prime) + "</small>" : "") + "</span>" +
          (estAdmin() ? '<span class="ligne__conseiller">' + esc(nomConseiller(l.conseiller_id)) + "</span>" : "") +
          '<span class="ligne__date">' + depuis(l.cree_le) + (l.rappel_le ? '<small class="' + (aRappeler(l) ? "urgent" : "") + '">Rappel ' + date(l.rappel_le) + "</small>" : "") + "</span>" +
          '<span class="badge badge--' + s.couleur + '">' + s.nom + "</span></div>";
      }).join("") : '<div class="vide"><p><strong>Aucun lead ici.</strong></p><p>Les nouvelles demandes du site apparaissent automatiquement.</p></div>';
      zone.querySelectorAll("[data-lead]").forEach(function (b) {
        b.onclick = function (e) { if (e.target.closest(".ligne__coche")) return; ouvrirFiche(Number(b.getAttribute("data-lead"))); };
        b.onkeydown = function (e) { if (e.key === "Enter") ouvrirFiche(Number(b.getAttribute("data-lead"))); };
      });
      zone.querySelectorAll("[data-coche]").forEach(function (c) {
        c.onchange = function () { var id = c.getAttribute("data-coche"); if (c.checked) etat.selection[id] = true; else delete etat.selection[id]; c.closest(".ligne").classList.toggle("ligne--choisie", c.checked); barre(); };
      });
      var tout = zone.querySelector("[data-tout]");
      if (tout) { tout.checked = liste.length > 0 && liste.every(function (l) { return etat.selection[l.id]; }); tout.onchange = function () { liste.forEach(function (l) { if (tout.checked) etat.selection[l.id] = true; else delete etat.selection[l.id]; }); dessiner(); }; }
      barre();
    };
    var barre = function () {
      var b = zone.querySelector("[data-barre-attribuer]"); if (!b) return;
      var ids = Object.keys(etat.selection);
      b.hidden = !ids.length;
      b.querySelector("[data-nb]").textContent = ids.length + " lead" + (ids.length > 1 ? "s" : "") + " sélectionné" + (ids.length > 1 ? "s" : "");
    };
    dessiner();
    zone.querySelector("[data-recherche]").addEventListener("input", function (e) { etat.recherche = e.target.value; dessiner(); });
    zone.querySelectorAll("[data-filtre]").forEach(function (b) { b.onclick = function () { etat.filtre = b.getAttribute("data-filtre"); vueLeads(); }; });
    var cf = zone.querySelector("[data-conseiller-filtre]"); if (cf) cf.onchange = function () { etat.conseillerFiltre = cf.value; dessiner(); };
    var appl = zone.querySelector("[data-appliquer]");
    if (appl) {
      zone.querySelector("[data-vider]").onclick = function () { etat.selection = {}; dessiner(); };
      appl.onclick = function () {
        var vers = zone.querySelector("[data-vers]").value;
        if (!vers) { toast("Choisissez un conseiller.", true); return; }
        var ids = Object.keys(etat.selection).map(Number);
        var cible = vers === "aucun" ? null : vers;
        appl.disabled = true;
        sb.from("leads").update({ conseiller_id: cible }).in("id", ids).then(function (r) {
          appl.disabled = false;
          if (r.error) { toast("Erreur : " + r.error.message, true); return; }
          sb.from("commentaires").insert(ids.map(function (id) { return { lead_id: id, auteur_id: etat.moi.id, texte: "Attribué à " + nomConseiller(cible), automatique: true }; })).then(function () {});
          etat.selection = {};
          chargerLeads().then(function () { vueLeads(); toast(ids.length + " lead" + (ids.length > 1 ? "s" : "") + " attribué" + (ids.length > 1 ? "s" : "") + " à " + nomConseiller(cible) + "."); });
        });
      };
    }
    zone.querySelector("[data-rafraichir]").onclick = function () { chargerLeads().then(function () { vueLeads(); toast("Liste à jour."); }); };
  }

  // ---------- Fiche d'un lead ----------
  function fermerFiche() {
    etat.leadOuvert = null;
    var f = app.querySelector("[data-fiche]"); if (f) f.hidden = true;
    var v = app.querySelector("[data-voile]"); if (v) v.hidden = true;
  }
  function ouvrirFiche(id, silencieux) {
    var l = etat.leads.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    etat.leadOuvert = id;
    var fiche = app.querySelector("[data-fiche]");
    fiche.hidden = false; app.querySelector("[data-voile]").hidden = false;
    var tel = (l.telephone || "").replace(/[^\d+]/g, "");
    var wa = tel.replace(/^\+/, "").replace(/^0/, "41");
    var infos = Object.keys(l.donnees || {}).filter(function (k) { return ["prenom", "nom", "email", "telephone", "telephone_complet", "indicatif", "form-name"].indexOf(k) < 0; });
    fiche.innerHTML =
      '<div class="fiche__tete"><div><p class="fiche__produit">' + esc(produitNom(l)) + " · reçu le " + date(l.cree_le) + '</p><h2>' + esc([l.prenom, l.nom].filter(Boolean).join(" ") || "Sans nom") + '</h2></div><button class="fermer" data-fermer aria-label="Fermer">×</button></div>' +
      '<div class="fiche__actions">' +
      (tel ? '<a class="btn btn--plein" href="tel:' + esc(tel) + '">Appeler ' + esc(l.telephone) + "</a>" : "") +
      (wa ? '<a class="btn btn--wa" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : "") +
      (l.email ? '<a class="btn" href="mailto:' + esc(l.email) + '">E-mail</a>' : "") + "</div>" +
      '<div class="fiche__suivi">' +
      '<label>Statut<select class="select" data-statut>' + STATUTS.map(function (s) { return '<option value="' + s.cle + '"' + (l.statut === s.cle ? " selected" : "") + ">" + s.nom + "</option>"; }).join("") + "</select></label>" +
      '<label>Rappel prévu<input class="select" type="datetime-local" value="' + pourInput(l.rappel_le) + '" data-rappel></label>' +
      (estAdmin() ? '<label>Conseiller<select class="select" data-attribuer><option value="">Non attribué</option>' + etat.conseillers.map(function (c) { return '<option value="' + c.id + '"' + (l.conseiller_id === c.id ? " selected" : "") + ">" + esc(c.nom) + "</option>"; }).join("") + "</select></label>" : "") +
      "</div>" +
      '<section class="fiche__bloc"><h3>Coordonnées</h3><dl class="infos">' +
      [["Prénom", l.prenom], ["Nom", l.nom], ["Téléphone", l.telephone], ["E-mail", l.email], ["Canton / NPA", l.canton], ["Prime estimée", l.prime], ["Formulaire", l.formulaire], ["Page", l.page]].filter(function (x) { return x[1]; }).map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + esc(x[1]) + "</dd></div>"; }).join("") + "</dl></section>" +
      (infos.length ? '<section class="fiche__bloc"><h3>Réponses du client</h3><dl class="infos">' + infos.map(function (k) { return "<div><dt>" + esc(libelle(k)) + "</dt><dd>" + esc(l.donnees[k]) + "</dd></div>"; }).join("") + "</dl></section>" : "") +
      '<section class="fiche__bloc"><h3>Suivi et commentaires</h3><form class="commentaire-form" data-commenter><textarea name="texte" rows="3" placeholder="Ex. Rappelé, pas disponible. RDV proposé jeudi 14 h." required></textarea><button class="btn btn--plein" type="submit">Ajouter</button></form><ol class="fil-suivi" data-commentaires><li class="chargement">Chargement…</li></ol></section>';
    fiche.querySelector("[data-fermer]").onclick = fermerFiche;
    var maj = function (champs, note) {
      return sb.from("leads").update(champs).eq("id", l.id).select().single().then(function (r) {
        if (r.error) { toast("Enregistrement impossible : " + r.error.message, true); return; }
        Object.assign(l, r.data);
        if (note) sb.from("commentaires").insert({ lead_id: l.id, auteur_id: etat.moi.id, texte: note, automatique: true }).then(chargerCommentaires);
        toast("Enregistré.");
        if (etat.vue === "leads") vueLeads();
      });
    };
    fiche.querySelector("[data-statut]").onchange = function (e) { var avant = statut(l.statut).nom; maj({ statut: e.target.value }, "Statut : " + avant + " → " + statut(e.target.value).nom); };
    fiche.querySelector("[data-rappel]").onchange = function (e) { var v = e.target.value ? new Date(e.target.value).toISOString() : null; maj({ rappel_le: v }, v ? "Rappel prévu le " + date(v) : "Rappel supprimé"); };
    var at = fiche.querySelector("[data-attribuer]"); if (at) at.onchange = function () { maj({ conseiller_id: at.value || null }, "Attribué à " + nomConseiller(at.value || null)); };
    var form = fiche.querySelector("[data-commenter]");
    form.onsubmit = function (e) {
      e.preventDefault();
      var texte = form.texte.value.trim(); if (!texte) return;
      sb.from("commentaires").insert({ lead_id: l.id, auteur_id: etat.moi.id, texte: texte }).then(function (r) {
        if (r.error) { toast("Commentaire non enregistré : " + r.error.message, true); return; }
        form.texte.value = ""; chargerCommentaires();
      });
    };
    function chargerCommentaires() {
      sb.from("commentaires").select("*").eq("lead_id", l.id).order("cree_le", { ascending: false }).then(function (r) {
        var ol = fiche.querySelector("[data-commentaires]"); if (!ol) return;
        var liste = r.data || [];
        ol.innerHTML = liste.length ? liste.map(function (c) {
          return '<li class="' + (c.automatique ? "auto" : "") + '"><p class="fil-suivi__tete"><strong>' + esc(c.auteur_id ? nomConseiller(c.auteur_id) : "Système") + "</strong> · " + date(c.cree_le) + "</p><p>" + esc(c.texte).replace(/\n/g, "<br>") + "</p></li>";
        }).join("") : '<li class="vide-mini">Aucun commentaire pour l\'instant.</li>';
      });
    }
    chargerCommentaires();
    if (!silencieux) fiche.scrollTop = 0;
  }

  // ---------- Conseillers et répartition (admin) ----------
  function vueConseillers() {
    var zone = app.querySelector("[data-contenu]");
    var mois = Date.now() - 30 * 86400000;
    var somme = etat.conseillers.filter(function (c) { return c.actif; }).reduce(function (s, c) { return s + (Number(c.poids) || 0); }, 0) || 1;
    zone.innerHTML =
      '<div class="tete"><div><h1>Conseillers et répartition</h1><p class="sous">Chaque nouveau lead va au conseiller actif le plus en retard sur sa part. Mettez 0 pour ne plus en recevoir.</p></div></div>' +
      '<h2 class="titre-section">Répartition générale</h2><p class="sous sous--section">Pour tous les leads qui ne relèvent d\'aucune règle par page ou formulaire (plus bas).</p>' +
      '<div class="tableau"><table><thead><tr><th>Conseiller</th><th>Rôle</th><th>Pourcentage</th><th>Part des leads</th><th>Actif</th><th>Leads 30 j</th><th>Signés</th><th></th></tr></thead><tbody>' +
      etat.conseillers.map(function (c) {
        var siens = etat.leads.filter(function (l) { return l.conseiller_id === c.id; });
        var recents = siens.filter(function (l) { return new Date(l.cree_le) >= mois; }).length;
        return '<tr data-c="' + c.id + '"><td><strong>' + esc(c.nom) + "</strong><small>" + esc(c.email || "") + "</small></td>" +
          '<td><select class="select" data-role><option value="conseiller"' + (c.role === "conseiller" ? " selected" : "") + '>Conseiller</option><option value="admin"' + (c.role === "admin" ? " selected" : "") + ">Admin</option></select></td>" +
          '<td><input class="select poids" type="number" min="0" max="100" value="' + (Number(c.poids) || 0) + '" data-poids></td>' +
          '<td><span class="part"><span style="width:' + (c.actif ? Math.round((c.poids || 0) / somme * 100) : 0) + '%"></span></span>' + (c.actif ? Math.round((c.poids || 0) / somme * 100) : 0) + " %</td>" +
          '<td><label class="interrupteur"><input type="checkbox" data-actif' + (c.actif ? " checked" : "") + "><span></span></label></td>" +
          "<td>" + recents + "</td><td>" + siens.filter(function (l) { return l.statut === "signe"; }).length + "</td>" +
          '<td><button class="btn btn--petit" data-enregistrer>Enregistrer</button> <button class="lien" data-reinit>Mot de passe</button></td></tr>';
      }).join("") + "</tbody></table></div>" +
      '<div data-regles></div>' +
      '<form class="carte inviter" data-inviter><h2>Ajouter un conseiller</h2><p class="sous">Vous créez son accès avec un mot de passe provisoire à lui transmettre. À sa première connexion, il doit choisir son propre mot de passe.</p>' +
      '<div class="grille4"><label>Nom<input class="select" name="nom" required placeholder="Jean Dupont"></label><label>E-mail<input class="select" type="email" name="email" required placeholder="jean@exemple.ch"></label><label>Mot de passe provisoire<input class="select" name="provisoire" required minlength="10" value="' + motProvisoire() + '"></label><label>Part générale<input class="select" type="number" name="poids" min="0" max="100" value="20"></label></div>' +
      '<div class="inviter__actions"><button class="btn btn--plein" type="submit">Créer l\'accès</button><button class="lien" type="button" data-par-email>ou l\'inviter par e-mail (lien pour choisir son mot de passe)</button></div></form>';
    zone.querySelectorAll("tr[data-c]").forEach(function (tr) {
      var id = tr.getAttribute("data-c");
      tr.querySelector("[data-enregistrer]").onclick = function () {
        sb.from("conseillers").update({ poids: Math.max(0, parseInt(tr.querySelector("[data-poids]").value, 10) || 0), actif: tr.querySelector("[data-actif]").checked, role: tr.querySelector("[data-role]").value }).eq("id", id).then(function (r) {
          if (r.error) { toast("Erreur : " + r.error.message, true); return; }
          chargerConseillers().then(function () { vueConseillers(); toast("Répartition enregistrée."); });
        });
      };
      tr.querySelector("[data-reinit]").onclick = function () {
        var c = etat.conseillers.filter(function (x) { return x.id === id; })[0];
        var mdp = prompt("Nouveau mot de passe provisoire pour " + c.nom + " (au moins 10 caractères). Il devra le changer à sa prochaine connexion.", motProvisoire());
        if (!mdp) return;
        if (mdp.length < 10) { toast("Au moins 10 caractères.", true); return; }
        appelAdmin({ action: "provisoire", id: id, email: c.email, mot_de_passe: mdp }).then(function (ok) { if (ok) afficherAcces(c.nom, c.email, mdp); });
      };
    });
    vueRegles(zone.querySelector("[data-regles]"));
    var f = zone.querySelector("[data-inviter]");
    f.onsubmit = function (e) {
      e.preventDefault();
      var b = f.querySelector("button[type=submit]"); b.disabled = true;
      var email = f.email.value.trim(), mdp = f.provisoire.value.trim(), nom = f.nom.value.trim();
      appelAdmin({ action: "creer", nom: nom, email: email, poids: f.poids.value, mot_de_passe: mdp }).then(function (ok) {
        b.disabled = false;
        if (ok) { chargerConseillers().then(function () { vueConseillers(); afficherAcces(nom, email, mdp); }); }
      });
    };
    f.querySelector("[data-par-email]").onclick = function () {
      if (!f.nom.value.trim() || !f.email.checkValidity() || !f.email.value) { f.reportValidity(); return; }
      appelAdmin({ action: "inviter", nom: f.nom.value.trim(), email: f.email.value.trim(), poids: f.poids.value }).then(function (ok) {
        if (ok) { toast("Invitation envoyée à " + f.email.value.trim() + "."); chargerConseillers().then(vueConseillers); }
      });
    };
  }

  // ---------- Répartition par page ou formulaire (admin) ----------
  function chargerRegles() {
    return sb.from("regles").select("*").then(function (r) { etat.reglesErreur = !!r.error; etat.regles = r.data || []; });
  }
  var FORMS = C.formulaires || {};
  function nomSource(s) {
    if (s.charAt(0) === "/") return s === "/lp/" ? "Pages publicitaires (/lp/)" : "Page " + s;
    return FORMS[s] ? FORMS[s].nom : s;
  }
  function detailSource(s) {
    if (s.charAt(0) === "/") return "Tous les formulaires des adresses qui commencent par " + s;
    var pages = FORMS[s] ? FORMS[s].pages : [];
    if (pages.length > 3) return "Formulaire « " + s + " », présent sur " + pages.length + " pages";
    return "Formulaire « " + s + " »" + (pages.length ? " · " + pages.join(", ") : "");
  }
  function vueRegles(boite) {
    etat.brouillons = etat.brouillons || [];
    var actifs = etat.conseillers.filter(function (c) { return c.actif; });
    var sources = [];
    etat.regles.forEach(function (r) { if (sources.indexOf(r.source) < 0) sources.push(r.source); });
    etat.brouillons.forEach(function (s) { if (sources.indexOf(s) < 0) sources.push(s); });
    sources.sort(function (a, b) { return (a.charAt(0) === "/" ? 0 : 1) - (b.charAt(0) === "/" ? 0 : 1) || nomSource(a).localeCompare(nomSource(b)); });
    var poids = function (s, id) { var r = etat.regles.filter(function (x) { return x.source === s && x.conseiller_id === id; })[0]; return r ? r.poids : 0; };
    var optionsForms = Object.keys(FORMS).filter(function (k) { return sources.indexOf(k) < 0; }).sort(function (a, b) { return FORMS[a].nom.localeCompare(FORMS[b].nom); })
      .map(function (k) { return '<option value="' + esc(k) + '">' + esc(FORMS[k].nom) + " — " + esc(FORMS[k].pages.length > 3 ? FORMS[k].pages.length + " pages" : FORMS[k].pages[0] || k) + "</option>"; }).join("");
    var optionsPages = ["/lp/"].concat(C.pages || []).filter(function (k) { return sources.indexOf(k) < 0; })
      .map(function (k) { return '<option value="' + esc(k) + '">' + esc(nomSource(k)) + "</option>"; }).join("");
    boite.innerHTML =
      '<h2 class="titre-section">Répartition par page ou formulaire</h2><p class="sous sous--section">Pour une source choisie, ces parts remplacent la répartition générale. Une règle de page passe avant une règle de formulaire. Exemple : 70 et 30 = 70 % / 30 %.</p>' +
      (etat.reglesErreur ? '<div class="alerte">Pour activer cette fonction, exécutez une fois le fichier <strong>espace/maj-1-repartition-par-source.sql</strong> dans Supabase › SQL Editor.</div>' : "") +
      '<div class="regles">' + (sources.length ? sources.map(function (s) {
        var total = actifs.reduce(function (t, c) { return t + (Number(poids(s, c.id)) || 0); }, 0);
        return '<div class="regle" data-source="' + esc(s) + '"><div class="regle__tete"><div><strong>' + esc(nomSource(s)) + "</strong><small>" + esc(detailSource(s)) + '</small></div><button class="lien" data-suppr>Supprimer</button></div>' +
          '<div class="regle__parts">' + actifs.map(function (c) {
            var v = Number(poids(s, c.id)) || 0;
            return '<label class="regle__part"><span>' + esc(c.nom) + '</span><span class="regle__saisie"><input class="select" type="number" min="0" max="100" value="' + v + '" data-c="' + c.id + '"><em data-pct>' + (total ? Math.round(v / total * 100) : 0) + " %</em></span></label>";
          }).join("") + '</div><div class="regle__pied"><span class="regle__info" data-info>' + (total ? "" : "Aucune part : la répartition générale s'applique.") + '</span><button class="btn btn--petit btn--plein" data-enreg>Enregistrer</button></div></div>';
      }).join("") : '<p class="vide-mini">Aucune règle : tous les leads suivent la répartition générale.</p>') + "</div>" +
      '<div class="ajout-regle"><select class="select" data-nouvelle><option value="">Ajouter une règle pour…</option><optgroup label="Un formulaire">' + optionsForms + '</optgroup><optgroup label="Une page (et ses sous-pages)">' + optionsPages + '</optgroup></select><button class="btn" data-ajouter>Ajouter</button></div>';
    boite.querySelectorAll(".regle").forEach(function (bloc) {
      var s = bloc.getAttribute("data-source");
      var champs = bloc.querySelectorAll("input[data-c]");
      var recalcul = function () {
        var tot = 0; champs.forEach(function (i) { tot += Math.max(0, parseInt(i.value, 10) || 0); });
        champs.forEach(function (i) { i.parentNode.querySelector("[data-pct]").textContent = (tot ? Math.round((Math.max(0, parseInt(i.value, 10) || 0)) / tot * 100) : 0) + " %"; });
        bloc.querySelector("[data-info]").textContent = tot ? "" : "Aucune part : la répartition générale s'applique.";
      };
      champs.forEach(function (i) { i.addEventListener("input", recalcul); });
      bloc.querySelector("[data-enreg]").onclick = function () {
        var lignes = []; champs.forEach(function (i) { lignes.push({ source: s, conseiller_id: i.getAttribute("data-c"), poids: Math.max(0, parseInt(i.value, 10) || 0) }); });
        sb.from("regles").upsert(lignes, { onConflict: "source,conseiller_id" }).then(function (r) {
          if (r.error) { toast("Erreur : " + r.error.message, true); return; }
          etat.brouillons = etat.brouillons.filter(function (x) { return x !== s; });
          chargerRegles().then(function () { vueRegles(boite); toast("Règle enregistrée pour « " + nomSource(s) + " »."); });
        });
      };
      bloc.querySelector("[data-suppr]").onclick = function () {
        if (!confirm("Supprimer la règle « " + nomSource(s) + " » ? Ces leads suivront la répartition générale.")) return;
        etat.brouillons = etat.brouillons.filter(function (x) { return x !== s; });
        sb.from("regles").delete().eq("source", s).then(function (r) {
          if (r.error) { toast("Erreur : " + r.error.message, true); return; }
          chargerRegles().then(function () { vueRegles(boite); toast("Règle supprimée."); });
        });
      };
    });
    boite.querySelector("[data-ajouter]").onclick = function () {
      var v = boite.querySelector("[data-nouvelle]").value;
      if (!v) { toast("Choisissez d'abord un formulaire ou une page.", true); return; }
      etat.brouillons.push(v); vueRegles(boite);
      var nouveau = boite.querySelector('.regle[data-source="' + v.replace(/"/g, '\\"') + '"]');
      if (nouveau) { nouveau.classList.add("regle--nouvelle"); nouveau.scrollIntoView({ behavior: "smooth", block: "center" }); }
    };
  }

  function motProvisoire() {
    var a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    var v = new Uint32Array(12); (window.crypto || window.msCrypto).getRandomValues(v);
    for (var i = 0; i < 12; i++) s += a.charAt(v[i] % a.length);
    return s;
  }
  function afficherAcces(nom, email, mdp) {
    var texte = "Bonjour " + nom + ",\n\nVoici votre accès à l'espace conseillers Assuravia :\n" + location.origin + "/espace/\nE-mail : " + email + "\nMot de passe provisoire : " + mdp + "\n\nÀ votre première connexion, vous choisirez votre propre mot de passe.";
    var d = document.createElement("div");
    d.className = "modale";
    d.innerHTML = '<div class="modale__boite"><h2>Accès créé pour ' + esc(nom) + '</h2><p class="sous">Transmettez-lui ces informations (WhatsApp, SMS ou e-mail). Le mot de passe provisoire ne sera plus affiché ensuite.</p><pre class="acces">' + esc(texte) + '</pre><div class="modale__actions"><button class="btn btn--plein" data-copier>Copier le message</button><button class="btn" data-fermer-modale>Fermer</button></div></div>';
    document.body.appendChild(d);
    d.querySelector("[data-copier]").onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(texte) : Promise.reject()).then(function () { toast("Message copié."); }, function () { toast("Copie impossible : sélectionnez le texte.", true); }); };
    d.querySelector("[data-fermer-modale]").onclick = function () { d.remove(); };
  }
  function appelAdmin(corps) {
    return sb.auth.getSession().then(function (s) {
      return fetch("/.netlify/functions/espace-admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (s.data.session ? s.data.session.access_token : "") }, body: JSON.stringify(corps) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) { toast(j.erreur || "Erreur", true); return false; } return true; }); })
        .catch(function () { toast("Serveur injoignable.", true); return false; });
    });
  }

  // ---------- Statistiques (admin) ----------
  function vueStats() {
    var zone = app.querySelector("[data-contenu]");
    var mois = Date.now() - 30 * 86400000;
    var recents = etat.leads.filter(function (l) { return new Date(l.cree_le) >= mois; });
    var signes = etat.leads.filter(function (l) { return l.statut === "signe"; }).length;
    var traites = etat.leads.filter(function (l) { return l.statut !== "nouveau"; }).length;
    var parProduit = {};
    etat.leads.forEach(function (l) { var k = produitNom(l); parProduit[k] = (parProduit[k] || 0) + 1; });
    var max = Math.max.apply(null, Object.keys(parProduit).map(function (k) { return parProduit[k]; }).concat([1]));
    zone.innerHTML =
      '<div class="tete"><div><h1>Statistiques</h1><p class="sous">Sur les ' + etat.leads.length + " derniers leads.</p></div></div>" +
      '<div class="kpis"><div><span>Leads (30 jours)</span><strong>' + recents.length + '</strong></div><div><span>Traités</span><strong>' + (etat.leads.length ? Math.round(traites / etat.leads.length * 100) : 0) + ' %</strong></div><div><span>Signés</span><strong>' + signes + '</strong></div><div><span>Taux de signature</span><strong>' + (etat.leads.length ? Math.round(signes / etat.leads.length * 100) : 0) + " %</strong></div></div>" +
      '<div class="tableau"><table><thead><tr><th>Conseiller</th>' + STATUTS.map(function (s) { return "<th>" + s.nom + "</th>"; }).join("") + "<th>Total</th></tr></thead><tbody>" +
      etat.conseillers.concat([{ id: null, nom: "Non attribués" }]).map(function (c) {
        var siens = etat.leads.filter(function (l) { return (l.conseiller_id || null) === c.id; });
        if (!siens.length && c.id === null) return "";
        return "<tr><td><strong>" + esc(c.nom) + "</strong></td>" + STATUTS.map(function (s) { var n = siens.filter(function (l) { return l.statut === s.cle; }).length; return "<td>" + (n || '<span class="zero">0</span>') + "</td>"; }).join("") + "<td><strong>" + siens.length + "</strong></td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<div class="carte"><h2>Leads par produit</h2><div class="barres">' + Object.keys(parProduit).sort(function (a, b) { return parProduit[b] - parProduit[a]; }).map(function (k) {
        return '<div class="barre-ligne"><span>' + esc(k) + '</span><span class="barre-fond"><span style="width:' + Math.round(parProduit[k] / max * 100) + '%"></span></span><strong>' + parProduit[k] + "</strong></div>";
      }).join("") + "</div></div>";
  }

  // ---------- Démarrage ----------
  sb.auth.onAuthStateChange(function (evenement) {
    if (evenement === "PASSWORD_RECOVERY") { typeLien = "recovery"; ecranMotDePasse(); }
  });
  demarrer();
  // Nouveaux leads : actualisation discrète toutes les 2 minutes
  setInterval(function () {
    if (!etat.profil || etat.vue !== "leads" || etat.leadOuvert) return;
    var avant = etat.leads.length;
    chargerLeads().then(function () { vueLeads(); if (etat.leads.length > avant) toast((etat.leads.length - avant) + " nouveau(x) lead(s)."); });
  }, 120000);
})();
