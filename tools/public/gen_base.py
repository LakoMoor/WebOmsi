"""The base files every OMSI-format content folder needs (weather, sky, water, smoke):
original, generated here."""
import math, os
from lib import *

ROOT = os.environ.get('PUBLIC_PACK', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public-pack'))
ROOT = os.path.abspath(ROOT)
P = lambda *a: os.path.join(ROOT, *a)


def main():
    write_text(P('Weather', '#CAVOK.owt'), """Weather file of the openOMSI public pack
[name]
<Clear>
[description]
A clear sky, good visibility, no wind.
[end]
[fog]
50000
1
[wind]
0
0
[temp]
15
5
[press]
1013
[clouds]
-1
0
[precip]
0
32
""")
    nz = [Noise(8, 21), Noise(8, 22)]
    # a soft round puff (exhaust and brake smoke)
    tga32(P('Texture', 'rauch.tga'), 32, 32, lambda x, y: (
        lambda d: (255, 255, 255, max(0.0, 1.0 - d) ** 2 * 200))(math.hypot(x - 15.5, y - 15.5) / 16.0))
    # sky gradient (horizon pale, zenith blue)
    for i in range(1, 9):
        bmp24(P('Texture', f'himmel{i:02d}.bmp'), 64, 256, lambda x, y, i=i: (
            110 + 100 * (y / 255.0) - i, 165 + 60 * (y / 255.0), 228 + 20 * (y / 255.0)))
    bmp24(P('Texture', 'himmel01.bmp'), 64, 256, lambda x, y: (
        120 + 100 * (y / 255.0), 170 + 60 * (y / 255.0), 230 + 20 * (y / 255.0)))
    # the sphere map of reflections (sky above, ground below) and a water swatch
    def env(x, y):
        t = y / 255.0
        return (170 - 60 * t, 200 - 60 * t, 240 - 150 * t) if t < 0.5 else (90, 100, 80)
    bmp24(P('Texture', 'envmap_unscharf.bmp'), 128, 128, lambda x, y: env(x * 2, y * 2))
    bmp24(P('Texture', 'water_envmap.bmp'), 128, 128, lambda x, y: env(x * 2, y * 2))
    tga32(P('Texture', 'water.tga'), 8, 8, lambda x, y: (47, 74, 83, 192))
    # a tile's own water files live in the map's texture folder too
    tga32(P('maps', 'Demo', 'texture', 'water.tga'), 8, 8, lambda x, y: (47, 74, 83, 192))
    bmp24(P('maps', 'Demo', 'texture', 'water_envmap.bmp'), 64, 64, lambda x, y: env(x * 4, y * 4))


if __name__ == '__main__':
    main()
    print('base files written to', ROOT)
