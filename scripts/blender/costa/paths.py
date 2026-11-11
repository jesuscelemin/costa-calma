"""Where the pipeline reads and writes. Everything heavy lives in assets-src/ (git-ignored)."""

import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ASSETS = os.path.join(ROOT, "assets-src", "blender")
POLYHAVEN = os.path.join(ASSETS, "polyhaven")
SCENE_JSON = os.path.join(ASSETS, "scene.json")
RENDERS = os.path.join(ASSETS, "renders")
