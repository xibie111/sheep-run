"""Build a local hard-alpha display font from the OFL ZCOOL KuaiLe source.

The reference uses playful heavy lettering, with a separate outlined gold title.
This atlas recreates that treatment; it does not identify the screenshot's font.
Run with Python/Pillow. No source UI PNG or runtime web font is changed.
"""
from pathlib import Path
from xml.etree import ElementTree as ET
import argparse
import hashlib
import json
import re
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools/font-sources/ZCOOLKuaiLe-Regular.ttf"
OUTPUT = ROOT / "assets/fonts"
SOURCE_HASH = "812a6fc1fe54b6d73a419245c32dfeba8aa33104d5be90d1cf6af082007cb71d"
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_HASH:
    raise RuntimeError("Display font source differs from the pinned upstream file")

chars = set(chr(i) for i in range(32, 127)) | set("−★×！…，。·：")
chars.update(chr(int(entry.attrib["id"])) for entry in ET.parse(OUTPUT / "pasture-pixel-12.fnt").findall("chars/char"))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--extra-text", action="append", help="Extend the current display atlas with only this text, retaining its existing glyphs")
args = parser.parse_args()
if args.extra_text:
    # A cosmetic name needs no font coverage for unrelated asset metadata.
    for current in OUTPUT.glob("pasture-display-*.fnt"):
        chars.update(chr(int(entry.attrib["id"])) for entry in ET.parse(current).findall("chars/char"))
    for text in args.extra_text:
        chars.update(text)
else:
    for source in (ROOT / "src").rglob("*.ts"):
        if not source.name.endswith(".test.ts"):
            chars.update(re.findall(r"[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef★−…·]", source.read_text(encoding="utf-8")))

OUTPUT.mkdir(parents=True, exist_ok=True)
supported = TTFont(SOURCE).getBestCmap()
missing = chars - set(map(chr, supported)) - set("−★")
if missing:
    raise RuntimeError(f"Unsupported display glyphs: {''.join(sorted(missing))}")
for size in (12, 20, 40, 64):
    # The compact button face needs more samples for its small internal counters.
    # Keep the final glyphs on a native bitmap grid instead of expanding thin masks.
    font = ImageFont.truetype(str(SOURCE), size + 4 if size == 20 else size)
    cell, columns = size + 12, 24
    atlas = Image.new("RGBA", (columns * cell, ((len(chars) + columns - 1) // columns) * cell))
    root = ET.Element("font")
    ET.SubElement(root, "info", face=f"Pasture Display {size}", size=str(size))
    ET.SubElement(root, "common", lineHeight=str(size), base=str(size), scaleW=str(atlas.width), scaleH=str(atlas.height), pages="1", packed="0")
    ET.SubElement(ET.SubElement(root, "pages"), "page", id="0", file=f"pasture-display-{size}.png")
    entries = ET.SubElement(root, "chars", count=str(len(chars)))
    for index, char in enumerate(sorted(chars)):
        glyph = Image.new("L", (cell, cell))
        if char == "★":
            # The UI uses its existing star icon; retain a real glyph for any text hint.
            import math
            center, radius = size / 2 + 3, size * 0.44
            points = [(center + math.sin(i * math.pi / 5) * radius * (1 if i % 2 == 0 else .42), center - math.cos(i * math.pi / 5) * radius * (1 if i % 2 == 0 else .42)) for i in range(10)]
            ImageDraw.Draw(glyph).polygon(points, fill=255)
        else:
            ImageDraw.Draw(glyph).text((3, 3), "-" if char == "−" else char, font=font, anchor="lt", fill=255, stroke_width=1 if size == 40 else 0)
        glyph = glyph.point(lambda value: 255 if value >= 112 else 0)
        bounds = glyph.getbbox()
        x, y = (index % columns) * cell + 2, (index // columns) * cell + 2
        if bounds:
            mask = glyph.crop(bounds)
            width, height = mask.size
            atlas.paste((255, 255, 255, 255), (x, y, x + width, y + height), mask)
        else:
            width = height = 0
        # Tight ink metrics and a consistent center keep icons and short labels aligned.
        advance = max(width + (2 if size >= 20 else 1), round(font.getlength(char)))
        ET.SubElement(entries, "char", id=str(ord(char)), x=str(x), y=str(y), width=str(width), height=str(height), xoffset=str((advance - width) // 2), yoffset=str((size - height) // 2), xadvance=str(advance), page="0", chnl="15")
    if size == 40:
        # Bake the gold face, dark outline and lower extrusion into the font itself.
        # Every layer stays on the integer bitmap grid; runtime needs no text filters.
        colored = Image.new("RGBA", atlas.size)
        for entry in entries:
            x, y, w, h = [int(entry.attrib[key]) for key in ("x", "y", "width", "height")]
            if not w or not h:
                continue
            mask = Image.new("L", (w + 6, h + 7))
            mask.paste(atlas.getchannel("A").crop((x, y, x + w, y + h)), (2, 2))
            outline = mask.filter(ImageFilter.MaxFilter(5))
            tile = Image.new("RGBA", mask.size)
            shadow = Image.new("L", mask.size)
            shadow.paste(outline, (1, 2))
            tile.paste((113, 47, 13, 255), (0, 0, *tile.size), shadow)
            tile.paste((78, 33, 9, 255), (0, 0, *tile.size), outline)
            for row in range(2, h + 2):
                progress = (row - 2) / max(1, h - 1)
                top, bottom = (255, 247, 200), (246, 164, 43)
                color = tuple(round(a + (b - a) * progress) for a, b in zip(top, bottom)) + (255,)
                strip = mask.crop((0, row, mask.width, row + 1))
                tile.paste(color, (0, row, tile.width, row + 1), strip)
            colored.alpha_composite(tile, (x - 2, y - 2))
            entry.set("x", str(x - 2)); entry.set("y", str(y - 2))
            entry.set("width", str(w + 6)); entry.set("height", str(h + 7))
            entry.set("xoffset", str(int(entry.attrib["xoffset"]) - 2))
            entry.set("yoffset", str(int(entry.attrib["yoffset"]) - 2))
        atlas = colored
    atlas.save(OUTPUT / f"pasture-display-{size}.png", optimize=True)
    ET.ElementTree(root).write(OUTPUT / f"pasture-display-{size}.fnt", encoding="utf-8", xml_declaration=True)
    print(f"{size}px: {len(chars)} glyphs; hard alpha; integer-pixel metrics")

(OUTPUT / "display-font-source.json").write_text(json.dumps({
    "family": "Pasture Display", "sourceFamily": "ZCOOL KuaiLe", "license": "SIL OFL 1.1",
    "source": "https://github.com/googlefonts/zcool-kuaile", "sha256": SOURCE_HASH,
    "sizes": [12, 20, 40, 64], "reference": "Visual reconstruction; source typeface of screenshot unknown",
}, indent=2) + "\n", encoding="utf-8")
