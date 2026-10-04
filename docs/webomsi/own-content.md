# Playing WebOmsi with your own files

WebOmsi starts with a small built-in game (the village "Demo" and four buses). You can add **your own zip files**
on the start screen: maps, buses, scenery, whole OMSI folders. They are read by your browser and kept in its own
storage; nothing is uploaded anywhere.

> Use only content you have the right to use. OMSI 2's own files and most mods are not meant to be passed on;
> that is why they are not part of this site and why your zips stay on your device.

## 1. Add a zip

1. Open the start screen and expand **Your own files**.
2. Drop the zip files **or a folder** onto the box (or tap it and choose them; *Choose a folder* picks a whole folder, for example an unpacked mod). Several at once are fine. A folder is put together into one archive in the browser, with a progress bar.
3. The page reads each zip and tells you what it found (`2 maps · 3 buses`). The maps appear in the **Map** list, the
   buses among the bus cards (marked *your files*).
4. Choose a map and a bus and press **Play**.

The zips are saved in the browser: next time they are listed already. The red **×** removes one. *Clear saved files*
at the bottom removes everything.

## 2. What a zip may contain

The game treats all your zips (and the built-in game) as **one folder**, as OMSI does with its installation. So a zip
can hold any of the usual folders:

| Folder | What for |
|---|---|
| `maps/<Name>/` with `global.cfg` and the `tile_*.map` files | a map |
| `Vehicles/<Name>/` with a `.bus` file | a bus |
| `Sceneryobjects/`, `Splines/`, `Texture/` | what the maps use |
| `Fonts/`, `Humans/`, `Sounds/`, `Weather/`, `Drivers/`, `Money/` | the rest of the base game |

A mod **as you downloaded it** works unchanged, also when everything sits in a wrapper folder such as
`OMSI 2/Vehicles/...` (the game finds the folder with `Vehicles` and `maps` by itself).

### Everything a map or bus uses must be there

* A map zip needs the scenery it places: its `Sceneryobjects`, `Splines` and `Texture` folders. If your map came without
  them, put them in another zip and add that too.
* A bus that uses files of another add-on (scripts, textures, sounds: the `.bus` file shows paths like
  `..\OtherBus\script\...`) needs that add-on's folder in a zip as well.

## 3. Make a small zip from your own OMSI 2 (on a computer)

OMSI 2 is some 8 GB; a browser cannot take that. `tools/pack/make_pack.py` cuts out one map and the buses you name,
with everything they use:

```sh
# you need Python 3 and this repository
OMSI2="/path/to/OMSI 2" tools/pack/make_pack.py Grundorf Vehicles/MB_O305/O305_E2H_84.bus Vehicles/MAN_SD202/MAN_D86.bus
```

* the first argument is the map's folder name in `maps/`, the others are `.bus` files relative to your OMSI 2 folder;
* it writes `pack/` and **`web/pack.zip`** (some hundred MB); add `web/pack.zip` on the start screen.

You can also zip folders by hand: select the `maps`, `Vehicles`, `Sceneryobjects`... folders you need (not the folder
above them) and compress them. A zip that is only one bus mod works too.

## 4. Size and speed

The browser keeps the files in memory while you play: stay **under about 1 GB** in total, and prefer trimmed zips.
The first start with big files takes a while (they are read and indexed); starts after that are quicker because the
zips are already in the browser's storage. On a phone use small zips and the *Light* graphics preset.

## 5. If something does not work

Open the browser console (**F12**) and look at the red lines.

| You see | It means |
|---|---|
| A building or a part of a bus is **white** | a texture is missing from your zips |
| The bus **does not move** | its scripts are missing (often from another add-on), see above |
| `no [model]`, `cannot load` | the `.bus` file points to a model file that is not in the zips |
| the page lists nothing for a zip | the zip has no `maps/*/global.cfg` and no `Vehicles/*/*.bus` |
| the tab runs out of memory | the zips are too big: trim them |

## 6. For site owners

A site can ship its own base content instead of the demo: set `packUrl`, `map` and `buses` in `web/config.json`
(see `web/config-omsi.json` for an example). Visitors' own zips are added on top of it. Only publish content that you
have the right to publish.
