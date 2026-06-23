# Offline MBTiles Generation

Wayfinder accepts sideloaded raster `.mbtiles` packages through Settings. Do not
download or redistribute raster tiles from `tile.openstreetmap.org` or other
volunteer-run tile servers. Generate offline packages from licensed source data.

## Sindh / Jacobabad Test Package

Source data:

- Geofabrik Pakistan extract:
  `https://download.geofabrik.de/asia/pakistan-latest.osm.pbf`
- License: OpenStreetMap data under ODbL.
- Required attribution metadata: `© OpenStreetMap contributors`

Local tools used:

```powershell
python -m pip install osmium pillow
```

Download source extract:

```powershell
New-Item -ItemType Directory -Force -Path 'C:\tmp\wayfinder_tiles'
Invoke-WebRequest `
  -Uri 'https://download.geofabrik.de/asia/pakistan-latest.osm.pbf' `
  -OutFile 'C:\tmp\wayfinder_tiles\pakistan-latest.osm.pbf'
```

Render raster MBTiles:

```powershell
python scripts\generate_sindh_osm_mbtiles.py `
  --source C:\tmp\wayfinder_tiles\pakistan-latest.osm.pbf `
  --output C:\tmp\wayfinder_tiles\wayfinder-sindh-jacobabad-osm-z5-z14.mbtiles `
  --bbox 66.5,23.5,71.5,28.5 `
  --minzoom 5 `
  --maxzoom 14
```

Output from the 2026-06-23 test run:

- File: `C:\tmp\wayfinder_tiles\wayfinder-sindh-jacobabad-osm-z5-z14.mbtiles`
- Copy for sideload: `C:\Users\VICTUS\Downloads\wayfinder-sindh-jacobabad-osm-z5-z14.mbtiles`
- Size: `155,660,288` bytes
- Tiles: `78,146`
- Zooms: `5-14`
- Bounds: `66.5,23.5,71.5,28.5`
- Center: `68.4514,28.2769,11`
- SHA-256: `be0cbcdc62a73cb385387460afee59be58565c17996f6419ed16e4417b3d45f3`
- MBTiles metadata attribution: `© OpenStreetMap contributors`

For another deployment region, use the matching Geofabrik `.osm.pbf` extract
and replace `--bbox` with `west,south,east,north` bounds for that area.
