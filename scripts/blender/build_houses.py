"""Builds Costa Calma's three house types from their plans (scene.json) into
assets-src/blender/houses.blend, one collection each, ready for the site to instance.

With --check, renders each house from outside and from straight above with its plan's ground floor
drawn over it in red, into assets-src/blender/renders/: if the house matches its plan, its walls run
along the red lines.

Run: npm run blender:houses            (build)
     npm run blender:houses -- --check (build and render the checks)
"""

import json
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from costa import materials  # noqa: E402
from costa.geometry import P, box, collection  # noqa: E402
from costa.house import STOREY, build_house  # noqa: E402
from costa.paths import ASSETS, RENDERS, SCENE_JSON  # noqa: E402
from costa.render import camera, cycles, daylight, render_to  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
CHECK = "--check" in argv
ONLY = argv[argv.index("--only") + 1] if "--only" in argv else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"
materials.build_all()

scene_data = json.load(open(SCENE_JSON))
houses = {slug: h for slug, h in scene_data["houses"].items() if ONLY in (None, slug)}

built = {}
for slug, house in houses.items():
    built[slug] = build_house(slug, house)
    print("built", slug, len(built[slug].objects), "objects")

for slug in built:
    collection(f"overlay-{slug}").hide_render = True

out = os.path.join(ASSETS, "houses.blend")
bpy.ops.wm.save_as_mainfile(filepath=out)
print("saved", out)

if not CHECK:
    sys.exit(0)

cycles(samples=64)
daylight()
ground = collection("ground")
box("ground", -200, 200, -200, 200, -0.2, -0.13, "grass", ground)


CUT = STOREY - 0.31  # just under the first floor's slab


def show_only(slug, top):
    """One house; from the top, cut over its ground floor like a plan, with the overlay."""
    for other in built:
        bpy.data.collections[f"house-{other}"].hide_render = other != slug
        bpy.data.collections[f"overlay-{other}"].hide_render = not (top and other == slug)
    for ob in bpy.data.collections[f"house-{slug}"].objects:
        lowest = min((ob.matrix_world @ Vector(c)).z for c in ob.bound_box)
        ob.hide_render = top and lowest >= CUT


for slug, house in houses.items():
    plot = house["plot"]
    cx, cz = plot["x"] + plot["w"] / 2, plot["z"] + plot["d"] / 2
    storeys = sum(1 for f in house["floors"] if f["kind"] != "plot")
    height = storeys * STOREY
    size = max(plot["w"], plot["d"])

    show_only(slug, top=False)
    # From the south-east, the sea side, a little above the roof.
    eye = P(cx + size * 0.95, cz + size * 1.15, height + size * 0.55)
    look = P(cx, cz, height * 0.35)
    render_to(camera(f"cam-{slug}", eye, look, lens=32), os.path.join(RENDERS, f"{slug}-check.png"))

    show_only(slug, top=True)
    top = camera(f"top-{slug}", P(cx, cz, 60), P(cx, cz, 0), ortho_scale=size * 1.08)
    top.rotation_euler = (0, 0, 0)
    bpy.context.scene.render.resolution_x = 1400
    bpy.context.scene.render.resolution_y = int(1400 * plot["d"] / plot["w"]) if plot["w"] >= plot["d"] else 1400
    render_to(top, os.path.join(RENDERS, f"{slug}-top.png"))
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 1000

print("checks in", RENDERS)
