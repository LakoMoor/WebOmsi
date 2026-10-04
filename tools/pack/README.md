# Your own OMSI 2 pack (private use)

`make_pack.py` trims your copy of OMSI 2 to one map and a few buses:

```sh
OMSI2="/path/to/OMSI 2" tools/pack/make_pack.py Grundorf Vehicles/MB_O305/O305_E2H_84.bus
```

It writes `pack/` and `web/pack.zip`. Both are in `.gitignore`: OMSI 2's files must never be published. Add
`web/pack.zip` on the start screen of the page (**Your own files**); the browser keeps it in its own storage.
See [docs/webomsi/own-content.md](../../docs/webomsi/own-content.md).

Some textures a map names exist nowhere in OMSI 2 itself; those objects are drawn white. That is the original's doing.
