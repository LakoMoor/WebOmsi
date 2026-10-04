"""Building blocks for the public pack: everything here is original content made by code
(procedural textures, primitive meshes, text files in OMSI's formats). Nothing is taken from
OMSI 2 or from any other game."""
import math, os, random, struct, zlib

# ---------------------------------------------------------------------------- files

def write_text(path, text, utf16=False, crlf=True):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if crlf:
        text = text.replace('\r\n', '\n').replace('\n', '\r\n')
    with open(path, 'wb') as f:
        f.write(b'\xff\xfe' + text.encode('utf-16-le') if utf16 else text.encode('utf-8'))


def write_bytes(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)

# ---------------------------------------------------------------------------- images

def png(path, w, h, pixel, alpha=False):
    """`pixel(x, y)` -> (r, g, b[, a]) with 0..255 values."""
    n = 4 if alpha else 3
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            p = pixel(x, y)
            raw.extend(int(max(0, min(255, v))) for v in p[:n])
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6 if alpha else 2, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    write_bytes(path, data)


def bmp24(path, w, h, pixel):
    """A 24-bit Windows bitmap (what OMSI's light maps are)."""
    row = (w * 3 + 3) & ~3
    out = bytearray()
    for y in range(h - 1, -1, -1):
        line = bytearray()
        for x in range(w):
            r, g, b = pixel(x, y)[:3]
            line += bytes((int(b), int(g), int(r)))
        line += b'\0' * (row - len(line))
        out += line
    head = b'BM' + struct.pack('<IHHI', 54 + len(out), 0, 0, 54) + struct.pack('<IiiHHIIiiII', 40, w, h, 1, 24, 0, len(out), 2835, 2835, 0, 0)
    write_bytes(path, head + bytes(out))


def tga32(path, w, h, pixel):
    """An uncompressed 32-bit Targa with alpha."""
    out = bytearray(struct.pack('<BBBHHBHHHHBB', 0, 0, 2, 0, 0, 0, 0, 0, w, h, 32, 0x28))
    for y in range(h):
        for x in range(w):
            r, g, b, a = (list(pixel(x, y)) + [255])[:4]
            out += bytes((int(b), int(g), int(r), int(a)))
    write_bytes(path, bytes(out))


class Noise:
    """Smooth value noise, tileable with period `n`."""
    def __init__(self, n, seed):
        r = random.Random(seed)
        self.n = n
        self.g = [[r.random() for _ in range(n)] for _ in range(n)]

    def at(self, x, y):
        n = self.n
        x0, y0 = int(math.floor(x)), int(math.floor(y))
        fx, fy = x - x0, y - y0
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a = self.g[y0 % n][x0 % n]; b = self.g[y0 % n][(x0 + 1) % n]
        c = self.g[(y0 + 1) % n][x0 % n]; d = self.g[(y0 + 1) % n][(x0 + 1) % n]
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(noises, x, y):
    s, amp, tot = 0.0, 1.0, 0.0
    for i, nz in enumerate(noises):
        f = 2 ** i
        s += amp * nz.at(x * f, y * f)
        tot += amp
        amp *= 0.5
    return s / tot

# ---------------------------------------------------------------------------- o3d meshes

class Mesh:
    """A triangle mesh in OMSI's mesh frame: x right, y up, z forward."""

    def __init__(self):
        self.v = []      # (x, y, z, nx, ny, nz, u, v)
        self.t = []      # (a, b, c, material)
        self.m = []      # (name, diffuse rgba, specular rgb, emissive rgb, power)

    def material(self, texture, diffuse=(1, 1, 1, 1), specular=(0, 0, 0), emissive=(0, 0, 0), power=0.0):
        key = (texture, diffuse, specular, emissive, power)
        if key not in self.m:
            self.m.append(key)
        return self.m.index(key)

    def quad(self, p0, p1, p2, p3, mat, uv=((0, 1), (1, 1), (1, 0), (0, 0)), flip=False):
        """Four corners in order around the quad, seen from the front."""
        e1 = [p1[i] - p0[i] for i in range(3)]
        e2 = [p3[i] - p0[i] for i in range(3)]
        n = (e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0])
        ln = math.sqrt(sum(c * c for c in n)) or 1.0
        n = tuple(c / ln for c in n)
        if flip:
            n = tuple(-c for c in n)
        base = len(self.v)
        for p, (u, v) in zip((p0, p1, p2, p3), uv):
            self.v.append((p[0], p[1], p[2], n[0], n[1], n[2], u, v))
        # Direct3D draws clockwise triangles seen from the front
        if flip:
            self.t += [(base, base + 1, base + 2, mat), (base, base + 2, base + 3, mat)]
        else:
            self.t += [(base, base + 2, base + 1, mat), (base, base + 3, base + 2, mat)]

    def box(self, x0, y0, z0, x1, y1, z1, mat, scale=1.0, faces='nsewtb'):
        """Axis-aligned box. Faces: n(+z) s(-z) e(+x) w(-x) t(+y) b(-y). UVs in metres * scale."""
        dx, dy, dz = (x1 - x0) * scale, (y1 - y0) * scale, (z1 - z0) * scale
        if 'n' in faces: self.quad((x1, y0, z1), (x0, y0, z1), (x0, y1, z1), (x1, y1, z1), mat, ((0, dy), (dx, dy), (dx, 0), (0, 0)))
        if 's' in faces: self.quad((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), mat, ((0, dy), (dx, dy), (dx, 0), (0, 0)))
        if 'e' in faces: self.quad((x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0), mat, ((0, dy), (dz, dy), (dz, 0), (0, 0)))
        if 'w' in faces: self.quad((x0, y0, z1), (x0, y0, z0), (x0, y1, z0), (x0, y1, z1), mat, ((0, dy), (dz, dy), (dz, 0), (0, 0)))
        if 't' in faces: self.quad((x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1), mat, ((0, 0), (dx, 0), (dx, dz), (0, dz)))
        if 'b' in faces: self.quad((x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0), mat, ((0, 0), (dx, 0), (dx, dz), (0, dz)))

    def cylinder_x(self, cx, cy, cz, radius, x0, x1, mat, segments=20, caps=True, cap_mat=None):
        """A cylinder around the x axis (a wheel), from x0 to x1."""
        cap_mat = mat if cap_mat is None else cap_mat
        ring = [(math.cos(2 * math.pi * i / segments), math.sin(2 * math.pi * i / segments)) for i in range(segments + 1)]
        for i in range(segments):
            (c0, s0), (c1, s1) = ring[i], ring[i + 1]
            p = lambda x, c, s: (x, cy + radius * s, cz + radius * c)
            u0, u1 = i / segments * 3.0, (i + 1) / segments * 3.0
            self.quad(p(x0, c0, s0), p(x1, c0, s0), p(x1, c1, s1), p(x0, c1, s1), mat, ((u0, 0), (u0, 1), (u1, 1), (u1, 0)), flip=True)
        if caps:
            for x, flip in ((x1, False), (x0, True)):
                base = len(self.v)
                nx = 1.0 if x == x1 else -1.0
                self.v.append((x, cy, cz, nx, 0, 0, 0.5, 0.5))
                for c, s in ring:
                    self.v.append((x, cy + radius * s, cz + radius * c, nx, 0, 0, 0.5 + 0.5 * c, 0.5 - 0.5 * s))
                for i in range(segments):
                    a, b = base + 1 + i, base + 2 + i
                    self.t.append((base, a, b, cap_mat) if flip else (base, b, a, cap_mat))

    def save(self, path):
        out = bytearray(b'\x84\x19')
        out += bytes((3, 0))  # version 3, 16-bit indices
        out += b'\x17' + struct.pack('<I', len(self.v))
        for v in self.v:
            out += struct.pack('<8f', *v)
        out += b'\x49' + struct.pack('<I', len(self.t))
        for a, b, c, m in self.t:
            out += struct.pack('<HHHH', a, b, c, m)
        out += b'\x26' + struct.pack('<H', len(self.m))
        for name, dif, spec, emi, power in self.m:
            out += struct.pack('<11f', *dif, *spec, *emi, power)
            nb = name.encode('latin-1')
            out += bytes((len(nb),)) + nb
        out += b'\x79' + struct.pack('<16f', 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
        assert len(self.v) < 65536
        write_bytes(path, bytes(out))
