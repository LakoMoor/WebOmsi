# Your own OMSI 2 pack (private use)

`make_pack.py` trims your copy of OMSI 2 to one map and a few buses:

```sh
OMSI2="/path/to/OMSI 2" tools/pack/make_pack.py Grundorf Vehicles/MB_O305/O305_E2H_84.bus
```

It writes `pack/` and `web/pack.zip`. Both are in `.gitignore`: OMSI 2's files must never be published. Copy
`web/config-omsi.json`, name your map and buses in it, open the page with `?config=config-omsi.json` and choose the zip
once; the browser keeps it in its own storage.

Some textures a map names exist nowhere in OMSI 2 itself; those objects are drawn white. That is the original's doing.
