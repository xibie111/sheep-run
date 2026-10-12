"""Crop image_gen originals and normalize alpha/pixel size; never paint replacements."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/content-update-v2/ui'
JOBS = [
    ('tripPaper', 'trip-paper-v2.png', None, 1280),
    ('tripEntry', 'ui-kit.png', (0, 0, 522, 350), 480),
    ('close', 'close.png', None, 480),
    ('chapterCard', 'ui-kit.png', (1048, 0, 1448, 350), 480),
    ('stampRecord', 'ui-kit.png', (100, 360, 450, 690), 160),
    ('stampCollection', 'ui-kit.png', (555, 360, 910, 690), 160),
    ('stampGoal', 'ui-kit.png', (1000, 360, 1360, 690), 160),
    ('stampCompanion', 'ui-kit.png', (100, 705, 450, 1030), 160),
    ('stampAnimal', 'ui-kit.png', (555, 705, 910, 1030), 160),
    ('stampLandmark', 'ui-kit.png', (1000, 705, 1360, 1030), 160),
]
records = []
for name, filename, region, width in JOBS:
    original = Image.open(BASE / 'sources' / filename).convert('RGBA')
    image = original.crop(region) if region else original.copy()
    image.putalpha(image.getchannel('A').point(lambda value: 255 if value >= 200 else 0))
    bounds = image.getbbox()
    if not bounds: raise ValueError(f'Empty generated asset: {name}')
    image = image.crop(bounds)
    aspect = image.width / image.height
    height = round(width / aspect)
    image = image.resize((width, height), Image.Resampling.NEAREST)
    destination = BASE / 'runtime' / f'{name}.png'
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination)
    records.append(dict(name=name, source=filename, sourceSize=original.size, region=region, inkBounds=bounds,
                        size=image.size, sourceAspect=aspect, aspectError=abs(width / height / aspect - 1)))
(BASE / 'processing.json').write_text(json.dumps(dict(alphaThreshold=200, filter='NEAREST', operations='region crop, hard alpha, trim, uniform scale only', assets=records), indent=2), encoding='utf-8')
print(json.dumps(records))
