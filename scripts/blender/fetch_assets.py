"""Downloads the CC0 Poly Haven assets the Blender scene uses into assets-src/blender/polyhaven/
(git-ignored, ADR 0007). Skips what is already there. Run with plain Python: npm run blender:fetch"""

import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets-src", "blender", "polyhaven")
UA = {"User-Agent": "costa-calma-pipeline"}

TEXTURES = {  # id: resolution
    "oak_veneer_01": "2k",
    "dark_wood": "2k",
    "painted_plaster_wall": "2k",
    "leafy_grass": "2k",
    "concrete_floor_02": "2k",
    "stacked_stone_wall": "2k",
    "coast_sand_01": "2k",
    "asphalt_02": "2k",
    "clay_roof_tiles": "2k",
}
MODELS = {
    "island_tree_01": "1k",
    "island_tree_02": "1k",
    "shrub_02": "1k",
    "potted_plant_04": "1k",
    "shrub_03": "1k",
    "shrub_04": "1k",
    "coast_rocks_01": "1k",
    "coast_rocks_02": "1k",
    "coast_land_rocks_02": "1k",
}
HDRIS = {"kloofendal_48d_partly_cloudy_puresky": "4k"}


def get(url, dest):
    if os.path.exists(dest):
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req) as r, open(dest + ".part", "wb") as f:
        f.write(r.read())
    os.replace(dest + ".part", dest)
    print("  ", os.path.relpath(dest, ROOT))


def files(asset):
    req = urllib.request.Request(f"https://api.polyhaven.com/files/{asset}", headers=UA)
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def main():
    missing = []
    for tid, res in TEXTURES.items():
        print("texture", tid)
        try:
            f = files(tid)
        except urllib.error.HTTPError:
            missing.append(tid)
            continue
        for key in ("Diffuse", "nor_gl", "Rough"):
            if key in f:
                get(f[key][res]["jpg"]["url"], os.path.join(ROOT, "textures", tid, f"{key}.jpg"))
    for mid, res in MODELS.items():
        print("model", mid)
        b = files(mid)["blend"][res]["blend"]
        base = os.path.join(ROOT, "models", mid)
        get(b["url"], os.path.join(base, f"{mid}.blend"))
        for rel, inc in b.get("include", {}).items():
            get(inc["url"], os.path.join(base, rel))
    for hid, res in HDRIS.items():
        print("hdri", hid)
        get(files(hid)["hdri"][res]["hdr"]["url"], os.path.join(ROOT, "hdri", f"{hid}.hdr"))
    if missing:
        print("not on Poly Haven:", ", ".join(missing))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
