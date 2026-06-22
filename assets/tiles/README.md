# Demo MBTiles

`demo_jacobabad.mbtiles` is a schematic raster tile package covering a larger **Jacobabad / northern Sindh, Pakistan** test area (regional zoom 7-12 plus local Jacobabad zoom 13 detail) for physical-device field testing.

It is generated locally by `python scripts/generate_jacobabad_mbtiles.py` and does **not** download or redistribute tiles from `tile.openstreetmap.org` or other volunteer-run raster tile servers.

- Current APK fallback uses `android/app/src/main/assets/tiles/demo_jacobabad.mbtiles`.
- This bundled package is for app behavior testing only: tile rendering, GPS, pins, routes, and exports.
- It is not navigation-grade mapping.
- Real deployments should use licensed or internally produced MBTiles imported through Settings.
