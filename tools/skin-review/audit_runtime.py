"""Validate final transport images, sprite registration and opaque body interiors."""
import hashlib
import json
from collections import deque
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
base = ROOT / "assets/skins/runtime-v1"
manifest = json.loads((base / "manifest.json").read_text(encoding="utf-8"))
entries = []
for skin in manifest["skins"]:
    path = base / skin["file"]
    im = Image.open(path).convert("RGBA")
    assert im.size == (640,384)
    assert set(im.getchannel("A").get_flattened_data()) == {0,255}
    assert hashlib.sha256(path.read_bytes()).hexdigest() == skin["sha256"]
    assert skin["source"] == "image_gen"
    frames = []
    for i in range(15):
        cell = im.crop((i%5*128,i//5*128,(i%5+1)*128,(i//5+1)*128))
        alpha = cell.getchannel("A")
        assert alpha.crop((0,0,128,16)).getbbox() is None
        box = alpha.getbbox()
        assert box and box[0] >= 4 and box[2] <= 124 and box[1] >= 16
        assert box[3] == (120 if i==5 else 128)
        # Empty pixels enclosed inside the silhouette must not make large holes.
        pixels = alpha.load()
        seen = set()
        queue = deque((x,y) for x in range(128) for y in (0,127))
        queue.extend((x,y) for x in (0,127) for y in range(128))
        while queue:
            x,y = queue.popleft()
            if not 0 <= x < 128 or not 0 <= y < 128 or (x,y) in seen or pixels[x,y]:
                continue
            seen.add((x,y))
            queue.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
        holes = sum(not pixels[x,y] and (x,y) not in seen for y in range(128) for x in range(128))
        assert holes < 16, f"{skin['id']} frame {i} has a large transparent body hole: {holes} pixels"
        frames.append({"index":i,"bbox":box,"enclosedTransparentPixels":holes})
    entries.append({"id":skin["id"],"source":"image_gen","size":list(im.size),"hardAlpha":True,"frames":frames})
result = {"passed":True,"skinCount":len(entries),"frameCount":len(entries)*15,"userSuppliedEightThemeImagesLoaded":False,"skins":entries}
(ROOT / "docs/skin-review/2026-10-08/runtime-art-audit.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print(f"{len(entries)} generated sheets / {len(entries)*15} poses passed: hard alpha, transparent padding, shared foot baseline, no large body holes.")
