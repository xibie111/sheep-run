"""Verify new copy coverage and retain every previous glyph's actual RGBA ink."""
from pathlib import Path
from PIL import Image
import xml.etree.ElementTree as ET
import hashlib, json, subprocess

root = Path(__file__).resolve().parents[1]
reports = []
for size in (12, 20, 40, 64):
    name = f'pasture-display-{size}'
    old_dir = root / 'docs/runner-update-v2/font-before'
    new_dir = root / 'assets/fonts'
    old = {int(e.attrib['id']): e.attrib for e in ET.parse(old_dir / f'{name}.fnt').findall('chars/char')}
    new = {int(e.attrib['id']): e.attrib for e in ET.parse(new_dir / f'{name}.fnt').findall('chars/char')}
    a, b = Image.open(old_dir / f'{name}.png').convert('RGBA'), Image.open(new_dir / f'{name}.png').convert('RGBA')
    failures = []
    def ink(image, entry):
        x, y, w, h = (int(entry[key]) for key in ('x', 'y', 'width', 'height'))
        return image.crop((x, y, x + w, y + h)).tobytes()
    for code, entry in old.items():
        newer = new.get(code)
        if newer is None or any(entry[key] != newer[key] for key in ('width', 'height', 'xoffset', 'yoffset', 'xadvance')) or ink(a, entry) != ink(b, newer):
            failures.append(chr(code))
    reports.append({'size': size, 'oldGlyphs': len(old), 'newGlyphs': len(new), 'unchangedOldInkAndMetrics': not failures,
        'failures': failures, 'alpha': sorted(set(b.getchannel('A').getdata())),
        'sha256': hashlib.sha256((new_dir / f'{name}.png').read_bytes()).hexdigest()})

protected = ['src/game/Constants.ts', 'src/entities/Sheep.ts', 'src/systems/InputSystem.ts', 'src/systems/ScoreSystem.ts',
    'src/systems/SaveSystem.ts', 'src/systems/ProgressionSystem.ts', 'src/systems/DifficultySystem.ts',
    'src/systems/ObstaclePatterns.ts', 'src/game/ObstacleDefinitions.ts', 'src/entities/Obstacle.ts', 'src/game/Viewport.ts', 'src/data/mailLetters.ts']
sources = []
for name in protected:
    before = subprocess.check_output(['git', 'show', f'HEAD:{name}'], cwd=root)
    current = (root / name).read_bytes().replace(b'\r\n', b'\n')
    sources.append({'path': name, 'unchangedAgainstHead': before == current,
        'sha256': hashlib.sha256(current).hexdigest()})

report = {'passed': all(r['unchangedOldInkAndMetrics'] and r['alpha'] == [0, 255] for r in reports) and all(r['unchangedAgainstHead'] for r in sources),
    'fonts': reports, 'protectedSources': sources, 'note': 'Font baseline is the preserved 614-glyph current checkout immediately before A added B copy; pre-existing and coordinated modifications remain intact.'}
(root / 'docs/runner-update-v2/font-and-protection.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': report['passed'], 'fonts': [[r['size'], r['oldGlyphs'], r['newGlyphs']] for r in reports], 'protectedSources': len(sources)}))
if not report['passed']:
    raise SystemExit(1)
