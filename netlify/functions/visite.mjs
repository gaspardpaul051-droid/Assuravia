// Compteur de visites sans cookies : le site envoie une ligne à chaque arrivée depuis l'extérieur.
// Aucune donnée personnelle n'est enregistrée (pas d'adresse IP, pas de cookie, pas d'identifiant).
// Variables d'environnement Netlify : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const ROBOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|bingpreview|google-inspectiontool|adsbot/i;
const court = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export const handler = async (event) => {
  const vide = { statusCode: 204, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  const URL = (process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1\/?$|\/$/, "");
  const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !CLE) return vide;
  if (ROBOTS.test(event.headers["user-agent"] || "")) return vide;
  let d;
  try { d = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "{}"); } catch (e) { return vide; }
  const page = court(d.page, 200);
  if (!page.startsWith("/") || page.startsWith("/espace")) return vide;
  const ligne = {
    page,
    source: court(d.source, 80),
    campagne: court(d.campagne, 120),
    terme: court(d.terme, 120),
    campagne_id: court(d.campagne_id, 30).replace(/[^\d]/g, ""),
    gclid: !!d.gclid,
    provenance: court(d.provenance, 120).toLowerCase(),
    mobile: !!d.mobile,
  };
  try {
    await fetch(URL + "/rest/v1/visites", { method: "POST", headers: { apikey: CLE, Authorization: "Bearer " + CLE, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(ligne) });
  } catch (e) { console.error("Visite non enregistrée :", e.message); }
  return vide;
};
