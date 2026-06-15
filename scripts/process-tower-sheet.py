# -*- coding: utf-8 -*-
"""Slice 4x4 tower sprite sheet into kick/snare/hihat/crash tiers."""

from __future__ import annotations

import shutil
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "sprites" / "tower"
SHEET_CANDIDATES = [
    ROOT / "public" / "assets" / "sprites" / "tower_sheet.png",
    ROOT / "public" / "assets" / "sprites" / "tower" / "tower_sheet.png",
]

ROW_TYPES = ["kick", "snare", "hihat", "crash"]
OUTPUT_SIZE = 128
PADDING = 8
CELL_INSET = 6
GRID_COLS = 4
GRID_ROWS = 4


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


def find_sheet() -> Path:
    for path in SHEET_CANDIDATES:
        if path.exists():
            return path
    tower_dir = OUT_DIR
    sheets = sorted(tower_dir.glob("tower_sheet*.png"))
    if sheets:
        return sheets[0]
    raise SystemExit(
        "Sprite sheet not found. Save the 4x4 image as:\n"
        "  public/assets/sprites/tower_sheet.png"
    )


def slice_cells(sheet: Image.Image) -> list[Image.Image]:
    w, h = sheet.size
    fw, fh = w // GRID_COLS, h // GRID_ROWS
    cells: list[Image.Image] = []
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            x0 = col * fw + CELL_INSET
            y0 = row * fh + CELL_INSET
            x1 = (col + 1) * fw - CELL_INSET
            y1 = (row + 1) * fh - CELL_INSET
            cells.append(sheet.crop((x0, y0, x1, y1)))
    return cells


def main() -> None:
    sheet_path = find_sheet()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(sheet_path)
    print(f"Sheet: {sheet_path.relative_to(ROOT)} ({sheet.size[0]}x{sheet.size[1]})")

    cells = slice_cells(sheet)
    for row, item_type in enumerate(ROW_TYPES):
        for col in range(GRID_COLS):
            tier = col + 1
            cell = cells[row * GRID_COLS + col]
            final = fit_to_canvas(cell, OUTPUT_SIZE, PADDING)
            out_path = OUT_DIR / f"{item_type}_t{tier}.png"
            final.save(out_path, optimize=True)
            bbox = content_bbox(final)
            print(f"  {item_type}_t{tier}.png  bbox={bbox}")

    print(f"Done. 16 sprites -> {OUT_DIR.relative_to(ROOT)}")


def install_sheet_from(src: Path) -> Path:
    dest = ROOT / "public" / "assets" / "sprites" / "tower_sheet.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return dest


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        install_sheet_from(Path(sys.argv[1]))
    main()
