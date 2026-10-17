// Netlify lance cette fonction automatiquement à chaque demande envoyée par un formulaire du site.
// Elle enregistre le lead dans l'espace conseillers (Supabase) et l'attribue à un conseiller
// selon les pourcentages définis par l'administrateur.
// Variables d'environnement Netlify : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { enregistrer } from "../lib/enregistrer.mjs";

export const handler = async (event) => {
  const payload = JSON.parse(event.body || "{}").payload || {};
  // Déjà enregistré par l'envoi direct du site (fonction lead) : la copie Netlify sert seulement d'archive
  if ((payload.data || {}).envoi_direct === "oui") return { statusCode: 200, body: "déjà enregistré" };
  return { statusCode: 200, body: await enregistrer(payload) };
};
