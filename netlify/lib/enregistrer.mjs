// Enregistrement d'un lead dans l'espace conseillers (Supabase) : doublon fusionné, sinon attribution et notification.
// Utilisé par submission-created (copie Netlify Forms) et par la fonction lead (envoi direct depuis le site).
// Variables d'environnement Netlify : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { choisirConseiller, extraireLead, memeContact, sourceDuLead } from "./leads.mjs";
import { notifierLead } from "./mail.mjs";

export async function enregistrer(payload) {

  const URL = (process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1\/?$|\/$/, "") || undefined;
  const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !CLE) {
    console.log("Espace conseillers non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants) : lead non enregistré.");
    return "ignoré";
  }
  try {
    const r = JSON.parse(Buffer.from(CLE.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()).role;
    if (r && r !== "service_role") console.error("SUPABASE_SERVICE_ROLE_KEY contient la clé « " + r + " » au lieu de la clé service_role : le lead ne pourra pas être enregistré.");
  } catch (e) { /* clé d'un autre format */ }
  const entetes = { apikey: CLE, Authorization: "Bearer " + CLE, "Content-Type": "application/json" };
  const api = async (chemin, options = {}) => {
    const r = await fetch(URL + "/rest/v1/" + chemin, { ...options, headers: { ...entetes, ...(options.headers || {}) } });
    const texte = await r.text();
    if (!r.ok) throw new Error(chemin + " : " + r.status + " " + texte);
    return texte ? JSON.parse(texte) : null;
  };

  try {
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
        return "complété " + existant.id;
      }
    }

    // Répartition : d'abord une règle propre à la page ou au formulaire (utile pour les conseillers au budget) ;
    // sinon le lead va à un conseiller « à la pièce » dont le solde couvre un lead (CHF 50), celui qui a le plus gros solde.
    // Un conseiller à la pièce sans solde suffisant ne reçoit rien, même par une règle. Personne de disponible : lead à attribuer.
    let actifs;
    try { actifs = (await api("conseillers?select=id,nom,poids,email,notif_email,type,credit&actif=eq.true")) || []; }
    catch (e) {
      try { actifs = (await api("conseillers?select=id,nom,poids,email,notif_email&actif=eq.true")) || []; }
      catch (e2) { actifs = (await api("conseillers?select=id,nom,poids&actif=eq.true")) || []; }
    }
    const VALEUR_BASE = 50;
    const pieces = actifs.filter((c) => c.type === "piece");
    const solde = {};
    if (pieces.length) {
      let couts = [];
      try { couts = (await api("leads?select=conseiller_id,cout&cout=not.is.null&conseiller_id=in.(" + pieces.map((c) => c.id).join(",") + ")")) || []; } catch (e) { couts = []; }
      pieces.forEach((c) => { solde[c.id] = Number(c.credit || 0) - couts.filter((l) => l.conseiller_id === c.id).reduce((t, l) => t + Number(l.cout || 0), 0); });
    }
    const disponible = (c) => c && (c.type !== "piece" || solde[c.id] >= VALEUR_BASE);
    let regles = [];
    try { regles = (await api("regles?select=source,conseiller_id,poids&poids=gt.0")) || []; } catch (e) { regles = []; }
    regles = regles.filter((r) => actifs.some((c) => c.id === r.conseiller_id));
    const source = sourceDuLead(regles, lead);
    let choisi = null;
    if (source) {
      const mois = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const candidats = regles.filter((r) => r.source === source).map((r) => ({ ...actifs.find((c) => c.id === r.conseiller_id), poids: r.poids })).filter(disponible);
      const filtreSource = source.startsWith("/") ? "&page=like." + encodeURIComponent(source + "*") : "&formulaire=eq." + encodeURIComponent(source);
      const attribues = (await api("leads?select=conseiller_id,formulaire,page&cree_le=gte." + mois + "&conseiller_id=not.is.null" + filtreSource)) || [];
      choisi = choisirConseiller(candidats, attribues);
    }
    if (!choisi) {
      const possibles = pieces.filter(disponible).sort((x, y) => solde[y.id] - solde[x.id]);
      choisi = possibles[0] || null;
    }
    lead.conseiller_id = choisi ? choisi.id : null;

    const cree = await api("leads", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(lead) });
    const id = cree && cree[0] && cree[0].id;
    if (id) {
      await api("commentaires", {
        method: "POST",
        body: JSON.stringify({ lead_id: id, texte: "Lead reçu" + (choisi ? " et attribué à " + choisi.nom + (source && choisi.poids !== undefined && regles.some((r) => r.source === source && r.conseiller_id === choisi.id) ? " (règle « " + source + " »)" : choisi.type === "piece" ? " (à la pièce, solde avant ce lead : CHF " + Math.round(solde[choisi.id]) + ")" : "") : " (aucun conseiller disponible : à attribuer)") + ".", automatique: true }),
      });
    }
    if (choisi) {
      const nomProduit = String(lead.produit || lead.formulaire || "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
      try { await notifierLead({ conseiller: actifs.find((c) => c.id === choisi.id), lead, id, nomProduit }); } catch (e) { console.error("Notification : " + e.message); }
    }
    return "enregistré " + id;
  } catch (e) {
    console.error("Erreur espace conseillers :", e.message);
    // On répond 200 pour ne pas bloquer la réception du formulaire par Netlify.
    return "erreur";
  }
}
