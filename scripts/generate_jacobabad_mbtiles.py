#!/usr/bin/env python3
"""Generate a policy-safe schematic raster MBTiles package for Jacobabad testing.

This intentionally does not fetch map tiles from OpenStreetMap volunteer-run
tile servers. It creates simple local raster tiles from code so the Android
demo can test offline tile rendering, panning, zooming, pins, and GPS behavior
without redistributing third-party hosted raster tiles.
"""

from __future__ import annotations

import math
import sqlite3
import struct
import zlib
from pathlib import Path

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

LAND = (225, 221, 204)
OUTSIDE = (205, 201, 185)
GRID = (174, 168, 146)
MINOR_GRID = (199, 193, 170)
ROAD = (177, 92, 50)
ROAD_CASING = (116, 69, 45)
RIVER = (64, 125, 150)
CANAL = (91, 151, 169)
URBAN = (87, 92, 86)
MARKER = (28, 82, 126)
TEXT = (43, 48, 43)


def deg2num(lat_deg: float, lon_deg: float, zoom: int) -> tuple[int, int]:
    lat_rad = math.radians(lat_deg)
    n = 2.0**zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile


def num2lon(x: float, zoom: int) -> float:
    return x / (2.0**zoom) * 360.0 - 180.0


def num2lat(y: float, zoom: int) -> float:
    n = math.pi - 2.0 * math.pi * y / (2.0**zoom)
    return math.degrees(math.atan(math.sinh(n)))


def lonlat_to_pixel(lon: float, lat: float, zoom: int, tile_x: int, tile_y: int) -> tuple[int, int]:
    n = 2.0**zoom
    x = (lon + 180.0) / 360.0 * n
    lat_rad = math.radians(lat)
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    return round((x - tile_x) * TILE_SIZE), round((y - tile_y) * TILE_SIZE)


def tile_range_for_bounds(zoom: int) -> set[tuple[int, int, int]]:
    west_x, north_y = deg2num(NORTH_LAT, WEST_LON, zoom)
    east_x, south_y = deg2num(SOUTH_LAT, EAST_LON, zoom)
    return {
        (zoom, x, y)
        for x in range(west_x, east_x + 1)
        for y in range(north_y, south_y + 1)
    }


def tile_range_around_center(zoom: int, radius: int) -> set[tuple[int, int, int]]:
    center_x, center_y = deg2num(CENTER_LAT, CENTER_LON, zoom)
    return {
        (zoom, center_x + dx, center_y + dy)
        for dx in range(-radius, radius + 1)
        for dy in range(-radius, radius + 1)
    }


def put_pixel(buf: bytearray, x: int, y: int, color: tuple[int, int, int]) -> None:
    if 0 <= x < TILE_SIZE and 0 <= y < TILE_SIZE:
        idx = (y * TILE_SIZE + x) * 3
        buf[idx : idx + 3] = bytes(color)


def draw_line(
    buf: bytearray,
    a: tuple[int, int],
    b: tuple[int, int],
    color: tuple[int, int, int],
    width: int = 1,
) -> None:
    x0, y0 = a
    x1, y1 = b
    dx = abs(x1 - x0)
    sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0)
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    radius = max(0, width // 2)
    while True:
        for ox in range(-radius, radius + 1):
            for oy in range(-radius, radius + 1):
                if ox * ox + oy * oy <= radius * radius + 1:
                    put_pixel(buf, x0 + ox, y0 + oy, color)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def draw_polyline(
    buf: bytearray,
    points: list[tuple[float, float]],
    zoom: int,
    tile_x: int,
    tile_y: int,
    color: tuple[int, int, int],
    width: int,
) -> None:
    pixels = [lonlat_to_pixel(lon, lat, zoom, tile_x, tile_y) for lon, lat in points]
    for start, end in zip(pixels, pixels[1:]):
        draw_line(buf, start, end, color, width)


def draw_circle(buf: bytearray, center: tuple[int, int], radius: int, color: tuple[int, int, int]) -> None:
    cx, cy = center
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            dist = (x - cx) ** 2 + (y - cy) ** 2
            if radius * radius - radius <= dist <= radius * radius + radius:
                put_pixel(buf, x, y, color)


FONT = {
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "B": ("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
    "C": ("01111", "10000", "10000", "10000", "10000", "10000", "01111"),
    "D": ("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "F": ("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
    "H": ("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
    "I": ("11111", "00100", "00100", "00100", "00100", "00100", "11111"),
    "J": ("00111", "00010", "00010", "00010", "10010", "10010", "01100"),
    "K": ("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
    "L": ("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
    "M": ("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
    "N": ("10001", "11001", "10101", "10011", "10001", "10001", "10001"),
    "O": ("01110", "10001", "10001", "10001", "10001", "10001", "01110"),
    "P": ("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
    "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
    "U": ("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
    "V": ("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
    "W": ("10001", "10001", "10001", "10101", "10101", "10101", "01010"),
    "Y": ("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
    " ": ("00000", "00000", "00000", "00000", "00000", "00000", "00000"),
}


def draw_text(buf: bytearray, x: int, y: int, text: str, color: tuple[int, int, int], scale: int = 1) -> None:
    cursor = x
    for char in text.upper():
        glyph = FONT.get(char, FONT[" "])
        for row, bits in enumerate(glyph):
            for col, bit in enumerate(bits):
                if bit == "1":
                    for ox in range(scale):
                        for oy in range(scale):
                            put_pixel(buf, cursor + col * scale + ox, y + row * scale + oy, color)
        cursor += 6 * scale


def png_bytes(buf: bytearray) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(kind + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", crc)

    raw = bytearray()
    stride = TILE_SIZE * 3
    for y in range(TILE_SIZE):
        raw.append(0)
        start = y * stride
        raw.extend(buf[start : start + stride])
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", TILE_SIZE, TILE_SIZE, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 6))
        + chunk(b"IEND", b"")
    )


def render_tile(zoom: int, tile_x: int, tile_y: int) -> bytes:
    buf = bytearray(LAND * (TILE_SIZE * TILE_SIZE))
    lon_w = num2lon(tile_x, zoom)
    lon_e = num2lon(tile_x + 1, zoom)
    lat_n = num2lat(tile_y, zoom)
    lat_s = num2lat(tile_y + 1, zoom)

    if lon_e < WEST_LON or lon_w > EAST_LON or lat_s > NORTH_LAT or lat_n < SOUTH_LAT:
        buf = bytearray(OUTSIDE * (TILE_SIZE * TILE_SIZE))

    for lon in [x / 10 for x in range(math.floor(WEST_LON * 10), math.ceil(EAST_LON * 10) + 1)]:
        if int(round(lon * 10)) % 5 == 0:
            color, width = GRID, 2
        else:
            color, width = MINOR_GRID, 1
        start = lonlat_to_pixel(lon, SOUTH_LAT, zoom, tile_x, tile_y)
        end = lonlat_to_pixel(lon, NORTH_LAT, zoom, tile_x, tile_y)
        draw_line(buf, start, end, color, width)

    for lat in [y / 10 for y in range(math.floor(SOUTH_LAT * 10), math.ceil(NORTH_LAT * 10) + 1)]:
        if int(round(lat * 10)) % 5 == 0:
            color, width = GRID, 2
        else:
            color, width = MINOR_GRID, 1
        start = lonlat_to_pixel(WEST_LON, lat, zoom, tile_x, tile_y)
        end = lonlat_to_pixel(EAST_LON, lat, zoom, tile_x, tile_y)
        draw_line(buf, start, end, color, width)

    # Approximate reference geography for field UI testing, not navigation.
    indus = [(68.95, 29.1), (69.10, 28.7), (69.05, 28.25), (68.88, 27.75), (68.72, 27.25)]
    canal = [(68.15, 28.95), (68.35, 28.55), (68.50, 28.25), (68.58, 27.95), (68.75, 27.5)]
    road_main = [(67.55, 29.0), (67.92, 28.72), (68.20, 28.48), (68.4514, 28.2769), (68.64, 28.02), (68.86, 27.72)]
    road_east = [(68.4514, 28.2769), (68.75, 28.25), (69.05, 28.20), (69.35, 28.10)]
    road_north = [(68.4514, 28.2769), (68.32, 28.62), (68.25, 28.95)]

    draw_polyline(buf, indus, zoom, tile_x, tile_y, RIVER, 5)
    draw_polyline(buf, canal, zoom, tile_x, tile_y, CANAL, 3)
    for route in (road_main, road_east, road_north):
        draw_polyline(buf, route, zoom, tile_x, tile_y, ROAD_CASING, 5)
        draw_polyline(buf, route, zoom, tile_x, tile_y, ROAD, 3)

    city = lonlat_to_pixel(CENTER_LON, CENTER_LAT, zoom, tile_x, tile_y)
    draw_circle(buf, city, 12, MARKER)
    draw_line(buf, (city[0] - 8, city[1]), (city[0] + 8, city[1]), MARKER, 2)
    draw_line(buf, (city[0], city[1] - 8), (city[0], city[1] + 8), MARKER, 2)

    if zoom >= 9:
        draw_text(buf, city[0] + 14, city[1] - 7, "JACOBABAD", TEXT, 1 if zoom < 12 else 2)
    if zoom <= 9:
        draw_text(buf, 14, 18, "JACOBABAD TEST MAP", TEXT, 1)
        draw_text(buf, 14, 32, "SCHEMATIC OFFLINE", TEXT, 1)

    return png_bytes(buf)


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
        "name": "Nergalith Wayfinder Demo - Jacobabad Schematic",
        "description": "Policy-safe schematic raster package for Jacobabad/northern Sindh app testing. Not for navigation.",
        "format": "png",
        "type": "baselayer",
        "version": "1.0.0",
        "minzoom": str(min(zooms)),
        "maxzoom": str(max(zooms)),
        "bounds": f"{WEST_LON},{SOUTH_LAT},{EAST_LON},{NORTH_LAT}",
        "center": f"{CENTER_LON},{CENTER_LAT},11",
        "attribution": "Schematic test map generated by Nergalith Wayfinder. Not for navigation.",
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

    for z, x, y_xyz in sorted(tiles):
        tile_row = (2**z - 1) - y_xyz
        cursor.execute(
            "INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
            (z, x, tile_row, sqlite3.Binary(render_tile(z, x, y_xyz))),
        )

    conn.commit()
    conn.close()
    return len(tiles)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    targets = [
        repo_root / "assets" / "tiles" / "demo_jacobabad.mbtiles",
        repo_root / "android" / "app" / "src" / "main" / "assets" / "tiles" / "demo_jacobabad.mbtiles",
    ]

    count = write_mbtiles(targets[0])
    targets[1].parent.mkdir(parents=True, exist_ok=True)
    targets[1].write_bytes(targets[0].read_bytes())

    print(f"Wrote {count} schematic tiles to:")
    for target in targets:
        print(f"  {target} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
