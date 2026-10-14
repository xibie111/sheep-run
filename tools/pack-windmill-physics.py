"""Only package built-in image_gen art; never paint/recolour or modify originals."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "assets/windmill-physics-v1"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    records = []
    (BASE / "runtime").mkdir(parents=True, exist_ok=True)
    for name, size in (("backdrop", (960, 540)), ("windmill", (400, 512)), ("grass", (960, 128))):
        source = BASE / "sources" / f"{name}.png"
        prompt = BASE / "prompts" / f"{name if name != 'windmill' else 'windmill'}.txt"
        with Image.open(source) as original:
            image = original.convert("RGBA")
            original_size = list(image.size)
            if name == "backdrop":
                if image.getchannel("A").getextrema() != (255, 255):
                    raise ValueError("Backdrop must be opaque")
                height = min(image.height, round(image.width * 9 / 16))
                width = min(image.width, round(image.height * 16 / 9))
                x, y = (image.width - width) // 2, (image.height - height) // 2
                crop = (x, y, x + width, y + height)
                image = image.crop(crop).resize(size, Image.Resampling.NEAREST)
                trim, fitted, scale = None, list(size), size[0] / width
            else:
                alpha = image.getchannel("A")
                if alpha.getextrema()[0] == 255:
                    raise ValueError(f"{name} has no genuine generated transparency")
                alpha = alpha.point(lambda value: 255 if value >= 96 else 0)
                image.putalpha(alpha)
                trim = alpha.getbbox()
                if trim is None:
                    raise ValueError(f"{name} is empty")
                image = image.crop(trim)
                scale = min(size[0] / image.width, size[1] / image.height)
                fitted = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
                image = image.resize(fitted, Image.Resampling.NEAREST)
                canvas = Image.new("RGBA", size, (0, 0, 0, 0))
                # Straight support line at the bottom; transparent transport padding only.
                canvas.alpha_composite(image, ((size[0] - fitted[0]) // 2, size[1] - fitted[1]))
                image, crop = canvas, None
            runtime = BASE / "runtime" / f"{name}.png"
            image.save(runtime)
            records.append({"name": name, "source": str(source.relative_to(ROOT)),
                "sourceSize": original_size, "sourceSha256": digest(source),
                "prompt": str(prompt.relative_to(ROOT)), "promptSha256": digest(prompt),
                "crop": crop, "alphaTrim": trim, "fitted": list(fitted), "uniformScale": scale,
                "size": list(size), "runtime": str(runtime.relative_to(ROOT)),
                "runtimeSha256": digest(runtime), "groundBaseline": size[1] if name != "backdrop" else 389,
                "alpha": "original opaque" if name == "backdrop" else "generated alpha threshold96; hard 0/255"})
    manifest = {"tool": "built-in image_gen", "reference": "assets/delivery-expansion-v1/chapters/runtime/windmill-destination.png",
        "referenceSha256": digest(ROOT / "assets/delivery-expansion-v1/chapters/runtime/windmill-destination.png"),
        "processing": "crop/alpha-trim, hard transparency, uniform nearest resize and transparent transport padding only",
        "runtimeDependsOnExternalPaths": False, "assets": records}
    (BASE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
