# -*- coding: utf-8 -*-
"""Process kick tower sprites: remove checkerboard/white bg and export kick_t1~t4."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "sprites" / "tower"
OUTPUT_SIZE = 128
PADDING = 8

NEW_SOURCES: list[tuple[str, str | None]] = [
    ("af440e627217162d124a896fb944dfc43081939.png", None),
    ("e1958b643407a9f7bf3bf90a09d924f82313526.png", None),
    ("a788df930f7ee50a572f9cf666cb66eb2056522.png", None),
    ("a3221d11dbee8aa948391ed9e65858d14051821.png", "top"),
]

LEGACY_SHEET = ROOT / "public" / "assets" / "sprites" / "59a66770c8b0150958212ce24950a4633852384.png"


def is_background(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    spread = max(r, g, b) - min(r, g, b)
    if spread <= 14 and min(r, g, b) >= 175:
        return True
    if min(r, g, b) >= 228 and spread <= 20:
        return True
    return False


def is_opaque_content(rgb: tuple[int, int, int], alpha: int) -> bool:
    if alpha < 40:
        return False
    return not is_background(rgb)


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

    for _ in range(2):
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
    if max_x < min_x or max_y < min_y:
        return None
    return (min_x, min_y, max_x + 1, max_y + 1)


def load_source_image(path: Path, crop_hint: str | None) -> Image.Image:
    im = Image.open(path)
    w, h = im.size
    if crop_hint == "top":
        return im.crop((0, 0, w, h // 2))
    if crop_hint == "bottom":
        return im.crop((0, h // 2, w, h))
    return im


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


def process_new_uploads() -> bool:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ok = True
    for tier, (filename, crop_hint) in enumerate(NEW_SOURCES, start=1):
        src = OUT_DIR / filename
        if not src.exists():
            print(f"  skip missing: {filename}")
            ok = False
            continue
        cell = load_source_image(src, crop_hint)
        final = fit_to_canvas(cell, OUTPUT_SIZE, PADDING)
        out_path = OUT_DIR / f"kick_t{tier}.png"
        final.save(out_path, optimize=True)
        bbox = content_bbox(final)
        gray = sum(
            1
            for px in final.getdata()
            if px[3] > 128 and is_background(px[:3])
        )
        print(f"  {filename} -> kick_t{tier}.png bbox={bbox} gray_left={gray}")
    return ok


def process_legacy_sheet() -> None:
    sheet = Image.open(LEGACY_SHEET)
    w, h = sheet.size
    fw, fh = w // 4, h // 4
    for tier in range(1, 5):
        box = (0, (tier - 1) * fh, fw, tier * fh)
        final = fit_to_canvas(sheet.crop(box), OUTPUT_SIZE, PADDING)
        (OUT_DIR / f"kick_t{tier}.png").save(final, optimize=True)
        print(f"  kick_t{tier}.png")


def main() -> None:
    print("Processing kick tower sprites...")
    if process_new_uploads():
        print("Done (new uploads).")
        return
    if LEGACY_SHEET.exists():
        process_legacy_sheet()
        print("Done (legacy sheet).")
        return
    raise SystemExit("No kick sprite sources found.")


if __name__ == "__main__":
    main()
