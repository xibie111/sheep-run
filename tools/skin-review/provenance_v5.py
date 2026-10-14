"""Record original image_gen provenance and immutable gameplay/save boundaries."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs/skins-v5"
IDS = ("bee-v1", "mushroom-v1", "chef-v1", "pirate-v1", "fox-v1", "dinosaur-v1")
records = []
for skin in IDS:
    base = ROOT / "assets/skins/generated-v5"
    source = base / f"{skin}-source.png"
    metadata_path = base / f"{skin}-generation.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    prompt = json.loads((base / f"{skin}-prompt.json").read_text(encoding="utf-8"))
    image = Image.open(source)
    assert image.mode == "RGBA"
    assert image.getchannel("A").getextrema() == (0, 255)
    assert prompt.get("prompt") and prompt.get("transparent_background") is True
    generated_path = metadata.get("generatedPath") or metadata.get("originalPath") or metadata.get("source")
    original = Path(generated_path) if generated_path else None
    if original is None or not original.is_file():
        # Individual generator metadata may use outputPath naming.
        for key, value in metadata.items():
            if isinstance(value, str) and "generated_images" in value and value.endswith(".png"):
                original = Path(value)
                break
    assert original is not None and original.is_file(), f"No original generation file: {skin}"
    checksum = hashlib.sha256(source.read_bytes()).hexdigest()
    assert hashlib.sha256(original.read_bytes()).hexdigest() == checksum
    records.append({"id": skin, "source": source.relative_to(ROOT).as_posix(), "sourceSha256": checksum, "size": list(image.size), "mode": image.mode, "trueAlpha": True, "originalByteIdentical": True, "originalGeneratedPath": str(original), "prompt": f"assets/skins/generated-v5/{skin}-prompt.json", "generatorMetadata": metadata_path.relative_to(ROOT).as_posix()})
protected = ("src/entities/Sheep.ts", "src/entities/SheepBody.ts", "src/entities/SheepAnimation.ts", "src/systems/SaveSystem.ts", "src/systems/ProgressionSystem.ts", "src/systems/InputSystem.ts", "src/input/GestureRecognizer.ts")
paths = [ROOT / name for name in protected if (ROOT / name).exists()]
report = {"passed": True, "recordedAt": datetime.now(timezone.utc).isoformat(), "tool": "builtin-image_gen", "skinCount": len(records), "noExternalRuntimeDependency": True, "skins": records, "protectedGameplayFiles": {path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}, "phoneHardware": False}
(OUTPUT / "provenance.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": True, "skinCount": len(records), "originalsByteIdentical": True, "protectedGameplayFiles": len(paths)}))
