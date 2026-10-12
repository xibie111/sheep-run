"""Crop generated alpha silhouettes and reduce by NEAREST; never repaint source art."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/content-update-v2/landmarks'
WIDTHS = {'windmill': 124, 'barn': 180, 'bridge': 220}
records = []
for name, width in WIDTHS.items():
    source = Image.open(BASE / 'sources' / f'{name}-v1.png').convert('RGBA')
    # Built-in generations retain transparency; cut residual low-alpha glow only.
    # This is deterministic texture preparation, not art replacement.
    alpha = source.getchannel('A').point(lambda a: 255 if a >= 200 else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f'No opaque subject: {name}')
    source.putalpha(alpha)
    crop = source.crop(bbox)
    height = round(crop.height * width / crop.width)
    output = crop.resize((width, height), Image.Resampling.NEAREST)
    output.save(BASE / 'runtime' / f'{name}.png')
    records.append({'id': name, 'sourceSize': list(source.size), 'crop': list(bbox),
                    'runtimeSize': list(output.size), 'logicalScale': 0.5,
                    'alphaThreshold': 200, 'resampling': 'NEAREST',
                    'runtimeAlphaValues': sorted(set(output.getchannel('A').getdata()))})
(BASE / 'processing.json').write_text(json.dumps({'tool': 'built-in image_gen', 'assets': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(records, ensure_ascii=False, indent=2))
