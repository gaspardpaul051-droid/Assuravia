"""Générateur du site Assuravia.

Usage : python3 build.py
Produit le site statique dans dist/ (publié par Netlify).

- Les pages sont dans templates/pages/ (Jinja2). Le chemin du fichier donne l'URL :
  templates/pages/entreprises/rc-professionnelle.html -> /entreprises/rc-professionnelle/
  templates/pages/index.html -> /
- Les articles du guide sont dans content/articles/*.md (voir CLAUDE.md pour le format).
- Les produits proposés sont définis dans PRODUITS ci-dessous.
"""

from __future__ import annotations

import datetime as dt
import re
import shutil
from pathlib import Path

import markdown
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
SITE_URL = "https://assuravia.ch"

MOIS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

CANTONS = [
    ("GE", "Genève"), ("VD", "Vaud"), ("VS", "Valais"), ("FR", "Fribourg"),
    ("NE", "Neuchâtel"), ("JU", "Jura"), ("BE", "Berne (Jura bernois, Bienne)"),
    ("autre", "Autre canton"),
]

# Produits. "page" = page dédiée existante ; sinon le lien mène au formulaire général.
PRODUITS = {
    "particuliers": [
        {"slug": "3e-pilier", "nom": "3e pilier", "desc": "Épargner pour la retraite et payer moins d'impôts.", "page": "/particuliers/3e-pilier/"},
        {"slug": "garantie-de-loyer", "nom": "Garantie de loyer", "desc": "Remplacer le dépôt bancaire de 3 mois de loyer.", "page": "/particuliers/garantie-de-loyer/"},
        {"slug": "complementaire-maladie", "nom": "Complémentaire maladie", "desc": "Dentaire, hospitalisation, médecines alternatives."},
        {"slug": "rc-menage", "nom": "RC privée et ménage", "desc": "Dommages causés à autrui, vol, incendie, dégâts d'eau."},
        {"slug": "vehicule", "nom": "Assurance véhicule", "desc": "RC, casco partielle ou complète pour voiture et moto."},
        {"slug": "protection-juridique", "nom": "Protection juridique", "desc": "Frais d'avocat et litiges : travail, logement, circulation."},
        {"slug": "voyage", "nom": "Assurance voyage", "desc": "Annulation, frais médicaux et rapatriement."},
        {"slug": "objets-de-valeur", "nom": "Objets de valeur", "desc": "Bijoux, montres, œuvres d'art, instruments."},
        {"slug": "libre-passage", "nom": "Libre passage", "desc": "Placer son 2e pilier entre deux emplois."},
        {"slug": "placements", "nom": "Placements et gestion de fortune", "desc": "Faire fructifier son épargne selon son profil."},
    ],
    "entreprises": [
        {"slug": "rc-pro", "nom": "RC professionnelle", "desc": "Dommages causés à vos clients ou à des tiers.", "page": "/entreprises/rc-professionnelle/"},
        {"slug": "lpp", "nom": "LPP (2e pilier)", "desc": "Caisse de pension pour vos employés."},
        {"slug": "laa", "nom": "LAA accidents", "desc": "Assurance accidents obligatoire des employés."},
        {"slug": "pgm", "nom": "Perte de gain maladie", "desc": "Salaire maintenu en cas de maladie d'un employé."},
        {"slug": "commerce-inventaire", "nom": "Commerce et inventaire", "desc": "Marchandises, mobilier et machines de l'entreprise."},
        {"slug": "transport", "nom": "Assurance transport", "desc": "Marchandises transportées en Suisse ou à l'étranger."},
        {"slug": "techniques", "nom": "Assurances techniques", "desc": "Bris de machines, électronique, chantiers."},
    ],
}


def produit_url(p: dict) -> str:
    return p.get("page") or f"/conseil/?produit={p['slug']}"


def date_fr(d: dt.date) -> str:
    return f"{d.day} {MOIS[d.month - 1]} {d.year}"


def lire_article(path: Path) -> dict:
    """Lit un article markdown avec un en-tête simple entre lignes '---'."""
    texte = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", texte, re.S)
    if not m:
        raise ValueError(f"En-tête manquant dans {path}")
    meta = {}
    for ligne in m.group(1).splitlines():
        if ":" in ligne:
            cle, val = ligne.split(":", 1)
            meta[cle.strip()] = val.strip().strip('"')
    for cle in ("titre", "description", "date", "categorie"):
        if cle not in meta:
            raise ValueError(f"Champ '{cle}' manquant dans {path}")
    date = dt.date.fromisoformat(meta["date"])
    html = markdown.markdown(m.group(2), extensions=["tables", "toc", "attr_list"])
    return {
        **meta,
        "slug": path.stem,
        "date_obj": date,
        "date_fr": date_fr(date),
        "html": html,
        "url": f"/guide/{path.stem}/",
        "brouillon": meta.get("brouillon", "non") == "oui",
    }


def url_de(page: Path) -> str:
    rel = page.relative_to(ROOT / "templates" / "pages").with_suffix("")
    parts = list(rel.parts)
    if parts[-1] == "index":
        parts = parts[:-1]
    return "/" + "/".join(parts) + ("/" if parts else "")


def ecrire(url: str, html: str) -> None:
    out = DIST / url.lstrip("/") / "index.html" if url.endswith("/") else DIST / url.lstrip("/")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")


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
    articles = sorted(
        (a for a in (lire_article(p) for p in (ROOT / "content" / "articles").glob("*.md"))
         if not a["brouillon"] and a["date_obj"] <= aujourd_hui),
        key=lambda a: a["date_obj"],
        reverse=True,
    )
    tous_produits = [(groupe, p) for groupe, liste in PRODUITS.items() for p in liste]
    env.globals.update(
        site_url=SITE_URL,
        cantons=CANTONS,
        produits=PRODUITS,
        tous_produits=tous_produits,
        produit_url=produit_url,
        articles=articles,
        annee=aujourd_hui.year,
    )

    sitemap: list[tuple[str, str]] = []

    for page in sorted((ROOT / "templates" / "pages").rglob("*.html")):
        url = url_de(page)
        tpl = env.get_template(str(page.relative_to(ROOT / "templates")))
        html = tpl.render(url=url)
        ecrire(url, html)
        if 'name="robots" content="noindex' not in html:
            sitemap.append((url, aujourd_hui.isoformat()))

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
    print(f"Site généré : {len(sitemap)} pages indexables, {len(articles)} articles.")


if __name__ == "__main__":
    main()
