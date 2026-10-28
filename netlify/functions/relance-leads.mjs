// Relance automatique : chaque heure, les jours ouvrables de 8 h à 19 h (heure de Zurich), un e-mail à chaque conseiller
// dont des leads sont encore « Nouveau » depuis plus de 24 heures ouvrables (samedi et dimanche ne comptent pas).
// Au plus une relance par lead toutes les 24 heures ouvrables, 3 au maximum ; chaque relance est notée dans le suivi du lead.
import { relancerConseiller } from "../lib/mail.mjs";

const MARQUE = "Relance e-mail envoyée au conseiller";
const HEURES = 24, MAX_RELANCES = 3, AGE_MAX_JOURS = 30;

const zurich = (d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { jour: p.weekday, heure: Number(p.hour) };
};
const weekend = (d) => ["Sat", "Sun"].includes(zurich(d).jour);
// Heures écoulées en excluant samedi et dimanche (heure de Zurich), au quart d'heure près
function heuresOuvrables(depuis, maintenant) {
  let t = new Date(depuis).getTime(), total = 0;
  const fin = maintenant.getTime(), pas = 15 * 60 * 1000;
  while (t < fin) { if (!weekend(new Date(t))) total += 0.25; t += pas; }
  return total;
}

export default async () => {
  const maintenant = new Date();
  const { heure } = zurich(maintenant);
  if (weekend(maintenant) || heure < 8 || heure > 19) return new Response("hors horaires");
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
  const leads = (await api("leads?select=id,prenom,nom,telephone,email,produit,formulaire,cree_le,conseiller_id&statut=eq.nouveau&conseiller_id=not.is.null&cree_le=gte." + limite + "&order=cree_le.asc")) || [];
  if (!leads.length) return new Response("rien à relancer");
  const relances = (await api("commentaires?select=lead_id,cree_le&automatique=eq.true&texte=like." + encodeURIComponent(MARQUE + "*") + "&lead_id=in.(" + leads.map((l) => l.id).join(",") + ")")) || [];
  const dues = leads.filter((l) => {
    if (heuresOuvrables(l.cree_le, maintenant) < HEURES) return false;
    const siennes = relances.filter((r) => r.lead_id === l.id).map((r) => r.cree_le).sort();
    if (siennes.length >= MAX_RELANCES) return false;
    return !siennes.length || heuresOuvrables(siennes[siennes.length - 1], maintenant) >= HEURES;
  });
  if (!dues.length) return new Response("rien à relancer");
  const conseillers = (await api("conseillers?select=id,nom,email&id=in.(" + [...new Set(dues.map((l) => l.conseiller_id))].join(",") + ")")) || [];
  let envoyes = 0;
  for (const c of conseillers) {
    const siens = dues.filter((l) => l.conseiller_id === c.id);
    try {
      if (await relancerConseiller({ conseiller: c, leads: siens })) {
        envoyes++;
        await api("commentaires", { method: "POST", body: JSON.stringify(siens.map((l) => ({ lead_id: l.id, texte: MARQUE + " (" + c.nom + ") : lead non traité depuis plus de 24 h ouvrables.", automatique: true }))) });
      }
    } catch (e) { console.error("Relance " + c.nom + " : " + e.message); }
  }
  console.log("Relances envoyées : " + envoyes + " conseiller(s), " + dues.length + " lead(s).");
  return new Response("ok " + envoyes);
};

export const config = { schedule: "0 * * * *" };
