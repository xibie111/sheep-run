"""Package generated wildlife without repainting, recoloring, or changing the source."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'assets/ambient-life-v1'
source_path = ART / 'sources/animals-clean-v2.png'
source = Image.open(source_path).convert('RGBA')
# Measured gutters in the generated 1774 x 886 approval atlas, not an assumed grid.
rows = [
    (0, 306, [0, 320, 636, 902, 1145, 1555, 1774], ['duck-0', 'duck-1', 'duckling-0', 'duckling-1', 'pond', 'ripple']),
    (306, 594, [0, 322, 632, 924, 1244, 1495, 1774], ['squirrel-run-0', 'squirrel-run-1', 'squirrel-dig', 'squirrel-pat', 'acorn', 'soil']),
    (594, 886, [0, 315, 630, 950, 1290, 1540, 1774], ['rabbit-idle', 'rabbit-hop', 'rabbit-land', 'rabbit-run', 'butterfly-open', 'butterfly-closed']),
]
packed = Image.new('RGBA', (1024, 296))
frames = {}
processing = []
crops = []
for row, (top, bottom, columns, names) in enumerate(rows):
    for col, name in enumerate(names):
        cell = tuple(round(n * (source.width / 1774 if i % 2 == 0 else source.height / 886))
                     for i, n in enumerate((columns[col], top, columns[col + 1], bottom)))
        rgba = np.asarray(source.crop(cell))
        ys, xs = np.where(rgba[:, :, 3] >= 128)
        if not len(xs):
            raise ValueError(f'Missing visible pixels: {name}')
        bounds = (cell[0] + int(xs.min()), cell[1] + int(ys.min()), cell[0] + int(xs.max()) + 1, cell[1] + int(ys.max()) + 1)
        sprite = source.crop(bounds)
        if sprite.width > 396 or sprite.height > 252:
            raise ValueError(f'Unexpected sprite dimensions: {name} {sprite.size}')
        group = ('squirrel' if name.startswith('squirrel') else 'rabbit' if name.startswith('rabbit')
                 else 'butterfly' if name.startswith('butterfly') else 'duckling' if name.startswith('duckling')
                 else 'duck' if name.startswith('duck-') else name)
        crops.append(dict(name=name, group=group, row=row, sprite=sprite, sourceBounds=bounds))
target_heights = dict(duck=56, duckling=24, pond=128, ripple=8, squirrel=72, acorn=16, soil=12, rabbit=68, butterfly=24)
group_scales = {g: target_heights[g] / max(c['sprite'].height for c in crops if c['group'] == g) for g in target_heights}
row_top = [2, 136, 216]
row_x = [2, 2, 2]
for crop in crops:
    name, row, sprite = crop['name'], crop['row'], crop['sprite']
    scale = group_scales[crop['group']]
    sprite = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.Resampling.NEAREST)
    x, y = row_x[row], row_top[row]
    assert x + sprite.width < packed.width and y + sprite.height < packed.height
    packed.paste(sprite, (x, y))
    frames[name] = dict(x=x, y=y, width=sprite.width, height=sprite.height)
    processing.append(dict(name=name, sourceBounds=crop['sourceBounds'], nearestScale=scale, packed=frames[name]))
    row_x[row] += sprite.width + 4
(ART / 'runtime').mkdir(exist_ok=True)
packed.save(ART / 'runtime/animals-atlas.png', optimize=True)
(ART / 'frames.json').write_text(json.dumps(frames, indent=2) + '\n', encoding='utf-8')
(ART / 'processing.json').write_text(json.dumps(dict(
    source='sources/animals-clean-v2.png', sourceSha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
    sourceSize=source.size, runtimeSize=packed.size, operations='Crop, uniform nearest-neighbor resize at 4x logical display size (one scale per animation group), and pack. No repainting or recoloring. Source retained untouched. Runtime uses existing hard-alpha >=128 convention.',
    frames=processing), indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(frames=len(frames), sourceSize=source.size, runtimeSize=packed.size)))
