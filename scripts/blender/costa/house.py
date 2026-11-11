"""A house built from its plan's geometry (scene.json, written by export-scene.mts): any house type,
with no measurement of its own. Storeys stack 3,2 m apart; each slab covers what stands below it
and what stands on it, so overhangs, terraces and double heights come out of the plan.

The house is built at the origin in its plan's coordinates, in a collection whose instance offset is
its plot's centre, so the site can instance it on its plot (x, z, rotation, mirrored)."""

import math

from . import models
from .geometry import (
    EPS,
    P,
    along,
    box,
    collection,
    difference_boxes,
    horizontal,
    overlap_area,
    rect_of,
    span,
    union_boxes,
)

STOREY = 3.2
SLAB = 0.3
WALL_H = STOREY - SLAB
THICK = {"exterior": 0.24, "party": 0.3, "interior": 0.1, "railing": 0.04}
HEAD = {"door": 2.1, "sliding": 2.7, "window": 2.5, "entrance": WALL_H}
RAILING_H = 1.1
PLANTER_H = 0.7

FINISH = {"deck": "teak", "lounge": "teak", "terrace": "paving", "solarium": "paving", "patio": "paving", "garage": "paving"}


def solid(room):
    return not room.get("open") and room["kind"] != "void"


def build_house(slug, house, overlay=True):
    coll = collection(f"house-{slug}")
    plot = house["plot"]
    cx, cz = plot["x"] + plot["w"] / 2, plot["z"] + plot["d"] / 2
    coll.instance_offset = P(cx, cz, 0)

    floors = house["floors"]
    plot_floor = next((f for f in floors if f["kind"] == "plot"), None)
    storeys = [f for f in floors if f["kind"] != "plot"]

    for level, floor in enumerate(storeys):
        _walls_and_openings(floor, level * STOREY, coll)
        _upper_rooms(floor, level, coll)
        _canopies(floor, level * STOREY, coll)

    slabs = _slabs(storeys, coll)
    if plot_floor:
        _plot(plot_floor, plot, coll)
        _canopies(plot_floor, 0.0, coll)
        _piers(plot_floor, storeys, slabs, coll)

    if overlay:
        _overlay(slug, plot, storeys[0] if storeys else None)
    return coll


# ---------------------------------------------------------------- walls and openings


def _walls_and_openings(floor, base, coll):
    fid = floor["id"]
    gap_ends = set()
    for o in floor["openings"]:
        for k in ("1", "2"):
            gap_ends.add((round(o["x" + k], 3), round(o["z" + k], 3)))

    rects = {}
    wall_ends = set()
    for i, w in enumerate(floor["walls"]):
        t = THICK[w["kind"]]
        a, b = span(w)
        flat = horizontal(w)
        lo = (round(a, 3), round(w["z1"], 3)) if flat else (round(w["x1"], 3), round(a, 3))
        hi = (round(b, 3), round(w["z1"], 3)) if flat else (round(w["x1"], 3), round(b, 3))
        if w["kind"] != "railing":
            wall_ends.update((lo, hi))
        # Run on half a thickness past each end to close the corners, but never into a gap.
        if lo not in gap_ends:
            a -= t / 2
        if hi not in gap_ends:
            b += t / 2
        if w["kind"] == "railing":
            along(w, a, b, 0.02, base, base + RAILING_H, "glass", f"{fid}-railing-{i}", coll)
            along(w, a, b, 0.05, base + RAILING_H, base + RAILING_H + 0.03, "frame", f"{fid}-rail-{i}", coll)
            continue
        mat = "render" if w["kind"] in ("exterior", "party") else "wall_in"
        if flat:
            rect = {"x": a, "z": w["z1"] - t / 2, "w": b - a, "d": t}
        else:
            rect = {"x": w["x1"] - t / 2, "z": a, "w": t, "d": b - a}
        rects.setdefault(mat, []).append(rect)
    for mat, rs in rects.items():
        for j, (x0, x1, z0, z1) in enumerate(union_boxes(rs)):
            box(f"{fid}-{mat}-{j}", x0, x1, z0, z1, base, base + WALL_H, mat, coll)

    for i, o in enumerate(floor["openings"]):
        kind = o["kind"]
        a, b = span(o)
        ends = {(round(o["x1"], 3), round(o["z1"], 3)), (round(o["x2"], 3), round(o["z2"], 3))}
        in_wall = bool(ends & wall_ends)
        outer = kind in ("window", "sliding", "entrance")
        t = THICK["exterior"] if outer else THICK["interior"]
        mat = "render" if outer else "wall_in"
        head = (WALL_H if b - a >= 3 else 2.5) if kind == "passage" else HEAD[kind]
        if in_wall and head < WALL_H:
            along(o, a, b, t, base + head, base + WALL_H, mat, f"{fid}-lintel-{i}", coll)
        if kind == "window":
            sill = o.get("sill") or 0
            if sill > 0:
                along(o, a, b, t, base, base + sill, mat, f"{fid}-sill-{i}", coll)
            _glazing(o, a, b, base + sill, base + head, f"{fid}-window-{i}", coll)
        elif kind == "sliding":
            _glazing(o, a, b, base, base + head, f"{fid}-sliding-{i}", coll, panes=max(2, round((b - a) / 1.4)))
        elif kind == "door":
            _leaf(o, base, f"{fid}-door-{i}", coll)
        elif kind == "entrance":
            _front_door(o, a, b, base, f"{fid}-entrance-{i}", coll)


def _glazing(o, a, b, y0, y1, name, coll, panes=None):
    """Slim black frames round floor-to-ceiling panes of glass."""
    f = 0.05
    along(o, a, b, 0.012, y0, y1, "glass", name + "-glass", coll)
    along(o, a, b, 0.07, y0, y0 + f, "frame", name + "-sill", coll)
    along(o, a, b, 0.07, y1 - f, y1, "frame", name + "-head", coll)
    n = panes or max(1, round((b - a) / 1.2))
    for k in range(n + 1):
        p = a + (b - a) * k / n
        along(o, max(a, p - f / 2), min(b, p + f / 2), 0.07, y0, y1, "frame", f"{name}-mullion-{k}", coll)


def _leaf(o, base, name, coll):
    """An interior door, open a quarter turn as the plan draws it: a walnut leaf."""
    s = o.get("swing")
    if not s:
        return
    h, leaf = s["hinge"], s["leaf"]
    seg = {"x1": h["x"], "z1": h["z"], "x2": leaf["x"], "z2": leaf["z"]}
    along(seg, *span(seg), 0.04, base, base + HEAD["door"] - 0.01, "walnut", name, coll)


def _front_door(o, a, b, base, name, coll):
    """The front door, shut: one walnut leaf, or two where it is wide (Villa Duna Blanca's)."""
    leaves = 2 if b - a >= 1.5 else 1
    for k in range(leaves):
        p = a + (b - a) * k / leaves
        q = a + (b - a) * (k + 1) / leaves
        along(o, p + 0.005, q - 0.005, 0.06, base, base + WALL_H - 0.02, "walnut", f"{name}-{k}", coll)


# ---------------------------------------------------------------- slabs, roofs and upper rooms


def _slabs(storeys, coll):
    """One slab per storey line, over what stands below it and on it, without overlaps; a double
    height's void is covered only by the slab above it. Returns each level's rectangles."""
    levels = {}
    if storeys:
        ground = [r for r in storeys[0]["rooms"] if solid(r)]
        for i, (x0, x1, z0, z1) in enumerate(union_boxes(ground)):
            box(f"floor-{i}", x0, x1, z0, z1, -0.05, 0.0, "floor", coll)
    for k in range(1, len(storeys) + 1):
        below = [r for r in storeys[k - 1]["rooms"] if solid(r) or r["kind"] == "void"]
        here = [r for r in storeys[k]["rooms"] if r["kind"] != "void"] if k < len(storeys) else []
        rects = union_boxes(below + here)
        y = k * STOREY
        for i, (x0, x1, z0, z1) in enumerate(rects):
            box(f"slab-{k}-{i}", x0, x1, z0, z1, y - SLAB, y - SLAB + 0.02, "ceiling", coll)
            box(f"slab-{k}-{i}-core", x0, x1, z0, z1, y - SLAB + 0.02, y, "render", coll)
        levels[k] = [{"x": x0, "z": z0, "w": x1 - x0, "d": z1 - z0} for (x0, x1, z0, z1) in rects]
    return levels


def _upper_rooms(floor, level, coll):
    """What stands on a slab in the open: decking and paving, planters, a jacuzzi."""
    if level == 0:
        return
    base = level * STOREY
    for r in floor["rooms"]:
        x0, x1, z0, z1 = rect_of(r)
        kind = r["kind"]
        name = f"{floor['id']}-{r['id']}"
        if kind == "planter":
            box(name, x0, x1, z0, z1, base, base + PLANTER_H, "render", coll)
            _shrubs_along(x0, x1, z0, z1, base + PLANTER_H - 0.05, coll)
        elif kind == "water":
            box(name + "-rim", x0, x1, z0, z1, base, base + 0.5, "travertine_block", coll)
            box(name + "-water", x0 + 0.15, x1 - 0.15, z0 + 0.15, z1 - 0.15, base + 0.5, base + 0.52, "water", coll)
        elif r.get("open") and kind in FINISH:
            box(name, x0, x1, z0, z1, base, base + 0.03, FINISH[kind], coll)


def _shrubs_along(x0, x1, z0, z1, y, coll):
    long = max(x1 - x0, z1 - z0)
    count = max(1, int(long / 1.1))
    for k in range(count):
        t = (k + 0.5) / count
        x = x0 + (x1 - x0) * (t if x1 - x0 > z1 - z0 else 0.5)
        z = z0 + (z1 - z0) * (t if z1 - z0 >= x1 - x0 else 0.5)
        models.place("shrub_02", x, z, y, coll, 0.7, k * 1.3)


def _canopies(floor, base, coll):
    """Eaves as the slab running on past the walls; pergolas as walnut slats on four posts."""
    for i, c in enumerate(floor.get("canopies") or []):
        x0, x1, z0, z1 = rect_of(c)
        name = f"{floor['id']}-{c['kind']}-{i}"
        if c["kind"] == "eave":
            box(name, x0, x1, z0, z1, base + STOREY - SLAB, base + STOREY, "render", coll)
            continue
        top = base + 2.75
        # Posts at the corners and no more than 5 m apart along the long sides.
        long_x = x1 - x0 >= z1 - z0
        length = (x1 - x0) if long_x else (z1 - z0)
        steps = max(1, math.ceil((length - 0.2) / 5))
        for k in range(steps + 1):
            t = k / steps
            for edge in (0, 1):
                if long_x:
                    x, z = x0 + (x1 - x0 - 0.2) * t, (z0, z1 - 0.2)[edge]
                else:
                    x, z = (x0, x1 - 0.2)[edge], z0 + (z1 - z0 - 0.2) * t
                box(f"{name}-post-{x:.2f}-{z:.2f}", x, x + 0.2, z, z + 0.2, base, top, "walnut", coll)
        box(f"{name}-beam-a", x0, x1, z0, z0 + 0.2, top, top + 0.22, "walnut", coll)
        box(f"{name}-beam-b", x0, x1, z1 - 0.2, z1, top, top + 0.22, "walnut", coll)
        # Slats across the shorter side, stepping along the longer one.
        if x1 - x0 >= z1 - z0:
            for k in range(int((x1 - x0) / 0.3)):
                x = x0 + 0.1 + k * 0.3
                box(f"{name}-slat-{k}", x, x + 0.07, z0, z1, top + 0.22, top + 0.4, "walnut", coll)
        else:
            for k in range(int((z1 - z0) / 0.3)):
                z = z0 + 0.1 + k * 0.3
                box(f"{name}-slat-{k}", x0, x1, z, z + 0.07, top + 0.22, top + 0.4, "walnut", coll)


# ---------------------------------------------------------------- the plot


def _plot(floor, plot, coll):
    # Lawn wherever the plot has nothing else: never over a pool or a paving.
    holes = [r for r in floor["rooms"] if r["kind"] != "garden"]
    for i, (x0, x1, z0, z1) in enumerate(difference_boxes(plot, holes)):
        box(f"plot-grass-{i}", x0, x1, z0, z1, -0.12, -0.04, "grass", coll)
    for r in floor["rooms"]:
        x0, x1, z0, z1 = rect_of(r)
        kind = r["kind"]
        name = f"plot-{r['id']}"
        if kind in ("pool", "water"):
            depth = 1.4 if kind == "pool" else 0.35
            rim = 0.15
            box(name + "-basin", x0, x1, z0, z1, -depth, -depth + 0.02, "pool_tile", coll)
            for i, (a, b, c, d) in enumerate(
                ((x0, x1, z0, z0 + rim), (x0, x1, z1 - rim, z1), (x0, x0 + rim, z0 + rim, z1 - rim), (x1 - rim, x1, z0 + rim, z1 - rim))
            ):
                box(f"{name}-rim-{i}", a, b, c, d, -depth, 0.02, "travertine_block", coll)
            box(name + "-water", x0 + rim, x1 - rim, z0 + rim, z1 - rim, -depth, -0.06, "water", coll)
        elif kind == "planter":
            box(name, x0, x1, z0, z1, 0, PLANTER_H, "render", coll)
            _shrubs_along(x0, x1, z0, z1, PLANTER_H - 0.05, coll)
        elif kind != "garden":
            box(name, x0, x1, z0, z1, -0.06, 0.0, FINISH.get(kind, "paving"), coll)
        tree = r.get("tree")
        if tree:
            models.place("island_tree_01", tree["x"], tree["z"], 0.0, coll, 1.0, 0.6)


def _piers(plot_floor, storeys, slabs, coll):
    """Square piers at the free corners of a porch or terrace of the plot that a slab covers."""
    ground = [r for r in storeys[0]["rooms"] if solid(r)] if storeys else []
    for r in plot_floor["rooms"]:
        if r["kind"] not in ("deck", "terrace", "patio", "lounge"):
            continue
        area = r["w"] * r["d"]
        cover = next(
            (k for k in sorted(slabs) if sum(overlap_area(r, s) for s in slabs[k]) > 0.5 * area),
            None,
        )
        if cover is None:
            continue
        top = cover * STOREY - SLAB
        x0, x1, z0, z1 = rect_of(r)
        for (x, z) in ((x0, z0), (x1 - 0.4, z0), (x0, z1 - 0.4), (x1 - 0.4, z1 - 0.4)):
            pier = {"x": x - 0.3, "z": z - 0.3, "w": 1.0, "d": 1.0}
            if any(overlap_area(pier, g) > EPS for g in ground):
                continue
            box(f"pier-{r['id']}-{x:.2f}-{z:.2f}", x, x + 0.4, z, z + 0.4, 0, top, "render", coll)


# ---------------------------------------------------------------- the check overlay


def _overlay(slug, plot, ground):
    """The plan's ground floor rooms and its plot, as thin red lines high over the house, for the
    top check render: if the house matches its plan, its walls run along them."""
    coll = collection(f"overlay-{slug}")
    t = 0.06
    y = 30.0
    rooms = (ground["rooms"] if ground else []) + [dict(plot, id="plot")]
    for r in rooms:
        x0, x1, z0, z1 = rect_of(r)
        for i, (a, b, c, d) in enumerate(((x0, x1, z0, z0), (x0, x1, z1, z1), (x0, x0, z0, z1), (x1, x1, z0, z1))):
            box(f"overlay-{slug}-{r['id']}-{i}", a - t, b + t, c - t, d + t, y, y + 0.01, "overlay_line", coll)
    return coll


def rotation_for(plot):
    """Blender's Z rotation for a site plot's clockwise-from-above degrees."""
    return -math.radians(plot["rotation"])
