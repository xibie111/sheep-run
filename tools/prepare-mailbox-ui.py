"""Pack the preserved image_gen masters; crop alpha bounds and sample nearest only."""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1] / "assets/mailbox-ui-v2"
records = []

def pack(source, name, region=None, width=None):
    path = root / "sources" / source
    original = Image.open(path).convert("RGBA")
    region = region or (0, 0, *original.size)
    tile = original.crop(region)
    bounds = tile.getchannel("A").point(lambda alpha: 255 if alpha >= 64 else 0).getbbox()
    assert bounds
    tile = tile.crop(bounds)
    size = (width, round(width * tile.height / tile.width)) if width else tile.size
    tile.resize(size, Image.Resampling.NEAREST).save(root / "runtime" / name)
    records.append(dict(source=source, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                        sourceSize=original.size, region=region, alphaBounds=bounds,
                        runtime=name, runtimeSize=size, resampling="NEAREST", alpha="preserved; threshold used for bounding box only"))

pack("letter-panel-original.png", "mail-letter-panel.png", width=940)
pack("letter-buttons-original.png", "mail-button-plain.png", (0, 0, 1619, 470), width=328)
pack("letter-buttons-original.png", "mail-button-floral.png", (0, 470, 1619, 971), width=380)
(root / "processing.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(records, ensure_ascii=False))
