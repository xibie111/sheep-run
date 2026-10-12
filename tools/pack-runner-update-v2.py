"""Package built-in generated runner artwork, preserving sampled RGBA pixels.

This is deterministic runtime sizing, not artwork generation or background
replacement. Originals and prompts remain untouched in the versioned directory.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/runner-update-v2'
IDS = ('goal-panel', 'goal-stamp', 'response-star', 'response-crown', 'response-heart')
LABELS = ('目标提示框', '本局印章', '伙伴开心', '纪录皇冠', '爱心告别')
VISIBLE_ALPHA = 16
entries = []
preview = Image.new('RGBA', (720, 270), '#fff1d0')
draw = ImageDraw.Draw(preview)
label = ImageFont.truetype(str(ROOT / 'tools/font-sources/ZCOOLKuaiLe-Regular.ttf'), 18)

for index, art_id in enumerate(IDS):
    source = ASSETS / 'sources' / f'{art_id}.png'
    original = Image.open(source)
    if original.mode != 'RGBA':
        raise ValueError(f'Expected original generated RGBA transparency: {source}')
    alpha = original.getchannel('A')
    minimum, maximum = alpha.getextrema()
    if minimum != 0 or maximum < 128:
        raise ValueError(f'Expected transparent surroundings and a visible object: {source}')
    visible_bounds = alpha.point(lambda value: 255 if value > VISIBLE_ALPHA else 0).getbbox()
    if visible_bounds is None:
        raise ValueError(f'Empty artwork: {source}')
    x0, y0, x1, y1 = visible_bounds
    crop_bounds = (max(0, x0 - 1), max(0, y0 - 1), min(original.width, x1 + 1), min(original.height, y1 + 1))
    crop = original.crop(crop_bounds)
    target = 232 if art_id == 'goal-panel' else 28
    scale = target / (crop.width if art_id == 'goal-panel' else max(crop.size))
    content_size = tuple(max(1, round(value * scale)) for value in crop.size)
    content = crop.resize(content_size, Image.Resampling.NEAREST)
    if art_id == 'goal-panel':
        runtime = content
        position = (0, 0)
    else:
        runtime = Image.new('RGBA', (32, 32))
        position = ((32 - content.width) // 2, (32 - content.height) // 2)
        # No mask: retain the nearest-neighbour sampled alpha exactly once.
        runtime.paste(content, position)
    output = ASSETS / 'runtime' / f'{art_id}.png'
    output.parent.mkdir(parents=True, exist_ok=True)
    runtime.save(output, optimize=True)
    entries.append({
        'id': art_id, 'source': f'sources/{source.name}', 'sourceSize': original.size,
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourceAlphaExtrema': (minimum, maximum), 'visibleBounds': visible_bounds, 'crop': crop_bounds,
        'contentSize': content_size, 'position': position, 'runtime': f'runtime/{output.name}',
        'runtimeSize': runtime.size, 'runtimeSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'runtimeAlphaExtrema': runtime.getchannel('A').getextrema(),
        'note': 'Original alpha maximum 254 retained; faint outside glow excluded by framing only'
            if maximum == 254 else 'Original generated RGBA retained',
    })
    if index == 0:
        large = runtime.resize((runtime.width * 2, runtime.height * 2), Image.Resampling.NEAREST)
        preview.alpha_composite(large, ((preview.width - large.width) // 2, 10))
        draw.text((360, 100), LABELS[index], font=label, fill='#4b2a1a', anchor='mm')
    else:
        x = (index - 1) * 180
        preview.alpha_composite(runtime.resize((128, 128), Image.Resampling.NEAREST), (x + 26, 118))
        draw.text((x + 90, 260), LABELS[index], font=label, fill='#4b2a1a', anchor='mm')

metadata = {
    'tool': 'tools/pack-runner-update-v2.py', 'artworkMode': 'Built-in image_gen; originals/prompts saved separately',
    'resampling': 'NEAREST', 'visibleAlphaThreshold': VISIBLE_ALPHA, 'sourceCropMarginPx': 1,
    'panelMaxWidth': 232, 'iconTile': (32, 32), 'iconContentMaxEdge': 28,
    'alpha': 'Sampled original RGBA retained. No color key, recolouring, alpha replacement or drawing on artwork.',
    'entries': entries,
}
(ASSETS / 'processing.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
preview.save(ASSETS / 'preview.png', optimize=True)
print(json.dumps({'packaged': len(entries), 'runtimeSizes': {entry['id']: entry['runtimeSize'] for entry in entries},
                  'runtimeBytes': sum((ASSETS / entry['runtime']).stat().st_size for entry in entries)}, ensure_ascii=False))
