"""Met à jour static/data/hypotheques.json avec les taux hypothécaires publiés par la BNS.

Source : Banque nationale suisse, portail de données (cube « zikrepro », taux d'intérêt
appliqués aux nouveaux contrats de crédit, par produit). Données mensuelles : moyenne,
premier et troisième quartile des taux des nouvelles hypothèques.

Utilisation :
    python3 outils/maj_taux_hypothecaires.py              # télécharge les données de la BNS
    python3 outils/maj_taux_hypothecaires.py --csv f.csv  # à partir d'un CSV déjà téléchargé

Lancé chaque semaine par .github/workflows/taux-hypothecaires.yml. Si la BNS ne répond pas
ou si le fichier est incomplet, le JSON existant n'est pas modifié.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import sys
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "static" / "data" / "hypotheques.json"

# Identifiant BNS -> (clé, libellé, durée en années ou None)
PRODUITS = [
    ("SARJOBD", "saron", "Hypothèque SARON", None),
    ("MV", "variable", "Hypothèque variable", None),
    ("20", "fixe2", "Taux fixe 2 ans", 2),
    ("30", "fixe3", "Taux fixe 3 ans", 3),
    ("50", "fixe5", "Taux fixe 5 ans", 5),
    ("70", "fixe7", "Taux fixe 7 ans", 7),
    ("10", "fixe10", "Taux fixe 10 ans", 10),
    ("HYP_15", "fixe15", "Taux fixe 15 ans", 15),
]
MESURES = {"M": "moyenne", "025Q": "q1", "075Q": "q3"}
MOIS_HISTORIQUE = 24


def url_bns(depuis: str) -> str:
    produits = ",".join(p[0] for p in PRODUITS)
    return ("https://data.snb.ch/api/cube/zikrepro/data/csv/fr"
            f"?dimSel=D0(M,025Q,075Q),D1({produits})&fromDate={depuis}")


def lire_csv(texte: str) -> tuple[str, dict]:
    """Retourne la date de publication et {mois: {produit: {mesure: valeur}}}."""
    publication = ""
    lignes = texte.splitlines()
    for i, ligne in enumerate(lignes):
        if ligne.startswith('"PublishingDate"'):
            publication = ligne.split(";")[1].strip('"')
        if ligne.startswith('"Date"'):
            corps = "\n".join(lignes[i:])
            break
    else:
        raise ValueError("En-tête « Date » introuvable dans le CSV de la BNS")
    donnees: dict = {}
    for r in csv.DictReader(io.StringIO(corps), delimiter=";"):
        if not r.get("Value"):
            continue
        donnees.setdefault(r["Date"], {}).setdefault(r["D1"], {})[MESURES.get(r["D0"], r["D0"])] = round(float(r["Value"]), 3)
    return publication, donnees


def construire(publication: str, donnees: dict) -> dict:
    mois = sorted(donnees)
    # Dernier mois où tous les produits ont une moyenne
    complets = [m for m in mois if all("moyenne" in donnees[m].get(p[0], {}) for p in PRODUITS)]
    if not complets:
        raise ValueError("Aucun mois complet dans les données de la BNS")
    dernier = complets[-1]
    taux = []
    for bns, cle, libelle, duree in PRODUITS:
        v = donnees[dernier][bns]
        taux.append({"cle": cle, "libelle": libelle, "duree": duree,
                     "moyenne": v["moyenne"], "q1": v.get("q1"), "q3": v.get("q3")})
    historique = {"mois": complets[-MOIS_HISTORIQUE:]}
    for bns, cle, _, _ in PRODUITS:
        historique[cle] = [donnees[m][bns]["moyenne"] for m in historique["mois"]]
    return {
        "source": "Banque nationale suisse (BNS), data.snb.ch, cube zikrepro",
        "publication": publication,
        "mois": dernier,
        "mise_a_jour": dt.date.today().isoformat(),
        "taux": taux,
        "historique": historique,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="fichier CSV de la BNS déjà téléchargé")
    args = ap.parse_args()
    if args.csv:
        texte = Path(args.csv).read_text(encoding="utf-8")
    else:
        aujourd_hui = dt.date.today()
        debut = dt.date(aujourd_hui.year - 3, aujourd_hui.month, 1).strftime("%Y-%m")
        req = urllib.request.Request(url_bns(debut), headers={"User-Agent": "assuravia.ch (mise a jour des taux)"})
        with urllib.request.urlopen(req, timeout=60) as rep:
            texte = rep.read().decode("utf-8")
    publication, donnees = lire_csv(texte)
    nouveau = construire(publication, donnees)
    if SORTIE.exists():
        ancien = json.loads(SORTIE.read_text(encoding="utf-8"))
        if {k: v for k, v in ancien.items() if k != "mise_a_jour"} == {k: v for k, v in nouveau.items() if k != "mise_a_jour"}:
            print(f"Taux inchangés (mois {nouveau['mois']}).")
            return 0
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(nouveau, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Taux mis à jour : mois {nouveau['mois']}, publication BNS {publication}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
