"""Deterministic crop / hard-alpha / nearest-neighbor only, no new drawing."""
import hashlib
import json
from pathlib import Path
from PIL import Image

BASE = Path(__file__).resolve().parents[2] / 'assets/delivery-expansion-v1/ui'
OUTPUT = BASE / 'runtime'
OUTPUT.mkdir(parents=True, exist_ok=True)
parts = [
    ('page-paper', 'ui-frames-original.png', (0, 0, 950, 520), 512),
    ('chapter-frame', 'ui-frames-original.png', (950, 0, 1536, 520), 256),
    ('action-button', 'ui-frames-original.png', (0, 520, 950, 1024), 384),
    ('keepsake-slot', 'ui-frames-original.png', (950, 520, 1536, 1024), 96),
]
icons = ['rating-gold', 'rating-gray', 'stamp-counter', 'stamp-album', 'page-previous', 'page-next', 'lock', 'complete-seal']
icon_sheet = Image.open(BASE / 'sources/ui-icons-original.png')
for index, name in enumerate(icons):
    col, row = index % 4, index // 4
    bounds = (round(col * icon_sheet.width / 4), round(row * icon_sheet.height / 2),
              round((col + 1) * icon_sheet.width / 4), round((row + 1) * icon_sheet.height / 2))
    parts.append((name, 'ui-icons-original.png', bounds, 64))
report = {'kind': 'generated-art-crop-only', 'alphaThreshold': 96, 'filter': 'NEAREST', 'parts': []}
for name, filename, bounds, longest in parts:
    source = BASE / 'sources' / filename
    image = Image.open(source).convert('RGBA').crop(bounds)
    alpha = image.getchannel('A').point(lambda value: 255 if value >= 96 else 0)
    image.putalpha(alpha)
    ink = alpha.getbbox()
    if not ink:
        raise ValueError(f'empty generated asset: {name}')
    image = image.crop(ink)
    ratio = longest / max(image.size)
    size = (max(1, round(image.width * ratio)), max(1, round(image.height * ratio)))
    image = image.resize(size, Image.Resampling.NEAREST)
    output = OUTPUT / f'{name}.png'
    image.save(output)
    report['parts'].append({'name': name, 'source': filename, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                            'cropRegion': bounds, 'trimBox': ink, 'runtimeSize': size,
                            'runtimeSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                            'transparent': image.getchannel('A').getextrema() == (0, 255)})
(BASE / 'processing.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'parts': len(parts), 'runtime': str(OUTPUT)}))
