"""Package the approved four-season image. No redraw, color edit or shape distortion."""
from pathlib import Path
import hashlib
import json
from PIL import Image
import numpy as np
from scipy.ndimage import label, find_objects

root = Path(__file__).resolve().parents[1] / "assets/seasons/new-obstacles-v2"
path = root / "sources/four-seasons-approved.png"
source = Image.open(path).convert("RGBA")
labels, _ = label(np.array(source.getchannel("A")) >= 128)
counts = np.bincount(labels.ravel())
boxes = [(b[1].start, b[0].start, b[1].stop, b[0].stop)
         for i, b in enumerate(find_objects(labels)) if counts[i + 1] > 2000]
assert len(boxes) == 24, f"Expected 24 isolated subjects, found {len(boxes)}"
kinds = ["WoodBarrel", "MilkChurn", "FruitBasket", "MushroomCluster", "Bramble", "HangingBranch"]
seasons = ["spring", "summer", "autumn", "winter"]
atlas = Image.new("RGBA", (280 * 6, 232 * 4))
frames, processing = {}, []
for row, (season, y0, y1) in enumerate(zip(seasons, [90, 340, 568, 792], [340, 568, 792, 1030])):
    subjects = sorted([b for b in boxes if y0 <= b[1] < y1], key=lambda b: b[0])
    assert len(subjects) == 6
    frames[season] = {}
    for column, (kind, box) in enumerate(zip(kinds, subjects)):
        tile = source.crop(box)
        assert tile.width <= 276 and tile.height <= 228
        x, y = column * 280 + 2, row * 232 + 2
        atlas.paste(tile, (x, y))
        frames[season][kind] = dict(x=x, y=y, width=tile.width, height=tile.height)
        processing.append(dict(season=season, kind=kind, sourceBounds=box, frame=frames[season][kind]))
atlas.save(root / "runtime/new-obstacles-atlas.png")
(root / "frames.json").write_text(json.dumps(frames, indent=2), encoding="utf-8")
(root / "processing.json").write_text(json.dumps(dict(
    sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(), sourceSize=source.size,
    runtimeSize=atlas.size, sourceUnmodified=True, resampling="none during packing; nearest-neighbor uniform fit at runtime",
    alpha="preserved during packing; runtime uses existing >=128 hard-edge convention", frames=processing), indent=2), encoding="utf-8")
print(f"Packed {len(processing)} sprites into {atlas.size}")
