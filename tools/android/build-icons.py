from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "assets" / "app-icon"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
source = Image.open(ART / "sheep-pasture-icon-source-v2.png").convert("RGBA")
assert source.width == source.height
assert source.getchannel("A").getextrema() == (255,255)
# Keep artwork uniformly scaled. Android exposes the central 72dp of a 108dp layer.
def scene(size):
    return source.resize((size,size),Image.Resampling.NEAREST)
def visible_icon(size,circle=False):
    full=scene(size*3)
    start=size//2
    # 108:72 == 3:2; a doubled viewport keeps integral crop coordinates.
    icon=full.crop((start,start,start+size*2,start+size*2)).resize((size,size),Image.Resampling.NEAREST)
    if circle:
        mask=Image.new("L",(size,size))
        ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255)
        icon.putalpha(mask)
    return icon
for density,size in {"mdpi":48,"hdpi":72,"xhdpi":96,"xxhdpi":144,"xxxhdpi":192}.items():
    dest=RES/("mipmap-"+density)
    dest.mkdir(parents=True,exist_ok=True)
    visible_icon(size).save(dest/"ic_launcher.png")
    visible_icon(size,True).save(dest/"ic_launcher_round.png")
    layer_size=round(size*108/48)
    scene(layer_size).save(dest/"ic_launcher_scene.png")
    Image.new("RGBA",(layer_size,layer_size)).save(dest/"ic_launcher_foreground.png")
for name in ("ic_launcher.xml","ic_launcher_round.xml"):
    (RES/"mipmap-anydpi-v26"/name).write_text('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@mipmap/ic_launcher_scene" />\n    <foreground android:drawable="@android:color/transparent" />\n</adaptive-icon>\n',encoding="utf-8")
visible_icon(512).save(ART/"sheep-pasture-icon-512-v2.png")
visible_icon(288,True).save(ART/"sheep-pasture-icon-round-preview-v2.png")
print(json.dumps({"source_size":source.size,"source_alpha":source.getchannel("A").getextrema(),"densities":5,"adaptive_layers":"opaque game landscape plus transparent overlay"}))

