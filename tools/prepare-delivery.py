"""Mechanical nearest-neighbour preparation of the retained built-in ImageGen art."""
from pathlib import Path
from PIL import Image
import hashlib, json
root = Path(__file__).resolve().parents[1]
assets = root / 'assets/delivery-v1'
records = []
original_names = {
    'forest': 'exec-bd3f6b40-0464-4714-85ed-9802b224eb81.png',
    'hill': 'exec-85f02643-3294-4faa-bc85-045ab23433e7.png',
    'postcard': 'exec-2dc2d48f-aeb1-49b0-bcec-b7c02752ced2.png',
}
for name in ('forest', 'hill', 'postcard'):
    source = assets / 'sources' / f'{name}.png'
    image = Image.open(source).convert('RGBA')
    width = 600 if name == 'postcard' else 960
    size = (width, round(image.height * width / image.width))
    image.resize(size, Image.Resampling.NEAREST).save(assets / 'runtime' / f'{name}.png', optimize=True)
    records.append({'name': name, 'source': f'sources/{name}.png', 'prompt': f'prompts/{name}.txt',
        'runtime': f'runtime/{name}.png', 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'generatedOriginal': original_names[name],
        'sourceSize': image.size, 'runtimeSize': size, 'crop': None, 'resampling': 'NEAREST',
        'transparent_background': False})
(assets / 'generation.json').write_text(json.dumps({'tool': 'builtin image_gen',
    'reference': 'assets/backgrounds/run-pasture-v1.png', 'assets': records,
    'runtimeFrames': 'Landscapes: upper 75 percent of full image; lower 25 percent becomes the scrolling road. No repainting.'}, indent=2) + '\n', encoding='utf-8')
print(json.dumps(records))
