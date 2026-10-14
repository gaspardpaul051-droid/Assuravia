// Actions réservées à l'administrateur de l'espace conseillers, qui demandent la clé de service Supabase :
// inviter un conseiller (il reçoit un e-mail pour choisir son mot de passe) et réinitialiser un mot de passe.
// Appel : POST /.netlify/functions/espace-admin  { action, email, nom, poids }  avec l'en-tête Authorization: Bearer <jeton du connecté>

export const handler = async (event) => {
  const URL = (process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1\/?$|\/$/, "") || undefined;
  const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SITE = process.env.ESPACE_URL || "https://assuravia.ch/espace/";
  const reponse = (code, objet) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(objet) });
  if (event.httpMethod !== "POST") return reponse(405, { erreur: "Méthode non autorisée" });
  if (!URL || !CLE) return reponse(500, { erreur: "Espace non configuré" });

  const service = { apikey: CLE, Authorization: "Bearer " + CLE, "Content-Type": "application/json" };
  try {
    // Qui appelle ? On vérifie le jeton auprès de Supabase, puis le rôle administrateur.
    const jeton = (event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");
    if (!jeton) return reponse(401, { erreur: "Non connecté" });
    const moi = await fetch(URL + "/auth/v1/user", { headers: { apikey: CLE, Authorization: "Bearer " + jeton } });
    if (!moi.ok) return reponse(401, { erreur: "Session expirée" });
    const utilisateur = await moi.json();
    const role = await (await fetch(URL + "/rest/v1/conseillers?select=role&id=eq." + utilisateur.id, { headers: service })).json();
    if (!role[0] || role[0].role !== "admin") return reponse(403, { erreur: "Réservé à l'administrateur" });

    const corps = JSON.parse(event.body || "{}");
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
