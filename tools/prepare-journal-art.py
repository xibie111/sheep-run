"""Preserve generated masters and package unchanged artwork at a uniform nearest-neighbor ratio."""
from pathlib import Path
import hashlib
import json
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=root/"assets/journey-v1"
manifest=json.loads((folder/"prompts.json").read_text(encoding="utf-8"))
(folder/"sources").mkdir(exist_ok=True)
(folder/"runtime").mkdir(exist_ok=True)
result=[]
for asset in manifest["assets"]:
    source=Path(asset["generatedPath"])
    master=folder/"sources"/(asset["season"]+".png")
    # Keep the original bytes. This is packaging only, not a generative edit.
    if not master.exists(): master.write_bytes(source.read_bytes())
    image=Image.open(master).convert("RGBA")
    size=(288,round(288*image.height/image.width))
    output=folder/"runtime"/(asset["season"]+".png")
    if output.exists(): raise RuntimeError("Refusing to overwrite an existing reward illustration")
    image.resize(size,Image.Resampling.NEAREST).save(output,optimize=True)
    result.append({"season":asset["season"],"master":str(master.relative_to(root)),"runtime":str(output.relative_to(root)),"sourceSize":image.size,"runtimeSize":size,"resize":"uniform nearest neighbor","alphaRange":image.getchannel("A").getextrema(),"sourceSha256":hashlib.sha256(master.read_bytes()).hexdigest(),"runtimeSha256":hashlib.sha256(output.read_bytes()).hexdigest()})
(folder/"processing.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,indent=2))
