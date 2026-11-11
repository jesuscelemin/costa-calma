"""Mediterranean plants built in code, for what Poly Haven does not have: palms, agaves and
bougainvillea in flower. Each kind is built once into a hidden collection, in a few variants, and
placed as collection instances (models.place does the same for the Poly Haven ones)."""

import math
import random

import bmesh
import bpy
from mathutils import Vector

from .geometry import P, collection
from .materials import MATS, _nodes, _principled

_BUILT = {}


def _materials():
    if "palm_leaf" in MATS:
        return
    m = bpy.data.materials.new("palm_trunk")
    nt, out = _nodes(m)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    rings = nt.nodes.new("ShaderNodeTexWave")
    rings.wave_type = "BANDS"
    rings.bands_direction = "Z"
    rings.inputs["Scale"].default_value = 6.0
    rings.inputs["Distortion"].default_value = 2.0
    nt.links.new(geo.outputs["Position"], rings.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].color = (0.22, 0.17, 0.12, 1)
    e[1].color = (0.45, 0.38, 0.29, 1)
    nt.links.new(rings.outputs["Fac"], ramp.inputs["Fac"])
    p = _principled(nt, Roughness=0.9)
    nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    nt.links.new(rings.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs[0])
    MATS["palm_trunk"] = m

    for name, color, sss in (
        ("palm_leaf", (0.16, 0.30, 0.09), (0.35, 0.55, 0.12)),
        ("agave", (0.32, 0.45, 0.40), (0.4, 0.55, 0.45)),
    ):
        m = bpy.data.materials.new(name)
        nt, out = _nodes(m)
        p = _principled(
            nt,
            **{
                "Base Color": (*color, 1),
                "Roughness": 0.55,
                "Subsurface Weight": 0.15,
                "Subsurface Radius": sss,
            },
        )
        nt.links.new(p.outputs[0], out.inputs[0])
        MATS[name] = m

    # Bougainvillea: magenta bracts over dark leaves, patchy.
    m = bpy.data.materials.new("bougainvillea")
    nt, out = _nodes(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    noise.inputs["Detail"].default_value = 6.0
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.45, (0.10, 0.18, 0.06, 1)
    e[1].position, e[1].color = 0.55, (0.72, 0.07, 0.38, 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    p = _principled(nt, Roughness=0.7)
    nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.8
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs[0])
    MATS["bougainvillea"] = m


def _object(name, bm, mats, coll):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(MATS[m])
    for poly in me.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def _palm(name, height, lean, fronds, seed, coll):
    """A palm: a ringed trunk that leans and curves a little, and a crown of arching fronds."""
    rng = random.Random(seed)
    bm = bmesh.new()
    sides, rings = 10, 14
    lean_dir = Vector((math.cos(seed), math.sin(seed), 0))
    rings_verts = []
    for k in range(rings + 1):
        t = k / rings
        centre = Vector((0, 0, height * t)) + lean_dir * lean * t * t
        radius = 0.30 - 0.11 * t + (0.04 if k == 0 else 0)
        ring = [
            bm.verts.new(centre + Vector((radius * math.cos(a), radius * math.sin(a), 0)))
            for a in (2 * math.pi * i / sides for i in range(sides))
        ]
        rings_verts.append(ring)
    for k in range(rings):
        for i in range(sides):
            j = (i + 1) % sides
            f = bm.faces.new((rings_verts[k][i], rings_verts[k][j], rings_verts[k + 1][j], rings_verts[k + 1][i]))
            f.material_index = 0
    top = Vector((0, 0, height)) + lean_dir * lean

    for n in range(fronds):
        azimuth = 2 * math.pi * n / fronds + rng.uniform(-0.15, 0.15)
        rise = rng.uniform(-0.35, 0.75)  # some reach up, some hang
        length = rng.uniform(2.6, 3.6)
        direction = Vector((math.cos(azimuth) * math.cos(rise), math.sin(azimuth) * math.cos(rise), math.sin(rise)))
        side = Vector((-math.sin(azimuth), math.cos(azimuth), 0))
        steps = 11
        spine = []
        for s in range(steps + 1):
            t = s / steps
            spine.append(top + direction * length * t + Vector((0, 0, -1.4 * t * t)))
        for s in range(steps):
            t = (s + 0.5) / steps
            a, b = spine[s], spine[s + 1]
            reach = 1.0 * math.sin(math.pi * min(1.0, t * 1.15)) + 0.1
            for sign in (1, -1):
                tip = (a + b) / 2 + side * sign * reach + Vector((0, 0, -0.35 * reach))
                f = bm.faces.new((bm.verts.new(a), bm.verts.new(b), bm.verts.new(tip)))
                f.material_index = 1
    return _object(name, bm, ["palm_trunk", "palm_leaf"], coll)


def _agave(name, size, leaves, seed, coll):
    """An agave: a rosette of thick, pointed leaves rising from the ground."""
    rng = random.Random(seed)
    bm = bmesh.new()
    for n in range(leaves):
        azimuth = 2 * math.pi * n / leaves + rng.uniform(-0.2, 0.2)
        rise = rng.uniform(0.35, 1.2)
        length = size * rng.uniform(0.7, 1.0)
        direction = Vector((math.cos(azimuth) * math.cos(rise), math.sin(azimuth) * math.cos(rise), math.sin(rise)))
        side = Vector((-math.sin(azimuth), math.cos(azimuth), 0)) * size * 0.09
        base = Vector((0, 0, 0.05))
        mid = base + direction * length * 0.45 + Vector((0, 0, 0.05))
        tip = base + direction * length
        up = Vector((0, 0, size * 0.04))
        v = [bm.verts.new(p) for p in (base - side, base + side, mid + side + up, tip, mid - side + up)]
        bm.faces.new((v[0], v[1], v[2], v[3], v[4]))
    return _object(name, bm, ["agave"], coll)


def _bougainvillea(name, size, seed, coll):
    """A mound of bougainvillea in flower: a few flattened blobs run together."""
    rng = random.Random(seed)
    bm = bmesh.new()
    for _ in range(5):
        r = size * rng.uniform(0.35, 0.55)
        centre = Vector((rng.uniform(-size, size) * 0.5, rng.uniform(-size, size) * 0.5, r * 0.6))
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r, matrix=__import__("mathutils").Matrix.Translation(centre))
    for v in bm.verts:
        v.co.z *= 0.75
        v.co += Vector((rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08)))
    return _object(name, bm, ["bougainvillea"], coll)


VARIANTS = {"palm": 4, "agave": 3, "bougainvillea": 3}


def build():
    """Every kind and variant, once, each in its own hidden collection."""
    if _BUILT:
        return _BUILT
    _materials()
    library = collection("library")
    library.hide_render = True
    library.hide_viewport = True
    for kind, count in VARIANTS.items():
        for i in range(count):
            coll = collection(f"flora-{kind}-{i}", library)
            if kind == "palm":
                _palm(f"palm-{i}", height=6.5 + i * 1.6, lean=0.4 + 0.35 * i, fronds=16 + 2 * i, seed=i + 1, coll=coll)
            elif kind == "agave":
                _agave(f"agave-{i}", size=1.1 + 0.35 * i, leaves=18 + 3 * i, seed=i + 7, coll=coll)
            else:
                _bougainvillea(f"bougainvillea-{i}", size=1.6 + 0.5 * i, seed=i + 13, coll=coll)
            _BUILT[(kind, i)] = coll
    return _BUILT


def place(kind, x, z, y, coll, rng, scale=1.0):
    """An instance of a random variant of a kind, standing at (x, z) on height y."""
    built = build()
    variant = rng.randrange(VARIANTS[kind])
    e = bpy.data.objects.new(f"{kind}@{x:.1f},{z:.1f}", None)
    e.instance_type = "COLLECTION"
    e.instance_collection = built[(kind, variant)]
    e.location = P(x, z, y)
    e.rotation_euler = (0, 0, rng.uniform(0, math.tau))
    e.scale = (scale,) * 3
    coll.objects.link(e)
    return e
