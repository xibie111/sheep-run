"""Read-only structural/registration audit of the user-supplied 128px skins."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(r"E:\新建文件夹\sheep_pixel_farm_skins__128x")
OUT = Path(__file__).resolve().parents[2] / "docs/skin-review/2026-10-08"
OUT.mkdir(parents=True, exist_ok=True)
results = []
for folder in sorted(p for p in ROOT.iterdir() if p.is_dir()):
    base = folder / "sheep_sprites"
    data = json.loads((base / "sheep-animations.json").read_text(encoding="utf-8-sig"))
    sheet = Image.open(base / "sheep-sheet.png").convert("RGBA")
    names = [name for group in data["animations"].values() for name in group]
    frames = []
    for i, name in enumerate(names):
        path = base / name
        im = Image.open(path).convert("RGBA")
        alpha = im.getchannel("A")
        bbox = alpha.getbbox()
        tile = sheet.crop(((i % 6)*128, (i // 6)*128, (i % 6+1)*128, (i // 6+1)*128))
        # Hidden RGB in transparent pixels does not affect rendered equality.
        same = im.tobytes() == tile.tobytes()
        frames.append({"file": name, "size": list(im.size), "bbox": bbox,
                       "alphaLevels": len(set(alpha.getdata())),
                       "partialAlphaPixels": sum(0 < a < 255 for a in alpha.getdata()),
                       "sheetMatches": same, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    grounded = [f for f in frames if f["file"].startswith(("idle_", "run_"))]
    bottom = [f["bbox"][3] for f in grounded]
    results.append({"id": folder.name, "name": data["displayName"], "sheetSize": list(sheet.size),
                    "frameCount": len(names), "frames": frames,
                    "groundedBottomRange": [min(bottom), max(bottom)],
                    "transparentGroundGapAt42px": round((128-max(bottom))*42/128, 3),
                    "validSizes": all(f["size"] == [128,128] for f in frames),
                    "singleFrameOrder": names,
                    "allSheetTilesMatch": all(f["sheetMatches"] for f in frames)})
report = {"source": str(ROOT), "skins": results, "note": "Physics values live in code, not PNG files. Raw foot padding must be compensated in the rendering adapter; do not change gravity, impulses or hitboxes."}
(OUT / "source-assets-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
for skin in results:
    print(json.dumps({k: skin[k] for k in ["id","name","sheetSize","frameCount","groundedBottomRange","transparentGroundGapAt42px","validSizes","allSheetTilesMatch"]}, ensure_ascii=False))
    print("partial-alpha:", sum(f["partialAlphaPixels"] for f in skin["frames"]))
