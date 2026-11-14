// IndexNow : après chaque mise en ligne réussie (événement Netlify « deploy-succeeded »), prévient Bing
// (et les autres moteurs IndexNow) des pages modifiées ces 2 derniers jours. Liste écrite par build.py dans /indexnow.json.
// Clé : fichier /<CLE>.txt à la racine du site (static/).
const SITE = "https://assuravia.ch";
const CLE = "80a1ed501ee442b4945fc893ae0bebfc";

export const handler = async () => {
  try {
    const urls = await fetch(`${SITE}/indexnow.json`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : []));
    if (!urls.length) return { statusCode: 200, body: "Aucune page modifiée" };
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: "assuravia.ch", key: CLE, keyLocation: `${SITE}/${CLE}.txt`, urlList: urls.slice(0, 10000) }),
    });
    console.log(`IndexNow : ${urls.length} adresses envoyées, réponse ${r.status}`);
    return { statusCode: 200, body: `IndexNow ${r.status}` };
  } catch (e) {
    console.log("IndexNow : échec", e.message);
    return { statusCode: 200, body: "IndexNow échec" };
  }
};
