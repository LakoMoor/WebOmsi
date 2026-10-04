"""The public pack's map "Demo" (a village loop) and its scenery: all made here."""
import math, os, random, struct
from lib import *

ROOT = os.environ.get('PUBLIC_PACK', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public-pack'))
ROOT = os.path.abspath(ROOT)
P = lambda *a: os.path.join(ROOT, *a)

# ------------------------------------------------------------------------------ textures

def make_textures():
    nz = [Noise(8, 1), Noise(8, 2), Noise(8, 3)]
    # ground
    png(P('Texture', 'demo_grass.png'), 256, 256, lambda x, y: (
        lambda t: (58 + 40 * t, 96 + 50 * t, 40 + 24 * t))(fbm(nz, x / 32, y / 32)))
    # detail (multiplied in: bright, low contrast)
    png(P('Texture', 'demo_noise.png'), 128, 128, lambda x, y: (
        lambda t: (200 + 55 * t,) * 3)(fbm(nz, x / 16, y / 16)))
    # asphalt with a dashed centre line (u across the road, v along it)
    def road(x, y):
        t = fbm(nz, x / 12, y / 12)
        g = 78 + 26 * t
        c = [g, g, g + 3]
        if abs(x - 128) < 3 and (y % 64) < 36:
            c = [225, 225, 215]
        if x < 6 or x > 249:
            c = [215, 215, 208]
        return c
    png(P('Splines', 'Demo', 'texture', 'demo_road.png'), 256, 256, road)
    png(P('Splines', 'Demo', 'texture', 'demo_kerb.png'), 64, 64, lambda x, y: (
        lambda t: (150 + 40 * t,) * 3)(fbm(nz, x / 8, y / 8)))
    # buildings
    def wall(x, y):
        t = fbm(nz, x / 16, y / 16)
        r = [214, 196, 160]
        # windows
        wx, wy = x % 64, y % 64
        if 14 < wx < 46 and 18 < wy < 52:
            sky = 120 + 60 * (1 - wy / 64)
            r = [60 + 20 * t, 80 + 30 * t, sky]
            if abs(wx - 30) < 1.5 or abs(wy - 35) < 1.5:
                r = [235, 235, 230]
        else:
            r = [v * (0.92 + 0.12 * t) for v in r]
        return r
    png(P('Sceneryobjects', 'Demo', 'texture', 'demo_wall.png'), 128, 128, wall)
    png(P('Sceneryobjects', 'Demo', 'texture', 'demo_roof.png'), 64, 64, lambda x, y: (
        lambda t: (150 + 30 * t, 62 + 14 * t, 46 + 10 * t) if (y % 8) > 1 else (110, 44, 34))(fbm(nz, x / 8, y / 8)))
    png(P('Sceneryobjects', 'Demo', 'texture', 'demo_bark.png'), 32, 32, lambda x, y: (
        lambda t: (92 + 40 * t, 64 + 28 * t, 40 + 16 * t))(fbm(nz, x / 4, y / 4)))
    png(P('Sceneryobjects', 'Demo', 'texture', 'demo_leaves.png'), 64, 64, lambda x, y: (
        lambda t: (34 + 30 * t, 100 + 56 * t, 36 + 24 * t))(fbm(nz, x / 6, y / 6)))
    png(P('Sceneryobjects', 'Demo', 'texture', 'demo_sign.png'), 64, 64, lambda x, y: (
        (250, 205, 40) if 4 < x < 60 and 4 < y < 60 else (40, 40, 44)))
    png(P('Sceneryobjects', 'Demo', 'texture', 'demo_metal.png'), 16, 16, lambda x, y: (120, 124, 130))

# ------------------------------------------------------------------------------ spline type

def make_spline_type():
    # the road: a kerb on each side and the asphalt between, 7 m wide; one lane each way
    write_text(P('Splines', 'Demo', 'demo_road.sli'), """Demo road, 2 lanes

[length]
10

[texture]
demo_road.png
demo_kerb.png

Kerb left:
[profile]
1
[profilepnt]
-3.9
0.12
0
0.1
[profilepnt]
-3.5
0.12
0.5
0.1
[profilepnt]
-3.5
0.0
1
0.1

Asphalt:
[profile]
0
[profilepnt]
-3.5
0.0
0
0.1
[profilepnt]
3.5
0.0
1
0.1

Kerb right:
[profile]
1
[profilepnt]
3.5
0.0
0
0.1
[profilepnt]
3.5
0.12
0.5
0.1
[profilepnt]
3.9
0.12
1
0.1

[path]
0
1.75
0.0
3
0

[path]
0
-1.75
0.0
3
1
""")

# ------------------------------------------------------------------------------ scenery

def make_scenery():
    d = lambda *a: P('Sceneryobjects', 'Demo', *a)
    # house: walls and a gable roof
    m = Mesh()
    wall = m.material('demo_wall.png'); roof = m.material('demo_roof.png')
    w, dpt, h, rh = 9.0, 11.0, 6.0, 2.6
    m.box(-w / 2, 0, -dpt / 2, w / 2, h, dpt / 2, wall, 0.14, faces='nsew')
    ridge = h + rh
    # roof: two slopes and two gable triangles (as degenerate quads)
    m.quad((-w / 2 - .4, h, -dpt / 2 - .4), (-w / 2 - .4, h, dpt / 2 + .4), (0, ridge, dpt / 2 + .4), (0, ridge, -dpt / 2 - .4), roof, ((0, 0), (4, 0), (4, 2), (0, 2)), flip=True)
    m.quad((w / 2 + .4, h, dpt / 2 + .4), (w / 2 + .4, h, -dpt / 2 - .4), (0, ridge, -dpt / 2 - .4), (0, ridge, dpt / 2 + .4), roof, ((0, 0), (4, 0), (4, 2), (0, 2)), flip=True)
    m.quad((-w / 2, h, dpt / 2), (w / 2, h, dpt / 2), (0, ridge, dpt / 2), (0, ridge, dpt / 2), wall, ((0, 1), (1, 1), (.5, 0), (.5, 0)))
    m.quad((w / 2, h, -dpt / 2), (-w / 2, h, -dpt / 2), (0, ridge, -dpt / 2), (0, ridge, -dpt / 2), wall, ((0, 1), (1, 1), (.5, 0), (.5, 0)))
    m.save(d('model', 'house.o3d'))
    write_text(d('house.sco'), "[friendlyname]\nDemo house\n\n[groups]\n1\nDemo\n\n[mesh]\nhouse.o3d\n")
    # tree: trunk and two cones of leaves
    t = Mesh()
    bark = t.material('demo_bark.png'); leaf = t.material('demo_leaves.png')
    t.box(-.25, 0, -.25, .25, 2.2, .25, bark, 1.0, faces='nsew')
    for base, r, top in ((1.6, 2.0, 5.2), (3.4, 1.4, 7.4)):
        n = 10
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            p0 = (r * math.sin(a0), base, r * math.cos(a0)); p1 = (r * math.sin(a1), base, r * math.cos(a1))
            t.quad(p1, p0, (0, top, 0), (0, top, 0), leaf, ((0, 0), (1, 0), (.5, 1), (.5, 1)))
    t.save(d('model', 'tree.o3d'))
    write_text(d('tree.sco'), "[friendlyname]\nDemo tree\n\n[groups]\n1\nDemo\n\n[mesh]\ntree.o3d\n")
    # bus stop: pole, sign, small shelter
    b = Mesh()
    metal = b.material('demo_metal.png'); sign = b.material('demo_sign.png')
    b.box(-.05, 0, -.05, .05, 3.0, .05, metal, 1.0, faces='nsew')
    b.box(-.3, 2.6, -.03, .3, 3.2, .03, sign, 1.0, faces='ns')
    b.save(d('model', 'busstop.o3d'))
    write_text(d('busstop.sco'), "[friendlyname]\nDemo bus stop\n\n[groups]\n1\nDemo\n\n[mesh]\nbusstop.o3d\n")
    # where the player's bus is put on the map
    e = Mesh()
    mat = e.material('demo_metal.png')
    e.box(-.1, 0, -.1, .1, .1, .1, mat, 1.0)
    e.save(d('model', 'entrypoint.o3d'))
    write_text(d('entrypoint.sco'), "[friendlyname]\nEntrypoint\n\n[groups]\n1\nUtilities\n\n[entrypoint]\n[onlyeditor]\n\n[mesh]\nentrypoint.o3d\n")

# ------------------------------------------------------------------------------ the map

TILE = 300.0

def loop():
    """A clockwise loop of straights and quarter circles: (kind, x, y, heading, length, radius)."""
    R, L1, L2 = 45.0, 120.0, 70.0
    x, y, h = 70.0, 60.0, 90.0           # heading 90 = east
    segs = []
    for k in range(4):
        straight = L1 if k % 2 == 0 else L2
        segs.append((x, y, h, straight, 0.0))
        x, y = x + straight * math.sin(math.radians(h)), y + straight * math.cos(math.radians(h))
        segs.append((x, y, h, R * math.pi / 2, R))
        # end of the quarter circle: centre on the right of the heading
        hr = math.radians(h)
        cx, cy = x + R * math.cos(hr), y - R * math.sin(hr)
        h2 = h + 90.0
        h2r = math.radians(h2)
        x, y = cx - R * math.cos(h2r), cy + R * math.sin(h2r)
        h = h2 % 360.0
    return segs


def make_tile():
    rnd = random.Random(7)
    out = ["File created by the openOMSI public pack generator", "", "[version]", "14", "", "[terrain]", "", "",
           "[variable_terrainlightmap]", "", "[variable_terrain]", ""]
    ids = iter(range(1000, 9000))
    segs = loop()
    first = None
    spl = []
    for i, (x, y, h, ln, rad) in enumerate(segs):
        sid = next(ids)
        spl.append((sid, x, y, h, ln, rad))
    for i, (sid, x, y, h, ln, rad) in enumerate(spl):
        prev_id = spl[i - 1][0]
        next_id = spl[(i + 1) % len(spl)][0]
        out += ["[spline]", "0", "Splines\\Demo\\demo_road.sli", str(sid), str(prev_id), str(next_id),
                f"{x:.4f}", "0", f"{y:.4f}", f"{h:.4f}", f"{ln:.4f}", f"{rad:.4f}", "0", "0", "0", "0", "0", "0", "0", ""]
    objects = []
    # houses on both sides of the long straights
    for k in range(5):
        objects.append(("house", 78 + 22 * k, 38, 0 if k % 2 else 180))
        objects.append(("house", 78 + 22 * k, 84 + 0, 180 if k % 2 else 0))
    # trees around
    for _ in range(70):
        tx, ty = rnd.uniform(8, 292), rnd.uniform(8, 292)
        # not on the road ring (rough test against the loop's box)
        if 20 < tx < 260 and 20 < ty < 215 and (abs(tx - 70) < 25 or abs(tx - 235) < 25 or abs(ty - 60) < 25 or abs(ty - 195) < 25 or True):
            if any(math.hypot(tx - px, ty - py) < 12 for px, py in ((s[1], s[2]) for s in spl)):
                continue
            if 30 < tx < 250 and 30 < ty < 210:
                continue
        objects.append(("tree", tx, ty, rnd.uniform(0, 360)))
    objects.append(("busstop", 150, 55.5, 0))
    entry_id = next(ids)
    n = 0
    for kind, x, y, hd in objects:
        oid = next(ids)
        out += [f"Object Nr. {n}", "[object]", "0", f"Sceneryobjects\\Demo\\{kind}.sco", str(oid), f"{x:.3f}", f"{y:.3f}", "0",
                f"{hd:.3f}", "0", "0", "0", ""]
        n += 1
    out += [f"Object Nr. {n}", "[object]", "0", "Sceneryobjects\\Demo\\entrypoint.sco", str(entry_id), "75.0", "56.0", "0", "90.0", "0", "0", "0", ""]
    write_text(P('maps', 'Demo', 'tile_0_0.map'), "\n".join(out), utf16=True)
    # flat ground, 61 x 61 heights, and a white light map
    write_bytes(P('maps', 'Demo', 'tile_0_0.map.terrain'), struct.pack('<I', 60) + struct.pack('<3721f', *([0.0] * 3721)))
    bmp24(P('maps', 'Demo', 'tile_0_0.map.LM.bmp'), 256, 256, lambda x, y: (255, 255, 255))
    return entry_id


def make_global(entry_id):
    q = math.radians(90.0)
    cfg = f"""File created by the openOMSI public pack generator
[name]
Demo
[friendlyname]
Demo village
[description]
A small village loop made for the openOMSI web demo.
[end]
[version]
14
[NextIDCode]
9000
[dynhelperactive]
[realrail]
[mapcam]
1
2
150.0
60.0
150.0
150.0
-30.0
0.0
[repair_time_min]
10.000
[years]
1988
2030
[groundtex]
texture\\demo_grass.png
texture\\demo_noise.png
0
1
60
[entrypoints]
1
0
{entry_id}
0
75.000
0.000
56.000
0.000
{math.sin(q / 2):.4f}
0.000
{math.cos(q / 2):.4f}
0
Start
[map]
0
0
tile_0_0.map
"""
    write_text(P('maps', 'Demo', 'global.cfg'), cfg, utf16=True)
    # the pack's own copy of the ground textures the map names (relative to the game's Texture folder)


if __name__ == '__main__':
    make_textures()
    make_spline_type()
    make_scenery()
    make_global(make_tile())
    print('map written to', ROOT)
