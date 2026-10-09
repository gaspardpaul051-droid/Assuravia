"""Générateur du site Assuravia.

Usage : python3 build.py
Produit le site statique dans dist/ (publié par Netlify).

- Pages fixes : templates/pages/ (Jinja2). Le chemin du fichier donne l'URL :
  templates/pages/entreprises/rc-professionnelle.html -> /entreprises/rc-professionnelle/
- Produits : content/produits/*.md. Chaque produit a une carte sur la page Privé ou Pro
  et, sauf s'il a une page fixe (champ `url`), une page générée avec templates/produit.html.
- Articles du blog : content/articles/*.md, publiés sous /blog/<fichier>/.
"""

from __future__ import annotations

import datetime as dt
import html as html_lib
import json
import re
import shutil
from pathlib import Path

import markdown
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
SITE_URL = "https://assuravia.ch"
# Numéro WhatsApp au format international sans + ni espaces, par exemple 41791234567.
WHATSAPP = "41XXXXXXXXX"

MOIS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

CANTONS = [
    ("GE", "Genève"), ("VD", "Vaud"), ("VS", "Valais"), ("FR", "Fribourg"),
    ("NE", "Neuchâtel"), ("JU", "Jura"), ("BE", "Berne (Jura bernois, Bienne)"),
    ("autre", "Autre canton"),
]

GROUPES = {
    "particuliers": {
        "nom": "Privé", "titre": "Particuliers", "url": "/particuliers/", "theme": "prive",
        "categories": ["Santé", "Prévoyance et placement", "Logement et biens", "Protection"],
    },
    "entreprises": {
        "nom": "Pro", "titre": "Entreprises", "url": "/entreprises/", "theme": "pro",
        "categories": ["Responsabilité", "Personnel", "Biens et exploitation"],
    },
}

CHAMPS_PRODUIT = ("slug", "groupe", "nom", "categorie", "icone", "ordre", "desc", "points", "badge", "bouton")


def date_fr(d: dt.date) -> str:
    return f"{d.day} {MOIS[d.month - 1]} {d.year}"


def lire_entete(path: Path) -> tuple[dict, str]:
    """Lit un fichier markdown avec un en-tête simple « cle: valeur » entre lignes '---'."""
    texte = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", texte, re.S)
    if not m:
        raise ValueError(f"En-tête manquant dans {path}")
    meta = {}
    for ligne in m.group(1).splitlines():
        if ":" in ligne:
            cle, val = ligne.split(":", 1)
            meta[cle.strip()] = val.strip().strip('"')
    return meta, m.group(2)


def extraire_faq(html: str) -> tuple[str, list[dict]]:
    """Sépare la section « Questions fréquentes » (h2 puis h3 + paragraphes) du reste."""
    morceaux = re.split(r"<h2[^>]*>Questions fréquentes</h2>", html, maxsplit=1)
    if len(morceaux) == 1:
        return html, []
    faq = []
    for m in re.finditer(r"<h3[^>]*>(.*?)</h3>(.*?)(?=<h3|$)", morceaux[1], re.S):
        faq.append({"question": m.group(1).strip(), "reponse": m.group(2).strip()})
    return morceaux[0], faq


def faq_jsonld(faq: list[dict]) -> str:
    if not faq:
        return ""
    texte = lambda h: html_lib.unescape(re.sub(r"<[^>]+>", "", h)).strip()
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": texte(q["question"]),
             "acceptedAnswer": {"@type": "Answer", "text": texte(q["reponse"])}}
            for q in faq
        ],
    }, ensure_ascii=False)


def lire_produit(path: Path) -> dict:
    meta, corps = lire_entete(path)
    for cle in CHAMPS_PRODUIT:
        if cle not in meta:
            raise ValueError(f"Champ '{cle}' manquant dans {path}")
    groupe = meta["groupe"]
    if groupe not in GROUPES:
        raise ValueError(f"Groupe inconnu dans {path} : {groupe}")
    if meta["categorie"] not in GROUPES[groupe]["categories"]:
        raise ValueError(f"Catégorie inconnue dans {path} : {meta['categorie']}")
    page_fixe = "url" in meta
    html, faq = extraire_faq(markdown.markdown(corps, extensions=["tables", "toc", "attr_list"]))
    return {
        **meta,
        "ordre": int(meta["ordre"]),
        "points": [p.strip() for p in meta["points"].split("|")],
        "url": meta.get("url") or f"{GROUPES[groupe]['url']}{meta['slug']}/",
        "page_fixe": page_fixe,
        "html": html,
        "faq": faq,
        "faq_jsonld": faq_jsonld(faq),
        "theme": GROUPES[groupe]["theme"],
    }


def lire_glossaire(path: Path) -> list[dict]:
    """Lit content/glossaire.txt : « catégorie | terme | définition | lien facultatif »."""
    termes = []
    for ligne in path.read_text(encoding="utf-8").splitlines():
        if not ligne.strip() or ligne.startswith("#"):
            continue
        champs = [c.strip() for c in ligne.split("|")]
        if len(champs) < 3 or champs[0] not in ("Assurance", "Prévoyance", "Placement"):
            raise ValueError(f"Ligne de glossaire invalide : {ligne}")
        terme = champs[1]
        ident = re.sub(r"[^a-z0-9]+", "-", terme.lower().translate(str.maketrans("àâäéèêëîïôöùûüç", "aaaeeeeiioouuuc"))).strip("-")
        termes.append({"categorie": champs[0], "terme": terme, "definition": champs[2],
                       "lien": champs[3] if len(champs) > 3 and champs[3] else "", "id": ident})
    cle = lambda t: t["terme"].lower().translate(str.maketrans("àâäéèêëîïôöùûüç", "aaaeeeeiioouuuc"))
    termes.sort(key=cle)
    for t in termes:
        t["lettre"] = cle(t)[0].upper() if cle(t)[0].isalpha() else "#"
    return termes


def lire_article(path: Path) -> dict:
    meta, corps = lire_entete(path)
    for cle in ("titre", "description", "date", "categorie"):
        if cle not in meta:
            raise ValueError(f"Champ '{cle}' manquant dans {path}")
    date = dt.date.fromisoformat(meta["date"])
    html, faq = extraire_faq(markdown.markdown(corps, extensions=["tables", "toc", "attr_list"]))
    return {
        **meta,
        "slug": path.stem,
        "date_obj": date,
        "date_fr": date_fr(date),
        "html": html,
        "faq": faq,
        "faq_jsonld": faq_jsonld(faq),
        "url": f"/blog/{path.stem}/",
        "brouillon": meta.get("brouillon", "non") == "oui",
    }


def url_de(page: Path) -> str:
    rel = page.relative_to(ROOT / "templates" / "pages").with_suffix("")
    parts = list(rel.parts)
    if parts[-1] == "index":
        parts = parts[:-1]
    return "/" + "/".join(parts) + ("/" if parts else "")


def ecrire(url: str, contenu: str) -> None:
    out = DIST / url.lstrip("/") / "index.html" if url.endswith("/") else DIST / url.lstrip("/")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(contenu, encoding="utf-8")


def main() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / "static", DIST)

    env = Environment(
        loader=FileSystemLoader(ROOT / "templates"),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    aujourd_hui = dt.date.today()

    tous = [lire_produit(p) for p in sorted((ROOT / "content" / "produits").glob("*.md"))]
    produits = {g: sorted((p for p in tous if p["groupe"] == g), key=lambda p: p["ordre"]) for g in GROUPES}
    par_slug = {p["slug"]: p for p in tous}

    articles = sorted(
        (a for a in (lire_article(p) for p in (ROOT / "content" / "articles").glob("*.md"))
         if not a["brouillon"] and a["date_obj"] <= aujourd_hui),
        key=lambda a: a["date_obj"],
        reverse=True,
    )
    env.globals.update(
        site_url=SITE_URL,
        whatsapp=WHATSAPP,
        cantons=CANTONS,
        groupes=GROUPES,
        produits=produits,
        par_slug=par_slug,
        articles=articles,
        glossaire=lire_glossaire(ROOT / "content" / "glossaire.txt"),
        annee=aujourd_hui.year,
    )

    sitemap: list[tuple[str, str]] = []

    for page in sorted((ROOT / "templates" / "pages").rglob("*.html")):
        url = url_de(page)
        contenu = env.get_template(str(page.relative_to(ROOT / "templates"))).render(url=url)
        ecrire(url, contenu)
        if 'name="robots" content="noindex' not in contenu:
            sitemap.append((url, aujourd_hui.isoformat()))

    tpl_produit = env.get_template("produit.html")
    for p in tous:
        if p["page_fixe"]:
            continue
        voisins = [q for q in produits[p["groupe"]] if q["slug"] != p["slug"]]
        voisins.sort(key=lambda q: (q["categorie"] != p["categorie"], q["ordre"]))
        ecrire(p["url"], tpl_produit.render(url=p["url"], produit=p, voisins=voisins[:3]))
        sitemap.append((p["url"], aujourd_hui.isoformat()))

    tpl_article = env.get_template("article.html")
    for a in articles:
        ecrire(a["url"], tpl_article.render(url=a["url"], article=a))
        sitemap.append((a["url"], a.get("maj", a["date"])))

    lignes = [f"<url><loc>{SITE_URL}{u}</loc><lastmod>{d}</lastmod></url>" for u, d in sitemap]
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(lignes) + "\n</urlset>\n",
        encoding="utf-8",
    )
    print(f"Site généré : {len(sitemap)} pages indexables, {len(tous)} produits, {len(articles)} articles.")


if __name__ == "__main__":
    main()
