"""Deterministic crop/nearest-neighbor packing of built-in image_gen output; no painting."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[2]
folder = root / 'assets/content-update-v2/delivery'
records = []
for name in ['dusk-pasture', 'field', 'cottage', 'dinner-ending', 'lunchbox']:
    source = Image.open(folder / 'sources' / f'{name}.png').convert('RGBA')
    crop = (0, 0, source.width, source.height)
    if name == 'lunchbox':
        crop = source.getchannel('A').getbbox()
        if not crop: raise ValueError('empty lunchbox alpha')
        source = source.crop(crop)
        target = (64, max(1, round(source.height * 64 / source.width)))
    else:
        target = (960, round(source.height * 960 / source.width))
    output = source.resize(target, Image.Resampling.NEAREST)
    if name == 'lunchbox':
        output.putalpha(output.getchannel('A').point(lambda alpha: 255 if alpha >= 96 else 0))
    output.save(folder / 'runtime' / f'{name}.png')
    records.append({'name': name, 'crop': crop, 'output': target, 'resampling': 'NEAREST',
        'sourceAlphaRetainedInOriginal': True, 'runtimeAlpha': 'hard 0/255 threshold96' if name == 'lunchbox' else 'original opaque'})
# Postcard uses the same generated dinner illustration; its separate frame is generated in the shared UI pack.
(folder / 'runtime' / 'dinner-postcard.png').write_bytes((folder / 'runtime' / 'dinner-ending.png').read_bytes())
(folder / 'processing.json').write_text(json.dumps({'tool': 'built-in image_gen', 'packing': records,
    'postcard': 'dinner-ending illustration with generated chapterCard frame drawn at runtime',
    'referenceRoles': {'backgrounds/menu-pasture-v1.png': 'style and environment', 'skins/generated-v1/white-source.png': 'character identity'}}, indent=2), encoding='utf-8')
