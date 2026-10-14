"""Add resident/story glyphs while proving every existing glyph is retained."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/resident-stories-v1'
BEFORE = EVIDENCE / 'fonts-before'
BEFORE.mkdir(exist_ok=True)
SIZES = (12, 20, 40, 64)
FILES = [p for p in (ROOT / 'src/residents').glob('*.ts') if not p.name.endswith('.test.ts')]
FILES += [p for p in (ROOT / 'src/delivery').glob('*.ts') if not p.name.endswith('.test.ts')]
FILES += [ROOT / 'src/data/expandedAchievements.ts']
chars = set()
for path in FILES:
    if path.exists():
        chars.update(re.findall(r'[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef★−…·—“”]', path.read_text(encoding='utf-8')))
text = ''.join(sorted(chars))
for size in SIZES:
    for extension in ('png', 'fnt'):
        source = ROOT / f'assets/fonts/pasture-display-{size}.{extension}'
        target = BEFORE / source.name
        if not target.exists(): shutil.copy2(source, target)
subprocess.run([sys.executable, str(ROOT / 'tools/build-display-fonts.py'), '--extra-text', text], cwd=ROOT, check=True)
records = []
def entries(path): return {int(c.attrib['id']): c.attrib for c in ET.parse(path).findall('chars/char')}
def ink(image, entry):
    x,y,w,h = (int(entry[k]) for k in ('x','y','width','height'))
    return image.crop((x,y,x+w,y+h)).tobytes()
for size in SIZES:
    stem = f'pasture-display-{size}'
    old,new = entries(BEFORE / (stem+'.fnt')),entries(ROOT / 'assets/fonts' / (stem+'.fnt'))
    a,b = Image.open(BEFORE / (stem+'.png')).convert('RGBA'),Image.open(ROOT / 'assets/fonts' / (stem+'.png')).convert('RGBA')
    retained = all(code in new and all(entry[k] == new[code][k] for k in ('width','height','xoffset','yoffset','xadvance')) and ink(a,entry) == ink(b,new[code]) for code,entry in old.items())
    missing = ''.join(c for c in text if ord(c) not in new or int(new[ord(c)]['width']) == 0)
    records.append({'size':size,'before':len(old),'after':len(new),'retainedInkAndMetrics':retained,'missing':missing,'hardAlpha':set(b.getchannel('A').getdata())=={0,255},'sha256':hashlib.sha256((ROOT/'assets/fonts'/(stem+'.png')).read_bytes()).hexdigest()})
report = {'passed':all(r['retainedInkAndMetrics'] and not r['missing'] and r['hardAlpha'] for r in records),'text':text,'files':[str(p.relative_to(ROOT)) for p in FILES],'fonts':records}
(EVIDENCE/'font-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':report['passed'],'fonts':records}))
if not report['passed']: raise SystemExit(1)
