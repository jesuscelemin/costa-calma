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


def water(name, deep=(0.05, 0.32, 0.36)):
    m = bpy.data.materials.new(name)
    nt, out = _nodes(m)
    p = _principled(nt, **{"Base Color": (*deep, 1), "Roughness": 0.02, "Transmission Weight": 1.0, "IOR": 1.33})
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ripples = nt.nodes.new("ShaderNodeTexNoise")
    ripples.inputs["Scale"].default_value = 1.6
    ripples.inputs["Detail"].default_value = 4
    nt.links.new(tc.outputs["Object"], ripples.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    nt.links.new(ripples.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs[0])
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
    plain("pool_tile", (0.55, 0.78, 0.76), 0.25)
    plain("overlay", (1.0, 0.1, 0.1), 1.0)
    emit("overlay_line", (1.0, 0.05, 0.05), 4.0)
    glass()
    water("water")
    clay()
    return MATS
