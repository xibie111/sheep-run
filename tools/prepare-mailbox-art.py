"""Package the built-in imagegen mailbox without altering its original alpha/art."""
from pathlib import Path
import argparse, hashlib, json, shutil
from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("source")
parser.add_argument("--repack", action="store_true", help="Repack this task's unchanged generated master")
args = parser.parse_args()
source = Path(args.source)
folder = root / "assets/mailbox-v1"
(folder / "sources").mkdir(parents=True, exist_ok=True)
(folder / "runtime").mkdir(exist_ok=True)
master = folder / "sources/mailbox-original.png"
runtime = folder / "runtime/mailbox.png"
if (master.exists() or runtime.exists()) and not args.repack:
    raise RuntimeError("Mailbox assets already exist; use a new version rather than overwrite")
if args.repack:
    if master.read_bytes() != source.read_bytes():
        raise RuntimeError("Repack cannot replace the preserved master")
else:
    shutil.copy2(source, master)
image = Image.open(master).convert("RGBA")
bounds = image.getchannel("A").point(lambda value: 255 if value >= 64 else 0).getbbox()
if not bounds or image.getchannel("A").getextrema()[0] != 0:
    raise RuntimeError("Generated mailbox needs genuine transparency")
cropped = image.crop(bounds)
ratio = min(28 / cropped.width, 58 / cropped.height)
size = (round(cropped.width * ratio), round(cropped.height * ratio))
packed = Image.new("RGBA", (28, 58))
packed.paste(cropped.resize(size, Image.Resampling.NEAREST), ((28-size[0])//2, 58-size[1]))
packed.save(runtime)
parameters = {"generator": "built-in image_gen", "source": str(source), "masterSHA256": hashlib.sha256(master.read_bytes()).hexdigest(), "sourceSize": image.size, "alphaCrop": bounds, "cropDetection": "alpha >= 64 removes only near-transparent margin speckles; pixel alpha inside crop is unchanged", "runtimeSize": packed.size, "uniformRatio": ratio, "contentSize": size, "resampling": "NEAREST", "alpha": "preserved inside crop, no pixel threshold or background removal", "anchor": "bottom-center", "flagPivot": [16, 13], "envelopeSlot": [4, 7], "stateLayers": "code-native static pixel flag and envelope, shared mailbox base"}
(folder / "processing.json").write_text(json.dumps(parameters, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(parameters, ensure_ascii=False))
