// Envoi direct d'une demande depuis le site vers l'espace conseillers, sans passer par le filtre anti-spam
// de Netlify Forms (qui peut écarter de vraies demandes). Le site envoie ensuite une copie à Netlify Forms,
// marquée envoi_direct=oui, gardée en archive.
// Appel : POST /.netlify/functions/lead  (corps : champs du formulaire, encodés comme un formulaire HTML)

import { enregistrer } from "../lib/enregistrer.mjs";

export const handler = async (event) => {
  const reponse = (code, texte) => ({ statusCode: code, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: texte });
  if (event.httpMethod !== "POST") return reponse(405, "Méthode non autorisée");
  const brut = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
  if (brut.length > 50000) return reponse(413, "Trop long");
  const params = new URLSearchParams(brut);
  const data = {};
  for (const [k, v] of params) data[k] = data[k] ? data[k] + ", " + v : v;
  // Robots : champ piège rempli, ou ni téléphone ni e-mail
  if (data["bot-field"]) return reponse(200, "ignoré");
  if (!data.telephone && !data.email) return reponse(400, "Coordonnées manquantes");
  if (!data["form-name"]) return reponse(400, "Formulaire inconnu");
  const resultat = await enregistrer({ form_name: data["form-name"], data });
  if (resultat === "erreur" || resultat === "ignoré") return reponse(502, resultat);
  return reponse(200, resultat);
};
