"""Mechanically pack only the six built-in generated travel postcards."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/travel-postcards-v2'
REVIEW = ROOT / 'docs/travel-postcards-v2'
NAMES = ['spring-pasture', 'summer-pond', 'autumn-sunset', 'winter-sunshine', 'duck-outing', 'butterfly-path']
runtime = ASSETS / 'runtime'
runtime.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)
records = []
for name in NAMES:
    source = ASSETS / 'sources' / (name + '.png')
    prompt = ASSETS / 'prompts' / (name + '.txt')
    metadata = json.loads((ASSETS / ('art-' + name + '.json')).read_text(encoding='utf-8-sig'))
    original = Image.open(source)
    if original.width * 2 != original.height * 3:
        raise ValueError(f'{name}: expected full 3:2 image, got {original.size}')
    image = original.convert('RGBA')
    if image.getchannel('A').getextrema() != (255, 255):
        raise ValueError(f'{name}: postcard must be fully opaque')
    target = runtime / (name + '.png')
    image.resize((600, 400), Image.Resampling.NEAREST).save(target, optimize=True)
    records.append({
        'name': name, 'tool': 'builtin image_gen', 'generatedOriginal': metadata.get('generatedOriginal', metadata.get('generatedSource')),
        'source': 'sources/' + source.name, 'sourceSize': original.size,
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'runtime': 'runtime/' + target.name, 'runtimeSize': [600, 400],
        'runtimeSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'prompt': 'prompts/' + prompt.name, 'promptSha256': hashlib.sha256(prompt.read_bytes()).hexdigest(),
        'resampling': 'NEAREST', 'crop': None, 'recolor': None, 'transparent_background': False,
    })
(ASSETS / 'manifest.json').write_text(json.dumps({'version': 2, 'assets': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Preserve every earlier glyph and its rendered ink; add only the new copy.
font_dir = ROOT / 'assets/fonts'
before = REVIEW / 'fonts-before'
before.mkdir(parents=True, exist_ok=True)
for size in (12, 20, 40, 64):
    for extension in ('fnt', 'png'):
        source = font_dir / f'pasture-display-{size}.{extension}'
        if not (before / source.name).exists():
            shutil.copy2(source, before / source.name)
copy = (ROOT / 'src/scenery/sceneryCatalog.ts').read_text(encoding='utf-8')
text = ''.join(sorted(set(char for char in copy if '\u3000' <= char <= '\u303f' or '\u4e00' <= char <= '\u9fff' or '\uff00' <= char <= '\uffef')))
missing = {char for size in (12, 20, 40, 64) for char in text if ord(char) not in {int(c.attrib['id']) for c in ET.parse(font_dir / f'pasture-display-{size}.fnt').findall('chars/char')}}
if missing:
    subprocess.run([sys.executable, str(ROOT / 'tools/build-display-fonts.py'), '--extra-text', text], cwd=ROOT, check=True)
font_results = []
for size in (12, 20, 40, 64):
    name = f'pasture-display-{size}'
    old = {int(c.attrib['id']): c.attrib for c in ET.parse(before / (name + '.fnt')).findall('chars/char')}
    new = {int(c.attrib['id']): c.attrib for c in ET.parse(font_dir / (name + '.fnt')).findall('chars/char')}
    a = Image.open(before / (name + '.png')).convert('RGBA')
    b = Image.open(font_dir / (name + '.png')).convert('RGBA')
    def ink(image, d):
        x, y, w, h = (int(d[k]) for k in ('x', 'y', 'width', 'height'))
        return image.crop((x, y, x + w, y + h)).tobytes()
    retained = all(code in new and all(d[k] == new[code][k] for k in ('width', 'height', 'xoffset', 'yoffset', 'xadvance')) and ink(a, d) == ink(b, new[code]) for code, d in old.items())
    absent = ''.join(c for c in text if ord(c) not in new or not int(new[ord(c)]['width']))
    font_results.append({'size': size, 'priorInkAndMetricsRetained': retained, 'missing': absent, 'hardAlpha': set(b.getchannel('A').getdata()) == {0, 255}, 'oldGlyphs': len(old), 'newGlyphs': len(new)})
report = {'passed': all(r['priorInkAndMetricsRetained'] and not r['missing'] and r['hardAlpha'] for r in font_results), 'requiredText': text, 'fonts': font_results}
(REVIEW / 'font-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
if not report['passed']:
    raise ValueError('font preservation failed; see font-report.json')
print(json.dumps({'assets': len(records), 'fontPass': report['passed']}, ensure_ascii=True))
