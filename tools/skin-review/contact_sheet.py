"""QA-only contact sheet, assembled from actual runtime PNGs and local BMFont."""
from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
font = Image.open(ROOT / "assets/fonts/pasture-pixel-12.png").convert("RGBA")
glyphs = {int(c.get("id")): {k:int(v) for k,v in c.attrib.items()} for c in ET.parse(ROOT / "assets/fonts/pasture-pixel-12.fnt").findall("chars/char")}
items = [("white","奶油白","免费"),("black","炭黑","10星"),("brown","暖棕","30星"),("golden","闪金","40金币"),("farmer","农夫羊","90金币"),
         ("mint","薄荷羊","20金币"),("rose","樱花羊","25金币"),("blueberry","蓝莓羊","35金币"),("lavender","薰衣草羊","45金币"),("pumpkin","南瓜羊","50金币"),
         ("forest","森林羊","60金币"),("chestnut","栗木羊","70金币"),("sunset","夕阳羊","80金币")]
canvas = Image.new("RGBA",(1400,864),(245,232,190,255))
def text(label,center,y):
    w=sum(glyphs[ord(c)]["xadvance"] for c in label)
    layer=Image.new("RGBA",(w+4,18))
    x=0
    for c in label:
        g=glyphs[ord(c)]
        part=font.crop((g["x"],g["y"],g["x"]+g["width"],g["y"]+g["height"]))
        color=Image.new("RGBA",part.size,(74,56,47,255));color.putalpha(part.getchannel("A"))
        layer.alpha_composite(color,(x+g["xoffset"],g["yoffset"]));x+=g["xadvance"]
    layer=layer.resize((layer.width*2,layer.height*2),Image.Resampling.NEAREST)
    canvas.alpha_composite(layer,(center-layer.width//2,y))
for i,(id,name,price) in enumerate(items):
    x,y=(i%5)*280,(i//5)*288
    cell=Image.new("RGBA",(272,280),(255,245,215,255));canvas.alpha_composite(cell,(x+4,y+4))
    sheet=Image.open(ROOT / f"assets/skins/runtime-v1/{id}-sheet.png").convert("RGBA")
    sprite=sheet.crop((0,16,128,128)).resize((256,224),Image.Resampling.NEAREST)
    canvas.alpha_composite(sprite,(x+12,y+4))
    text(name,x+140,y+230);text(price,x+140,y+254)
canvas.save(ROOT / "docs/skin-review/2026-10-08/skin-contact-sheet.png",optimize=True)
