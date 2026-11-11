"""The development on its hillside, from the site plan (scene.json): terraces as prisms whose sides
are the dry stone walls, the land round them, the zigzag road with its verges and lamps, the sea,
the planting of each bancal, and the houses instanced on their plots.

Site coordinates are the plans': x to the east, z to the south (the sea); levels are y, over the sea."""

import math
import random

import bmesh
import bpy
import numpy as np

from . import models
from .geometry import P, box, collection
from .materials import MATS

TOP = {
    "beach": "sand",
    "promenade": "teak",
    "row": "grass",
    "road": "kerb",
    "bancal": "soil",
}
ROAD_LIFT = 0.04


# ---------------------------------------------------------------- polygons


def inside(xs, zs, outline):
    """Which of the points (numpy arrays) lie inside a closed outline (a list of {x, z})."""
    px = np.array([p["x"] for p in outline])
    pz = np.array([p["z"] for p in outline])
    result = np.zeros(xs.shape, dtype=bool)
    j = len(px) - 1
    for i in range(len(px)):
        crosses = (pz[i] > zs) != (pz[j] > zs)
        with np.errstate(divide="ignore", invalid="ignore"):
            x_at = (px[j] - px[i]) * (zs - pz[i]) / (pz[j] - pz[i]) + px[i]
        result ^= crosses & (xs < x_at)
        j = i
    return result


def distance_to_road(xs, zs, road):
    """Distance from each point to the road's centre line, and the road's level there."""
    best = np.full(xs.shape, np.inf)
    level = np.zeros(xs.shape)
    for a, b in zip(road[:-1], road[1:]):
        abx, abz = b["x"] - a["x"], b["z"] - a["z"]
        length2 = abx * abx + abz * abz or 1e-9
        t = np.clip(((xs - a["x"]) * abx + (zs - a["z"]) * abz) / length2, 0, 1)
        d = np.hypot(xs - (a["x"] + t * abx), zs - (a["z"] + t * abz))
        closer = d < best
        best = np.where(closer, d, best)
        level = np.where(closer, a["y"] + t * (b["y"] - a["y"]), level)
    return best, level


def distance_to_roads(xs, zs, roads):
    """Distance from each point to the nearest road's centre line, and that road's level there."""
    best = np.full(xs.shape, np.inf)
    level = np.zeros(xs.shape)
    for road in roads:
        d, y = distance_to_road(xs, zs, road["centre"])
        closer = d < best
        best = np.where(closer, d, best)
        level = np.where(closer, y, level)
    return best, level


def to_site(plot, house_plot, x, z):
    """A point of a house's plan placed on its site plot (as toSite in site-plan.ts)."""
    dx = x - (house_plot["x"] + house_plot["w"] / 2)
    dz = z - (house_plot["z"] + house_plot["d"] / 2)
    if plot.get("mirrored"):
        dx = -dx
    a = math.radians(plot["rotation"])
    return plot["x"] + dx * math.cos(a) - dz * math.sin(a), plot["z"] + dx * math.sin(a) + dz * math.cos(a)


def plot_corners(plot, house_plot, margin=0.0):
    x0, z0 = house_plot["x"] - margin, house_plot["z"] - margin
    x1, z1 = house_plot["x"] + house_plot["w"] + margin, house_plot["z"] + house_plot["d"] + margin
    return [dict(zip("xz", to_site(plot, house_plot, x, z))) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]


# ---------------------------------------------------------------- meshes


def prism(name, outline, top_y, bottom, top_mat, side_mat, coll):
    """A terrace: its outline flat at its level (or at a level per point), its sides down to
    `bottom`. Where it stands over a lower one, its sides are the stone wall that holds it."""
    bm = bmesh.new()
    n = len(outline)
    ys = top_y if isinstance(top_y, list) else [top_y] * n
    top = [bm.verts.new((p["x"], -p["z"], ys[i])) for i, p in enumerate(outline)]
    low = [bm.verts.new((p["x"], -p["z"], bottom)) for p in outline]
    faces_top = [bm.faces.new(top)]
    faces_low = [bm.faces.new(list(reversed(low)))]
    sides = [bm.faces.new((top[i], low[i], low[(i + 1) % n], top[(i + 1) % n])) for i in range(n)]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    tri = bmesh.ops.triangulate(bm, faces=faces_top + faces_low, quad_method="BEAUTY", ngon_method="BEAUTY")
    for f in tri["faces"]:
        f.material_index = 0
    for f in sides:
        f.material_index = 1
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MATS[top_mat])
    me.materials.append(MATS[side_mat])
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def ribbon(name, line, half, lift, mat, coll, skirt=0.0):
    """A strip `half` either side of a line of points with levels, `lift` over them; with a skirt,
    its edges run down so it never floats over the ground."""
    bm = bmesh.new()
    left, right = [], []
    for i, p in enumerate(line):
        a = line[max(0, i - 1)]
        b = line[min(len(line) - 1, i + 1)]
        tx, tz = b["x"] - a["x"], b["z"] - a["z"]
        length = math.hypot(tx, tz) or 1
        nx, nz = -tz / length, tx / length
        y = p["y"] + lift
        left.append(bm.verts.new((p["x"] + nx * half, -(p["z"] + nz * half), y)))
        right.append(bm.verts.new((p["x"] - nx * half, -(p["z"] - nz * half), y)))
    for i in range(len(line) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    if skirt:
        for edge in (left, right):
            low = [bm.verts.new((v.co.x, v.co.y, v.co.z - skirt)) for v in edge]
            for i in range(len(edge) - 1):
                bm.faces.new((edge[i], edge[i + 1], low[i + 1], low[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MATS[mat])
    for poly in me.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


# ---------------------------------------------------------------- the land round the site


def level_by_radius(terraces, centre):
    """The hillside's level against the distance from the site's centre, from the terraces."""
    pairs = []
    for t in terraces:
        r = np.mean([math.hypot(p["x"] - centre["x"], p["z"] - centre["z"]) for p in t["outline"]])
        pairs.append((r, t["level"]))
    pairs.sort()
    radii = [r for r, _ in pairs]
    levels = [lv for _, lv in pairs]
    # Up the hill past the last bancal, and down into the sea past the beach.
    # The hill climbs steeply behind the top row, as in Jesús's reference.
    radii = [radii[0] - 260, radii[0] - 90, radii[0] - 30] + radii + [radii[-1] + 30, radii[-1] + 90, radii[-1] + 600]
    levels = [levels[0] + 95, levels[0] + 45, levels[0] + 12] + levels + [-3, -10, -30]
    return np.array(radii), np.array(levels)


def land(site, centre, coll, step=3.0):
    terraces = site["terraces"]
    xs_axis = np.arange(-520, 520 + step, step)
    zs_axis = np.arange(-460, 640 + step, step)
    gx, gz = np.meshgrid(xs_axis, zs_axis)
    r = np.hypot(gx - centre["x"], gz - centre["z"])
    radii, levels = level_by_radius(terraces, centre)
    h = np.interp(r, radii, levels)
    # The hill is no cone: it swells and folds as it runs along the coast.
    swell = 3.2 * np.sin(gx / 37.0 + 1.3) + 2.1 * np.sin(gx / 13.0 + gz / 29.0) + 1.4 * np.sin(gz / 17.0)
    h = h + np.where(h > 2.5, swell, 0)
    # Under the terraces, out of sight; under the road, below it.
    for t in terraces:
        mask = inside(gx, gz, t["outline"])
        h = np.where(mask, np.minimum(h, t["level"] - 1.2), h)
    d, road_y = distance_to_roads(gx, gz, site["roads"])
    near = d < max(r["width"] for r in site["roads"]) / 2 + 3.5
    h = np.where(near, np.minimum(h, road_y - 0.25), h)

    rows, cols = gx.shape
    verts = np.column_stack([gx.ravel(), -gz.ravel(), h.ravel()])
    idx = np.arange(rows * cols).reshape(rows, cols)
    quads = np.column_stack(
        [idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, 1:].ravel(), idx[1:, :-1].ravel()]
    )
    me = bpy.data.meshes.new("land")
    me.from_pydata(verts.tolist(), [], quads.tolist())
    me.update()
    for poly in me.polygons:
        poly.use_smooth = True
    me.materials.append(MATS["hillside"])
    ob = bpy.data.objects.new("land", me)
    coll.objects.link(ob)
    return xs_axis, zs_axis, h


# ---------------------------------------------------------------- the site


def build_site(scene_data, house_collections, planting=True):
    site, centre, houses = scene_data["site"], scene_data["centre"], scene_data["houses"]
    root = collection("site")
    ground = collection("site-ground", root)
    road_coll = collection("site-road", root)
    plots_coll = collection("site-houses", root)
    green = collection("site-planting", root)

    # Each plot's level: that of the terrace its centre stands on.
    plot_levels = {}
    for plot in site["plots"]:
        for t in site["terraces"]:
            if inside(np.array([plot["x"]]), np.array([plot["z"]]), t["outline"])[0]:
                plot_levels[plot["unit"]] = t["level"]
                break

    for i, t in enumerate(site["terraces"]):
        top = t["level"]
        if t["kind"] == "beach":
            # The beach runs down into the water: its inner edge first, then the shore.
            half = len(t["outline"]) // 2
            top = [1.2] * half + [-0.5] * (len(t["outline"]) - half)
        ob = prism(f"terrace-{i}-{t['kind']}", t["outline"], top, -12.0, TOP[t["kind"]], "stone", ground)
        # The plots are cut out of their terrace, so the houses' lawns and pools take their place.
        plots_here = [p for p in site["plots"] if plot_levels.get(p["unit"]) == t["level"] and t["kind"] == "row"]
        if plots_here:
            _cut_plots(ob, plots_here, houses, t["level"], ground)

    land_grid = land(site, centre, ground)
    sea = box("sea", -3000, 3000, -3000, 3000, -40, 0.0, "sea", ground)
    sea.name = "sea"

    for road in site["roads"]:
        line, width = road["centre"], road["width"]
        ribbon(f"road-{road['id']}-verge", line, width / 2 + 2.0, ROAD_LIFT - 0.02, "kerb", road_coll, skirt=2.5)
        ribbon(f"road-{road['id']}", line, width / 2, ROAD_LIFT + 0.01 * site["roads"].index(road), "asphalt", road_coll)
        _lamps(line, width, road_coll, name=road["id"])

    for plot in site["plots"]:
        house = house_collections[plot["houseType"]]
        e = bpy.data.objects.new(f"unit-{plot['unit']}", None)
        e.instance_type = "COLLECTION"
        e.instance_collection = house
        e.location = P(plot["x"], plot["z"], plot_levels[plot["unit"]])
        e.rotation_euler = (0, 0, -math.radians(plot["rotation"]))
        if plot.get("mirrored"):
            e.scale = (-1, 1, 1)
        e["unit"] = plot["unit"]
        e["houseType"] = plot["houseType"]
        plots_coll.objects.link(e)

    _neighbours(site, land_grid, collection("site-neighbours", root))
    if planting:
        _plant(site, centre, houses, plot_levels, green)
        _wild(site, land_grid, green)
    return root


def _cut_plots(terrace, plots, houses, level, coll):
    """One boolean per plot, each cutter a hair inside its plot: the two halves of a pair touch, and
    one cutter with touching boxes would not be a clean solid."""
    for plot in plots:
        corners = plot_corners(plot, houses[plot["houseType"]]["plot"], margin=-0.01)
        bm = bmesh.new()
        low = [bm.verts.new((c["x"], -c["z"], level - 0.15)) for c in corners]
        high = [bm.verts.new((c["x"], -c["z"], level + 3)) for c in corners]
        bm.faces.new(low)
        bm.faces.new(list(reversed(high)))
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((low[i], low[j], high[j], high[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        name = f"{terrace.name}-cut-{plot['unit']}"
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        cutter = bpy.data.objects.new(name, me)
        coll.objects.link(cutter)
        cutter.hide_render = True
        cutter.hide_viewport = True
        mod = terrace.modifiers.new(f"plot-{plot['unit']}", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cutter


def _lamps(road, width, coll, every=28.0, name="road"):
    """Street lamps on the uphill verge, one every `every` metres along the road."""
    walked = 0.0
    next_at = every / 2
    for a, b in zip(road[:-1], road[1:]):
        seg = math.hypot(b["x"] - a["x"], b["z"] - a["z"])
        while next_at <= walked + seg and seg > 0:
            t = (next_at - walked) / seg
            x, z = a["x"] + t * (b["x"] - a["x"]), a["z"] + t * (b["z"] - a["z"])
            y = a["y"] + t * (b["y"] - a["y"]) + ROAD_LIFT
            nx, nz = -(b["z"] - a["z"]) / seg, (b["x"] - a["x"]) / seg
            # The uphill side is the one nearer the centre of the arcs, to the north.
            side = 1 if nz < 0 else -1
            px, pz = x + side * nx * (width / 2 + 1.0), z + side * nz * (width / 2 + 1.0)
            box(f"lamp-post-{name}-{next_at:.0f}", px - 0.07, px + 0.07, pz - 0.07, pz + 0.07, y, y + 4.6, "lamp_post", coll)
            box(f"lamp-head-{name}-{next_at:.0f}", px - 0.18, px + 0.18, pz - 0.18, pz + 0.18, y + 4.6, y + 4.85, "lamp", coll)
            next_at += every
        walked += seg


# ---------------------------------------------------------------- planting

DENSITY = {  # metres between plants, along and across the contour
    "vine": (1.6, 2.4),
    "olive": (7.0, 7.0),
}


def _plant(site, centre, houses, plot_levels, coll):
    rng = random.Random(7)
    keep_out = [plot_corners(p, houses[p["houseType"]]["plot"], margin=1.0) for p in site["plots"]]
    width = max(r["width"] for r in site["roads"])

    def clear(xs, zs):
        ok = np.ones(xs.shape, dtype=bool)
        for outline in keep_out:
            ok &= ~inside(xs, zs, outline)
        d, _ = distance_to_roads(xs, zs, site["roads"])
        return ok & (d > width / 2 + 3.0)

    for t in site["terraces"]:
        planting = t.get("planting")
        if not planting:
            continue
        pts = np.array([[p["x"], p["z"]] for p in t["outline"]])
        rel = pts - np.array([centre["x"], centre["z"]])
        radius = np.hypot(rel[:, 0], rel[:, 1])
        angle = np.arctan2(rel[:, 0], rel[:, 1])
        r0, r1 = radius.min(), radius.max()
        a0, a1 = angle.min(), angle.max()
        if planting in DENSITY:
            along, across = DENSITY[planting]
            rs = np.arange(r0 + across / 2, r1, across)
            cand = []
            for rr in rs:
                da = along / rr
                for aa in np.arange(a0, a1, da):
                    cand.append((centre["x"] + rr * math.sin(aa), centre["z"] + rr * math.cos(aa)))
            cand = np.array(cand)
        else:
            area = (r1 - r0) * (a1 - a0) * (r0 + r1) / 2
            count = int(area / (45 if planting == "pine" else 70))
            rr = rng_uniform(rng, r0, r1, count)
            aa = rng_uniform(rng, a0, a1, count)
            cand = np.column_stack([centre["x"] + rr * np.sin(aa), centre["z"] + rr * np.cos(aa)])
        if len(cand) == 0:
            continue
        mask = inside(cand[:, 0], cand[:, 1], t["outline"]) & clear(cand[:, 0], cand[:, 1])
        for x, z in cand[mask]:
            jx, jz = rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3)
            y = t["level"]
            turn = rng.uniform(0, math.tau)
            if planting == "vine":
                models.place("shrub_02", x + jx * 0.3, z + jz * 0.3, y, coll, rng.uniform(0.45, 0.6), turn)
            elif planting == "olive":
                models.place("island_tree_01", x + jx * 3, z + jz * 3, y, coll, rng.uniform(0.45, 0.62), turn)
            elif planting == "pine":
                models.place("island_tree_02", x, z, y, coll, rng.uniform(1.0, 1.45), turn)
            else:  # garden
                if rng.random() < 0.35:
                    models.place("island_tree_01", x, z, y, coll, rng.uniform(0.6, 0.9), turn)
                else:
                    models.place("shrub_02", x, z, y, coll, rng.uniform(0.8, 1.3), turn)


def rng_uniform(rng, a, b, n):
    return np.array([rng.uniform(a, b) for _ in range(n)])


def _wild(site, land_grid, coll, step=9.0):
    """Pines and scrub over the land round the development, thicker up the hill, none on the beach
    nor on the terraces, which have their own planting."""
    xs_axis, zs_axis, h = land_grid
    rng = random.Random(11)
    gx, gz = np.meshgrid(np.arange(-420, 420, step), np.arange(-420, 260, step))
    gx = gx + np.array([[rng.uniform(-3, 3) for _ in range(gx.shape[1])] for _ in range(gx.shape[0])])
    gz = gz + np.array([[rng.uniform(-3, 3) for _ in range(gz.shape[1])] for _ in range(gz.shape[0])])
    xs, zs = gx.ravel(), gz.ravel()
    ix = np.clip(np.searchsorted(xs_axis, xs), 0, len(xs_axis) - 1)
    iz = np.clip(np.searchsorted(zs_axis, zs), 0, len(zs_axis) - 1)
    ys = h[iz, ix]
    free = ys > 3.0
    for t in site["terraces"]:
        free &= ~inside(xs, zs, t["outline"])
    d, _ = distance_to_roads(xs, zs, site["roads"])
    free &= d > max(r["width"] for r in site["roads"]) / 2 + 4
    for n in site["neighbours"]:
        free &= np.hypot(xs - n["x"], zs - n["z"]) > max(n["w"], n["d"]) / 2 + 2.5
    for x, z, y in zip(xs[free], zs[free], ys[free]):
        # Higher up, more pines; lower down, more scrub and the odd olive.
        p = min(0.85, 0.25 + y / 70)
        roll = rng.random()
        turn = rng.uniform(0, math.tau)
        if roll < p:
            models.place("island_tree_02", x, z, y - 0.2, coll, rng.uniform(0.9, 1.5), turn)
        elif roll < p + 0.25:
            models.place("shrub_02", x, z, y - 0.1, coll, rng.uniform(1.0, 1.8), turn)


def _ground_at(land_grid, x, z):
    xs_axis, zs_axis, h = land_grid
    ix = int(np.clip(np.searchsorted(xs_axis, x), 0, len(xs_axis) - 1))
    iz = int(np.clip(np.searchsorted(zs_axis, z), 0, len(zs_axis) - 1))
    return float(h[iz, ix])


def _neighbours(site, land_grid, coll, storey=3.0):
    """The neighbouring developments: white volumes, a hipped roof of tiles on the houses, a flat
    roof on the blocks, and a pool before some houses. Each stands on a plinth into the slope."""
    for i, n in enumerate(site["neighbours"]):
        w, d = n["w"], n["d"]
        y = _ground_at(land_grid, n["x"], n["z"])
        top = y + n["storeys"] * storey
        bm = bmesh.new()
        hw, hd = w / 2, d / 2

        def v(x, z, h):
            return bm.verts.new((x, -z, h))

        # Walls (and a plinth down into the hill), as one box.
        lo = [v(-hw, -hd, y - 3), v(hw, -hd, y - 3), v(hw, hd, y - 3), v(-hw, hd, y - 3)]
        hi = [v(-hw, -hd, top), v(hw, -hd, top), v(hw, hd, top), v(-hw, hd, top)]
        bm.faces.new(lo)
        for k in range(4):
            bm.faces.new((lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k]))
        roof_faces = []
        if n["kind"] == "house":
            # A hipped roof: eaves a little out, a ridge along the longer side.
            e = 0.5
            eaves = [v(-hw - e, -hd - e, top), v(hw + e, -hd - e, top), v(hw + e, hd + e, top), v(-hw - e, hd + e, top)]
            rise = min(w, d) * 0.28
            if w >= d:
                r1, r2 = v(-hw + hd, 0, top + rise), v(hw - hd, 0, top + rise)
                roof_faces += [
                    bm.faces.new((eaves[0], eaves[1], r2, r1)),
                    bm.faces.new((eaves[2], eaves[3], r1, r2)),
                    bm.faces.new((eaves[3], eaves[0], r1)),
                    bm.faces.new((eaves[1], eaves[2], r2)),
                ]
            else:
                r1, r2 = v(0, -hd + hw, top + rise), v(0, hd - hw, top + rise)
                roof_faces += [
                    bm.faces.new((eaves[1], eaves[2], r2, r1)),
                    bm.faces.new((eaves[3], eaves[0], r1, r2)),
                    bm.faces.new((eaves[0], eaves[1], r1)),
                    bm.faces.new((eaves[2], eaves[3], r2)),
                ]
            bm.faces.new(list(reversed(eaves)))
        else:
            roof_faces.append(bm.faces.new(hi))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        for f in bm.faces:
            f.material_index = 1 if f in roof_faces else 0
        me = bpy.data.meshes.new(f"neighbour-{i}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(MATS["white_render"])
        me.materials.append(MATS["tile_roof" if n["kind"] == "house" else "flat_roof"])
        ob = bpy.data.objects.new(f"neighbour-{i}", me)
        ob.location = P(n["x"], n["z"], 0)
        ob.rotation_euler = (0, 0, -math.radians(n["rotation"]))
        coll.objects.link(ob)
        if n.get("pool"):
            # A pool in the garden to the south, sunk into a paved terrace.
            a = math.radians(n["rotation"])
            # The plan's south, turned as the building is: local (0, 1) goes to (-sin a, cos a).
            px = n["x"] - (hd + 4) * math.sin(a)
            pz = n["z"] + (hd + 4) * math.cos(a)
            for name, (hx, hz, y0, y1, mat) in {
                "terrace": (4.5, 2.5, y - 2, y + 0.05, "paving"),
                "pool": (3.5, 1.6, y - 2, y + 0.08, "water"),
            }.items():
                part = box(f"neighbour-{i}-{name}", -hx, hx, -hz, hz, y0, y1, mat, coll)
                part.location = P(px, pz, 0)
                part.rotation_euler = (0, 0, -a)
