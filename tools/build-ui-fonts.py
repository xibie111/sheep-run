"""Subset pinned Ark Pixel BDF glyphs into hard-alpha Phaser BMFont atlases.

No browser font rasterization. Run with Python + Pillow; upstream fonts use OFL 1.1.
"""
from pathlib import Path
import io
import re
import urllib.request
import zipfile
import tempfile
from xml.etree import ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/fonts"
VERSION = "2026.09.25"
chars = set(chr(i) for i in range(32, 127)) | set("−★！…，。·：颗暂停音乐音效开静音继续游戏重新开始返回首页衣橱奶油白炭黑暖棕闪金农夫羊免费星金币已装备已解锁未解锁占位预览解锁成功已经解锁暂不可用余额不足还需要换上这套装扮在牧场中一路向前最高分")
for source in (ROOT / "src").rglob("*.ts"):
    if not source.name.endswith(".test.ts"):
        chars.update(re.findall(r"[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef★−…·]", source.read_text(encoding="utf-8")))
OUT.mkdir(parents=True, exist_ok=True)
CACHE = Path(tempfile.gettempdir()) / "sheep-run-ui-font-sources" / VERSION
CACHE.mkdir(parents=True, exist_ok=True)
for size in (10, 12):
    family = "fusion" if size == 10 else "ark"
    name = f"{family}-pixel-{size}px-monospaced-zh_hans.bdf"
    subset = ROOT / f"tools/font-sources/pasture-pixel-{size}.bdf"
    local = subset if subset.exists() else CACHE / name
    if not local.exists() and (OUT / name).exists():
        local.write_bytes((OUT / name).read_bytes())
    if local.exists():
        source = local.read_text(encoding="utf-8")
    else:
        url = f"https://github.com/TakWolf/{family}-pixel-font/releases/download/{VERSION}/{family}-pixel-font-{size}px-monospaced-bdf-v{VERSION}.zip"
        with zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url).read())) as pack:
            source = pack.read(name).decode("utf-8")
            local.write_text(source, encoding="utf-8")
            (OUT / f"{family}-OFL.txt").write_bytes(pack.read("OFL.txt"))
    # Grow the local subset when additional UI labels need more characters.
    # The pinned full upstream source remains in the local generation cache,
    # and cache-ui-font-sources.py persists the resulting subset for offline use.
    available = set(map(int, re.findall(r"ENCODING (\d+)", source)))
    if {ord(c) for c in chars if c != "−"} - available:
        full = CACHE / ("full-" + name)
        if not full.exists():
            url = f"https://github.com/TakWolf/{family}-pixel-font/releases/download/{VERSION}/{family}-pixel-font-{size}px-monospaced-bdf-v{VERSION}.zip"
            with zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url).read())) as pack:
                full.write_bytes(pack.read(name))
        source = full.read_text(encoding="utf-8")
    ascent = int(re.search(r"FONT_ASCENT (\d+)", source)[1])
    glyphs = {}
    for block in source.split("STARTCHAR ")[1:]:
        code = int(re.search(r"ENCODING (-?\d+)", block)[1])
        if chr(code) not in chars:
            continue
        w, h, ox, oy = map(int, re.search(r"BBX ([^\n]+)", block)[1].split())
        advance = int(re.search(r"DWIDTH (\d+)", block)[1])
        rows = block.split("BITMAP\n")[1].split("ENDCHAR")[0].strip().splitlines()
        glyphs[code] = (w, h, ox, ascent - h - oy, advance, rows)
    # U+2212 uses the existing bitmap hyphen; it never falls back to browser text.
    glyphs.setdefault(ord("−"), glyphs[ord("-")])
    missing = sorted(chars - set(map(chr, glyphs)))
    if missing:
        raise RuntimeError(f"{size}px missing glyphs: {''.join(missing)}")
    cell = size + 2
    columns = 32
    atlas = Image.new("RGBA", (columns * cell, ((len(glyphs) + columns - 1) // columns) * cell))
    root = ET.Element("font")
    ET.SubElement(root, "info", face=f"Pasture Pixel {size}px (subset)", size=str(size))
    ET.SubElement(root, "common", lineHeight=str(size + 2), base=str(ascent), scaleW=str(atlas.width), scaleH=str(atlas.height), pages="1", packed="0")
    ET.SubElement(ET.SubElement(root, "pages"), "page", id="0", file=f"pasture-pixel-{size}.png")
    entries = ET.SubElement(root, "chars", count=str(len(glyphs)))
    for index, (code, (w, h, ox, oy, advance, rows)) in enumerate(sorted(glyphs.items())):
        x, y = (index % columns) * cell + 1, (index // columns) * cell + 1
        for row, bits in enumerate(rows):
            for col in range(w):
                if int(bits, 16) & (1 << (len(bits) * 4 - 1 - col)):
                    atlas.putpixel((x + col, y + row), (255, 255, 255, 255))
        ET.SubElement(entries, "char", id=str(code), x=str(x), y=str(y), width=str(w), height=str(h), xoffset=str(ox), yoffset=str(oy), xadvance=str(advance), page="0", chnl="15")
    atlas.save(OUT / f"pasture-pixel-{size}.png", optimize=True)
    ET.ElementTree(root).write(OUT / f"pasture-pixel-{size}.fnt", encoding="utf-8", xml_declaration=True)
    print(f"{size}px: {len(glyphs)} glyphs, {atlas.width}x{atlas.height}, no missing glyphs")
