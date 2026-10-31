// Relance automatique : un e-mail au conseiller pour chaque lead encore « Nouveau lead » 24 heures après son arrivée.
// Envoi du mardi 10 h au vendredi 16 h (heure de Zurich), en journée (8 h à 19 h) : le lundi reste libre pour traiter
// les leads du week-end. Une seule relance par lead, notée dans son suivi. Fonction lancée chaque heure.
import { relancerConseiller } from "../lib/mail.mjs";

const MARQUE = "Relance e-mail envoyée au conseiller";
const HEURES = 24, AGE_MAX_JOURS = 30;

const zurich = (d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { jour: p.weekday, heure: Number(p.hour) };
};
// Mardi dès 10 h, mercredi et jeudi, vendredi jusqu'à 16 h ; jamais la nuit
function fenetreEnvoi(d) {
  const { jour, heure } = zurich(d);
  if (heure < 8 || heure >= 19) return false;
  if (jour === "Tue") return heure >= 10;
  if (jour === "Wed" || jour === "Thu") return true;
  if (jour === "Fri") return heure < 16;
  return false;
}

export default async () => {
  const maintenant = new Date();
  if (!fenetreEnvoi(maintenant)) return new Response("hors horaires");
  const URL = (process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1\/?$|\/$/, "");
  const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !CLE || !process.env.RESEND_API_KEY) return new Response("non configuré");
  const api = async (chemin, options = {}) => {
    const r = await fetch(URL + "/rest/v1/" + chemin, { ...options, headers: { apikey: CLE, Authorization: "Bearer " + CLE, "Content-Type": "application/json", ...(options.headers || {}) } });
    const t = await r.text();
    if (!r.ok) throw new Error(chemin + " : " + r.status + " " + t);
    return t ? JSON.parse(t) : null;
  };
  const limite = new Date(Date.now() - AGE_MAX_JOURS * 86400000).toISOString();
  const avant = new Date(Date.now() - HEURES * 3600000).toISOString();
  const leads = (await api("leads?select=id,prenom,nom,telephone,email,produit,formulaire,cree_le,conseiller_id&statut=eq.nouveau&conseiller_id=not.is.null&cree_le=gte." + limite + "&cree_le=lte." + avant + "&order=cree_le.asc")) || [];
  if (!leads.length) return new Response("rien à relancer");
  const deja = new Set(((await api("commentaires?select=lead_id&automatique=eq.true&texte=like." + encodeURIComponent(MARQUE + "*") + "&lead_id=in.(" + leads.map((l) => l.id).join(",") + ")")) || []).map((r) => r.lead_id));
  const dues = leads.filter((l) => !deja.has(l.id));
  if (!dues.length) return new Response("rien à relancer");
  const conseillers = (await api("conseillers?select=id,nom,email&id=in.(" + [...new Set(dues.map((l) => l.conseiller_id))].join(",") + ")")) || [];
  let envoyes = 0;
  for (const l of dues) {
    const c = conseillers.find((x) => x.id === l.conseiller_id);
    if (!c) continue;
    try {
      if (await relancerConseiller({ conseiller: c, leads: [l] })) {
        envoyes++;
        await api("commentaires", { method: "POST", body: JSON.stringify({ lead_id: l.id, texte: MARQUE + " (" + c.nom + ") : lead toujours « Nouveau lead » plus de 24 h après son arrivée.", automatique: true }) });
      }
    } catch (e) { console.error("Relance lead " + l.id + " : " + e.message); }
  }
  console.log("Relances envoyées : " + envoyes + " e-mail(s).");
  return new Response("ok " + envoyes);
};

export const config = { schedule: "0 * * * *" };
