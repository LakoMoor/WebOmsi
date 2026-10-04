#!/usr/bin/env python3
"""Writes manifest.json into a folder of game files, so that the page can download it file by file
with a progress bar:   tools/pack/make_manifest.py web/pack-omsi

The page needs the manifest to know what to fetch (and how big it is, for the bar). Run it again
whenever the folder changes."""
import hashlib, json, os, sys

root = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
files = []
for dp, _, fs in os.walk(root):
    for f in sorted(fs):
        if f in ('manifest.json', '.DS_Store'):
            continue
        p = os.path.join(dp, f)
        files.append([os.path.relpath(p, root).replace(os.sep, '/'), os.path.getsize(p)])
files.sort()
ident = hashlib.sha1(json.dumps(files).encode()).hexdigest()[:12]
json.dump({'id': ident, 'files': files}, open(os.path.join(root, 'manifest.json'), 'w'), separators=(',', ':'))
print(len(files), 'files,', round(sum(s for _, s in files) / 1e6), 'MB ->', os.path.join(root, 'manifest.json'), '(id', ident + ')')
