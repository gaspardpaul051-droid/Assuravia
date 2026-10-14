// Netlify lance cette fonction automatiquement à chaque demande envoyée par un formulaire du site.
// Elle enregistre le lead dans l'espace conseillers (Supabase) et l'attribue à un conseiller
// selon les pourcentages définis par l'administrateur.
// Variables d'environnement Netlify : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { choisirConseiller, extraireLead, memeContact } from "../lib/leads.mjs";

export const handler = async (event) => {
  const URL = process.env.SUPABASE_URL;
  const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !CLE) {
    console.log("Espace conseillers non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants) : lead non enregistré.");
    return { statusCode: 200, body: "ignoré" };
  }
  const entetes = { apikey: CLE, Authorization: "Bearer " + CLE, "Content-Type": "application/json" };
  const api = async (chemin, options = {}) => {
    const r = await fetch(URL + "/rest/v1/" + chemin, { ...options, headers: { ...entetes, ...(options.headers || {}) } });
    const texte = await r.text();
    if (!r.ok) throw new Error(chemin + " : " + r.status + " " + texte);
    return texte ? JSON.parse(texte) : null;
  };

  try {
    const payload = JSON.parse(event.body || "{}").payload || {};
    const lead = extraireLead(payload);

    // Doublon : même e-mail ou même téléphone dans les 3 dernières heures -> on complète la fiche existante
    const depuis = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const filtres = [];
    if (lead.email) filtres.push("email.eq." + encodeURIComponent(lead.email));
    if (lead.telephone) filtres.push("telephone.eq." + encodeURIComponent(lead.telephone));
    if (filtres.length) {
      const recents = await api("leads?select=id,donnees,formulaire,email,telephone&cree_le=gte." + depuis + "&or=(" + filtres.join(",") + ")&order=cree_le.desc&limit=5");
      const existant = (recents || []).find((r) => memeContact(r, lead));
      if (existant) {
        await api("leads?id=eq." + existant.id, {
          method: "PATCH",
          body: JSON.stringify({ donnees: { ...existant.donnees, ...lead.donnees }, prime: lead.prime || undefined }),
        });
        await api("commentaires", {
          method: "POST",
          body: JSON.stringify({ lead_id: existant.id, texte: "Nouvelle demande du même contact (" + (lead.formulaire || "formulaire") + ").", automatique: true }),
        });
        return { statusCode: 200, body: "complété " + existant.id };
      }
    }

    // Répartition : conseillers actifs avec un pourcentage, et leurs leads des 30 derniers jours
    const conseillers = await api("conseillers?select=id,nom,poids&actif=eq.true&poids=gt.0");
    const mois = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const attribues = await api("leads?select=conseiller_id&cree_le=gte." + mois + "&conseiller_id=not.is.null");
    const choisi = choisirConseiller(conseillers || [], attribues || []);
    lead.conseiller_id = choisi ? choisi.id : null;

    const cree = await api("leads", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(lead) });
    const id = cree && cree[0] && cree[0].id;
    if (id) {
      await api("commentaires", {
        method: "POST",
        body: JSON.stringify({ lead_id: id, texte: "Lead reçu" + (choisi ? " et attribué à " + choisi.nom : " (aucun conseiller actif : à attribuer)") + ".", automatique: true }),
      });
    }
    return { statusCode: 200, body: "enregistré " + id };
  } catch (e) {
    console.error("Erreur espace conseillers :", e.message);
    // On répond 200 pour ne pas bloquer la réception du formulaire par Netlify.
    return { statusCode: 200, body: "erreur" };
  }
};
