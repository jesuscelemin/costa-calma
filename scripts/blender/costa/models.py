"""Poly Haven models (CC0), appended once into a hidden library collection and placed as copies."""

import os

import bpy

from .geometry import P, collection
from .paths import POLYHAVEN

_LOADED = {}


def load(name):
    """The meshes of a model, appended once; empty if it was not downloaded."""
    if name in _LOADED:
        return _LOADED[name]
    path = os.path.join(POLYHAVEN, "models", name, f"{name}.blend")
    objs = []
    if os.path.exists(path):
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.objects = list(src.objects)
        library = collection("library")
        library.hide_render = True
        library.hide_viewport = True
        for o in dst.objects:
            if o is not None and o.type == "MESH":
                library.objects.link(o)
                objs.append(o)
    _LOADED[name] = objs
    return objs


def place(name, x, z, y, coll, scale=1.0, rot=0.0):
    """A copy of a model standing at (x, z) on height y; it shares its meshes with the library."""
    placed = []
    for src in load(name):
        ob = src.copy()
        ob.location = P(x, z, y)
        ob.scale = (scale,) * 3
        ob.rotation_euler = (0, 0, rot)
        coll.objects.link(ob)
        placed.append(ob)
    return placed
