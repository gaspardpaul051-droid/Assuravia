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
  var NOMS_CHAMPS = {
    date_naissance: "Date de naissance", annee_naissance: "Année de naissance", sexe: "Sexe", canton: "Canton", franchise: "Franchise",
    adultes: "Adultes", enfants: "Enfants", pour_qui: "Pour qui", formule: "Formule", formule_choisie: "Formule choisie",
    logement: "Logement", pieces: "Pièces", logement_rue: "Rue", logement_numero: "N°", logement_npa: "NPA", logement_localite: "Localité",
    inventaire: "Valeur de l'inventaire", somme_assuree: "Somme assurée", somme_corrigee: "Somme corrigée", somme_ok: "Somme confirmée",
    option_rc: "Option RC", option_pj: "Option protection juridique", option_cyber: "Option cyber", capital: "Capital",
    dentaire: "Dentaire", voyage: "Voyage", alternatives: "Médecines alternatives", division: "Hospitalisation",
    fam_base: "Base", fam_hop: "Hospitalisation", fam_alt: "Médecines alternatives", fam_dent: "Dentaire", fam_voyage: "Voyage", fam_capital: "Capital",
    economiser_impots: "Économiser des impôts", suite_souhaitee: "Suite souhaitée", message: "Message", description: "Description",
    complement: "Complément", statut: "Situation", revoir_batiment: "Revoir le bâtiment", date_debut: "Début souhaité", npa: "NPA", localite: "Localité"
  };
  function nomChamp(k) { return NOMS_CHAMPS[k] || libelle(k); }
  var VALEURS = { hop_commune: "Chambre commune", hop_flex: "Hospitalisation flexible", hop_demi: "Demi-privée", hop_privee: "Privée", hop_monde: "Privée, monde entier", base_plus: "Base plus", alt_therap: "Médecines alternatives (thérapeutes)", alt_medecin: "Médecines alternatives (médecins)", dent_essentiel: "Dentaire essentiel", dent_confort: "Dentaire confort", appartement: "Appartement", maison: "Maison", h: "Homme", f: "Femme" };
  function valeurChamp(v) {
    v = String(v == null ? "" : v);
    if (/^[a-z_]+(,\s*[a-z_]+)*$/.test(v) && v.split(/,\s*/).every(function (x) { return VALEURS[x]; })) return v.split(/,\s*/).map(function (x) { return VALEURS[x]; }).join(", ");
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join(".");
    if (/^(on|true|oui)$/i.test(v)) return "Oui";
    if (/^(off|false|non)$/i.test(v)) return "Non";
    return v.replace(/_/g, " ");
  }
  function formatPrime(p) { return /^\d+([.,]\d+)?$/.test(String(p).trim()) ? "CHF " + p : p; }
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

  var etat = { moi: null, profil: null, conseillers: [], leads: [], activite: [], regles: [], brouillons: [], selection: {}, vue: "leads", filtre: "tous", recherche: "", conseillerFiltre: "", leadOuvert: null, commentaires: [], message: "" };
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
  function chargerActivite() {
    return sb.from("commentaires").select("lead_id,auteur_id,texte,automatique,cree_le").order("cree_le", { ascending: false }).limit(5000).then(function (r) { etat.activite = r.data || []; });
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
        Promise.all([chargerConseillers(), chargerLeads(), chargerActivite(), estAdmin() ? chargerRegles() : null]).then(rendre);
      });
    });
  }
  function sortir() { sb.auth.signOut().then(function () { etat = { moi: null, profil: null, conseillers: [], leads: [], activite: [], regles: [], brouillons: [], selection: {}, vue: "leads", filtre: "tous", recherche: "", conseillerFiltre: "", leadOuvert: null, commentaires: [] }; ecranConnexion("Vous êtes déconnecté."); }); }

  // ---------- Mise en page ----------
  function rendre() {
    var onglets = [["leads", estAdmin() ? "Tous les leads" : "Mes leads"]];
    if (estAdmin()) onglets.push(["conseillers", "Conseillers et répartition"], ["stats", "Statistiques"]);
    else onglets.push(["perf", "Mes statistiques"]);
    app.innerHTML =
      '<header class="barre"><div class="marque"><img src="/marque/embleme.svg" alt="" width="34" height="34"><div><strong>Assuravia</strong><span>Espace conseillers</span></div></div>' +
      '<nav class="onglets">' + onglets.map(function (o) { return '<button class="onglet' + (etat.vue === o[0] ? " onglet--actif" : "") + '" data-vue="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</nav>" +
      '<div class="moi"><span class="avatar">' + esc((etat.profil.nom || "?").charAt(0).toUpperCase()) + '</span><span class="moi__nom">' + esc(etat.profil.nom) + (estAdmin() ? ' <small>Admin</small>' : "") + '</span><button class="btn btn--petit" data-mon-mdp title="Changer mon mot de passe">Mot de passe</button><button class="btn btn--petit" data-sortir>Déconnexion</button></div></header>' +
      '<main class="contenu" data-contenu></main><aside class="fiche" data-fiche hidden></aside><div class="voile" data-voile hidden></div>';
    app.querySelectorAll("[data-vue]").forEach(function (b) { b.onclick = function () { etat.vue = b.getAttribute("data-vue"); rendre(); }; });
    app.querySelector("[data-sortir]").onclick = sortir;
    app.querySelector("[data-mon-mdp]").onclick = function () { ecranMotDePasse("changer"); };
    app.querySelector("[data-voile]").onclick = fermerFiche;
    if (etat.vue === "conseillers") vueConseillers(); else if (etat.vue === "stats") vueStats(); else if (etat.vue === "perf") vuePerf(); else vueLeads();
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
          avatar(nomLead(l)) +
          '<span class="ligne__qui"><strong class="ligne__nom">' + esc(nomLead(l)) + '</strong><span class="ligne__tel">' + esc(l.telephone || l.email || "Sans coordonnées") + "</span></span>" +
          '<span class="ligne__produit"><span class="etiquette">' + esc(produitNom(l)) + "</span>" + (l.prime ? "<small>" + esc(formatPrime(l.prime)) + "</small>" : "") + "</span>" +
          dernierMot(l) +
          (estAdmin() ? '<span class="ligne__conseiller">' + esc(nomConseiller(l.conseiller_id)) + "</span>" : "") +
          '<span class="ligne__date">' + (l.statut === "nouveau" ? '<span class="point-vif"></span>' : "") + depuis(l.cree_le) + (l.rappel_le ? '<small class="' + (aRappeler(l) ? "urgent" : "") + '">Rappel ' + date(l.rappel_le) + "</small>" : "") + "</span>" +
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
    zone.querySelector("[data-rafraichir]").onclick = function () { Promise.all([chargerLeads(), chargerActivite()]).then(function () { vueLeads(); toast("Liste à jour."); }); };
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
    var s0 = statut(l.statut);
    var d = l.donnees || {};
    var TECH = ["prenom", "nom", "email", "telephone", "telephone_complet", "indicatif", "form-name", "page", "produit", "prime_totale", "prime_mensuelle_estimee", "prime_estimee", "prime_principale", "etape_atteinte", "gclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "canton"];
    var reponses = Object.keys(d).filter(function (k) { return TECH.indexOf(k) < 0; });
    var origine = [["Page", l.page], ["Formulaire", l.formulaire], ["Source", d.utm_source], ["Campagne", d.utm_campaign], ["Mot-clé", d.utm_term], ["Google Ads", d.gclid ? "Oui (clic publicitaire)" : ""]].filter(function (x) { return x[1]; });
    var tuile = function (ic, label, val, lien) { return '<div class="tuile"><span class="tuile__ic">' + ic + '</span><span class="tuile__txt"><small>' + label + "</small>" + (lien ? '<a href="' + esc(lien) + '">' + esc(val) + "</a>" : "<b>" + esc(val) + "</b>") + "</span></div>"; };
    var IC = {
      tel: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
      mail: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
      lieu: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
      prime: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>'
    };
    fiche.innerHTML =
      '<div class="fiche__tete"><div class="fiche__identite">' + avatar(nomLead(l), "grand") + '<div><p class="fiche__produit">' + esc(produitNom(l)) + '</p><h2>' + esc(nomLead(l)) + '</h2><p class="fiche__meta">Reçu ' + depuis(l.cree_le) + " · " + date(l.cree_le) + (estAdmin() ? " · Conseiller : <b>" + esc(nomConseiller(l.conseiller_id)) + "</b>" : "") + '</p><div class="fiche__puces"><span class="badge badge--' + s0.couleur + '" data-badge-tete>' + s0.nom + "</span>" + (l.prime ? '<span class="fiche__puce">' + esc(formatPrime(l.prime)) + "</span>" : "") + (l.canton ? '<span class="fiche__puce">' + esc(l.canton) + "</span>" : "") + (l.rappel_le ? '<span class="fiche__puce fiche__puce--or">Rappel ' + date(l.rappel_le) + "</span>" : "") + '</div></div></div><button class="fermer" data-fermer aria-label="Fermer">×</button></div>' +
      '<div class="fiche__actions">' +
      (tel ? '<a class="btn btn--plein btn--gros" href="tel:' + esc(tel) + '">Appeler</a>' : "") +
      (wa ? '<a class="btn btn--wa btn--gros" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : "") +
      (l.email ? '<a class="btn btn--gros" href="mailto:' + esc(l.email) + '">E-mail</a>' : "") + "</div>" +
      '<div class="fiche__corps"><div class="fiche__col"><section class="fiche__bloc fiche__bloc--statut"><div class="statut-ligne"><label class="statut-champ"><span>Statut du lead</span><span class="statut-select statut-select--' + s0.couleur + '"><select data-statut-select>' + STATUTS.map(function (s) { return '<option value="' + s.cle + '"' + (l.statut === s.cle ? " selected" : "") + ">" + s.nom + "</option>"; }).join("") + '</select></span></label>' +
      '<label class="statut-champ"><span>Rappel prévu</span><input class="select" type="datetime-local" value="' + pourInput(l.rappel_le) + '" data-rappel></label></div>' +
      '<div class="rappels-rapides"><span>Rappeler :</span><button type="button" class="mini" data-dans="1h">dans 1 h</button><button type="button" class="mini" data-dans="demain">demain 9 h</button><button type="button" class="mini" data-dans="lundi">lundi 9 h</button>' + (l.rappel_le ? '<button type="button" class="mini mini--suppr" data-dans="aucun">aucun</button>' : "") + "</div>" +
      (estAdmin() ? '<label class="statut-champ statut-champ--plein"><span>Conseiller</span><select class="select" data-attribuer><option value="">Non attribué</option>' + etat.conseillers.map(function (c) { return '<option value="' + c.id + '"' + (l.conseiller_id === c.id ? " selected" : "") + ">" + esc(c.nom) + "</option>"; }).join("") + "</select></label>" : "") +
      "</section>" +
      '<section class="fiche__bloc"><h3>Informations du client</h3><div class="tuiles">' +
        (l.telephone ? tuile(IC.tel, "Téléphone", l.telephone, "tel:" + tel) : "") +
        (l.email ? tuile(IC.mail, "E-mail", l.email, "mailto:" + l.email) : "") +
        (l.canton ? tuile(IC.lieu, "Canton / NPA", l.canton) : "") +
        (l.prime ? tuile(IC.prime, "Prime estimée", formatPrime(l.prime)) : "") +
      "</div>" +
      (reponses.length ? '<h4 class="sous-titre">Sa demande</h4><dl class="details">' + reponses.map(function (k) { return '<div class="details__ligne"><dt>' + esc(nomChamp(k)) + "</dt><dd>" + esc(valeurChamp(d[k])) + "</dd></div>"; }).join("") + "</dl>" : "") +
      (origine.length ? '<h4 class="sous-titre">Provenance</h4><dl class="details details--doux">' + origine.map(function (x) { return '<div class="details__ligne"><dt>' + x[0] + "</dt><dd>" + esc(x[1]) + "</dd></div>"; }).join("") + "</dl>" : "") +
      "</section></div>" +
      '<div class="fiche__col fiche__col--com"><section class="fiche__bloc fiche__bloc--com"><h3>Suivi et commentaires <span class="compteur" data-compteur></span></h3><form class="commentaire-form" data-commenter>' +
      '<div class="suggestions">' + ["Pas de réponse", "Message vocal laissé", "Rappeler plus tard", "RDV fixé", "Offre envoyée", "Documents demandés"].map(function (x) { return '<button type="button" class="mini" data-suggestion>' + x + "</button>"; }).join("") + "</div>" +
      '<textarea name="texte" rows="3" placeholder="Où en êtes-vous avec ce client ? Ex. Rappelé, RDV jeudi 14 h chez lui." required></textarea>' +
      '<div class="commentaire-form__pied"><small>Ctrl + Entrée pour publier</small><button class="btn btn--plein" type="submit">Publier</button></div></form>' +
      '<ol class="fil-suivi" data-commentaires><li class="chargement">Chargement…</li></ol></section></div></div>';
    fiche.querySelector("[data-fermer]").onclick = fermerFiche;
    var maj = function (champs, note) {
      return sb.from("leads").update(champs).eq("id", l.id).select().single().then(function (r) {
        if (r.error) { toast("Enregistrement impossible : " + r.error.message, true); return; }
        Object.assign(l, r.data);
        if (note) {
          var c = { lead_id: l.id, auteur_id: etat.moi.id, texte: note, automatique: true };
          etat.activite.unshift(Object.assign({ cree_le: new Date().toISOString() }, c));
          sb.from("commentaires").insert(c).then(chargerCommentaires);
        }
        toast("Enregistré.");
        if (etat.vue === "leads") vueLeads();
      });
    };
    var choixStatut = fiche.querySelector("[data-statut-select]");
    choixStatut.onchange = function () {
      var cle = choixStatut.value; if (cle === l.statut) return;
      var avant = statut(l.statut).nom;
      choixStatut.parentNode.className = "statut-select statut-select--" + statut(cle).couleur;
      maj({ statut: cle }, "Statut : " + avant + " → " + statut(cle).nom).then(function () {
        if (cle === "signe") { confettis(); toast("Bravo, contrat signé ! +40 points"); }
        else if (cle === "rdv") toast("RDV prévu : +10 points");
        ouvrirFiche(l.id, true);
      });
    };
    var poserRappel = function (v) { maj({ rappel_le: v }, v ? "Rappel prévu le " + date(v) : "Rappel supprimé").then(function () { ouvrirFiche(l.id, true); }); };
    fiche.querySelector("[data-rappel]").onchange = function (e) { poserRappel(e.target.value ? new Date(e.target.value).toISOString() : null); };
    fiche.querySelectorAll("[data-dans]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-dans"), d = new Date();
        if (k === "aucun") return poserRappel(null);
        if (k === "1h") d = new Date(Date.now() + 3600000);
        else { if (k === "demain") d.setDate(d.getDate() + 1); else d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); }
        poserRappel(d.toISOString());
      };
    });
    var at = fiche.querySelector("[data-attribuer]"); if (at) at.onchange = function () { maj({ conseiller_id: at.value || null }, "Attribué à " + nomConseiller(at.value || null)); };
    var form = fiche.querySelector("[data-commenter]");
    var zoneTexte = form.texte;
    var ajuster = function () { zoneTexte.style.height = "auto"; zoneTexte.style.height = Math.min(zoneTexte.scrollHeight + 2, 260) + "px"; };
    zoneTexte.addEventListener("input", ajuster);
    zoneTexte.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.onsubmit(e); } });
    form.querySelectorAll("[data-suggestion]").forEach(function (b) {
      b.onclick = function () { zoneTexte.value = (zoneTexte.value ? zoneTexte.value.replace(/\s*$/, "") + ". " : "") + b.textContent; zoneTexte.focus(); ajuster(); };
    });
    form.onsubmit = function (e) {
      e.preventDefault();
      var texte = zoneTexte.value.trim(); if (!texte) return;
      var bouton = form.querySelector("button[type=submit]"); bouton.disabled = true;
      sb.from("commentaires").insert({ lead_id: l.id, auteur_id: etat.moi.id, texte: texte }).then(function (r) {
        bouton.disabled = false;
        if (r.error) { toast("Commentaire non enregistré : " + r.error.message, true); return; }
        etat.activite.unshift({ lead_id: l.id, auteur_id: etat.moi.id, texte: texte, automatique: false, cree_le: new Date().toISOString() });
        zoneTexte.value = ""; ajuster(); chargerCommentaires();
        if (etat.vue === "leads") vueLeads();
      });
    };
    function chargerCommentaires() {
      sb.from("commentaires").select("*").eq("lead_id", l.id).order("cree_le", { ascending: false }).then(function (r) {
        var ol = fiche.querySelector("[data-commentaires]"); if (!ol) return;
        var liste = r.data || [];
        var cpt = fiche.querySelector("[data-compteur]"); if (cpt) cpt.textContent = liste.filter(function (c) { return !c.automatique; }).length || "";
        ol.innerHTML = liste.length ? liste.map(function (c) {
          var auteur = c.auteur_id ? nomConseiller(c.auteur_id) : "Assuravia";
          if (c.automatique) return '<li class="auto"><span class="auto__point"></span><span>' + esc(c.texte) + ' <em>· ' + esc(auteur) + ", " + depuis(c.cree_le) + "</em></span></li>";
          return '<li class="bulle' + (c.auteur_id === etat.moi.id ? " bulle--moi" : "") + '">' + avatar(auteur, "petit") + '<div class="bulle__corps"><p class="fil-suivi__tete"><strong>' + esc(auteur) + "</strong> <span>" + depuis(c.cree_le) + " · " + date(c.cree_le) + "</span></p><p class=\"bulle__texte\">" + esc(c.texte).replace(/\n/g, "<br>") + "</p></div></li>";
        }).join("") : '<li class="vide-mini">Aucun commentaire pour l\'instant. Notez ici chaque échange avec le client.</li>';
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


  // ---------- Petits éléments visuels ----------
  function nomLead(l) { return [l.prenom, l.nom].filter(Boolean).join(" ") || "Sans nom"; }
  function initiales(n) { return (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (m) { return m.charAt(0).toUpperCase(); }).join("") || "?"; }
  function teinte(n) { var h = 0; for (var i = 0; i < (n || "").length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return h; }
  function avatar(n, taille) { return '<span class="pastille' + (taille ? " pastille--" + taille : "") + '" style="--h:' + teinte(n) + '" aria-hidden="true">' + esc(initiales(n)) + "</span>"; }
  function dernierMot(l) {
    var c = etat.activite.filter(function (x) { return x.lead_id === l.id && !x.automatique; });
    if (!c.length) return '<span class="ligne__dernier ligne__dernier--vide">' + (l.statut === "nouveau" ? "À appeler en premier" : "Aucun commentaire") + "</span>";
    return '<span class="ligne__dernier"><span class="ligne__bulle">' + c.length + "</span>" + esc(c[0].texte.length > 90 ? c[0].texte.slice(0, 88) + "…" : c[0].texte) + "</span>";
  }
  function confettis() {
    var couleurs = ["#E2BE52", "#1565A8", "#1E8E5A", "#C2413A", "#6D4BC3", "#0E8A9E"], boite = document.createElement("div");
    boite.className = "confettis";
    for (var i = 0; i < 90; i++) {
      var c = document.createElement("i");
      c.style.left = Math.random() * 100 + "vw"; c.style.background = couleurs[i % couleurs.length];
      c.style.animationDelay = Math.random() * 0.4 + "s"; c.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
      c.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      boite.appendChild(c);
    }
    document.body.appendChild(boite); setTimeout(function () { boite.remove(); }, 3400);
  }

  // ---------- Points, niveaux et badges ----------
  var RANG = { nouveau: 0, injoignable: 1, faux_numero: 1, doublon: 1, a_rappeler: 1, pas_interesse: 1, rdv: 2, offre: 3, signe: 4 };
  var NIVEAUX = [[0, "Débutant"], [60, "En route"], [180, "Confirmé"], [400, "Expert"], [800, "Champion"], [1500, "Légende"]];
  function bilan(id, depuisDate) {
    var leads = etat.leads.filter(function (l) { return l.conseiller_id === id && (!depuisDate || new Date(l.cree_le) >= depuisDate); });
    var mesCom = etat.activite.filter(function (c) { return c.auteur_id === id && (!depuisDate || new Date(c.cree_le) >= depuisDate); });
    var b = { recus: leads.length, contactes: 0, rdv: 0, offres: 0, signes: 0, commentaires: mesCom.filter(function (c) { return !c.automatique; }).length, points: 0 };
    leads.forEach(function (l) {
      var r = RANG[l.statut] || 0;
      if (r >= 1) b.contactes++; if (r >= 2) b.rdv++; if (r >= 3) b.offres++; if (r >= 4) b.signes++;
    });
    b.points = b.contactes * 3 + b.rdv * 10 + b.offres * 8 + b.signes * 40 + Math.min(b.commentaires, b.recus * 3) * 1;
    // Réactivité : délai entre l'arrivée du lead et la première action du conseiller
    var delais = [];
    leads.forEach(function (l) {
      var a = mesCom.filter(function (c) { return c.lead_id === l.id; });
      if (a.length) delais.push((new Date(a[a.length - 1].cree_le) - new Date(l.cree_le)) / 60000);
    });
    delais.sort(function (x, y) { return x - y; });
    b.reaction = delais.length ? delais[Math.floor(delais.length / 2)] : null;
    // Série : jours consécutifs avec au moins une action
    var jours = {}; mesCom.forEach(function (c) { jours[new Date(c.cree_le).toDateString()] = true; });
    var serie = 0, d = new Date(); if (!jours[d.toDateString()]) d.setDate(d.getDate() - 1);
    while (jours[d.toDateString()]) { serie++; d.setDate(d.getDate() - 1); }
    b.serie = serie;
    return b;
  }
  function niveau(points) {
    var i = 0; while (i + 1 < NIVEAUX.length && points >= NIVEAUX[i + 1][0]) i++;
    var suivant = NIVEAUX[i + 1];
    return { num: i + 1, nom: NIVEAUX[i][1], suivant: suivant ? suivant[0] : null, base: NIVEAUX[i][0], pct: suivant ? Math.round((points - NIVEAUX[i][0]) / (suivant[0] - NIVEAUX[i][0]) * 100) : 100 };
  }
  function dureeLisible(min) {
    if (min === null) return "–";
    if (min < 60) return Math.max(1, Math.round(min)) + " min";
    if (min < 1440) return Math.round(min / 60) + " h";
    return Math.round(min / 1440) + " j";
  }
  function badges(b, tout) {
    var ouverts = etat.leads.filter(function (l) { return l.conseiller_id === etat.moi.id && l.statut === "nouveau" && Date.now() - new Date(l.cree_le) > 86400000; }).length;
    return [
      ["Premier contrat", "Signer un premier contrat", tout.signes, 1, "trophee"],
      ["Closer", "Signer 10 contrats", tout.signes, 10, "couronne"],
      ["Agenda plein", "Obtenir 10 rendez-vous", tout.rdv, 10, "agenda"],
      ["Éclair", "Réagir en moins d'1 h (médiane, 5 leads min.)", b.reaction !== null && tout.recus >= 5 && b.reaction <= 60 ? 1 : 0, 1, "eclair"],
      ["Régulier", "5 jours d'affilée avec une action", b.serie, 5, "flamme"],
      ["Bavard", "Écrire 50 commentaires", tout.commentaires, 50, "bulle"],
      ["Zéro oubli", "Aucun nouveau lead en attente depuis plus de 24 h", tout.recus && !ouverts ? 1 : 0, 1, "cible"]
    ].map(function (x) { return { nom: x[0], desc: x[1], fait: Math.min(x[2], x[3]), but: x[3], ok: x[2] >= x[3], icone: x[4] }; });
  }
  var ICONES = {
    trophee: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    couronne: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z"/>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>',
    eclair: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    flamme: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z"/>',
    bulle: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    cible: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'
  };
  function icone(n) { return '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[n] + "</svg>"; }

  // ---------- Mes statistiques (conseiller) ----------
  function vuePerf() {
    var zone = app.querySelector("[data-contenu]");
    var moi = etat.moi.id, debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    var mois = bilan(moi, debutMois), tout = bilan(moi, null), niv = niveau(tout.points);
    var objectif = Number((etat.moi.user_metadata || {}).objectif_signes) || 5;
    var pctObj = Math.min(100, Math.round(mois.signes / objectif * 100));
    var aFaire = etat.leads.filter(function (l) { return l.conseiller_id === moi && (l.statut === "nouveau" || aRappeler(l)); }).length;
    var prenom = (etat.profil.nom || "").split(" ")[0];
    var heure = new Date().getHours();
    var phrase = pctObj >= 100 ? "Objectif du mois atteint. Impressionnant !" : mois.signes ? "Encore " + (objectif - mois.signes) + " contrat" + (objectif - mois.signes > 1 ? "s" : "") + " pour atteindre votre objectif du mois." : aFaire ? "Vos clients attendent votre appel : c'est le moment de marquer des points." : "Tout est à jour. Bravo !";
    // 8 dernières semaines
    var semaines = [];
    for (var i = 7; i >= 0; i--) {
      var deb = new Date(); deb.setHours(0, 0, 0, 0); deb.setDate(deb.getDate() - ((deb.getDay() + 6) % 7) - i * 7);
      var fin = new Date(deb); fin.setDate(fin.getDate() + 7);
      var ls = etat.leads.filter(function (l) { return l.conseiller_id === moi && new Date(l.cree_le) >= deb && new Date(l.cree_le) < fin; });
      semaines.push({ nom: deb.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit" }), recus: ls.length, signes: ls.filter(function (l) { return l.statut === "signe"; }).length });
    }
    var maxS = Math.max.apply(null, semaines.map(function (s) { return s.recus; }).concat([1]));
    var entonnoir = [["Leads reçus", tout.recus], ["Contactés", tout.contactes], ["RDV obtenus", tout.rdv], ["Offres", tout.offres], ["Signés", tout.signes]];
    var bs = badges(mois, tout);
    var r = 54, circ = 2 * Math.PI * r;
    zone.innerHTML =
      '<div class="perf-tete"><div><p class="perf-salut">' + (heure < 18 ? "Bonjour" : "Bonsoir") + " " + esc(prenom) + '</p><h1>Mes statistiques</h1><p class="sous">' + phrase + "</p></div>" +
      (aFaire ? '<button class="btn btn--plein btn--gros" data-a-faire>' + aFaire + " lead" + (aFaire > 1 ? "s" : "") + " à traiter →</button>" : "") + "</div>" +
      '<div class="perf-haut">' +
        '<div class="carte niveau"><div class="niveau__rang"><span class="niveau__num">' + niv.num + '</span><div><span class="niveau__label">Niveau</span><strong>' + niv.nom + '</strong></div></div>' +
        '<p class="niveau__points"><b>' + tout.points + "</b> points</p>" +
        '<div class="jauge"><span style="width:' + niv.pct + '%"></span></div>' +
        '<p class="sous">' + (niv.suivant ? "Encore " + (niv.suivant - tout.points) + " points pour le niveau " + (niv.num + 1) : "Niveau maximum atteint") + "</p>" +
        '<p class="bareme">Contact +3 · RDV +10 · Offre +8 · Signé +40 · Commentaire +1</p></div>' +
        '<div class="carte objectif"><div class="anneau"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="' + r + '" class="anneau__fond"/><circle cx="60" cy="60" r="' + r + '" class="anneau__plein" style="stroke-dasharray:' + circ + ";stroke-dashoffset:" + circ * (1 - pctObj / 100) + '"/></svg><div class="anneau__centre"><strong>' + mois.signes + "/" + objectif + "</strong><span>signés</span></div></div>" +
        '<div><span class="niveau__label">Objectif du mois</span><p class="objectif__txt">' + pctObj + ' % atteint</p><button class="lien" data-objectif>Modifier mon objectif</button></div></div>' +
        '<div class="carte serie"><span class="serie__icone">' + icone("flamme") + '</span><strong>' + tout.serie + '</strong><span>jour' + (tout.serie > 1 ? "s" : "") + " d'affilée</span><p class=\"sous\">" + (tout.serie ? "Continuez demain pour garder la série." : "Une action aujourd'hui lance votre série.") + "</p></div>" +
      "</div>" +
      '<div class="kpis kpis--5"><div><span>Leads ce mois</span><strong>' + mois.recus + "</strong></div><div><span>Taux de contact</span><strong>" + (mois.recus ? Math.round(mois.contactes / mois.recus * 100) : 0) + " %</strong></div><div><span>RDV ce mois</span><strong>" + mois.rdv + "</strong></div><div><span>Signés ce mois</span><strong>" + mois.signes + "</strong></div><div><span>Temps de réaction</span><strong>" + dureeLisible(tout.reaction) + "</strong></div></div>" +
      '<div class="perf-grille">' +
        '<div class="carte"><h2>Mon parcours client</h2><div class="entonnoir">' + entonnoir.map(function (e, i) { var pc = tout.recus ? Math.round(e[1] / tout.recus * 100) : 0; return '<div class="entonnoir__ligne"><span>' + e[0] + '</span><span class="entonnoir__barre"><span style="width:' + Math.max(pc, e[1] ? 4 : 0) + "%;--i:" + i + '"></span></span><strong>' + e[1] + "</strong><em>" + pc + " %</em></div>"; }).join("") + "</div></div>" +
        '<div class="carte"><h2>Mes 8 dernières semaines</h2><div class="histo">' + semaines.map(function (s) { return '<div class="histo__col" title="' + s.recus + " reçus, " + s.signes + ' signés"><div class="histo__barres"><span class="histo__recus" style="height:' + Math.round(s.recus / maxS * 100) + '%"></span><span class="histo__signes" style="height:' + Math.round(s.signes / maxS * 100) + '%"></span></div><b>' + s.recus + "</b><small>" + s.nom + "</small></div>"; }).join("") + '</div><p class="legende"><span class="leg leg--recus"></span>Reçus <span class="leg leg--signes"></span>Signés</p></div>' +
      "</div>" +
      '<h2 class="titre-section">Mes badges <small>' + bs.filter(function (b) { return b.ok; }).length + " / " + bs.length + "</small></h2>" +
      '<div class="badges">' + bs.map(function (b) { return '<div class="badge-jeu' + (b.ok ? " badge-jeu--ok" : "") + '"><span class="badge-jeu__icone">' + icone(b.icone) + "</span><strong>" + b.nom + "</strong><small>" + b.desc + "</small>" + (b.ok ? '<span class="badge-jeu__etat">Obtenu</span>' : '<span class="jauge jauge--mini"><span style="width:' + Math.round(b.fait / b.but * 100) + '%"></span></span><span class="badge-jeu__etat">' + b.fait + " / " + b.but + "</span>") + "</div>"; }).join("") + "</div>";
    var af = zone.querySelector("[data-a-faire]");
    if (af) af.onclick = function () { etat.vue = "leads"; etat.filtre = "tous"; rendre(); };
    zone.querySelector("[data-objectif]").onclick = function () {
      var v = prompt("Combien de contrats voulez-vous signer ce mois ?", objectif);
      var n = parseInt(v, 10); if (!n || n < 1) return;
      sb.auth.updateUser({ data: { objectif_signes: n } }).then(function (res) {
        if (res && res.error) { toast("Erreur : " + res.error.message, true); return; }
        etat.moi.user_metadata = Object.assign({}, etat.moi.user_metadata, { objectif_signes: n });
        vuePerf(); toast("Objectif : " + n + " contrats ce mois. Allez-y !");
      });
    };
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
    var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    var classement = etat.conseillers.filter(function (c) { return c.actif; }).map(function (c) { var b = bilan(c.id, debutMois); b.c = c; return b; }).sort(function (x, y) { return y.points - x.points || y.signes - x.signes; });
    var podium = '<div class="carte"><h2>Classement du mois</h2><ol class="classement">' + classement.map(function (b, i) {
      return '<li class="classement__ligne' + (i < 3 && b.points ? " classement__ligne--" + (i + 1) : "") + '"><span class="classement__rang">' + (i + 1) + "</span>" + avatar(b.c.nom, "petit") + "<strong>" + esc(b.c.nom) + '</strong><span class="classement__det">' + b.recus + " reçus · " + b.rdv + " RDV · " + b.signes + " signés · réaction " + dureeLisible(b.reaction) + '</span><b class="classement__pts">' + b.points + " pts</b></li>";
    }).join("") + "</ol></div>";
    zone.innerHTML =
      '<div class="tete"><div><h1>Statistiques</h1><p class="sous">Sur les ' + etat.leads.length + " derniers leads.</p></div></div>" +
      '<div class="kpis"><div><span>Leads (30 jours)</span><strong>' + recents.length + '</strong></div><div><span>Traités</span><strong>' + (etat.leads.length ? Math.round(traites / etat.leads.length * 100) : 0) + ' %</strong></div><div><span>Signés</span><strong>' + signes + '</strong></div><div><span>Taux de signature</span><strong>' + (etat.leads.length ? Math.round(signes / etat.leads.length * 100) : 0) + " %</strong></div></div>" + podium +
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
