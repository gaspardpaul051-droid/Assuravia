// Outils communs : lecture d'une demande Netlify et répartition des leads.

// Champs techniques que l'on ne garde pas dans la fiche
const IGNORES = new Set(["form-name", "bot-field", "ip", "user_agent", "referrer", "consentement"]);

export function propre(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

// Transforme une demande Netlify Forms en ligne « leads »
export function extraireLead(payload) {
  const d = payload.data || {};
  const donnees = {};
  Object.keys(d).forEach((k) => {
    if (IGNORES.has(k)) return;
    const v = Array.isArray(d[k]) ? d[k].join(", ") : propre(d[k]);
    if (v) donnees[k] = v;
  });
  const tel = propre(d.telephone_complet) || [propre(d.indicatif), propre(d.telephone)].filter(Boolean).join(" ");
  const prime = propre(d.prime_totale) || propre(d.prime_mensuelle_estimee) || propre(d.prime_estimee) || propre(d.prime_principale);
  return {
    formulaire: propre(payload.form_name || d["form-name"]),
    produit: propre(d.produit),
    page: propre(d.page),
    prenom: propre(d.prenom),
    nom: propre(d.nom),
    email: propre(d.email).toLowerCase(),
    telephone: tel.replace(/\s+/g, ""),
    canton: propre(d.canton) || propre(d.domicile_npa) || "",
    prime,
    donnees,
  };
}

// Même personne : même e-mail ou même téléphone
export function memeContact(a, b) {
  return (a.email && b.email && a.email === b.email) || (a.telephone && b.telephone && a.telephone === b.telephone);
}

// Répartition pondérée : on donne le lead au conseiller le plus en retard sur sa part.
// part visée = poids / somme des poids ; retard = part visée × (total + 1) − leads déjà reçus.
export function choisirConseiller(conseillers, attribues) {
  const actifs = conseillers.filter((c) => Number(c.poids) > 0);
  if (!actifs.length) return null;
  const compte = {};
  attribues.forEach((l) => { compte[l.conseiller_id] = (compte[l.conseiller_id] || 0) + 1; });
  const ids = new Set(actifs.map((c) => c.id));
  const total = attribues.filter((l) => ids.has(l.conseiller_id)).length;
  const somme = actifs.reduce((s, c) => s + Number(c.poids), 0);
  let meilleur = null, retardMax = -Infinity;
  actifs.forEach((c) => {
    const retard = (Number(c.poids) / somme) * (total + 1) - (compte[c.id] || 0);
    if (retard > retardMax + 1e-9) { retardMax = retard; meilleur = c; }
  });
  return meilleur;
}

