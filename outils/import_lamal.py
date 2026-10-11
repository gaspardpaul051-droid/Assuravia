"""Importe les données officielles de l'OFSP (primes LAMal) pour le comparateur.

Usage : python3 outils/import_lamal.py donnees/ofsp-2027

Le dossier doit contenir les fichiers du jeu opendata.swiss « Primes de l'assurance-maladie » :
  Praemien_CH.csv (ou Prämien_CH.csv), Tarife.csv, Einzugsgebiete.csv
et, si disponible, le fichier des régions de primes de l'OFSP (Prämienregionen*.xlsx).

Écrit dans static/data/lamal/ :
  index.json         année, caisses, communes (NPA → commune, canton, région)
  <CANTON>.json      offres (caisse, modèle, région) et primes mensuelles
"""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SORTIE = ROOT / "static" / "data" / "lamal"

CANTONS = ["AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE", "NW", "OW",
           "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH"]

# Noms usuels des caisses (liste des assureurs admis de l'OFSP, état au 1.1.2026)
CAISSES = {
    "8": "CSS", "32": "Aquilana", "134": "Einsiedler Krankenkasse", "194": "Sumiswalder Krankenkasse",
    "246": "Krankenkasse Steffisburg", "290": "Concordia", "312": "Atupri", "343": "Avenir",
    "360": "Krankenkasse Luzerner Hinterland", "376": "KPT", "455": "ÖKK", "509": "Vivao Sympany",
    "780": "Glarner Krankenversicherung", "820": "curaulta", "881": "EGK", "923": "SLKK",
    "941": "sodalis", "966": "vita surselva", "1040": "Krankenkasse Visperterminen",
    "1318": "Krankenkasse Wädenswil", "1322": "Krankenkasse Birchmeier", "1384": "SWICA",
    "1386": "Galenos", "1401": "rhenusana", "1479": "Mutuel", "1509": "Sanitas", "1535": "Philos",
    "1542": "Assura", "1555": "Visana", "1560": "Agrisano", "1562": "Helsana", "1568": "sana24",
}

FRANCHISES = {"E": [300, 500, 1000, 1500, 2000, 2500], "J": [300, 500, 1000, 1500, 2000, 2500],
              "K": [0, 100, 200, 300, 400, 500, 600]}


def trouver(dossier: Path, *noms: str) -> Path | None:
    for n in noms:
        for p in dossier.iterdir():
            if p.name.lower().replace("ä", "ae").startswith(n.lower()):
                return p
    return None


def lire_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def lire_regions(path: Path) -> list[list]:
    """Fichier OFSP des régions de primes : une ligne par NPA et commune."""
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    lignes = []
    for ws in wb.worksheets:
        entetes = None
        for row in ws.iter_rows(values_only=True):
            cells = ["" if c is None else str(c).strip() for c in row]
            bas = [c.lower() for c in cells]
            if entetes is None:
                if any("plz" in c or "npa" in c for c in bas) and any("region" in c for c in bas):
                    entetes = bas
                continue
            if not any(cells):
                continue
            def col(*cles):
                for i, h in enumerate(entetes):
                    if any(k in h for k in cles):
                        return cells[i] if i < len(cells) else ""
                return ""
            npa = col("plz", "npa")
            region = col("region")
            if not npa.isdigit():
                continue
            region = "".join(ch for ch in region if ch.isdigit())[-1:] or "0"
            lignes.append([npa, col("ort", "localit"), col("gemeinde", "commune"), col("bfs", "ofs"),
                           col("kanton", "canton"), region])
    return lignes


def main(dossier: Path) -> None:
    primes = lire_csv(trouver(dossier, "Praemien_CH", "Prämien_CH", "Pr_mien_CH"))
    tarifs = lire_csv(trouver(dossier, "Tarife"))
    einzug = lire_csv(trouver(dossier, "Einzugsgebiete"))
    annee = int(primes[0]["Geschäftsjahr"])

    noms_tarifs = {(t["Versicherer"], t["Tarif"]): t["Name_FR"].strip() for t in tarifs if t["Kategorie"] == "MOD"}
    restrictions = {}
    for e in einzug:
        if e["Eingeschränkt"] == "Y":
            restrictions[(e["Versicherer"], e["Kanton"], e["Region"][-1], e["Tarif"])] = [
                int(x) for x in e["Gemeinden-BFS"].split(",") if x.strip()]

    par_canton = defaultdict(dict)  # canton -> clé offre -> {sous-groupe: {A/S: [primes]}}
    for r in primes:
        k = r["Kanton"]
        if k not in CANTONS:
            continue
        cle = (r["Versicherer"], r["Tarif"], r["Tariftyp"], r["Region"][-1])
        groupe = r["Altersuntergruppe"]
        acc = "A" if r["Unfalleinschluss"] == "MIT_UNF" else "S"
        lettre = groupe[0]
        montant = int(r["Franchise"].rsplit("_", 1)[1])
        idx = FRANCHISES[lettre].index(montant)
        offre = par_canton[k].setdefault(cle, {})
        liste = offre.setdefault(groupe, {}).setdefault(acc, [None] * len(FRANCHISES[lettre]))
        liste[idx] = float(r["Prämie"])

    SORTIE.mkdir(parents=True, exist_ok=True)
    utilisees = set()
    for k, offres in par_canton.items():
        sortie = []
        for (caisse, tarif, typ, region), p in sorted(offres.items(), key=lambda x: (x[0][3], x[0][0], x[0][1])):
            utilisees.add(caisse)
            o = {"c": caisse, "t": tarif, "y": typ, "r": region,
                 "n": "Assurance de base" if typ == "BASE" else noms_tarifs.get((caisse, tarif), tarif), "p": p}
            if (caisse, k, region, tarif) in restrictions:
                o["b"] = restrictions[(caisse, k, region, tarif)]
            sortie.append(o)
        regions = sorted({o["r"] for o in sortie})
        (SORTIE / f"{k}.json").write_text(json.dumps({"annee": annee, "canton": k, "regions": regions, "offres": sortie},
                                                     ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    manquantes = utilisees - CAISSES.keys()
    if manquantes:
        raise SystemExit(f"Nom de caisse manquant pour : {sorted(manquantes)} (ajoutez-les dans CAISSES)")

    index = {"annee": annee, "caisses": {c: CAISSES[c] for c in sorted(utilisees, key=int)},
             "franchises": FRANCHISES, "communes": []}
    fichier_regions = trouver(dossier, "Praemienregionen", "Prämienregionen", "Anhang")
    if fichier_regions:
        index["communes"] = lire_regions(fichier_regions)
    (SORTIE / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Primes {annee} : {len(par_canton)} cantons, {len(utilisees)} caisses, "
          f"{len(index['communes'])} NPA/communes" + ("" if fichier_regions else " (fichier des régions absent)"))


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "donnees" / "ofsp-2027"))
