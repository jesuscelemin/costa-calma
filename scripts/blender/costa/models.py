"""Poly Haven models (CC0), appended once into a hidden collection each and placed as collection
instances: one empty per plant, however many meshes the model has, so Cycles instances them."""

import os

import bpy

from .geometry import P, collection
from .paths import POLYHAVEN

_LOADED = {}


def load(name):
    """A model's collection, appended once; None if it was not downloaded."""
    if name in _LOADED:
        return _LOADED[name]
    path = os.path.join(POLYHAVEN, "models", name, f"{name}.blend")
    found = None
    if os.path.exists(path):
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.objects = list(src.objects)
        library = collection("library")
        library.hide_render = True
        library.hide_viewport = True
        found = collection(f"model-{name}", library)
        for o in dst.objects:
            if o is not None and o.type == "MESH":
                found.objects.link(o)
    _LOADED[name] = found
    return found


def place(name, x, z, y, coll, scale=1.0, rot=0.0):
    """An instance of a model standing at (x, z) on height y."""
    source = load(name)
    if source is None:
        return None
    e = bpy.data.objects.new(f"{name}@{x:.1f},{z:.1f}", None)
    e.instance_type = "COLLECTION"
    e.instance_collection = source
    e.location = P(x, z, y)
    e.scale = (scale,) * 3
    e.rotation_euler = (0, 0, rot)
    coll.objects.link(e)
    return e
