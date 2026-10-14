"""Extend local display atlases for six skin names, retaining prior glyph ink/metrics."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REVIEW = ROOT / "docs/skins-v5"
FONTS = ROOT / "assets/fonts"
NAMES = ["蜜蜂羊", "蘑菇羊", "厨师羊", "海盗羊", "狐狸羊", "恐龙羊"]
TEXT = "".join(sorted(set("".join(NAMES))))
SIZES = (12, 20, 40, 64)


def glyph_ink(image, entry):
    x, y, w, h = (int(entry[key]) for key in ("x", "y", "width", "height"))
    return image.crop((x, y, x + w, y + h)).tobytes()


def main():
    before = REVIEW / "fonts-before"
    before.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        for extension in ("fnt", "png"):
            path = FONTS / f"pasture-display-{size}.{extension}"
            target = before / path.name
            if not target.exists():
                shutil.copy2(path, target)
    missing = set()
    for size in SIZES:
        known = {int(c.attrib["id"]) for c in ET.parse(FONTS / f"pasture-display-{size}.fnt").findall("chars/char")}
        missing.update(c for c in TEXT if ord(c) not in known)
    if missing:
        subprocess.run([sys.executable, str(ROOT / "tools/build-display-fonts.py"), "--extra-text", TEXT], cwd=ROOT, check=True)
    reports = []
    for size in SIZES:
        name = f"pasture-display-{size}"
        old = {int(c.attrib["id"]): c.attrib for c in ET.parse(before / f"{name}.fnt").findall("chars/char")}
        new = {int(c.attrib["id"]): c.attrib for c in ET.parse(FONTS / f"{name}.fnt").findall("chars/char")}
        a = Image.open(before / f"{name}.png").convert("RGBA")
        b = Image.open(FONTS / f"{name}.png").convert("RGBA")
        retained = all(code in new and all(d[key] == new[code][key] for key in ("width", "height", "xoffset", "yoffset", "xadvance")) and glyph_ink(a, d) == glyph_ink(b, new[code]) for code, d in old.items())
        absent = "".join(c for c in TEXT if ord(c) not in new or int(new[ord(c)]["width"]) == 0)
        reports.append({"size": size, "oldGlyphs": len(old), "newGlyphs": len(new), "priorInkAndMetricsRetained": retained, "missing": absent, "hardAlpha": set(b.getchannel("A").getdata()) == {0, 255}, "pngHash": hashlib.sha256((FONTS / f"{name}.png").read_bytes()).hexdigest()})
    report = {"passed": all(r["priorInkAndMetricsRetained"] and not r["missing"] and r["hardAlpha"] for r in reports), "skinNames": NAMES, "requiredText": TEXT, "fonts": reports}
    (REVIEW / "font-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": report["passed"], "fonts": reports}, ensure_ascii=True))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
