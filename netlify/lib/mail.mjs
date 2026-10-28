// Notification par e-mail d'un nouveau lead au conseiller (service Resend, https://resend.com).
// Variables d'environnement Netlify : RESEND_API_KEY (obligatoire pour envoyer),
// MAIL_EXPEDITEUR (facultatif, par défaut « Assuravia <leads@assuravia.ch> », domaine à vérifier dans Resend),
// ESPACE_URL (facultatif, par défaut https://assuravia.ch/espace/).

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const mailActif = () => !!process.env.RESEND_API_KEY;

// Téléphone lisible : +41 78 576 87 98
function telLisible(t) {
  const n = String(t || "").replace(/[^\d+]/g, "");
  const m = n.match(/^\+41(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? "+41 " + m[1] + " " + m[2] + " " + m[3] + " " + m[4] : t || "";
}

export async function notifierLead({ conseiller, lead, id, nomProduit, origine }) {
  const cle = process.env.RESEND_API_KEY;
  if (!cle || !conseiller || !conseiller.email || !conseiller.notif_email) return false;
  const espace = (process.env.ESPACE_URL || "https://assuravia.ch/espace/").replace(/\/?$/, "/");
  const lien = espace + (id ? "#lead=" + id : "");
  const nom = [lead.prenom, lead.nom].filter(Boolean).join(" ") || "Sans nom";
  const produit = nomProduit || lead.produit || lead.formulaire || "Demande";
  const tel = telLisible(lead.telephone);
  const lignes = [
    ["Produit", produit],
    ["Téléphone", tel ? '<a href="tel:' + esc(String(lead.telephone).replace(/\s/g, "")) + '" style="color:#1565A8;font-weight:700">' + esc(tel) + "</a>" : ""],
    ["E-mail", lead.email ? '<a href="mailto:' + esc(lead.email) + '" style="color:#1565A8">' + esc(lead.email) + "</a>" : ""],
    ["Canton", esc(lead.canton)],
    ["Rappel souhaité", esc((lead.donnees || {}).moment_rappel)],
    ["Estimation", esc(lead.prime)],
    ["Page", esc(lead.page)],
  ].filter((l) => l[1]);
  const html = `<!doctype html><html><body style="margin:0;background:#F2F5F9;font-family:Arial,Helvetica,sans-serif;color:#0B2545">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <p style="margin:0 0 12px;font-weight:800;font-size:18px">Assuravia <span style="font-weight:400;color:#5B6B80;font-size:14px">· Espace conseillers</span></p>
  <div style="background:#fff;border-radius:14px;padding:24px;border-top:5px solid #E2BE52">
    <p style="margin:0;color:#5B6B80;font-size:14px">${esc(origine || "Nouveau lead attribué")}</p>
    <h1 style="margin:6px 0 18px;font-size:24px">${esc(nom)}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${lignes.map((l) => `<tr><td style="padding:8px 0;color:#5B6B80;width:140px;border-bottom:1px solid #E6ECF3">${l[0]}</td><td style="padding:8px 0;border-bottom:1px solid #E6ECF3">${l[0] === "Produit" ? "<strong>" + esc(l[1]) + "</strong>" : l[1]}</td></tr>`).join("")}
    </table>
    <p style="margin:22px 0 0"><a href="${esc(lien)}" style="display:inline-block;background:#0B2545;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Ouvrir la fiche</a></p>
  </div>
  <p style="margin:14px 4px 0;font-size:12px;color:#7A8899">Vous recevez cet e-mail car les notifications sont activées pour votre compte. L'administrateur peut les désactiver dans « Conseillers et répartition ».</p>
</div></body></html>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + cle, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_EXPEDITEUR || "Assuravia <leads@assuravia.ch>",
      to: [conseiller.email],
      subject: "Nouveau lead : " + produit + " · " + nom,
      html,
      text: (origine || "Nouveau lead attribué") + "\n\n" + nom + "\n" + produit + (tel ? "\nTéléphone : " + tel : "") + (lead.email ? "\nE-mail : " + lead.email : "") + "\n\nOuvrir la fiche : " + lien,
    }),
  });
  if (!r.ok) { console.error("Envoi de l'e-mail impossible : " + r.status + " " + (await r.text())); return false; }
  return true;
}

const NOMS = { "rc-pro": "RC professionnelle", "complementaire-sante-eco": "Complémentaire santé", "complementaire-maladie": "Complémentaire santé", "assurance-menage": "Assurance ménage", "assurance-batiment": "Assurance bâtiment", "3e-pilier": "3e pilier", "rc-privee": "RC privée", "lamal": "LAMal", "hypotheque": "Hypothèque", "garantie-de-loyer": "Garantie de loyer", "assurance-hospitalisation": "Hospitalisation", "complementaire-ambulatoire": "Soins ambulatoires", "protection-juridique": "Protection juridique", "voyage": "Assurance voyage", "objets-de-valeur": "Objets de valeur", "vehicule": "Véhicule" };
const nomLisible = (slug) => NOMS[slug] || String(slug || "Demande").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

// Relance : un e-mail par conseiller listant ses leads encore « Nouveau » (envoyé même si les notifications sont désactivées)
export async function relancerConseiller({ conseiller, leads }) {
  const cle = process.env.RESEND_API_KEY;
  if (!cle || !conseiller || !conseiller.email || !leads.length) return false;
  const espace = (process.env.ESPACE_URL || "https://assuravia.ch/espace/").replace(/\/?$/, "/");
  const n = leads.length;
  const titre = n > 1 ? n + " leads attendent votre appel" : "Un lead attend votre appel";
  const ligne = (l) => {
    const nom = [l.prenom, l.nom].filter(Boolean).join(" ") || "Sans nom";
    const produit = nomLisible(l.produit || l.formulaire);
    const tel = telLisible(l.telephone);
    const depuis = new Date(l.cree_le).toLocaleString("fr-CH", { timeZone: "Europe/Zurich", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #E6ECF3"><strong>${esc(nom)}</strong><br><span style="color:#5B6B80;font-size:14px">${esc(produit)} · reçu ${esc(depuis)}</span>${tel ? `<br><a href="tel:${esc(String(l.telephone).replace(/\s/g, ""))}" style="color:#1565A8;font-weight:700">${esc(tel)}</a>` : ""}</td><td style="padding:10px 0;border-bottom:1px solid #E6ECF3;text-align:right"><a href="${esc(espace + "#lead=" + l.id)}" style="color:#1565A8;font-weight:700">Ouvrir</a></td></tr>`;
  };
  const html = `<!doctype html><html><body style="margin:0;background:#F2F5F9;font-family:Arial,Helvetica,sans-serif;color:#0B2545">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <p style="margin:0 0 12px;font-weight:800;font-size:18px">Assuravia <span style="font-weight:400;color:#5B6B80;font-size:14px">· Espace conseillers</span></p>
  <div style="background:#fff;border-radius:14px;padding:24px;border-top:5px solid #C2413A">
    <p style="margin:0;color:#C2413A;font-size:14px;font-weight:700">Relance : non traité depuis plus de 24 h ouvrables</p>
    <h1 style="margin:6px 0 8px;font-size:22px">${esc(titre)}</h1>
    <p style="margin:0 0 14px;color:#5B6B80;font-size:15px">Ces demandes sont toujours au statut « Nouveau ». Un rappel rapide augmente nettement les chances de signer.</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">${leads.map(ligne).join("")}</table>
    <p style="margin:22px 0 0"><a href="${esc(espace)}" style="display:inline-block;background:#0B2545;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Ouvrir l'espace conseillers</a></p>
  </div>
  <p style="margin:14px 4px 0;font-size:12px;color:#7A8899">Relance automatique les jours ouvrables. Dès que vous appelez, commentez ou programmez un rappel, le lead passe « En cours » et la relance s'arrête.</p>
</div></body></html>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + cle, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_EXPEDITEUR || "Assuravia <leads@assuravia.ch>",
      to: [conseiller.email],
      subject: "Relance : " + titre.toLowerCase().replace(/^./, (c) => c.toUpperCase()),
      html,
      text: titre + "\n\n" + leads.map((l) => "- " + ([l.prenom, l.nom].filter(Boolean).join(" ") || "Sans nom") + " (" + (l.produit || l.formulaire || "") + ") " + telLisible(l.telephone) + " : " + espace + "#lead=" + l.id).join("\n"),
    }),
  });
  if (!r.ok) { console.error("Relance impossible : " + r.status + " " + (await r.text())); return false; }
  return true;
}
