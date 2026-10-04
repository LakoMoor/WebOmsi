#!/usr/bin/env python3
"""Trims your own copy of OMSI 2 to one map and a few buses, for private use in WebOmsi.

    OMSI2="/path/to/OMSI 2" tools/pack/make_pack.py Grundorf Vehicles/MB_O305/O305_E2H_84.bus ...

It follows the files a map and the buses name (objects, splines, models, textures) and copies just
those, with the engine's base folders (fonts, textures, humans, sounds...), into ./pack, then writes
./web/pack.zip. OMSI 2's files are not ours to publish: both outputs are in .gitignore. Open the page
with ?config=config-omsi.json and choose the zip once.
"""
import os, re, shutil, sys, zipfile

R = os.environ.get('OMSI2')
if not R or len(sys.argv) < 3:
    sys.exit(__doc__)
MAP, BUSES = sys.argv[1], sys.argv[2:]
OUT = os.environ.get('PACK_OUT', 'pack')
SKIP = ('SDK', 'docs', 'Tutorials', 'TicketPacks', 'Addons')

idx = {}   # lower-case relative path -> real relative path
for d, _, fs in os.walk(R):
    rel = os.path.relpath(d, R)
    if rel.split(os.sep)[0] in SKIP:
        continue
    for f in fs:
        p = os.path.join(rel, f).replace('\\', '/').lstrip('./')
        idx[p.lower()] = p

tok = re.compile(rb'[A-Za-z0-9_ ./\\()+-]+\.(?:sco|sli|o3d|x|bmp|dds|tga|jpg|jpeg|png|cfg|cti|map|rdy|wav|ogg|scr|osc|ovh|bus|lst|txt|ini|hum|fnt|tex|opl|oft)', re.I)


# every file by its bare name, to find what a file names without a folder (a texture of a
# bus is often written as `Texture\\x.tga`, a sound as `sound\\y.wav`, from the bus's folder)
byname = {}
for p_ in idx.values():
    byname.setdefault(os.path.basename(p_).lower(), []).append(p_)


def home(p):
    """The folder an add-on keeps its things in: Vehicles/<Name>, Sceneryobjects/<Name>, Splines/<Name>."""
    parts = p.split('/')
    return '/'.join(parts[:2]) if len(parts) > 2 and parts[0].lower() in ('vehicles', 'sceneryobjects', 'splines', 'maps') else ''


def find(ref, bases):
    ref = ref.decode('latin1').replace('\\', '/').strip().lstrip('/')
    for b in bases + ['']:
        k = os.path.normpath((b + '/' + ref).lower().lstrip('/')).replace('\\', '/')
        if k in idx:
            return idx[k]


def closure(seeds):
    seen, todo = set(), list(seeds)
    while todo:
        p = todo.pop()
        if p in seen or p not in idx.values():
            continue
        seen.add(p)
        if p.lower().rsplit('.', 1)[-1] in ('sco', 'o3d', 'sli', 'cfg', 'bus', 'osc', 'ovh', 'scr', 'map'):
            try:
                data = open(os.path.join(R, p), 'rb').read()
            except OSError:
                continue
            d = os.path.dirname(p)
            h = home(p)
            for m in tok.finditer(data):
                name = m.group(0)
                r = find(name, [d, d + '/model', d + '/texture', os.path.dirname(d) + '/texture'] + ([h, h + '/texture', h + '/sound', h + '/model'] if h else []) + ['Texture', 'Sounds'])
                if r:
                    if r not in seen:
                        todo.append(r)
                elif h:
                    # not where it is said to be: the same name anywhere in the add-on's own folder
                    base = os.path.basename(name.decode('latin1').replace('\\', '/').strip()).lower()
                    for c in byname.get(base, []):
                        if c.startswith(h + '/') and c not in seen:
                            todo.append(c)
    return seen


# what the map names: scenery objects and splines, read out of its tile files
mapdir = f'maps/{MAP}/'
refs = set()
for p in idx.values():
    if p.lower().startswith(mapdir.lower()) and p.lower().endswith('.map'):
        raw = open(os.path.join(R, p), 'rb').read()
        for m in re.finditer(rb'(?:Sceneryobjects|Splines)[\\/][A-Za-z0-9_ .\\/()-]+\.(?:sco|sli)', raw.decode('utf-16-le', 'ignore').encode('latin1', 'ignore'), re.I):
            refs.add(m.group(0))
seeds = [r for r in (find(x, ['']) for x in refs) if r and not r.lower().startswith('vehicles/')]
seeds += [p for p in idx.values() if p.lower().startswith(mapdir.lower())] + list(BUSES)
files = {f for f in closure(seeds) if not (f.lower().startswith('vehicles/') and not any(f.startswith(os.path.dirname(b) + '/') for b in BUSES))}
for b in BUSES:   # small text files beside the buses (depot files, descriptions)
    d = os.path.dirname(b)
    for f in os.listdir(os.path.join(R, d)):
        p = f'{d}/{f}'
        if os.path.isfile(os.path.join(R, p)) and os.path.getsize(os.path.join(R, p)) < 400_000 and f.lower().rsplit('.', 1)[-1] in ('hof', 'dsc', 'cfg', 'txt', 'bus'):
            files.add(p)
for d in ['Fonts', 'Texture', 'Humans', 'Sounds', 'GUI', 'Inputs', 'Languages', 'Scripts', 'Weather', 'Money', 'Drivers', 'program', 'helper', 'template', 'Situations']:
    for dp, _, fs in os.walk(os.path.join(R, d)):
        for f in fs:
            files.add(os.path.relpath(os.path.join(dp, f), R))
files = {f for f in files if os.path.exists(os.path.join(R, f))}
shutil.rmtree(OUT, ignore_errors=True)
for f in files:
    t = os.path.join(OUT, f)
    os.makedirs(os.path.dirname(t), exist_ok=True)
    shutil.copy2(os.path.join(R, f), t)
for d in ['Vehicles', 'Sceneryobjects', 'Splines']:
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
open(os.path.join(OUT, 'maps', MAP, 'ailists.cfg'), 'w').write('')   # no AI traffic
os.makedirs('web', exist_ok=True)
with zipfile.ZipFile('web/pack.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dp, _, fs in os.walk(OUT):
        for f in sorted(fs):
            p = os.path.join(dp, f)
            z.write(p, os.path.relpath(p, OUT))
print(len(files), 'files ->', OUT, 'and web/pack.zip', round(os.path.getsize('web/pack.zip') / 1e6), 'MB')
