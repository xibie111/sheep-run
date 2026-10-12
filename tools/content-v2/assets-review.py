"""Read-only runtime asset validation; writes B evidence, never modifies art."""
from pathlib import Path
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
base = ROOT / 'assets/content-update-v2'
assets, invalid = [], []
for path in sorted(base.glob('*/runtime/*.png')):
    image = Image.open(path).convert('RGBA')
    alpha = set(image.getchannel('A').getdata())
    hard = not (alpha - {0, 255})
    is_cutout = path.parent.parent.name in {'ui', 'landmarks'} or path.stem == 'lunchbox'
    if not hard or (is_cutout and 0 not in alpha) or (not is_cutout and alpha != {255}):
        invalid.append(path.relative_to(ROOT).as_posix())
    assets.append(dict(path=path.relative_to(ROOT).as_posix(), size=image.size, hardAlpha=hard,
                       opaque=alpha == {255}, expectedCutout=is_cutout,
                       sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
report = dict(passed=len(assets) == 19 and not invalid, count=len(assets), assets=assets, invalid=invalid)
(ROOT / 'docs/content-update-v2/asset-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(dict(passed=report['passed'], count=len(assets), invalid=invalid)))
if not report['passed']: raise SystemExit(1)
