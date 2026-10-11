from pathlib import Path
from PIL import Image
import hashlib, json, shutil

root = Path(__file__).resolve().parents[1]
generated = Path('C:/Users/mechrevo/.codex/generated_images/01a11bdb-d0cb-7f30-aa81-e08acb61df39')
assets = root / 'assets/scenery-v1'
sources = {
    'rainbow': 'exec-ae6fe812-da27-4e34-a5b9-ad5a990e04f9.png',
    'meteors': 'exec-baef6d2f-38f5-4aac-9bd7-de8d48115290.png',
    'fireflies': 'exec-f373b6f9-4e40-4d51-8ee4-61dc3e20bae0.png',
}
records = []
for name, filename in sources.items():
    source = assets / 'sources' / (name + '.png')
    if not source.exists(): shutil.copy2(generated / filename, source)
    image = Image.open(source).convert('RGBA')
    # Mechanical proportional downscale only; retain the complete generated composition.
    size = (600, round(image.height * 600 / image.width))
    image.resize(size, Image.Resampling.NEAREST).save(assets / 'runtime' / (name + '.png'), optimize=True)
    records.append({'id': name, 'source': str(source.relative_to(assets)), 'generatedOriginal': filename,
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'sourceSize': image.size,
        'runtime': 'runtime/' + name + '.png', 'runtimeSize': size, 'resampling': 'NEAREST',
        'crop': None, 'prompt': 'prompts/' + name + '.txt', 'transparent_background': False})
(assets / 'generation.json').write_text(json.dumps({'tool': 'builtin image_gen', 'reference':
    'docs/ambient-life-review/2026-10-11/screenshots/after-remove-squirrel.png',
    'note': 'An initial parallel request failed with a network error. These three sequential calls succeeded.',
    'assets': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(records))
