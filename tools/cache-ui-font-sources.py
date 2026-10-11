from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image
root = Path(__file__).resolve().parents[1]
out = root / "tools/font-sources"
out.mkdir(parents=True, exist_ok=True)
for size in (10, 12):
    tree = ET.parse(root / f"assets/fonts/pasture-pixel-{size}.fnt")
    image = Image.open(root / f"assets/fonts/pasture-pixel-{size}.png")
    ascent = int(tree.find("common").get("base"))
    chars = tree.findall("chars/char")
    lines = ["STARTFONT 2.1", f"FONT PasturePixelSubset-{size}", f"SIZE {size} 75 75", f"FONTBOUNDINGBOX {size} {size} 0 -2", "STARTPROPERTIES 5", f"FONT_ASCENT {ascent}", "FONT_DESCENT 2", 'COPYRIGHT "Copyright (c) 2021, TakWolf (https://takwolf.com)"', 'LICENSE "SIL Open Font License 1.1; see the adjacent upstream OFL files"', 'FAMILY_NAME "Pasture Pixel Subset"', "ENDPROPERTIES", f"CHARS {len(chars)}"]
    for char in chars:
        data = {key: int(value) for key, value in char.attrib.items()}
        w, h = data["width"], data["height"]
        lines.extend([f'STARTCHAR uni{data["id"]:04X}', f'ENCODING {data["id"]}', f'SWIDTH {data["xadvance"] * 1000 // size} 0', f'DWIDTH {data["xadvance"]} 0', f'BBX {w} {h} {data["xoffset"]} {ascent - h - data["yoffset"]}', "BITMAP"])
        digits = ((w + 7) // 8) * 2
        for y in range(h):
            bits = 0
            for x in range(w):
                if image.getpixel((data["x"] + x, data["y"] + y))[3] != 0:
                    bits |= 1 << (digits * 4 - x - 1)
            lines.append(f"{bits:0{digits}X}")
        lines.append("ENDCHAR")
    lines.append("ENDFONT")
    (out / f"pasture-pixel-{size}.bdf").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Saved {size}px offline subset")
