"""The public pack's buses: four original two-axle buses (a city bus, a minibus, a long bus, a double-decker)
sharing one drive/brake script. Everything is generated here."""
import math, os
from lib import *

ROOT = os.environ.get('PUBLIC_PACK', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public-pack'))
ROOT = os.path.abspath(ROOT)
V = lambda *a: os.path.join(ROOT, 'Vehicles', 'DemoBus', *a)

VARIANTS = {
    # key: (friendly name, length, width, height, body rgb, stripe rgb, mass t, power kW)
    'city': ('Demo City Bus', 10.6, 2.5, 3.0, (236, 190, 40), (190, 40, 36), 10.5, 170),
    'mini': ('Demo Minibus', 7.4, 2.2, 2.7, (52, 110, 190), (240, 240, 244), 5.2, 110),
    'long': ('Demo Long Bus', 12.2, 2.55, 3.05, (60, 150, 90), (245, 245, 245), 12.5, 210),
    'double': ('Demo Double-Decker', 10.4, 2.5, 4.25, (196, 38, 42), (238, 228, 196), 13.0, 190),
}

# -------------------------------------------------------------------------- textures

def textures(key, body, stripe):
    nz = [Noise(8, 11), Noise(8, 12)]
    def paint(x, y):
        n = fbm(nz, x / 20, y / 20)
        t = 0.94 + 0.08 * n
        # y: 0 top .. 255 bottom of the side; a stripe under the windows
        if 120 < y < 150:
            return [c * t for c in stripe]
        if y > 225:
            return [58, 58, 62]
        return [c * t for c in body]
    png(V('Texture', f'demo_paint_{key}.png'), 128, 256, paint)
    png(V('Texture', 'demo_tyre.png'), 32, 32, lambda x, y: (30, 30, 32) if (x // 4) % 2 else (24, 24, 26))
    png(V('Texture', 'demo_rim.png'), 64, 64, lambda x, y: (176, 180, 186) if math.hypot(x - 32, y - 32) > 12 else (120, 124, 130))
    png(V('Texture', 'demo_inside.png'), 64, 64, lambda x, y: (196, 192, 180))
    png(V('Texture', 'demo_floor.png'), 64, 64, lambda x, y: (70, 72, 76) if (x // 8 + y // 8) % 2 else (64, 66, 70))
    png(V('Texture', 'demo_seat.png'), 32, 32, lambda x, y: (46, 76, 140))
    png(V('Texture', 'demo_dash.png'), 64, 64, lambda x, y: (38, 40, 44))
    png(V('Texture', 'demo_wheel.png'), 32, 32, lambda x, y: (24, 24, 26))
    png(V('Texture', 'demo_light.png'), 8, 8, lambda x, y: (255, 244, 200))
    png(V('Texture', 'demo_tail.png'), 8, 8, lambda x, y: (200, 20, 20))
    png(V('Texture', 'demo_bumper.png'), 8, 8, lambda x, y: (50, 52, 58))
    png(V('Texture', 'demo_door.png'), 32, 64, lambda x, y: (40, 62, 82) if 2 < x < 29 and 2 < y < 61 and abs(x - 15.5) > 0.8 else (30, 32, 36))
    def dest(x, y):
        # a dark roller sign with amber dots standing for the destination
        on = 6 < y < 26 and (x // 3) % 2 == 0 and (x * 7 + y * 3) % 5 < 4 and 6 < x < 120
        return (255, 170, 40) if on else (20, 20, 24)
    png(V('Texture', 'demo_dest.png'), 128, 32, dest)
    png(V('Texture', 'demo_glass.png'), 8, 8, lambda x, y: (140, 180, 200, 60), alpha=True)

# -------------------------------------------------------------------------- body

def thin(m, x0, y0, z0, x1, y1, z1, mat, scale=0.25):
    m.box(x0, y0, z0, x1, y1, z1, mat, scale)


def body_mesh(key, L, W, H, pax_rows, axles=(), levels=1):
    m = Mesh()
    paint = m.material(f'demo_paint_{key}.png')
    inside = m.material('demo_inside.png')
    floor = m.material('demo_floor.png')
    seat = m.material('demo_seat.png')
    dash = m.material('demo_dash.png')
    light = m.material('demo_light.png', emissive=(0.6, 0.58, 0.45))
    tail = m.material('demo_tail.png', emissive=(0.5, 0.05, 0.05))
    bump = m.material('demo_bumper.png')
    door = m.material('demo_door.png')
    destm = m.material('demo_dest.png', emissive=(0.35, 0.22, 0.05))
    t = 0.07
    fz = 0.55                      # floor height
    hw, hl = W / 2, L / 2
    sill, head = 1.10, 2.25        # window band
    top = 2.35 if levels == 2 else H   # the lower deck's ceiling
    # floor and roof
    thin(m, -hw, fz - t, -hl, hw, fz, hl, floor)
    thin(m, -hw, top - t, -hl, hw, top, hl, paint)
    # underbody skirt, open at the wheels
    cuts = sorted(axles)
    start = -hl
    for a in cuts:
        thin(m, -hw, 0.32, start, hw, fz - t, a - 0.7, paint)
        start = a + 0.7
    thin(m, -hw, 0.32, start, hw, fz - t, hl, paint)
    # wheel arches inside the cabin (the tyre tops rise above the floor)
    for a in cuts:
        for side in (-1, 1):
            xa, xb = (side * (hw - 0.55), side * (hw - t)) if side > 0 else (side * (hw - t), side * (hw - 0.55))
            thin(m, xa, fz, a - 0.62, xb, 1.12, a + 0.62, inside)
    # side walls: a strip below the windows, one above, pillars between
    pillars = [-hl + 0.1 + i * ((L - 0.4) / (pax_rows + 1)) for i in range(pax_rows + 2)]
    for side in (-1, 1):
        x0, x1 = (side * (hw - t), side * hw) if side > 0 else (side * hw, side * (hw - t))
        thin(m, x0, fz, -hl, x1, sill, hl, paint)
        thin(m, x0, head, -hl, x1, top, hl, paint)
        for pz in pillars:
            thin(m, x0, sill, pz - 0.05, x1, head, pz + 0.05, paint)
    # rear wall (solid) and front wall (a windscreen opening)
    thin(m, -hw, fz, -hl, hw, top, -hl + t, paint)
    thin(m, -hw, fz, hl - t, hw, sill - 0.05, hl, paint)
    thin(m, -hw, head + 0.1, hl - t, hw, top, hl, paint)
    for px in (-hw, -hw / 3, hw / 3, hw - 0.06):
        thin(m, px, sill - 0.05, hl - t, px + 0.06, head + 0.1, hl, paint)
    # the driver's place: seat, dashboard, steering wheel column
    dz = hl - 1.25
    thin(m, -hw + 0.25, fz, dz - 0.55, -hw + 0.85, fz + 0.45, dz - 0.05, seat)
    thin(m, -hw + 0.25, fz + 0.45, dz - 0.6, -hw + 0.85, fz + 1.15, dz - 0.5, seat)
    thin(m, -hw + 0.05, fz, hl - 0.75, hw - 0.1, fz + 0.9, hl - t, dash)
    thin(m, -hw + 0.1, fz + 0.9, hl - 0.65, hw - 0.1, fz + 1.0, hl - t, dash)
    # passenger seats: two and two with an aisle
    z = -hl + 0.7
    for _ in range(pax_rows):
        for x in (-hw + 0.1, hw - 0.5, -hw + 0.55, hw - 0.95):
            thin(m, x, fz, z, x + 0.4, fz + 0.45, z + 0.45, seat)
            thin(m, x, fz + 0.45, z - 0.06, x + 0.4, fz + 1.0, z + 0.02, seat)
        z += (L - 2.8) / max(pax_rows, 1)
    if levels == 2:
        # the upper deck: floor over the saloon (not over the cab), belt, windows, roof, seats
        uf, usill, uhead = top, 2.95, 3.95
        zc = hl - 2.3
        thin(m, -hw, uf, -hl, hw, uf + t, zc, floor)
        thin(m, -hw, H - t, -hl, hw, H, hl - 0.4, paint)
        up = [-hl + 0.1 + i * ((L - 2.9) / (pax_rows + 1)) for i in range(pax_rows + 2)]
        for side in (-1, 1):
            x0, x1 = (side * (hw - t), side * hw) if side > 0 else (side * hw, side * (hw - t))
            thin(m, x0, uf, -hl, x1, usill, zc + 0.1, paint)
            thin(m, x0, uhead, -hl, x1, H, zc + 0.1, paint)
            for pz in up:
                thin(m, x0, usill, pz - 0.05, x1, uhead, pz + 0.05, paint)
        thin(m, -hw, uf, -hl, hw, H, -hl + t, paint)
        thin(m, -hw, uf, zc, hw, H, zc + 0.1, paint)
        z = -hl + 0.7
        for _ in range(pax_rows):
            for x in (-hw + 0.1, hw - 0.5, -hw + 0.55, hw - 0.95):
                thin(m, x, uf + t, z, x + 0.4, uf + t + 0.45, z + 0.45, seat)
                thin(m, x, uf + t + 0.45, z - 0.06, x + 0.4, uf + t + 1.0, z + 0.02, seat)
            z += (L - 3.6) / max(pax_rows, 1)
    # outside details: lights, bumpers, mirrors, destination sign, doors
    for sx in (-1, 1):
        thin(m, sx * (hw - 0.55) - 0.16, 0.62, hl, sx * (hw - 0.55) + 0.16, 0.8, hl + 0.04, light)
        thin(m, sx * (hw - 0.3) - 0.1, 0.62, -hl - 0.04, sx * (hw - 0.3) + 0.1, 0.95, -hl, tail)
        # mirror arm and mirror
        mx0, mx1 = (hw, hw + 0.32) if sx > 0 else (-hw - 0.32, -hw)
        thin(m, mx0, 1.65, hl - 0.55, mx1, 1.7, hl - 0.5, bump)
        a, b = (hw + 0.3, hw + 0.36) if sx > 0 else (-hw - 0.36, -hw - 0.3)
        thin(m, a, 1.35, hl - 0.6, b, 1.95, hl - 0.4, bump)
    thin(m, -hw, 0.32, hl, hw, 0.6, hl + 0.14, bump)
    thin(m, -hw, 0.32, -hl - 0.12, hw, 0.6, -hl, bump)
    thin(m, -hw + 0.2, head + 0.12, hl, hw - 0.2, head + 0.12 + 0.28, hl + 0.03, destm)
    # doors on the right: front and middle, a dark glazed leaf over the wall
    for dz0 in (hl - 1.65, -0.5):
        thin(m, hw, fz + 0.05, dz0, hw + 0.03, head - 0.05, dz0 + 1.0, door)
    return m


def wheel_mesh(hub_x, radius, hub_z, width, side):
    """A wheel at its place in the vehicle (mesh frame). `side` -1 left / +1 right."""
    m = Mesh()
    tyre = m.material('demo_tyre.png'); rim = m.material('demo_rim.png')
    x0, x1 = (hub_x - width / 2, hub_x + width / 2)
    m.cylinder_x(hub_x, radius, hub_z, radius, x0, x1, tyre, segments=24, caps=True, cap_mat=rim)
    return m

# -------------------------------------------------------------------------- the files

MODEL_CFG = """[mesh]
body.o3d
[viewpoint]
0
{wheels}"""


def bus_files(key):
    name, L, W, H, body, stripe, mass, kw = VARIANTS[key]
    textures(key, body, stripe)
    rows = {'city': 5, 'mini': 3, 'long': 6, 'double': 4}[key]
    hl = L / 2
    front, rear = hl - 1.55, -(hl - 2.4)          # axle positions (forward)
    body_mesh(key, L, W, H, rows, axles=(front, rear), levels=2 if key == 'double' else 1).save(V('Model', key, 'body.o3d'))
    r = 0.5
    wheels = []
    hubs = {}
    for ax, long_ in enumerate((front, rear)):
        for si, side in enumerate(('L', 'R')):
            sgn = -1 if side == 'L' else 1
            hx = sgn * (W / 2 - 0.12)
            wheel_mesh(hx, r, long_, 0.3, sgn).save(V('Model', key, f'wheel_{ax}_{side}.o3d'))
            hubs[(ax, side)] = (hx, long_)
            block = f"[mesh]\nwheel_{ax}_{side}.o3d\n[viewpoint]\n0\n[newanim]\norigin_trans\n{hx:.3f}\n{long_:.3f}\n{r:.3f}\nanim_rot\nWheel_Rotation_{ax}_{side}\n57.295779513\n"
            if ax == 0:
                block += f"[newanim]\norigin_trans\n{hx:.3f}\n{long_:.3f}\n{r:.3f}\norigin_rot_y\n90\nanim_rot\nAxle_Steering_{ax}_{side}\n57.295779513\n"
            wheels.append(block)
    write_text(V('Model', key, 'model.cfg'), MODEL_CFG.format(wheels="".join(wheels)), crlf=True)
    inv_turn = math.tan(math.radians(33)) / (front - (rear * 0.0 + (-0.0)) + 0.0) if False else 0.12
    bus = f"""{name}

[type]
0
[friendlyname]
openOMSI
{name}
Standard
[model]
Model\\{key}\\model.cfg
[varnamelist]
1
Script\\drive_varlist.txt
[stringvarnamelist]
0
[script]
1
Script\\drive.osc
[constfile]
1
Script\\drive_constfile_{key}.txt

[add_camera_driver]
{-W / 2 + 0.55:.2f}
{hl - 1.9:.2f}
1.95
-0.06
48
0
-4
Driver, ahead (standard)
[add_camera_driver]
{-W / 2 + 0.55:.2f}
{hl - 1.9:.2f}
1.95
-0.06
48
-70
-4
Driver, left mirror side
[add_camera_driver]
{-W / 2 + 0.55:.2f}
{hl - 1.9:.2f}
1.95
-0.06
48
70
-4
Driver, right side
[add_camera_pax]
{W / 2 - 0.7:.2f}
{-hl + 3.5:.2f}
1.7
-0.06
60
0
0
Passenger seat

[set_camera_std]
0
[set_camera_outside_center]
0
0
1.4

[mass]
{mass}
[momentofintertia]
{mass * 30:.0f}
{mass * 8:.0f}
{mass * 30:.0f}
[boundingbox]
{W:.2f}
{L:.2f}
{H:.2f}
0
0
{H / 2:.2f}
[schwerpunkt]
1.0
[rollwiderstand]
900
[rot_pnt_long]
{rear:.3f}
[inv_min_turnradius]
{math.tan(math.radians(32)) / (front - rear):.3f}
[ai_deltaheight]
-0.1

[newachse]
achse_long
{front:.3f}
achse_maxwidth
{W - 0.1:.2f}
achse_minwidth
{W - 0.5:.2f}
achse_raddurchmesser
1.0
1.0
achse_feder
220
achse_maxforce
{mass * 5.5:.0f}
achse_daempfer
24
achse_antrieb
0
[newachse]
achse_long
{rear:.3f}
achse_maxwidth
{W - 0.1:.2f}
achse_minwidth
{W - 0.5:.2f}
achse_raddurchmesser
1.0
1.0
achse_feder
260
achse_maxforce
{mass * 7:.0f}
achse_daempfer
24
achse_antrieb
1
"""
    write_text(V(f'demo_{key}.bus'), bus)
    # per-variant drive constants
    write_text(V('Script', f'drive_constfile_{key}.txt'), f"[const]\nmax_torque\n{mass * 1300:.0f}\n[const]\npower_w\n{kw * 1000:.0f}\n")


def scripts():
    write_text(V('Script', 'drive_varlist.txt'), "parking_brake\ngear\nw_wheel\ndrive_cmd\n")
    # constants are defined per bus by `bus_files` (appended below); the script reads them
    write_text(V('Script', 'drive.osc'), """'Drive and brake of the openOMSI public pack's buses (original work).
'Automatic gearbox: the driven wheels get the engine's power curve, limited by a maximum
'torque; R selects reverse, D drive. The service brake is the Brake pedal, the parking brake
'a switch.

{init}
	1 (S.L.gear)
	0 (S.L.parking_brake)
{end}

{trigger:parking_brake_toggle}
	(L.L.parking_brake) ! (S.L.parking_brake)
{end}

{trigger:automatic_D}
	1 (S.L.gear)
{end}

{trigger:automatic_R}
	-1 (S.L.gear)
{end}

{trigger:automatic_N}
	0 (S.L.gear)
{end}

{frame}
	' wheel speed in rad/s, at least 1 so that the power curve does not divide by zero
	(L.L.n_Wheel) abs 0.10472 * 1 max (S.L.w_wheel)

	' torque at the driven wheels: min(maximum, power / speed) * throttle * gear
	(C.L.power_w) (L.L.w_wheel) /
	(C.L.max_torque) min
	(L.L.Throttle) *
	(L.L.gear) *
	(L.L.parking_brake) ! *
	(S.L.M_Wheel)

	' brakes: pedal, and the parking brake (the whole vehicle, in N)
	(L.L.Brake) 62000 *
	(L.L.parking_brake) 45000 * +
	(S.L.Brakeforce)
{end}
""")


def main():
    scripts()
    for key in VARIANTS:
        bus_files(key)
        # the constfile named by the .bus is shared: write the one of this variant under the name
    print('buses written to', V())


if __name__ == '__main__':
    main()
