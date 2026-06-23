#!/usr/bin/env python3
"""Generate a raster MBTiles package for Sindh/Jacobabad from OSM PBF data.

Input data should come from an ODbL-compliant OSM extract such as Geofabrik's
Pakistan PBF. This script renders local PNG tiles from OSM vector features; it
does not fetch or redistribute tiles from OpenStreetMap volunteer-run servers.
"""

from __future__ import annotations

import argparse
import json
import math
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path

import osmium
from PIL import Image, ImageDraw, ImageFont

DEFAULT_BBOX = (66.5, 23.5, 71.5, 28.5)
DEFAULT_ZOOMS = range(5, 15)
TILE_SIZE = 256

BACKGROUND = "#ece7d8"
PARK = "#dbe8c3"
WATER = "#9ecae1"
BUILTUP = "#ded6c8"
RAIL = "#57534e"
CASING = "#ffffff"
TEXT = "#292524"

ROAD_STYLE = {
    "motorway": (5, "#d95f02", 5),
    "trunk": (5, "#d95f02", 5),
    "primary": (6, "#e67e22", 4),
    "secondary": (7, "#f2a65a", 3),
    "tertiary": (8, "#f4c06a", 3),
    "unclassified": (10, "#c7a36a", 2),
    "residential": (12, "#c7a36a", 2),
    "service": (13, "#a8a29e", 1),
    "track": (12, "#8b7d5c", 1),
    "path": (13, "#78716c", 1),
    "footway": (14, "#78716c", 1),
}

PLACE_MIN_ZOOM = {
    "city": 5,
    "town": 7,
    "village": 11,
    "hamlet": 13,
}


@dataclass(slots=True)
class Feature:
    kind: str
    coords: list[tuple[float, float]]
    tags: dict[str, str]
    min_zoom: int
    bbox: tuple[float, float, float, float]


@dataclass(slots=True)
class Label:
    text: str
    lon: float
    lat: float
    min_zoom: int


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


def tile_range_for_bbox(
    bbox: tuple[float, float, float, float],
    zoom: int,
    clip: tuple[float, float, float, float],
) -> tuple[range, range]:
    west, south, east, north = bbox
    clip_west, clip_south, clip_east, clip_north = clip
    west = max(west, clip_west)
    south = max(south, clip_south)
    east = min(east, clip_east)
    north = min(north, clip_north)
    if west > east or south > north:
        return range(0), range(0)
    west_x, north_y = deg2num(north, west, zoom)
    east_x, south_y = deg2num(south, east, zoom)
    return range(west_x, east_x + 1), range(north_y, south_y + 1)


def intersects(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    aw, as_, ae, an = a
    bw, bs, be, bn = b
    return not (ae < bw or aw > be or an < bs or as_ > bn)


class OsmCollector(osmium.SimpleHandler):
    def __init__(self, bbox: tuple[float, float, float, float]):
        super().__init__()
        self.bbox = bbox
        self.features: list[Feature] = []
        self.labels: list[Label] = []

    def node(self, node: osmium.osm.Node) -> None:
        if not node.location.valid():
            return
        lon = node.location.lon
        lat = node.location.lat
        if not point_in_bbox(lon, lat, self.bbox):
            return
        tags = dict(node.tags)
        place = tags.get("place")
        name = tags.get("name")
        if place in PLACE_MIN_ZOOM and name:
            self.labels.append(Label(name, lon, lat, PLACE_MIN_ZOOM[place]))

    def way(self, way: osmium.osm.Way) -> None:
        tags = dict(way.tags)
        kind, min_zoom = classify_way(tags)
        if not kind:
            return

        coords: list[tuple[float, float]] = []
        for node in way.nodes:
            if node.location.valid():
                coords.append((node.lon, node.lat))
        if len(coords) < 2:
            return

        bbox = feature_bbox(coords)
        if not intersects(bbox, self.bbox):
            return

        self.features.append(Feature(kind, coords, tags, min_zoom, bbox))


def point_in_bbox(lon: float, lat: float, bbox: tuple[float, float, float, float]) -> bool:
    west, south, east, north = bbox
    return west <= lon <= east and south <= lat <= north


def feature_bbox(coords: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    lons = [point[0] for point in coords]
    lats = [point[1] for point in coords]
    return min(lons), min(lats), max(lons), max(lats)


def classify_way(tags: dict[str, str]) -> tuple[str | None, int]:
    highway = tags.get("highway")
    if highway in ROAD_STYLE:
        return f"road:{highway}", ROAD_STYLE[highway][0]
    if tags.get("railway") in {"rail", "light_rail", "narrow_gauge"}:
        return "rail", 9
    if tags.get("waterway") in {"river", "stream", "canal", "drain"}:
        return "waterway", 7
    if tags.get("natural") in {"water", "wetland"} or tags.get("water") or tags.get("landuse") in {
        "reservoir",
        "basin",
    }:
        return "water", 8
    if tags.get("landuse") in {"residential", "commercial", "industrial", "retail"}:
        return "builtup", 11
    if tags.get("landuse") in {"forest", "orchard", "farmland", "grass", "meadow"}:
        return "park", 11
    return None, 99


def build_tile_index(
    features: list[Feature],
    labels: list[Label],
    zooms: range,
    bbox: tuple[float, float, float, float],
) -> tuple[dict[tuple[int, int, int], list[int]], dict[tuple[int, int, int], list[int]]]:
    feature_index: dict[tuple[int, int, int], list[int]] = {}
    label_index: dict[tuple[int, int, int], list[int]] = {}

    for feature_id, feature in enumerate(features):
        for zoom in zooms:
            if zoom < feature.min_zoom:
                continue
            x_range, y_range = tile_range_for_bbox(feature.bbox, zoom, bbox)
            for x in x_range:
                for y in y_range:
                    feature_index.setdefault((zoom, x, y), []).append(feature_id)

    for label_id, label in enumerate(labels):
        for zoom in zooms:
            if zoom < label.min_zoom:
                continue
            x, y = deg2num(label.lat, label.lon, zoom)
            label_index.setdefault((zoom, x, y), []).append(label_id)

    return feature_index, label_index


def render_tile(
    zoom: int,
    tile_x: int,
    tile_y: int,
    features: list[Feature],
    labels: list[Label],
    feature_ids: list[int],
    label_ids: list[int],
) -> bytes:
    image = Image.new("RGB", (TILE_SIZE, TILE_SIZE), BACKGROUND)
    draw = ImageDraw.Draw(image)

    tile_bbox = (
        num2lon(tile_x, zoom),
        num2lat(tile_y + 1, zoom),
        num2lon(tile_x + 1, zoom),
        num2lat(tile_y, zoom),
    )

    for kind in ("park", "builtup", "water"):
        for feature_id in feature_ids:
            feature = features[feature_id]
            if feature.kind != kind or not intersects(feature.bbox, tile_bbox):
                continue
            pixels = [lonlat_to_pixel(lon, lat, zoom, tile_x, tile_y) for lon, lat in feature.coords]
            fill = {"park": PARK, "builtup": BUILTUP, "water": WATER}[kind]
            if feature.coords[0] == feature.coords[-1] and len(pixels) >= 4:
                draw.polygon(pixels, fill=fill)
            else:
                draw.line(pixels, fill=fill, width=max(1, zoom - 8))

    for kind in ("waterway", "rail"):
        for feature_id in feature_ids:
            feature = features[feature_id]
            if feature.kind != kind or not intersects(feature.bbox, tile_bbox):
                continue
            pixels = [lonlat_to_pixel(lon, lat, zoom, tile_x, tile_y) for lon, lat in feature.coords]
            if kind == "waterway":
                draw.line(pixels, fill=WATER, width=water_width(zoom))
            else:
                draw.line(pixels, fill=RAIL, width=1 if zoom < 12 else 2)

    for road_class in sorted(ROAD_STYLE, key=lambda item: ROAD_STYLE[item][2], reverse=True):
        for feature_id in feature_ids:
            feature = features[feature_id]
            if feature.kind != f"road:{road_class}" or not intersects(feature.bbox, tile_bbox):
                continue
            _, color, base_width = ROAD_STYLE[road_class]
            pixels = [lonlat_to_pixel(lon, lat, zoom, tile_x, tile_y) for lon, lat in feature.coords]
            width = road_width(zoom, base_width)
            if width > 1:
                draw.line(pixels, fill=CASING, width=width + 2, joint="curve")
            draw.line(pixels, fill=color, width=width, joint="curve")

    font = font_for_zoom(zoom)
    for label_id in label_ids:
        label = labels[label_id]
        x, y = lonlat_to_pixel(label.lon, label.lat, zoom, tile_x, tile_y)
        if -80 <= x <= TILE_SIZE + 80 and -20 <= y <= TILE_SIZE + 20:
            draw.text((x + 4, y - 8), label.text, fill=TEXT, font=font, stroke_width=2, stroke_fill=BACKGROUND)

    from io import BytesIO

    output = BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def road_width(zoom: int, base_width: int) -> int:
    if zoom <= 7:
        return 1
    if zoom <= 10:
        return max(1, base_width - 2)
    if zoom <= 12:
        return max(1, base_width - 1)
    return base_width


def water_width(zoom: int) -> int:
    if zoom <= 7:
        return 1
    if zoom <= 10:
        return 2
    return 3


def font_for_zoom(zoom: int) -> ImageFont.ImageFont:
    try:
        size = 10 if zoom < 12 else 12
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def write_mbtiles(
    output_path: Path,
    bbox: tuple[float, float, float, float],
    zooms: range,
    features: list[Feature],
    labels: list[Label],
    feature_index: dict[tuple[int, int, int], list[int]],
    label_index: dict[tuple[int, int, int], list[int]],
) -> int:
    if output_path.exists():
        output_path.unlink()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(output_path))
    cursor = conn.cursor()
    cursor.execute("PRAGMA synchronous=OFF")
    cursor.execute("PRAGMA journal_mode=MEMORY")
    cursor.execute("CREATE TABLE metadata (name TEXT, value TEXT)")
    cursor.execute(
        "CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)"
    )
    cursor.execute(
        "CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)"
    )

    west, south, east, north = bbox
    metadata = {
        "name": "Nergalith Wayfinder - Sindh OSM",
        "description": "Raster MBTiles generated from Geofabrik Pakistan OSM PBF for Sindh/Jacobabad field testing.",
        "format": "png",
        "type": "baselayer",
        "version": "1.0.0",
        "minzoom": str(min(zooms)),
        "maxzoom": str(max(zooms)),
        "bounds": f"{west},{south},{east},{north}",
        "center": "68.4514,28.2769,11",
        "attribution": "© OpenStreetMap contributors",
        "generator": "nergalith-wayfinder/scripts/generate_sindh_osm_mbtiles.py",
        "json": json.dumps({"vector_layers": []}),
    }
    cursor.executemany("INSERT INTO metadata (name, value) VALUES (?, ?)", metadata.items())

    inserted = 0
    start = time.time()
    for zoom in zooms:
        x_range, y_range = tile_range_for_bbox(bbox, zoom, bbox)
        total = len(x_range) * len(y_range)
        done = 0
        for x in x_range:
            for y_xyz in y_range:
                tile_key = (zoom, x, y_xyz)
                png = render_tile(
                    zoom,
                    x,
                    y_xyz,
                    features,
                    labels,
                    feature_index.get(tile_key, []),
                    label_index.get(tile_key, []),
                )
                tms_row = (2**zoom - 1) - y_xyz
                cursor.execute(
                    "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
                    (zoom, x, tms_row, sqlite3.Binary(png)),
                )
                inserted += 1
                done += 1
        conn.commit()
        elapsed = time.time() - start
        print(f"zoom {zoom}: {done}/{total} tiles, elapsed {elapsed:.1f}s")

    conn.commit()
    conn.close()
    return inserted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path, help="Input .osm.pbf file")
    parser.add_argument("--output", required=True, type=Path, help="Output .mbtiles file")
    parser.add_argument(
        "--bbox",
        default="66.5,23.5,71.5,28.5",
        help="west,south,east,north bounds. Default covers Sindh/Jacobabad test area.",
    )
    parser.add_argument("--minzoom", default=5, type=int)
    parser.add_argument("--maxzoom", default=14, type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    bbox = tuple(float(part) for part in args.bbox.split(","))
    if len(bbox) != 4:
        raise ValueError("--bbox must be west,south,east,north")
    zooms = range(args.minzoom, args.maxzoom + 1)

    collector = OsmCollector(bbox)  # type: ignore[arg-type]
    print(f"Parsing {args.source} for bbox {bbox}...")
    collector.apply_file(str(args.source), locations=True)
    print(f"Collected {len(collector.features)} render features and {len(collector.labels)} labels")

    print("Building tile index...")
    feature_index, label_index = build_tile_index(collector.features, collector.labels, zooms, bbox)  # type: ignore[arg-type]
    print(f"Indexed {len(feature_index)} feature tiles and {len(label_index)} label tiles")

    print(f"Rendering MBTiles to {args.output}...")
    count = write_mbtiles(
        args.output,
        bbox,  # type: ignore[arg-type]
        zooms,
        collector.features,
        collector.labels,
        feature_index,
        label_index,
    )
    print(f"Wrote {count} tiles to {args.output} ({args.output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
