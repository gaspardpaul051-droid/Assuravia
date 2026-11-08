"""Images de partage (og:image, 1200 × 630) : une par article du blog, plus une image générale.

À lancer après `python3 build.py` (lit les pages de dist/) :
    python3 outils/images_partage.py
Écrit static/og/<slug>.png (articles sans image seulement, sauf --tout) et static/og/assuravia.png.
Relancer ensuite `python3 build.py` pour que les pages pointent vers les nouvelles images.
"""
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SORTIE = ROOT / "static" / "og"

GABARIT = """<!doctype html><html><head><meta charset="utf-8"><style>
body{{margin:0;width:1200px;height:630px;font-family:"Plus Jakarta Sans","Segoe UI",Arial,sans-serif;background:#0B2545;color:#fff;display:grid;grid-template-columns:600px 600px;overflow:hidden}}
.texte{{padding:64px 48px 56px 64px;display:flex;flex-direction:column;gap:22px}}
.marque{{font-weight:800;font-size:30px;letter-spacing:.01em}} .marque span{{color:#E2BE52}}
.cat{{align-self:flex-start;background:#E2BE52;color:#0B2545;font-weight:800;font-size:22px;padding:6px 16px;border-radius:999px}}
h1{{margin:0;font-size:{taille}px;line-height:1.15;font-weight:800}}
.pied{{margin-top:auto;font-size:22px;color:#BFD3EA}}
.image{{position:relative}} .image svg{{position:absolute;inset:0;width:100%;height:100%}}
</style></head><body><div class="texte"><div class="marque">Assura<span>via</span></div>{cat}<h1>{titre}</h1><div class="pied">{pied}</div></div><div class="image">{svg}</div></body></html>"""


def main(tout: bool) -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        nav = p.chromium.launch()
        page = nav.new_page(viewport={"width": 1200, "height": 630})
        travaux = []
        for f in sorted((DIST / "blog").glob("*/index.html")):
            slug = f.parent.name
            cible = SORTIE / f"{slug}.png"
            if cible.exists() and not tout:
                continue
            html = f.read_text(encoding="utf-8")
            svg = re.search(r'<div class="article__image">(<svg.*?</svg>)', html, re.S)
            titre = re.search(r"<h1>(.*?)</h1>", html, re.S)
            cat = re.search(r'<p class="badge">(.*?)</p>', html)
            if not (svg and titre):
                continue
            travaux.append((cible, svg.group(1), titre.group(1).strip(), cat.group(1) if cat else "", "assuravia.ch · Suisse romande"))
        if tout or not (SORTIE / "assuravia.png").exists():
            from jinja2 import Environment, FileSystemLoader
            env = Environment(loader=FileSystemLoader(str(ROOT / "templates")))
            svg = env.get_template("partials/couverture.html").module.couverture("Entreprises", 12, "bouclier")
            travaux.append((SORTIE / "assuravia.png", str(svg), "Assurance et prévoyance en Suisse romande", "", "Simulations en 2 minutes · conseil gratuit"))
        for cible, svg, titre, cat, pied in travaux:
            taille = 54 if len(titre) < 50 else 46 if len(titre) < 70 else 40
            svg = svg.replace('viewBox="0 0 640 360"', 'viewBox="140 0 360 360"')
            page.set_content(GABARIT.format(svg=svg, titre=titre, cat=f'<div class="cat">{cat}</div>' if cat else "", pied=pied, taille=taille))
            page.screenshot(path=str(cible))
            print("écrit", cible.relative_to(ROOT))
        nav.close()


if __name__ == "__main__":
    main("--tout" in sys.argv)
