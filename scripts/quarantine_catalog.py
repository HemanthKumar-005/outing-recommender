"""Split data/places_catalog.yaml into curated vs generated-placeholder venues.

Why: ~3,200 of the ~3,500 catalog rows were produced by scripts/import_places.py
(`generate_mock_places`), e.g. "Visakhapatnam Artisan Coffee Roasters 2" at a random
offset from the city centre. They are not real venues. This script:
  * keeps only the hand-curated rows (listed in data/enrichment_report.json) in the runtime catalog
  * tags them source=repo_curated, verification_status=unverified (curated != verified)
  * moves everything else to data/quarantine/synthetic_places.yaml (never loaded at runtime)
Idempotent: safe to re-run.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "places_catalog.yaml"
REPORT = ROOT / "data" / "enrichment_report.json"
QUAR = ROOT / "data" / "quarantine" / "synthetic_places.yaml"

# Corrections made by hand during the pre-launch audit. Hours stay flagged as estimated
# because they were not checked against a live source.
CORRECTIONS = {
    ("Taj Mahal", "Agra"): {
        # Closed on Fridays (the previous data said closed Monday, open Friday).
        "opening_hours": {**{d: [["06:00", "18:30"]] for d in ("mon", "tue", "wed", "thu", "sat", "sun")}, "fri": []},
        "opening_hours_source": "manual_correction",
        "opening_hours_is_estimated": True,
    },
}


def main() -> None:
    data = yaml.safe_load(CATALOG.read_text(encoding="utf-8")) or {}
    places = data.get("places") or []
    rep = json.loads(REPORT.read_text(encoding="utf-8"))
    curated_keys = set()
    for s in rep.get("places_lacking_real_hours", []):
        m = re.match(r"(.*) \((.*)\)$", s)
        if m:
            curated_keys.add((m.group(1), m.group(2)))
    if QUAR.exists():
        prev = (yaml.safe_load(QUAR.read_text(encoding="utf-8")) or {}).get("places", [])
    else:
        prev = []

    keep, quarantined = [], list(prev)
    for p in places:
        key = (p["name"], p["city"])
        if key in curated_keys:
            p["source"] = "repo_curated"
            p["verification_status"] = "unverified"
            if key in CORRECTIONS:
                p.update(CORRECTIONS[key])
            keep.append(p)
        else:
            p["source"] = "generated_placeholder"
            p["verification_status"] = "rejected"
            quarantined.append(p)

    data["places"] = keep
    CATALOG.write_text(yaml.dump(data, sort_keys=False, allow_unicode=True), encoding="utf-8")
    QUAR.write_text(yaml.dump({"note": "NOT REAL VENUES. Generated placeholders; never load at runtime.", "places": quarantined},
                              sort_keys=False, allow_unicode=True), encoding="utf-8")
    print(f"kept {len(keep)} curated venues; quarantined {len(quarantined)} generated placeholders")


if __name__ == "__main__":
    main()
