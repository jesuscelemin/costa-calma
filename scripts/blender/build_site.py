"""Builds the whole development (scene.json): the hillside, its terraces and stone walls, the zigzag
road, the beach and the sea, the planting, and the 16 houses on their plots. Saves
assets-src/blender/site.blend and renders the aerial from the camera of Jesús's view 08:

- aerial-clay.png: one matte material and no planting, to judge the volumes and the framing;
- aerial-draft.png: the materials and the planting, in a quick daylight.

Run: npm run blender:site                 (both renders)
     npm run blender:site -- --preview    (small and fast, to frame the camera)
"""

import json
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from costa import materials  # noqa: E402
from costa.geometry import collection  # noqa: E402
from costa.house import build_house  # noqa: E402
from costa.paths import ASSETS, RENDERS, SCENE_JSON  # noqa: E402
from costa.render import camera, cycles, daylight, render_to  # noqa: E402
from costa.site import build_site  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
PREVIEW = "--preview" in argv

# The aerial's camera: over the sea off the east end, looking west along the coast with the sea on
# the left and the hill on the right, as in view 08. Site metres: x east, z south, y up.
EYE = (150.0, 130.0, 64.0)
LOOK = (-22.0, -38.0, 6.0)
LENS = 30.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"
materials.build_site()

scene_data = json.load(open(SCENE_JSON))
houses = {slug: build_house(slug, house, overlay=False) for slug, house in scene_data["houses"].items()}
# The houses' own collections are their sources: out of the render, instanced on the plots.
library = collection("house-library")
for coll in houses.values():
    bpy.context.scene.collection.children.unlink(coll)
    library.children.link(coll)
library.hide_render = True
library.hide_viewport = True

build_site(scene_data, houses, planting=not PREVIEW)

out = os.path.join(ASSETS, "site.blend")
bpy.ops.wm.save_as_mainfile(filepath=out)
print("saved", out)

from costa.geometry import P  # noqa: E402

cam = camera("aerial", P(EYE[0], EYE[1], EYE[2]), P(LOOK[0], LOOK[1], LOOK[2]), lens=LENS)
daylight(sun_elevation=32, sun_azimuth=245)

if PREVIEW:
    cycles(samples=12, width=960, height=540)
else:
    cycles(samples=96, width=1920, height=1080)

planting = bpy.data.collections.get("site-planting")

materials.clay_mode(True)
bpy.context.scene.view_settings.exposure = -1.3
if planting:
    planting.hide_render = True
render_to(cam, os.path.join(RENDERS, "aerial-clay-preview.png" if PREVIEW else "aerial-clay.png"))

if not PREVIEW and "--clay-only" not in argv:
    materials.clay_mode(False)
    bpy.context.scene.view_settings.exposure = 0.0
    if planting:
        planting.hide_render = False
    render_to(cam, os.path.join(RENDERS, "aerial-draft.png"))
