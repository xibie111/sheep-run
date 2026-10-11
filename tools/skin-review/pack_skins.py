"""Pack generated art into registered frames; no painted/recolored art.

Only cut cells, snap alpha, nearest-neighbor scale and register feet. Original
inputs remain untouched. Top 16 rows are transport padding; Phaser uses the
128x112 visible frame so the existing 48x42 display has uniform pixel scale.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/skins/runtime-v1"
OUT.mkdir(parents=True, exist_ok=True)
IDS = ["white", "black", "brown", "golden", "farmer", "mint", "rose", "blueberry", "lavender", "pumpkin", "forest", "chestnut", "sunset"]
FRAME_NAMES = ["idle_1", "run_1", "run_2", "run_3", "run_4", "jump", "fall", "hit", "dash_1", "dead", "idle_2", "run_5", "run_6", "dash_2", "dead_settled"]
report = []
for skin in IDS:
    frames = []
    path = ROOT / f"assets/skins/generated-v1/{skin}-source.png"
    original = Image.open(path).convert("RGBA")
    w, h = original.size
    for i in range(15):
        frames.append(original.crop((round(i%5*w/5), round(i//5*h/3), round((i%5+1)*w/5), round((i//5+1)*h/3))))
    provenance = "image_gen"
    bounds = []
    for frame in frames:
        alpha = frame.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
        frame.putalpha(alpha)
        box = alpha.getbbox()
        if box is None:
            raise RuntimeError(f"{skin}: empty frame")
        bounds.append(box)
    # One scale per skin, not per pose: lying/dead sheep never grow in size.
    scale = min(120 / max(b[2]-b[0] for b in bounds), 104 / max(b[3]-b[1] for b in bounds))
    sheet = Image.new("RGBA", (640, 384))
    entries = []
    for i, (frame, box) in enumerate(zip(frames, bounds)):
        actor = frame.crop(box)
        actor = actor.resize((round(actor.width*scale), round(actor.height*scale)), Image.Resampling.NEAREST)
        # Airborne art stays tucked but motion/height remain controlled by code.
        bottom = 120 if i == 5 else 128
        x, y = (128-actor.width)//2, bottom-actor.height
        if y < 16:
            raise RuntimeError(f"{skin} frame {i}: crossed reserved padding")
        sheet.paste(actor, ((i%5)*128+x, (i//5)*128+y))
        entries.append({"index": i, "pose": FRAME_NAMES[i], "bbox": [x,y,x+actor.width,y+actor.height], "footBaseline": bottom})
    destination = OUT / f"{skin}-sheet.png"
    sheet.save(destination, optimize=True)
    levels = set(sheet.getchannel("A").get_flattened_data())
    assert levels == {0,255}
    report.append({"id":skin,"source":provenance,"frameWidth":128,"frameHeight":128,"frameCount":15,
                   "renderFrameWidth":128,"renderFrameHeight":112,"topPadding":16,"columns":5,"rows":3,
                   "file":destination.name,"sha256":hashlib.sha256(destination.read_bytes()).hexdigest(),"frames":entries})
(OUT / "manifest.json").write_text(json.dumps({"generatedAt":"2026-10-08","skins":report},ensure_ascii=False,indent=2),encoding="utf-8")
print(f"Packed {len(report)} sheets, 15 registered frames each, hard alpha, nearest neighbor, grounded baseline 128.")
for entry in report:
    print(entry["id"], (OUT / entry["file"]).stat().st_size)
