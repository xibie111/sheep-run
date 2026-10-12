"""Pack ONLY built-in generated chapter art: crop, alpha trim, uniform nearest.

Inputs under assets/delivery-expansion-v1/chapters/sources:
  {windmill,rain,lighthouse}-backgrounds.png : three stacked 16:9 panels
  {windmill,rain,lighthouse}-ending.png : complete 16:9 illustrations
  items.png : genuinely transparent 3x3 sprite contact sheet (rows are chapters;
              columns are carried, ordinary stamp, commemorative stamp)
No backgrounds, characters, borders or sprites are drawn by this script.
It never overwrites sources. It refuses missing or opaque cutouts.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/delivery-expansion-v1/chapters'
SOURCE, RUNTIME = BASE / 'sources', BASE / 'runtime'
NAMES = ('windmill', 'rain', 'lighthouse')
# Inspected generated atlas seams and the first >=90%-clear tan road row.
# Keep the complete valid panel; exclude separator pixels and align road at72%.
PANELS = {
    'windmill': ((0,543,388),(543,1083,931),(1083,1672,1485)),
    'rain': ((0,543,379),(543,1082,918),(1082,1672,1473)),
    'lighthouse': ((0,534,382),(534,1059,910),(1059,1672,1454)),
}
records = []

def fit_crop(image, ratio=16/9):
    width, height = image.size
    if width / height > ratio:
        crop_width = round(height * ratio)
        left = (width - crop_width) // 2
        box = (left, 0, left + crop_width, height)
    else:
        crop_height = round(width / ratio)
        top = (height - crop_height) // 2
        box = (0, top, width, top + crop_height)
    return image.crop(box), box

def save(name, image, source, crop, max_size, cutout=False):
    image = image.convert('RGBA')
    trim = None
    if cutout:
        alpha = image.getchannel('A')
        if alpha.getextrema()[0] >= 255:
            raise ValueError(f'{name}: source has no genuine transparent background')
        alpha = alpha.point(lambda a: 255 if a >= 96 else 0)
        image.putalpha(alpha)
        trim = alpha.getbbox()
        if not trim: raise ValueError(f'{name}: transparent sprite is empty')
        image = image.crop(trim)
    elif image.getchannel('A').getextrema() != (255, 255):
        raise ValueError(f'{name}: full background/illustration must be opaque')
    scale = min(max_size[0] / image.width, max_size[1] / image.height)
    size = (max(1, round(image.width*scale)), max(1, round(image.height*scale)))
    image = image.resize(size, Image.Resampling.NEAREST)
    if cutout:
        # Transparent padding only; never author bitmap art in the processing step.
        canvas=Image.new('RGBA',max_size,(0,0,0,0))
        canvas.alpha_composite(image,((max_size[0]-image.width)//2,(max_size[1]-image.height)//2))
        image=canvas
    destination = RUNTIME / f'{name}.png'
    image.save(destination)
    records.append({'name': name, 'source': str(source.relative_to(BASE)),
                    'crop': list(crop), 'alphaTrim': list(trim) if trim else None,
                    'size': list(image.size), 'uniformScale': scale,
                    'resampling': 'NEAREST', 'alpha': 'hard 0/255 threshold96' if cutout else 'original opaque',
                    'runtime': str(destination.relative_to(BASE))})

def main():
    required = [SOURCE / f'{name}-{kind}.png' for name in NAMES for kind in ('backgrounds', 'ending')]
    required.append(SOURCE/'items.png')
    required.append(SOURCE/'windmill-destination-v2.png')
    missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
    if missing: raise FileNotFoundError('Built-in imagegen outputs missing: '+', '.join(missing))
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        source = SOURCE/f'{name}-backgrounds.png'
        with Image.open(source) as atlas:
            for stage,(start,end,road_y) in zip(('pasture','middle','destination'),PANELS[name]):
                if name=='windmill' and stage=='destination':
                    # Targeted built-in redraw keeps all four windmill sails in view.
                    replacement=SOURCE/'windmill-destination-v2.png'
                    with Image.open(replacement) as illustration:
                        crop=(44,1,1628,892)
                        save(f'{name}-{stage}',illustration.crop(crop),replacement,crop,(960,540))
                    continue
                unit=int(min(atlas.width/16,(road_y-start)/(.72*9),(end-road_y)/(.28*9)))
                width,height=unit*16,unit*9
                left=(atlas.width-width)//2
                top=round(road_y-height*.72)
                crop=(left,top,left+width,top+height)
                if top<start or top+height>end: raise ValueError(f'{name}-{stage}: cross-panel crop')
                save(f'{name}-{stage}',atlas.crop(crop),source,crop,(960,540))
        source = SOURCE/f'{name}-ending.png'
        with Image.open(source) as original:
            panel,crop=fit_crop(original)
            save(f'{name}-ending',panel,source,crop,(960,540))
            save(f'{name}-postcard',panel,source,crop,(640,360))
    source=SOURCE/'items.png'
    with Image.open(source) as atlas:
        for row,name in enumerate(NAMES):
            for column,kind in enumerate(('carried','ordinary','keepsake')):
                # The illustrated row2 ends at655; equal-thirds cut would trim
                # the lighthouse stamp top and accidentally include it in rain.
                bounds=(0,341,655,1024)
                crop=(round(atlas.width*column/3),bounds[row],
                      round(atlas.width*(column+1)/3),bounds[row+1])
                save(f'{name}-{kind}',atlas.crop(crop),source,crop,(80,80),True)
    (BASE/'processing.json').write_text(json.dumps({'tool':'built-in image_gen',
        'processingOnly':'crop, alpha-trim/threshold, uniform nearest rescale; no authored art',
        'packing':records,'runtimeDependsOnExternalPaths':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'packed':len(records),'runtime':str(RUNTIME),'assets':records},ensure_ascii=False))

if __name__=='__main__': main()
