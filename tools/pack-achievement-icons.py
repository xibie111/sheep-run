"""Package generated originals into native pixel icons without redrawing the art.

Original RGBA files and image_gen prompts stay under the versioned asset folder.
Runtime files retain the generated alpha; resampling uses nearest neighbour only.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/achievement-icons-v1'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--partial', action='store_true', help='Inspect completed originals during generation')
args = parser.parse_args()
catalog = re.findall(r'\{id:"([^"]+)",metric:"[^"]+",name:"([^"]+)"', (ROOT / 'src/data/journeyBook.ts').read_text(encoding='utf-8'))
entries = []
preview = Image.new('RGBA', (5 * 144, 4 * 150), '#fff1d0')
label = ImageFont.truetype(str(ROOT / 'tools/font-sources/ZCOOLKuaiLe-Regular.ttf'), 16)
draw = ImageDraw.Draw(preview)
for index, (achievement_id, name) in enumerate(catalog):
    source = ASSETS / 'sources' / f'{achievement_id}.png'
    if not source.exists():
        if args.partial:
            continue
        raise FileNotFoundError(source)
    original = Image.open(source).convert('RGBA')
    alpha = original.getchannel('A')
    if alpha.getextrema() != (0, 255):
        raise ValueError(f'Expected real transparent cutout: {source}')
    bounds = alpha.point(lambda value: 255 if value > 16 else 0).getbbox()
    if bounds is None:
        raise ValueError(f'Empty generated art: {source}')
    # Ignore nearly invisible edge noise for framing, keeping a full source pixel
    # around the visible silhouette. No color or alpha channel is replaced.
    x0, y0, x1, y1 = bounds
    bounds = (max(0, x0 - 1), max(0, y0 - 1), min(original.width, x1 + 1), min(original.height, y1 + 1))
    crop = original.crop(bounds)
    ratio = 28 / max(crop.size)
    size = tuple(max(1, round(value * ratio)) for value in crop.size)
    reduced = crop.resize(size, Image.Resampling.NEAREST)
    icon = Image.new('RGBA', (32, 32))
    position = ((32 - size[0]) // 2, (32 - size[1]) // 2)
    icon.paste(reduced, position)
    output = ASSETS / 'runtime' / f'{achievement_id}.png'
    icon.save(output, optimize=True)
    entries.append({'id': achievement_id, 'source': f'sources/{source.name}', 'sourceSize': original.size,
                    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'crop': bounds,
                    'contentSize': size, 'position': position, 'runtime': f'runtime/{output.name}',
                    'runtimeSize': icon.size, 'runtimeSha256': hashlib.sha256(output.read_bytes()).hexdigest()})
    x, y = index % 5 * 144, index // 5 * 150
    preview.alpha_composite(icon.resize((112, 112), Image.Resampling.NEAREST), (x + 16, y + 5))
    draw.text((x + 72, y + 124), name, font=label, fill='#4b2a1a', anchor='mm')
(ASSETS / 'processing.json').write_text(json.dumps({'tool': 'tools/pack-achievement-icons.py', 'runtimeSize': [32, 32],
    'contentMaxSize': 28, 'resampling': 'NEAREST', 'alpha': 'Generated alpha retained; no color key or background replacement',
    'entries': entries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
preview.save(ASSETS / 'preview.png', optimize=True)
print(f'Packaged {len(entries)} / {len(catalog)} native achievement icons')
