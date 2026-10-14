"""Prepare generated originals for runtime without drawing or replacing any art.

Backgrounds are uniformly center-cropped to 16:9 and sampled with NEAREST.
Transparent sprites are alpha-bounded and uniformly contained in 128px cells.
All originals remain byte-identical; the report records every crop and checksum.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'assets/resident-stories-v1'
SOURCE, OUTPUT = ART / 'sources', ART / 'runtime'
REVISION = ART / 'revision-menu-style/sources'
OUTPUT.mkdir(exist_ok=True)
records = []
SLUGS = ['windmill-thanks', 'windmill-photo', 'riverside-thanks', 'riverside-sunshine', 'lighthouse-old-letter', 'lighthouse-gathering']
MIDDLES = ['windmill-middle', 'riverside-middle', 'lighthouse-middle']
REVISED = {slug + suffix for slug in SLUGS for suffix in ('-destination', '-ending')}
REVISED.update(['ahe-keepsake', 'xiaomu-keepsake', 'adeng-keepsake', 'group-photo', *MIDDLES])
missing = [name for name in sorted(REVISED) if not (REVISION / (name + '.png')).is_file()]
if missing:
    raise FileNotFoundError('Menu-style revision is incomplete: ' + ', '.join(missing))

def save(source_name, target_name, size, transparent=False, quadrant=None):
    path = (REVISION if source_name in REVISED else SOURCE) / (source_name + '.png')
    source_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    original = Image.open(path).convert('RGBA')
    region = (0, 0, original.width, original.height)
    if quadrant is not None:
        x, y = quadrant % 2, quadrant // 2
        region = (x * original.width // 2, y * original.height // 2, (x + 1) * original.width // 2, (y + 1) * original.height // 2)
    image = original.crop(region)
    crop = (0, 0, image.width, image.height)
    if transparent:
        # Remove generator's near-invisible alpha speckles; retain crisp sprite ink.
        alpha = image.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
        crop = alpha.getbbox()
        if not crop:
            raise ValueError(f'Empty generated sprite: {source_name}/{quadrant}')
        image.putalpha(alpha)
        image = image.crop(crop)
        fitted = ImageOps.contain(image, (size[0] - 12, size[1] - 12), Image.Resampling.NEAREST)
        prepared = Image.new('RGBA', size)
        prepared.alpha_composite(fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2))
    else:
        prepared = ImageOps.fit(image.convert('RGB'), size, method=Image.Resampling.NEAREST, centering=(.5, .5)).convert('RGBA')
    target = OUTPUT / (target_name + '.png')
    prepared.save(target)
    assert hashlib.sha256(path.read_bytes()).hexdigest() == source_hash
    records.append({'source': path.relative_to(ART).as_posix(), 'sourceSha256': source_hash,
                    'originalSize': list(original.size), 'region': list(region), 'alphaCrop': list(crop),
                    'alphaCutoff': 128 if transparent else None, 'uniformScale': True, 'sampler': 'NEAREST',
                    'output': target.relative_to(ART).as_posix(), 'size': list(size),
                    'outputSha256': hashlib.sha256(target.read_bytes()).hexdigest()})

for resident in ['ahe', 'xiaomu', 'adeng']:
    save(resident, resident + '-npc', (128, 128), True)
    save(resident, resident + '-portrait', (128, 128), True)
    save(resident + '-keepsake', resident + '-keepsake', (960, 540))
for neighbor in ['flower-neighbor', 'bridge-neighbor', 'harbor-neighbor']:
    save(neighbor, neighbor, (128, 128), True)
save('group-photo', 'group-photo', (960, 540))
for index, resident in enumerate(['ahe', 'xiaomu', 'adeng']):
    save(resident + '-kit', resident + '-envelope', (128, 128), True, 0)
    save(resident + '-kit', resident + '-ordinary', (128, 128), True, 1)
    save(resident + '-kit', SLUGS[index * 2] + '-stamp', (128, 128), True, 2)
    save(resident + '-kit', SLUGS[index * 2 + 1] + '-stamp', (128, 128), True, 3)
for slug in SLUGS:
    save(slug + '-destination', slug + '-destination', (960, 540))
    save(slug + '-ending', slug + '-ending', (960, 540))
    save(slug + '-ending', slug + '-postcard', (640, 360))
for middle in MIDDLES:
    save(middle, middle, (960, 540))
(ART / 'processing.json').write_text(json.dumps({'generatedOnly': True, 'originalsUnmodified': True, 'records': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'runtimeAssets': len(records), 'originalsUnmodified': True}))
