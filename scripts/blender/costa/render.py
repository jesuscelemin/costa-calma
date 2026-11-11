"""Render settings, light and cameras shared by the pipeline's renders."""

import math
import os

import bpy
from mathutils import Vector

from .geometry import collection
from .paths import POLYHAVEN


def cycles(samples=64, width=1600, height=1000):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for device_type in ("METAL", "OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = device_type
            prefs.get_devices()
            if any(d.type == device_type for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == device_type
                scene.cycles.device = "GPU"
                break
        except TypeError:
            continue
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"


def daylight(sun_elevation=48, sun_azimuth=215, strength=1.0):
    """The Poly Haven sky and a warm sun; azimuth in degrees clockwise from north."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new("sky")
    scene.world = world
    world.use_nodes = True
    wn = world.node_tree
    wn.nodes.clear()
    out = wn.nodes.new("ShaderNodeOutputWorld")
    env = wn.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(
        os.path.join(POLYHAVEN, "hdri", "kloofendal_48d_partly_cloudy_puresky.hdr"), check_existing=True
    )
    bg = wn.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    wn.links.new(env.outputs[0], bg.inputs["Color"])
    wn.links.new(bg.outputs[0], out.inputs["Surface"])

    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4.5
    sun.angle = math.radians(1.0)
    sun.color = (1.0, 0.88, 0.74)
    ob = bpy.data.objects.new("sun", sun)
    # A sun light shines down its -Z: tilt it from the zenith, then turn it to come from the azimuth.
    ob.rotation_euler = (math.radians(90 - sun_elevation), 0, math.radians(180 - sun_azimuth))
    collection("light").objects.link(ob)
    return ob


def camera(name, location, target, lens=35.0, ortho_scale=None):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_end = 5000
    if ortho_scale:
        cam.type = "ORTHO"
        cam.ortho_scale = ortho_scale
    ob = bpy.data.objects.new(name, cam)
    ob.location = Vector(location)
    direction = Vector(target) - Vector(location)
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    collection("cameras").objects.link(ob)
    return ob


def render_to(cam, path):
    scene = bpy.context.scene
    scene.camera = cam
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("rendered", path)


def golden_hour(sun_elevation=11.0, sun_azimuth=250.0, strength=0.3):
    """A physical sky late in the afternoon, and a warm low sun in it (azimuth clockwise from north),
    the light of Jesús's references."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new("golden-hour")
    scene.world = world
    world.use_nodes = True
    wn = world.node_tree
    wn.nodes.clear()
    out = wn.nodes.new("ShaderNodeOutputWorld")
    sky = wn.nodes.new("ShaderNodeTexSky")
    for kind in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING", "HOSEK_WILKIE"):
        try:
            sky.sky_type = kind
            break
        except TypeError:
            continue
    for attr, value in (
        ("sun_elevation", math.radians(sun_elevation)),
        ("sun_rotation", math.radians(90 - sun_azimuth)),
        ("sun_disc", False),
        ("altitude", 40.0),
        ("air_density", 1.2),
        ("aerosol_density", 3.0),
        ("dust_density", 3.0),
    ):
        if hasattr(sky, attr):
            setattr(sky, attr, value)
    bg = wn.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    wn.links.new(sky.outputs[0], bg.inputs["Color"])
    wn.links.new(bg.outputs[0], out.inputs["Surface"])

    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4.2
    sun.angle = math.radians(0.8)
    sun.color = (1.0, 0.64, 0.40)
    ob = bpy.data.objects.new("sun", sun)
    ob.rotation_euler = (math.radians(90 - sun_elevation), 0, math.radians(180 - sun_azimuth))
    collection("light").objects.link(ob)
    return ob
