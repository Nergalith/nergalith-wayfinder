#!/usr/bin/env python3
"""Generate a raster MBTiles package around Jacobabad, Sindh, Pakistan."""

from __future__ import annotations

import math
import sqlite3
import time
import urllib.error
import urllib.request
from pathlib import Path

# Larger Jacobabad / northern Sindh field-test area.
WEST_LON = 67.1
SOUTH_LAT = 27.1
EAST_LON = 69.8
NORTH_LAT = 29.2
CENTER_LAT = 28.2769
CENTER_LON = 68.4514
REGIONAL_ZOOMS = (7, 8, 9, 10, 11, 12)
LOCAL_DETAIL_ZOOMS = (13,)
LOCAL_DETAIL_RADIUS = 5
TILE_SIZE = 256
USER_AGENT = "NergalithWayfinderJacobabadTileGen/0.1 (+offline field-test package)"


def deg2num(lat_deg: float, lon_deg: float, zoom: int) -> tuple[int, int]:
    lat_rad = math.radians(lat_deg)
    n = 2.0**zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile


def tile_range_for_bounds(zoom: int) -> set[tuple[int, int, int]]:
    west_x, north_y = deg2num(NORTH_LAT, WEST_LON, zoom)
    east_x, south_y = deg2num(SOUTH_LAT, EAST_LON, zoom)
    tiles: set[tuple[int, int, int]] = set()
    for x in range(west_x, east_x + 1):
        for y in range(north_y, south_y + 1):
            tiles.add((zoom, x, y))
    return tiles


def tile_range_around_center(zoom: int, radius: int) -> set[tuple[int, int, int]]:
    center_x, center_y = deg2num(CENTER_LAT, CENTER_LON, zoom)
    tiles: set[tuple[int, int, int]] = set()
    for dx in range(-radius, radius + 1):
        for dy in range(-radius, radius + 1):
            tiles.add((zoom, center_x + dx, center_y + dy))
    return tiles


def fetch_tile(z: int, x: int, y: int) -> bytes | None:
    url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.read()
    except urllib.error.URLError as error:
        print(f"warn: failed {url}: {error}")
        return None


def write_mbtiles(output_path: Path) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    conn = sqlite3.connect(output_path)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE metadata (name TEXT, value TEXT)")
    cursor.execute(
        "CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)"
    )
    cursor.execute(
        "CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)"
    )

    zooms = REGIONAL_ZOOMS + LOCAL_DETAIL_ZOOMS
    metadata = {
        "name": "Nergalith Wayfinder Demo - Jacobabad Pakistan",
        "description": "OSM raster package around Jacobabad and northern Sindh for physical-device field testing.",
        "format": "png",
        "type": "baselayer",
        "version": "1.0.0",
        "minzoom": str(min(zooms)),
        "maxzoom": str(max(zooms)),
        "bounds": f"{WEST_LON},{SOUTH_LAT},{EAST_LON},{NORTH_LAT}",
        "center": f"{CENTER_LON},{CENTER_LAT},11",
        "attribution": "© OpenStreetMap contributors",
        "generator": "nergalith-wayfinder/scripts/generate_jacobabad_mbtiles.py",
        "json": '{"vector_layers":[]}',
    }
    for key, value in metadata.items():
        cursor.execute("INSERT INTO metadata (name, value) VALUES (?, ?)", (key, value))

    tiles: set[tuple[int, int, int]] = set()
    for zoom in REGIONAL_ZOOMS:
        tiles.update(tile_range_for_bounds(zoom))
    for zoom in LOCAL_DETAIL_ZOOMS:
        tiles.update(tile_range_around_center(zoom, LOCAL_DETAIL_RADIUS))

    inserted = 0
    for z, x, y_xyz in sorted(tiles):
        tile_data = fetch_tile(z, x, y_xyz)
        if not tile_data:
            continue
        tile_row = (2**z - 1) - y_xyz
        cursor.execute(
            "INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
            (z, x, tile_row, sqlite3.Binary(tile_data)),
        )
        inserted += 1
        time.sleep(0.15)

    conn.commit()
    conn.close()
    return inserted


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    targets = [
        repo_root / "assets" / "tiles" / "demo_jacobabad.mbtiles",
        repo_root / "android" / "app" / "src" / "main" / "assets" / "tiles" / "demo_jacobabad.mbtiles",
    ]

    count = write_mbtiles(targets[0])
    targets[1].parent.mkdir(parents=True, exist_ok=True)
    targets[1].write_bytes(targets[0].read_bytes())

    print(f"Wrote {count} tiles to:")
    for target in targets:
        print(f"  {target} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
