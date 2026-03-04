#!/usr/bin/env python3
"""
Generate Apple Wallet strip assets with icon-only stamps (no text).
Output files:
  public/wallet-strip-<category>-t<total>-r<remaining>.png
  public/wallet-strip-<category>-t<total>-r<remaining>@2x.png
  public/wallet-strip-<category>-t<total>-r<remaining>@3x.png
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"

BASE_WIDTH = 375
BASE_HEIGHT = 123
TOTAL_BUCKETS = [1, 4, 8, 12, 16, 20]
SCALES = {1: "", 2: "@2x", 3: "@3x"}


PALETTES: Dict[str, Dict[str, Tuple[int, int, int]]] = {
    "jumping": {
        "top": (50, 13, 65),
        "bottom": (26, 8, 37),
        "accent": (225, 92, 184),
        "active_icon": (231, 235, 110),
        "inactive_icon": (146, 137, 168),
        "active_bg": (255, 246, 153),
        "inactive_bg": (46, 33, 62),
        "active_border": (238, 162, 214),
        "inactive_border": (128, 111, 151),
    },
    "pilates": {
        "top": (30, 36, 16),
        "bottom": (15, 20, 10),
        "accent": (231, 235, 110),
        "active_icon": (225, 92, 184),
        "inactive_icon": (154, 166, 130),
        "active_bg": (238, 242, 141),
        "inactive_bg": (35, 43, 24),
        "active_border": (245, 245, 182),
        "inactive_border": (130, 142, 107),
    },
    "mixto": {
        "top": (34, 14, 55),
        "bottom": (20, 9, 34),
        "accent": (202, 113, 225),
        "active_icon": (231, 235, 110),
        "inactive_icon": (150, 133, 170),
        "active_bg": (233, 172, 246),
        "inactive_bg": (45, 33, 63),
        "active_border": (240, 208, 250),
        "inactive_border": (129, 110, 149),
    },
}


ICON_PATHS = {
    "jumping": PUBLIC_DIR / "wallet-icon-jumping.png",
    "pilates": PUBLIC_DIR / "wallet-icon-pilates.png",
    "mixto": PUBLIC_DIR / "wallet-icon-mixto.png",
}


def lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def lerp_color(c1: Tuple[int, int, int], c2: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
    return (lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))


def tint_icon(icon_img: Image.Image, size: int, color: Tuple[int, int, int], alpha_mul: float = 1.0) -> Image.Image:
    resized = icon_img.resize((size, size), Image.Resampling.LANCZOS)
    alpha = resized.getchannel("A")
    gray = ImageOps.grayscale(resized)
    colored = ImageOps.colorize(gray, black=(20, 18, 28), white=color).convert("RGBA")
    if alpha_mul < 1.0:
        alpha = alpha.point(lambda px: int(px * alpha_mul))
    colored.putalpha(alpha)
    return colored


def compute_stamp_positions(total: int, width: int, height: int) -> List[Tuple[int, int, int]]:
    if total <= 8:
        cols = total
        rows = 1
    elif total <= 12:
        cols = 6
        rows = 2
    elif total <= 16:
        cols = 8
        rows = 2
    else:
        cols = 10
        rows = 2

    side_pad = int(width * 0.05)
    usable_w = width - side_pad * 2
    gap = 10 if cols <= 6 else 8 if cols <= 8 else 6
    max_size = 34 if rows == 1 else 26
    size = min(max_size, int((usable_w - (cols - 1) * gap) / cols))
    size = max(size, 18)

    layout_w = cols * size + (cols - 1) * gap
    start_x = (width - layout_w) // 2

    if rows == 1:
        start_y = int(height * 0.60) - size // 2
        row_ys = [start_y]
    else:
        row_gap = 8
        layout_h = rows * size + (rows - 1) * row_gap
        start_y = int(height * 0.62) - layout_h // 2
        row_ys = [start_y + row * (size + row_gap) for row in range(rows)]

    out: List[Tuple[int, int, int]] = []
    for idx in range(total):
        row = idx // cols
        col = idx % cols
        x = start_x + col * (size + gap)
        y = row_ys[row]
        out.append((x, y, size))
    return out


def draw_strip(category: str, total: int, remaining: int, scale: int) -> Image.Image:
    palette = PALETTES[category]
    w = BASE_WIDTH * scale
    h = BASE_HEIGHT * scale
    strip = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(strip)

    for y in range(h):
        t = y / max(1, h - 1)
        color = lerp_color(palette["top"], palette["bottom"], t)
        draw.line((0, y, w, y), fill=(*color, 255))

    # Top accent and separator line
    draw.rectangle((0, 0, w, max(2, 8 * scale // 1)), fill=(*palette["accent"], 218))
    sep_y = int(h * 0.42)
    draw.line((int(w * 0.04), sep_y, int(w * 0.96), sep_y), fill=(255, 255, 255, 60), width=max(1, scale))

    used = max(0, total - remaining)
    positions = compute_stamp_positions(total, w, h)

    icon_jump = Image.open(ICON_PATHS["jumping"]).convert("RGBA")
    icon_pil = Image.open(ICON_PATHS["pilates"]).convert("RGBA")

    for i, (x, y, size) in enumerate(positions):
        is_active = i >= used
        bg_color = palette["active_bg"] if is_active else palette["inactive_bg"]
        border = palette["active_border"] if is_active else palette["inactive_border"]

        cx = x + size // 2
        cy = y + size // 2

        if is_active:
            glow_size = int(size * 1.9)
            glow = Image.new("RGBA", (glow_size, glow_size), (0, 0, 0, 0))
            glow_draw = ImageDraw.Draw(glow)
            glow_draw.ellipse((0, 0, glow_size - 1, glow_size - 1), fill=(*palette["accent"], 120))
            glow = glow.filter(ImageFilter.GaussianBlur(radius=max(2, int(4 * scale))))
            strip.alpha_composite(glow, (cx - glow_size // 2, cy - glow_size // 2))

        draw.ellipse((x, y, x + size, y + size), fill=(*bg_color, 235), outline=(*border, 255), width=max(1, int(scale * 1.2)))

        icon_src = icon_jump if category == "jumping" else icon_pil if category == "pilates" else (icon_jump if i % 2 == 0 else icon_pil)
        icon_size = int(size * 0.56)
        icon_color = palette["active_icon"] if is_active else palette["inactive_icon"]
        icon_alpha = 1.0 if is_active else 0.55
        icon = tint_icon(icon_src, icon_size, icon_color, alpha_mul=icon_alpha)
        strip.alpha_composite(icon, (cx - icon_size // 2, cy - icon_size // 2))

    return strip


def iter_targets() -> Iterable[Tuple[str, int, int]]:
    for category in ("jumping", "pilates", "mixto"):
        for total in TOTAL_BUCKETS:
            for remaining in range(0, total + 1):
                yield category, total, remaining


def main() -> None:
    if not PUBLIC_DIR.exists():
        raise SystemExit(f"Public directory not found: {PUBLIC_DIR}")

    generated = 0
    for category, total, remaining in iter_targets():
        for scale, suffix in SCALES.items():
            img = draw_strip(category, total, remaining, scale)
            out_name = f"wallet-strip-{category}-t{total}-r{remaining}{suffix}.png"
            out_path = PUBLIC_DIR / out_name
            img.save(out_path, format="PNG", optimize=True)
            generated += 1

    print(f"Generated {generated} strip files in {PUBLIC_DIR}")


if __name__ == "__main__":
    main()
