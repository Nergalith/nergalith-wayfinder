#!/usr/bin/env python3
"""Generate a small raster MBTiles demo package around Bangui, CAR (OpenStreetMap tiles)."""

from __future__ import annotations

import math
import sqlite3
import time
import urllib.error
import urllib.request
from pathlib import Path

# Bangui, Central African Republic
CENTER_LAT = 4.3947
CENTER_LON = 18.5582
ZOOM_LEVELS = (10, 11, 12)
TILE_SIZE = 256
USER_AGENT = "NergalithWayfinderDemoTileGen/0.1 (+offline demo; not for production redistribution)"


def deg2num(lat_deg: float, lon_deg: float, zoom: int) -> tuple[int, int]:
    lat_rad = math.radians(lat_deg)
    n = 2.0**zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile


def tile_range(center_lat: float, center_lon: float, zoom: int, radius: int = 1) -> list[tuple[int, int, int]]:
    x_center, y_center = deg2num(center_lat, center_lon, zoom)
    tiles: list[tuple[int, int, int]] = []
    for dx in range(-radius, radius + 1):
        for dy in range(-radius, radius + 1):
            tiles.append((zoom, x_center + dx, y_center + dy))
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

    metadata = {
        "name": "Nergalith Wayfinder Demo - Bangui CAR",
        "description": "Small OSM raster demo for development testing only. Replace before deployment.",
        "format": "png",
        "type": "baselayer",
        "version": "1.0.0",
        "minzoom": str(min(ZOOM_LEVELS)),
        "maxzoom": str(max(ZOOM_LEVELS)),
        "bounds": "18.40,4.30,18.70,4.50",
        "center": f"{CENTER_LON},{CENTER_LAT},12",
        "attribution": "© OpenStreetMap contributors",
        "generator": "nergalith-wayfinder/scripts/generate_demo_mbtiles.py",
        "json": '{"vector_layers":[]}',
    }
    for key, value in metadata.items():
        cursor.execute("INSERT INTO metadata (name, value) VALUES (?, ?)", (key, value))

    inserted = 0
    for zoom in ZOOM_LEVELS:
        radius = 1 if zoom <= 11 else 2
        for z, x, y_xyz in tile_range(CENTER_LAT, CENTER_LON, zoom, radius=radius):
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
        repo_root / "assets" / "tiles" / "demo_bangui.mbtiles",
        repo_root / "android" / "app" / "src" / "main" / "assets" / "tiles" / "demo_bangui.mbtiles",
    ]

    count = write_mbtiles(targets[0])
    targets[0].parent.mkdir(parents=True, exist_ok=True)
    targets[1].parent.mkdir(parents=True, exist_ok=True)
    targets[1].write_bytes(targets[0].read_bytes())

    print(f"Wrote {count} tiles to:")
    for target in targets:
        print(f"  {target} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()