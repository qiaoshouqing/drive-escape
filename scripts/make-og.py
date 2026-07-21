#!/usr/bin/env python3
"""Build the 1200x630 Open Graph image from the generated hero artwork."""

from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1200
HEIGHT = 630
TITLE_LINES = ("周末自驾", "逃离计划")
EYEBROW = "周末路线探索"
SUBTITLE = "输入出发城市，看看周末能开多远"
DOMAIN = "drive-escape.pomodiary.com"


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
        [
            "/System/Library/Fonts/STHeiti Medium.ttc",
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
        ]
        if bold
        else [
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
            "/System/Library/Fonts/STHeiti Medium.ttc",
        ]
    )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise RuntimeError("No supported Chinese font found")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: make-og.py <hero-source.png> <output.png>")

    source = Path(sys.argv[1])
    output = Path(sys.argv[2])

    image = Image.open(source).convert("RGB")
    source_ratio = image.width / image.height
    target_ratio = WIDTH / HEIGHT
    if source_ratio > target_ratio:
        resized_height = HEIGHT
        resized_width = round(resized_height * source_ratio)
    else:
        resized_width = WIDTH
        resized_height = round(resized_width / source_ratio)

    image = image.resize((resized_width, resized_height), Image.Resampling.LANCZOS)
    left = (resized_width - WIDTH) // 2
    top = (resized_height - HEIGHT) // 2
    image = image.crop((left, top, left + WIDTH, top + HEIGHT)).convert("RGBA")

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for x in range(660):
        alpha = round(54 * max(0, 1 - x / 660))
        overlay_draw.line((x, 0, x, HEIGHT), fill=(4, 38, 31, alpha))
    image = Image.alpha_composite(image, overlay)

    draw = ImageDraw.Draw(image)
    eyebrow_font = font(22, bold=True)
    title_font = font(78, bold=True)
    subtitle_font = font(28)
    domain_font = font(19)

    pill_box = (70, 72, 252, 118)
    draw.rounded_rectangle(pill_box, radius=23, fill=(25, 91, 72, 255), outline=(190, 225, 208, 255), width=1)
    draw.text((91, 82), EYEBROW, font=eyebrow_font, fill=(234, 249, 239, 255))
    title_x = 68
    title_y = 154
    title_gap = 22
    first_line_box = draw.textbbox((0, 0), TITLE_LINES[0], font=title_font)
    title_line_height = first_line_box[3] - first_line_box[1]
    draw.text((title_x, title_y), TITLE_LINES[0], font=title_font, fill=(255, 255, 255, 255))
    draw.text(
        (title_x, title_y + title_line_height + title_gap),
        TITLE_LINES[1],
        font=title_font,
        fill=(255, 255, 255, 255),
    )
    draw.text((72, 366), SUBTITLE, font=subtitle_font, fill=(224, 242, 232, 245))
    draw.line((72, 458, 486, 458), fill=(207, 232, 218, 105), width=1)
    draw.text((72, 484), DOMAIN, font=domain_font, fill=(205, 228, 215, 220))

    output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
