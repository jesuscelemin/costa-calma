"""Boxes from plan coordinates. Plans are in metres, x to the east and z to the south (the sea);
in Blender X = x, Y = -z and Z is up, so north is +Y."""

import bpy
from mathutils import Vector

from .materials import MATS


EPS = 1e-4


def P(x, z, y=0.0):
    return Vector((x, -z, y))


def collection(name, parent=None):
    """A collection by name, created under `parent` (or the scene) the first time."""
    found = bpy.data.collections.get(name)
    if found:
        return found
    c = bpy.data.collections.new(name)
    (parent.children if parent else bpy.context.scene.collection.children).link(c)
    return c


def box(name, x0, x1, z0, z1, y0, y1, mat, coll, bevel=0.0):
    """An axis-aligned box from plan ranges (x, z) and heights (y)."""
    x0, x1 = min(x0, x1), max(x0, x1)
    z0, z1 = min(z0, z1), max(z0, z1)
    me = bpy.data.meshes.new(name)
    vs = [(x, -z, y) for y in (y0, y1) for z in (z0, z1) for x in (x0, x1)]
    fs = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    me.from_pydata(vs, [], fs)
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(MATS[mat] if isinstance(mat, str) else mat)
    coll.objects.link(ob)
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    return ob


def horizontal(seg):
    return abs(seg["z1"] - seg["z2"]) < EPS


def span(seg):
    if horizontal(seg):
        return sorted((seg["x1"], seg["x2"]))
    return sorted((seg["z1"], seg["z2"]))


def along(seg, a, b, t, y0, y1, mat, name, coll):
    """A box along a segment's line, from `a` to `b` along it, `t` thick."""
    if horizontal(seg):
        return box(name, a, b, seg["z1"] - t / 2, seg["z1"] + t / 2, y0, y1, mat, coll)
    return box(name, seg["x1"] - t / 2, seg["x1"] + t / 2, a, b, y0, y1, mat, coll)


def rect_of(r):
    return (r["x"], r["x"] + r["w"], r["z"], r["z"] + r["d"])


def union_boxes(rects):
    """Non-overlapping boxes (x0, x1, z0, z1) covering the union of rectangles (x, z, w, d), so
    pieces that touch never overlap and never show coplanar faces."""
    if not rects:
        return []
    xs = sorted({round(r["x"], 4) for r in rects} | {round(r["x"] + r["w"], 4) for r in rects})
    zs = sorted({round(r["z"], 4) for r in rects} | {round(r["z"] + r["d"], 4) for r in rects})
    out = []
    for j in range(len(zs) - 1):
        za, zb = zs[j], zs[j + 1]
        zm = (za + zb) / 2
        run = None
        for i in range(len(xs) - 1):
            xa, xb = xs[i], xs[i + 1]
            xm = (xa + xb) / 2
            inside = any(r["x"] < xm < r["x"] + r["w"] and r["z"] < zm < r["z"] + r["d"] for r in rects)
            if inside:
                run = [run[0], xb] if run else [xa, xb]
            elif run:
                out.append((run[0], run[1], za, zb))
                run = None
        if run:
            out.append((run[0], run[1], za, zb))
    return out


def difference_boxes(outer, holes):
    """Non-overlapping boxes (x0, x1, z0, z1) covering rectangle `outer` minus the `holes`."""
    xs = sorted({round(v, 4) for r in [outer, *holes] for v in (r["x"], r["x"] + r["w"])})
    zs = sorted({round(v, 4) for r in [outer, *holes] for v in (r["z"], r["z"] + r["d"])})
    ox0, ox1, oz0, oz1 = rect_of(outer)
    keep = []
    for j in range(len(zs) - 1):
        for i in range(len(xs) - 1):
            xm, zm = (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
            if not (ox0 < xm < ox1 and oz0 < zm < oz1):
                continue
            if any(h["x"] < xm < h["x"] + h["w"] and h["z"] < zm < h["z"] + h["d"] for h in holes):
                continue
            keep.append({"x": xs[i], "z": zs[j], "w": xs[i + 1] - xs[i], "d": zs[j + 1] - zs[j]})
    return union_boxes(keep)


def overlap_area(a, b):
    ax0, ax1, az0, az1 = rect_of(a)
    bx0, bx1, bz0, bz1 = rect_of(b)
    return max(0, min(ax1, bx1) - max(ax0, bx0)) * max(0, min(az1, bz1) - max(az0, bz0))
