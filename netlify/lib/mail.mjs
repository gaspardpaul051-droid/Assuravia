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
