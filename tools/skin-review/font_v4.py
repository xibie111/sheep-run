"""Extend the existing display font only with skin/purchase text; verify retained ink."""
from pathlib import Path
import re, json, shutil, subprocess, sys
import xml.etree.ElementTree as ET
from PIL import Image
root = Path(__file__).resolve().parents[2]
before = root / 'docs/skins-v4/fonts-before'
before.mkdir(parents=True, exist_ok=True)
fonts = root / 'assets/fonts'
for size in (12, 20, 40, 64):
    for extension in ('png', 'fnt'):
        name = f'pasture-display-{size}.{extension}'
        if not (before / name).exists(): shutil.copy2(fonts / name, before / name)
files = ['src/scenes/WardrobeScene.ts','src/ui/WardrobePurchase.ts','src/data/sheepSkins.ts','src/data/skinSpriteAssets.ts']
copy = ''.join(sorted(set(''.join(''.join(re.findall(r'[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]', (root / file).read_text(encoding='utf-8'))) for file in files))))
delivery_copy = root / 'docs/delivery-expansion-v1/required-font.txt'
if delivery_copy.exists():
    copy = ''.join(sorted(set(copy + ''.join(re.findall(r'[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]', delivery_copy.read_text(encoding='utf-8'))))))
    files.append(delivery_copy.relative_to(root).as_posix())
subprocess.run([sys.executable, str(root / 'tools/build-display-fonts.py'), '--extra-text', copy], cwd=root, check=True)
reports = []
for size in (12,20,40,64):
    name = f'pasture-display-{size}'
    old = {int(c.attrib['id']):c.attrib for c in ET.parse(before / f'{name}.fnt').findall('chars/char')}
    new = {int(c.attrib['id']):c.attrib for c in ET.parse(fonts / f'{name}.fnt').findall('chars/char')}
    a,b = Image.open(before / f'{name}.png').convert('RGBA'),Image.open(fonts / f'{name}.png').convert('RGBA')
    def ink(image, d):
        x,y,w,h = [int(d[k]) for k in ('x','y','width','height')]
        return image.crop((x,y,x+w,y+h)).tobytes()
    retained = all(code in new and all(d[k] == new[code][k] for k in ('width','height','xoffset','yoffset','xadvance')) and ink(a,d) == ink(b,new[code]) for code,d in old.items())
    missing = ''.join(c for c in copy if ord(c) not in new or (int(new[ord(c)]['width']) <= 0 and not c.isspace()))
    reports.append({'size':size,'oldGlyphs':len(old),'newGlyphs':len(new),'oldInkAndMetricsRetained':retained,'missing':missing,'hardAlpha':set(b.getchannel('A').getdata()) == {0,255}})
report = {'passed':all(r['oldInkAndMetricsRetained'] and not r['missing'] and r['hardAlpha'] for r in reports),'fonts':reports,'copy':copy,'sourceFiles':files}
(root / 'docs/skins-v4/font-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':report['passed'],'fonts':[[r['size'],r['oldGlyphs'],r['newGlyphs']] for r in reports]}))
if not report['passed']: raise SystemExit(1)
