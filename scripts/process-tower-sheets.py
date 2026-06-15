# -*- coding: utf-8 -*-
"""Process tower_sheet1-16 into game-ready transparent sprites."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TOWER_DIR = ROOT / "public" / "assets" / "sprites" / "tower"
OUTPUT_SIZE = 128
PADDING = 8

SHEET_MAP = {
    "kick": [1, 2, 3, 4],
    "snare": [5, 6, 7, 8],
    "hihat": [9, 10, 11, 12],
    "crash": [13, 14, 15, 16],
}


def is_background(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    spread = max(r, g, b) - min(r, g, b)
    if spread <= 14 and min(r, g, b) >= 175:
        return True
    if min(r, g, b) >= 228 and spread <= 20:
        return True
    return False


def is_opaque_content(rgb: tuple[int, int, int], alpha: int) -> bool:
    return alpha >= 40 and not is_background(rgb)


def remove_background(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_background(px[x, y][:3]):
                q.append((x, y))
                visited[y][x] = True
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y][x] and is_background(px[x, y][:3]):
                q.append((x, y))
                visited[y][x] = True

    while q:
        x, y = q.popleft()
        px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if is_background(px[nx, ny][:3]):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    for x in range(w):
        for y in range(h):
            if px[x, y][3] == 0:
                continue
            r, g, b, _ = px[x, y]
            if is_background((r, g, b)):
                px[x, y] = (r, g, b, 0)

    return rgba


def content_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    min_x, min_y, max_x, max_y = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_opaque_content((r, g, b), a):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x < min_x:
        return None
    return (min_x, min_y, max_x + 1, max_y + 1)


def fit_to_canvas(im: Image.Image, size: int, padding: int) -> Image.Image:
    cutout = remove_background(im)
    bbox = content_bbox(cutout)
    if not bbox:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cropped = cutout.crop(bbox)
    inner = size - padding * 2
    cropped.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - cropped.width) // 2
    oy = (size - cropped.height) // 2
    canvas.paste(cropped, (ox, oy), cropped)
    return canvas


def main() -> None:
    TOWER_DIR.mkdir(parents=True, exist_ok=True)
    for item_type, sheets in SHEET_MAP.items():
        for tier, sheet_no in enumerate(sheets, start=1):
            src = TOWER_DIR / f"tower_sheet{sheet_no}.png"
            if not src.exists():
                raise SystemExit(f"Missing: {src}")
            final = fit_to_canvas(Image.open(src), OUTPUT_SIZE, PADDING)
            final.save(src, optimize=True)
            bbox = content_bbox(final)
            print(f"  tower_sheet{sheet_no}.png -> {item_type}_t{tier}  bbox={bbox}")
    print("Done. 16 sprites processed in place.")


if __name__ == "__main__":
    main()
