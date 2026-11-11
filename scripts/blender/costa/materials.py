"""Costa Calma's materials, after Jesús's references for Villa Duna Blanca (~/Desktop/Duna_Blanca):
sand render, honed travertine, walnut, black frames, clear glass, pool water. Procedural where a
texture would repeat, Poly Haven textures (CC0) where the grain matters."""

import os

import bpy

from .paths import POLYHAVEN

MATS = {}


def _nodes(m):
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return nt, nt.nodes.new("ShaderNodeOutputMaterial")


def _principled(nt, **inputs):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    for key, value in inputs.items():
        p.inputs[key].default_value = value
    return p


def plain(name, color, rough=0.6, metal=0.0, **extra):
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    p = _principled(nt, **{"Base Color": (*color, 1), "Roughness": rough, "Metallic": metal}, **extra)
    nt.links.new(p.outputs[0], out.inputs[0])
    MATS[name] = m
    return m


def textured(name, texture, scale=1.0, rough=None, tint=(1, 1, 1), value=1.0):
    """A Poly Haven texture set, box-projected in object space so any box takes it."""
    folder = os.path.join(POLYHAVEN, "textures", texture)
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / scale,) * 3
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])

    def image(file, color=True):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(os.path.join(folder, file), check_existing=True)
        t.image.colorspace_settings.name = "sRGB" if color else "Non-Color"
        t.projection = "BOX"
        t.projection_blend = 0.2
        nt.links.new(mp.outputs[0], t.inputs[0])
        return t

    p = _principled(nt)
    hsv = nt.nodes.new("ShaderNodeHueSaturation")
    hsv.inputs["Value"].default_value = value
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(image("Diffuse.jpg").outputs[0], hsv.inputs["Color"])
    nt.links.new(hsv.outputs[0], mix.inputs[6])
    mix.inputs[7].default_value = (*tint, 1)
    nt.links.new(mix.outputs[2], p.inputs["Base Color"])
    if rough is None and os.path.exists(os.path.join(folder, "Rough.jpg")):
        nt.links.new(image("Rough.jpg", False).outputs[0], p.inputs["Roughness"])
    else:
        p.inputs["Roughness"].default_value = 0.5 if rough is None else rough
    if os.path.exists(os.path.join(folder, "nor_gl.jpg")):
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.6
        nt.links.new(image("nor_gl.jpg", False).outputs[0], nm.inputs["Color"])
        nt.links.new(nm.outputs[0], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs[0])
    MATS[name] = m
    return m


def travertine(name, base=(0.80, 0.72, 0.60), tile=(1.2, 0.6), rough=0.38, joints=True):
    """Honed travertine: cream with long pores and soft bands, laid in tiles with fine joints."""
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.2, 9.0, 9.0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    pores = nt.nodes.new("ShaderNodeTexNoise")
    pores.inputs["Scale"].default_value = 6.0
    pores.inputs["Detail"].default_value = 12.0
    pores.inputs["Roughness"].default_value = 0.7
    nt.links.new(mp.outputs[0], pores.inputs["Vector"])
    bands = nt.nodes.new("ShaderNodeTexNoise")
    bands.inputs["Scale"].default_value = 0.35
    bands.inputs["Detail"].default_value = 3.0
    nt.links.new(tc.outputs["Object"], bands.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.25, (base[0] * 0.78, base[1] * 0.74, base[2] * 0.70, 1)
    e[1].position, e[1].color = 0.62, (*base, 1)
    e.new(0.9).color = (min(1, base[0] * 1.08), min(1, base[1] * 1.08), min(1, base[2] * 1.06), 1)
    blend = nt.nodes.new("ShaderNodeMath")
    blend.operation = "MULTIPLY_ADD"
    blend.inputs[1].default_value = 0.55
    nt.links.new(pores.outputs["Fac"], blend.inputs[0])
    soft = nt.nodes.new("ShaderNodeMath")
    soft.operation = "MULTIPLY"
    soft.inputs[1].default_value = 0.45
    nt.links.new(bands.outputs["Fac"], soft.inputs[0])
    nt.links.new(soft.outputs[0], blend.inputs[2])
    nt.links.new(blend.outputs[0], ramp.inputs["Fac"])
    color = ramp.outputs["Color"]
    if joints:
        brick = nt.nodes.new("ShaderNodeTexBrick")
        brick.offset = 0.5
        brick.inputs["Scale"].default_value = 1.0
        brick.inputs["Mortar Size"].default_value = 0.0025
        brick.inputs["Brick Width"].default_value = tile[0]
        brick.inputs["Row Height"].default_value = tile[1]
        brick.inputs["Color1"].default_value = (1, 1, 1, 1)
        brick.inputs["Color2"].default_value = (1, 1, 1, 1)
        brick.inputs["Mortar"].default_value = (0.72, 0.70, 0.66, 1)
        nt.links.new(tc.outputs["Object"], brick.inputs["Vector"])
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1
        nt.links.new(ramp.outputs["Color"], mul.inputs[6])
        nt.links.new(brick.outputs["Color"], mul.inputs[7])
        color = mul.outputs[2]
    p = _principled(nt, Roughness=rough)
    nt.links.new(color, p.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(pores.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs[0])
    MATS[name] = m
    return m


def plaster(name, color, scale=3.0):
    """Mineral render: a flat colour with a soft trowelled cloud and a fine bump."""
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    cloud = nt.nodes.new("ShaderNodeTexNoise")
    cloud.inputs["Scale"].default_value = scale
    cloud.inputs["Detail"].default_value = 8.0
    nt.links.new(tc.outputs["Object"], cloud.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.35, (color[0] * 0.93, color[1] * 0.92, color[2] * 0.9, 1)
    e[1].position, e[1].color = 0.7, (*color, 1)
    nt.links.new(cloud.outputs["Fac"], ramp.inputs["Fac"])
    p = _principled(nt, Roughness=0.85)
    nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 180
    nt.links.new(tc.outputs["Object"], fine.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.05
    nt.links.new(fine.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs[0])
    MATS[name] = m
    return m


def glass(name="glass"):
    """Thin architectural glass: mostly see-through, with a faint reflection at grazing angles."""
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    clear.inputs["Color"].default_value = (0.93, 0.96, 0.95, 1)
    gloss = nt.nodes.new("ShaderNodeBsdfGlossy")
    gloss.inputs["Roughness"].default_value = 0.02
    fresnel = nt.nodes.new("ShaderNodeFresnel")
    fresnel.inputs["IOR"].default_value = 1.5
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fresnel.outputs[0], mix.inputs[0])
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(gloss.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    MATS[name] = m
    return m


def water(name, tint=(0.18, 0.74, 0.82), density=1.2, waves=1.6, strength=0.12):
    """Clear water: it lets the light through to the floor below and soaks up the reds as it gets
    deeper, so it reads turquoise over a light floor and blue over deep water."""
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    p = _principled(nt, **{"Base Color": (1, 1, 1, 1), "Roughness": 0.03, "Transmission Weight": 1.0, "IOR": 1.33})
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ripples = nt.nodes.new("ShaderNodeTexNoise")
    ripples.inputs["Scale"].default_value = waves
    ripples.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], ripples.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    nt.links.new(ripples.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs[0])
    absorb = nt.nodes.new("ShaderNodeVolumeAbsorption")
    absorb.inputs["Color"].default_value = (*tint, 1)
    absorb.inputs["Density"].default_value = density
    nt.links.new(absorb.outputs[0], out.inputs["Volume"])
    MATS[name] = m
    return m


def emit(name, color, strength):
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs[0], out.inputs[0])
    MATS[name] = m
    return m


def clay(name="clay", color=(0.78, 0.77, 0.75)):
    """The check renders' and the clay aerial's one material: a warm mid-grey, matte."""
    return plain(name, color, 0.8)


def build_all():
    """Every material the houses use, once."""
    if MATS:
        return MATS
    plaster("render", (0.70, 0.56, 0.40), 2.0)  # warm sand render outside (views 01–03)
    plaster("wall_in", (0.80, 0.74, 0.64), 2.5)  # warm ivory plaster inside (view 05)
    plaster("ceiling", (0.82, 0.77, 0.68), 1.5)
    travertine("floor", (0.78, 0.70, 0.58), (1.2, 0.6), 0.3)
    travertine("travertine_block", (0.82, 0.74, 0.62), (2.4, 0.9), 0.4, joints=False)
    travertine("paving", (0.78, 0.70, 0.58), (0.9, 0.45), 0.6)
    textured("walnut", "dark_wood", 1.0, None, (1.0, 0.85, 0.7), 0.9)
    textured("teak", "oak_veneer_01", 1.2, 0.6, (1.0, 0.82, 0.62), 0.8)
    textured("grass", "leafy_grass", 2.0, 0.9, (0.55, 0.85, 0.45), 0.8)
    plain("frame", (0.03, 0.03, 0.032), 0.35, 0.6)
    plain("pool_tile", (0.72, 0.88, 0.90), 0.25)
    plain("overlay", (1.0, 0.1, 0.1), 1.0)
    emit("overlay_line", (1.0, 0.05, 0.05), 4.0)
    glass()
    water("water")
    clay()
    return MATS


def stone(name="stone"):
    """Dry stone walls: irregular stones in warm limestone greys, with dark gaps between them."""
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (2.2, 2.2, 3.4)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    cells = nt.nodes.new("ShaderNodeTexVoronoi")
    cells.feature = "DISTANCE_TO_EDGE"
    nt.links.new(mp.outputs[0], cells.inputs["Vector"])
    tint = nt.nodes.new("ShaderNodeTexVoronoi")
    nt.links.new(mp.outputs[0], tint.inputs["Vector"])
    joints = nt.nodes.new("ShaderNodeValToRGB")
    e = joints.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0.08, 0.07, 0.06, 1)
    e[1].position, e[1].color = 0.06, (1, 1, 1, 1)
    nt.links.new(cells.outputs["Distance"], joints.inputs["Fac"])
    shade = nt.nodes.new("ShaderNodeValToRGB")
    e = shade.color_ramp.elements
    e[0].color = (0.42, 0.37, 0.30, 1)
    e[1].color = (0.70, 0.64, 0.55, 1)
    nt.links.new(tint.outputs["Color"], shade.inputs["Fac"])
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1
    nt.links.new(shade.outputs["Color"], mul.inputs[6])
    nt.links.new(joints.outputs["Color"], mul.inputs[7])
    p = _principled(nt, Roughness=0.9)
    nt.links.new(mul.outputs[2], p.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    nt.links.new(cells.outputs["Distance"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs[0])
    MATS[name] = m
    return m


def hillside(name="hillside"):
    """The land round the development: sand by the sea, dry scrub and earth up the hill."""
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.08
    noise.inputs["Detail"].default_value = 8
    nt.links.new(geo.outputs["Position"], noise.inputs["Vector"])
    land = nt.nodes.new("ShaderNodeValToRGB")
    e = land.color_ramp.elements
    e[0].position, e[0].color = 0.35, (0.20, 0.22, 0.11, 1)
    e[1].position, e[1].color = 0.65, (0.38, 0.32, 0.21, 1)
    nt.links.new(noise.outputs["Fac"], land.inputs["Fac"])
    shore = nt.nodes.new("ShaderNodeMapRange")
    shore.inputs["From Min"].default_value = 1.2
    shore.inputs["From Max"].default_value = 2.4
    nt.links.new(sep.outputs["Z"], shore.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    nt.links.new(shore.outputs[0], mix.inputs["Factor"])
    mix.inputs[6].default_value = (0.78, 0.68, 0.52, 1)
    nt.links.new(land.outputs["Color"], mix.inputs[7])
    p = _principled(nt, Roughness=0.95)
    nt.links.new(mix.outputs[2], p.inputs["Base Color"])
    nt.links.new(p.outputs[0], out.inputs[0])
    MATS[name] = m
    return m


def sea(name="sea"):
    """The sea: the same clear water, deep enough to turn from turquoise over the sand to blue."""
    return water(name, tint=(0.05, 0.55, 0.62), density=0.4, waves=0.06, strength=0.3)


def build_site():
    """The development's materials, besides the houses'."""
    if "stone" in MATS:
        return MATS
    build_all()
    textured("stone", "stacked_stone_wall", 2.0, None, (0.88, 0.92, 0.98), 1.3)
    hillside()
    sea()
    textured("sand", "coast_sand_01", 9.0, 0.9, (1.0, 0.94, 0.82), 1.05)
    plain("soil", (0.42, 0.33, 0.22), 0.95)
    textured("asphalt", "asphalt_02", 4.0, None, (0.75, 0.75, 0.75), 0.7)
    plain("kerb", (0.72, 0.68, 0.61), 0.7)
    plain("lamp_post", (0.04, 0.04, 0.045), 0.4, 0.7)
    emit("lamp", (1.0, 0.72, 0.42), 0.0)
    return MATS


_CLAY_LINKS = {}
CLAY_KEEPS = {"sea", "water", "glass", "lamp", "overlay_line"}


def clay_mode(on, color=(0.62, 0.61, 0.59)):
    """Every material turns matte clay, but the sea, the water and the glass keep theirs, so the
    clay aerial still reads land from sea. Undone with clay_mode(False)."""
    for m in bpy.data.materials:
        if m.name in CLAY_KEEPS or not m.use_nodes:
            continue
        nt = m.node_tree
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
        if out is None:
            continue
        surface = out.inputs["Surface"]
        if on:
            if m.name in _CLAY_LINKS:
                continue
            _CLAY_LINKS[m.name] = surface.links[0].from_socket if surface.links else None
            clay_node = nt.nodes.new("ShaderNodeBsdfPrincipled")
            clay_node.name = "clay"
            clay_node.inputs["Base Color"].default_value = (*color, 1)
            clay_node.inputs["Roughness"].default_value = 0.85
            nt.links.new(clay_node.outputs[0], surface)
        else:
            source = _CLAY_LINKS.pop(m.name, False)
            if source is False:
                continue
            clay_node = nt.nodes.get("clay")
            if clay_node:
                nt.nodes.remove(clay_node)
            if source is not None:
                nt.links.new(source, surface)


def build_context():
    """The neighbouring developments' materials: white render and terracotta tiles."""
    if "tile_roof" in MATS:
        return MATS
    plaster("white_render", (0.86, 0.84, 0.80), 2.0)
    textured("tile_roof", "clay_roof_tiles", 2.0, None, (1.0, 0.9, 0.85), 1.0)
    plain("flat_roof", (0.74, 0.72, 0.68), 0.85)
    return MATS
