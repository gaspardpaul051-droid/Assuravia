// Actions réservées à l'administrateur de l'espace conseillers, qui demandent la clé de service Supabase :
// créer un conseiller avec un mot de passe provisoire (à changer à la première connexion), l'inviter par e-mail,
// lui donner un nouveau mot de passe provisoire, lui envoyer un e-mail de réinitialisation,
// ou prévenir par e-mail un conseiller des leads qu'on vient de lui attribuer (action « notifier »).
// Appel : POST /.netlify/functions/espace-admin  { action, email, nom, poids }  avec l'en-tête Authorization: Bearer <jeton du connecté>

import { notifierLead, relancerConseiller } from "../lib/mail.mjs";

export const handler = async (event) => {
  const URL = (process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1\/?$|\/$/, "") || undefined;
  const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SITE = process.env.ESPACE_URL || "https://assuravia.ch/espace/";
  const reponse = (code, objet) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(objet) });
  if (event.httpMethod !== "POST") return reponse(405, { erreur: "Méthode non autorisée" });
  if (!URL || !CLE) return reponse(500, { erreur: "Espace non configuré" });

  // La clé doit être la clé « service_role » (et non la clé « anon ») : on lit son rôle dans le jeton
  let roleCle = "";
  try { roleCle = JSON.parse(Buffer.from(CLE.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()).role || ""; } catch (e) { roleCle = CLE.startsWith("sb_secret_") ? "service_role" : ""; }
  if (roleCle !== "service_role") {
    return reponse(500, { erreur: "Dans Netlify, la variable SUPABASE_SERVICE_ROLE_KEY ne contient pas la clé service_role (c'est sans doute la clé anon). Remplacez-la puis republiez." });
  }
  const service = { apikey: CLE, Authorization: "Bearer " + CLE, "Content-Type": "application/json" };
  try {
    // Qui appelle ? On vérifie le jeton auprès de Supabase, puis le rôle administrateur.
    const jeton = (event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");
    if (!jeton) return reponse(401, { erreur: "Non connecté" });
    const moi = await fetch(URL + "/auth/v1/user", { headers: { apikey: CLE, Authorization: "Bearer " + jeton } });
    if (!moi.ok) return reponse(401, { erreur: "Session expirée" });
    const utilisateur = await moi.json();
    const role = await (await fetch(URL + "/rest/v1/conseillers?select=role&id=eq." + utilisateur.id, { headers: service })).json();
    if (!Array.isArray(role) || !role[0]) return reponse(403, { erreur: "Votre compte n'a pas de fiche conseiller dans la base." });
    if (role[0].role !== "admin") return reponse(403, { erreur: "Réservé à l'administrateur" });

    const corps = JSON.parse(event.body || "{}");
    const uuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
    if (corps.action === "supprimer") {
      if (!uuid(corps.id)) return reponse(400, { erreur: "Conseiller inconnu" });
      if (corps.id === utilisateur.id) return reponse(400, { erreur: "Vous ne pouvez pas supprimer votre propre compte." });
      // Ses leads vont au conseiller choisi (ou restent non attribués)
      const vers = uuid(corps.vers) ? corps.vers : null;
      await fetch(URL + "/rest/v1/leads?conseiller_id=eq." + corps.id, { method: "PATCH", headers: service, body: JSON.stringify({ conseiller_id: vers }) });
      const r = await fetch(URL + "/auth/v1/admin/users/" + corps.id, { method: "DELETE", headers: service });
      if (!r.ok) return reponse(400, { erreur: "Suppression impossible" });
      return reponse(200, { ok: true });
    }
    if (corps.action === "notifier") {
      // Leads attribués à la main : e-mail au conseiller s'il a les notifications activées
      if (!uuid(corps.conseiller_id)) return reponse(200, { ok: true, envoyes: 0 });
      const ids = (Array.isArray(corps.ids) ? corps.ids : []).map(Number).filter((n) => n > 0).slice(0, 50);
      if (!ids.length) return reponse(200, { ok: true, envoyes: 0 });
      const c = await (await fetch(URL + "/rest/v1/conseillers?select=id,nom,email,notif_email&id=eq." + corps.conseiller_id, { headers: service })).json();
      if (!Array.isArray(c) || !c[0] || !c[0].notif_email) return reponse(200, { ok: true, envoyes: 0 });
      const leads = await (await fetch(URL + "/rest/v1/leads?select=*&id=in.(" + ids.join(",") + ")", { headers: service })).json();
      let envoyes = 0;
      for (const l of Array.isArray(leads) ? leads : []) {
        const nomProduit = String(l.produit || l.formulaire || "").replace(/-/g, " ").replace(/^./, (x) => x.toUpperCase());
        if (await notifierLead({ conseiller: c[0], lead: l, id: l.id, nomProduit, origine: "Lead attribué par l'administrateur" })) envoyes++;
      }
      return reponse(200, { ok: true, envoyes });
    }
    if (corps.action === "relancer") {
      // Relance immédiate demandée par l'admin : un e-mail par conseiller pour les leads choisis encore « Nouveau »
      const ids = (Array.isArray(corps.ids) ? corps.ids : []).map(Number).filter((n) => n > 0).slice(0, 100);
      if (!ids.length) return reponse(200, { ok: true, envoyes: 0, leads: 0 });
      const leads = await (await fetch(URL + "/rest/v1/leads?select=id,prenom,nom,telephone,email,produit,formulaire,cree_le,conseiller_id,statut&id=in.(" + ids.join(",") + ")&statut=eq.nouveau&conseiller_id=not.is.null", { headers: service })).json();
      if (!Array.isArray(leads) || !leads.length) return reponse(200, { ok: true, envoyes: 0, leads: 0 });
      const cons = await (await fetch(URL + "/rest/v1/conseillers?select=id,nom,email&id=in.(" + [...new Set(leads.map((l) => l.conseiller_id))].join(",") + ")", { headers: service })).json();
      let envoyes = 0, sansEmail = [];
      for (const c of Array.isArray(cons) ? cons : []) {
        const siens = leads.filter((l) => l.conseiller_id === c.id);
        if (!c.email) { sansEmail.push(c.nom); continue; }
        if (await relancerConseiller({ conseiller: c, leads: siens })) {
          envoyes++;
          await fetch(URL + "/rest/v1/commentaires", { method: "POST", headers: service, body: JSON.stringify(siens.map((l) => ({ lead_id: l.id, auteur_id: utilisateur.id, texte: "Relance e-mail envoyée au conseiller (" + c.nom + ") par l'administrateur.", automatique: true }))) });
        }
      }
      return reponse(200, { ok: true, envoyes, leads: leads.length, sansEmail });
    }
    const email = String(corps.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reponse(400, { erreur: "E-mail invalide" });

    if (corps.action === "inviter") {
      const r = await fetch(URL + "/auth/v1/invite", {
        method: "POST", headers: service,
        body: JSON.stringify({ email, data: { nom: corps.nom || "" }, redirect_to: SITE }),
      });
      const res = await r.json();
      if (!r.ok) return reponse(400, { erreur: res.msg || res.error_description || "Invitation impossible" });
      // Fiche conseiller : nom et pourcentage choisis par l'administrateur
      await fetch(URL + "/rest/v1/conseillers?id=eq." + res.id, {
        method: "PATCH", headers: service,
        body: JSON.stringify({ nom: corps.nom || email, poids: Math.max(0, parseInt(corps.poids, 10) || 0) }),
      });
      return reponse(200, { ok: true, id: res.id });
    }
    const mdp = String(corps.mot_de_passe || "");
    if (corps.action === "creer") {
      if (mdp.length < 10) return reponse(400, { erreur: "Mot de passe provisoire : au moins 10 caractères" });
      const r = await fetch(URL + "/auth/v1/admin/users", {
        method: "POST", headers: service,
        body: JSON.stringify({ email, password: mdp, email_confirm: true, user_metadata: { nom: corps.nom || "", doit_changer: true } }),
      });
      const res = await r.json();
      if (!r.ok) {
        const msg = res.msg || res.message || res.error_description || "";
        return reponse(400, { erreur: /already|exists|registered/i.test(msg) ? "Un compte existe déjà avec cet e-mail" : "Création impossible : " + msg });
      }
      await fetch(URL + "/rest/v1/conseillers?id=eq." + res.id, {
        method: "PATCH", headers: service,
        body: JSON.stringify({ nom: corps.nom || email, poids: Math.max(0, parseInt(corps.poids, 10) || 0) }),
      });
      return reponse(200, { ok: true, id: res.id });
    }
    if (corps.action === "provisoire") {
      if (mdp.length < 10) return reponse(400, { erreur: "Mot de passe provisoire : au moins 10 caractères" });
      if (!/^[0-9a-f-]{36}$/i.test(String(corps.id || ""))) return reponse(400, { erreur: "Conseiller inconnu" });
      const r = await fetch(URL + "/auth/v1/admin/users/" + corps.id, {
        method: "PUT", headers: service,
        body: JSON.stringify({ password: mdp, user_metadata: { doit_changer: true } }),
      });
      if (!r.ok) return reponse(400, { erreur: "Modification impossible" });
      return reponse(200, { ok: true });
    }
    if (corps.action === "reinitialiser") {
      const r = await fetch(URL + "/auth/v1/recover", { method: "POST", headers: service, body: JSON.stringify({ email, redirect_to: SITE }) });
      if (!r.ok) return reponse(400, { erreur: "Envoi impossible" });
      return reponse(200, { ok: true });
    }
    return reponse(400, { erreur: "Action inconnue" });
  } catch (e) {
    console.error(e);
    return reponse(500, { erreur: "Erreur serveur" });
  }
};
