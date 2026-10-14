"""Reproducibly pack only the six built-in generated v5 skins.

This is asset registration, not illustration: retain source RGB, threshold alpha,
cut complete subjects, apply one nearest-neighbour scale per skin, and align feet.
Never writes any earlier source/runtime directory. Requires Pillow, numpy, scipy.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import PIL
import scipy
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
GENERATED = ROOT / "assets/skins/generated-v5"
RUNTIME = ROOT / "assets/skins/runtime-v5"
REVIEW = ROOT / "docs/skins-v5"
IDS = ("bee-v1", "mushroom-v1", "chef-v1", "pirate-v1", "fox-v1", "dinosaur-v1")
POSES = ("idle_1", "run_1", "run_2", "run_3", "run_4", "jump", "fall",
         "hit", "dash_1", "dead", "idle_2", "run_5", "run_6", "dash_2", "dead_settled")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def old_hashes() -> dict:
    snapshot = REVIEW / "old-skin-hashes-before.json"
    if snapshot.is_file():
        before = json.loads(snapshot.read_text(encoding="utf-8"))["files"]
    else:
        # Committed asset manifest makes later re-packing independent of local QA docs.
        before = json.loads((RUNTIME / "manifest.json").read_text(encoding="utf-8"))["protectedOldAssetHashes"]
    changed = [name for name, expected in before.items()
               if not (ROOT / name).is_file() or digest((ROOT / name).read_bytes()) != expected]
    if changed:
        raise RuntimeError(f"Existing skin assets changed: {changed}")
    return {"count": len(before), "unchanged": True, "files": before}


def subject_regions(image: Image.Image, skin: str) -> list[tuple[int, int, int, int]]:
    """Infer 5x3 cells from fifteen large alpha subjects; do not cut at guessed grid lines.

    The regions include detached small decorations belonging to each subject.
    Gap boundaries must sit between complete subjects, never through their ink.
    """
    alpha = np.asarray(image.getchannel("A")) >= 128
    labels, _ = ndimage.label(alpha, np.ones((3, 3), dtype=np.uint8))
    counts = np.bincount(labels.ravel())
    slices = ndimage.find_objects(labels)
    major = []
    threshold = max(1000, int(max(counts[1:], default=0) * 0.2))
    for label, sl in enumerate(slices, 1):
        if sl is not None and counts[label] >= threshold:
            ys, xs = sl
            major.append((xs.start, ys.start, xs.stop, ys.stop))
    if len(major) != 15:
        raise RuntimeError(f"{skin}: expected 15 complete alpha subjects, found {len(major)}; regenerate art")
    major.sort(key=lambda b: b[1] + b[3])
    rows = [sorted(major[r * 5:(r + 1) * 5], key=lambda b: b[0] + b[2]) for r in range(3)]
    y_edges = [0]
    for row in range(2):
        bottom = max(b[3] for b in rows[row])
        top = min(b[1] for b in rows[row + 1])
        if top - bottom < 4:
            raise RuntimeError(f"{skin}: pose rows overlap or have no clean crop gap; regenerate art")
        y_edges.append((bottom + top) // 2)
    y_edges.append(image.height)
    regions = []
    for row, subjects in enumerate(rows):
        x_edges = [0]
        for column in range(4):
            right, left = subjects[column][2], subjects[column + 1][0]
            if left - right < 4:
                raise RuntimeError(f"{skin}: adjacent poses overlap or have no crop gap; regenerate art")
            x_edges.append((right + left) // 2)
        x_edges.append(image.width)
        for column in range(5):
            regions.append((x_edges[column], y_edges[row], x_edges[column + 1], y_edges[row + 1]))
    return regions


def pack_skin(skin: str) -> dict:
    source_path = GENERATED / f"{skin}-source.png"
    image = Image.open(source_path).convert("RGBA")
    if image.getchannel("A").getextrema() != (0, 255):
        raise RuntimeError(f"{skin}: source must have real transparent alpha")
    regions = subject_regions(image, skin)
    subjects, boxes = [], []
    for index, region in enumerate(regions):
        frame = image.crop(region)
        frame.putalpha(frame.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
        box = frame.getchannel("A").getbbox()
        if box is None:
            raise RuntimeError(f"{skin}: empty pose {index}")
        absolute = [box[0] + region[0], box[1] + region[1], box[2] + region[0], box[3] + region[1]]
        if absolute[0] <= 0 or absolute[1] <= 0 or absolute[2] >= image.width or absolute[3] >= image.height:
            raise RuntimeError(f"{skin}: source pose {index} touches image boundary; regenerate art")
        subjects.append(frame.crop(box))
        boxes.append(absolute)
    # Existing contract: max 120x104 ink, 128x112 visible tile and one uniform scale.
    scale = min(120 / max(p.width for p in subjects), 104 / max(p.height for p in subjects))
    sheet = Image.new("RGBA", (640, 384))
    entries = []
    for index, subject in enumerate(subjects):
        actor = subject.resize((round(subject.width * scale), round(subject.height * scale)), Image.Resampling.NEAREST)
        baseline = 120 if index == 5 else 128
        x, y = (128 - actor.width) // 2, baseline - actor.height
        if x < 0 or y < 16:
            raise RuntimeError(f"{skin} pose {index}: top padding or side boundary exceeded")
        frame = Image.new("RGBA", (128, 128))
        frame.paste(actor, (x, y))
        ink = frame.getchannel("A").getbbox()
        if ink is None or ink[3] != baseline or ink[1] < 16:
            raise RuntimeError(f"{skin} pose {index}: registered foot baseline is invalid")
        sheet.paste(frame, ((index % 5) * 128, (index // 5) * 128))
        REVIEW.joinpath("poses", skin).mkdir(parents=True, exist_ok=True)
        frame.crop((0, 16, 128, 128)).save(REVIEW / "poses" / skin / f"{index:02}-{POSES[index]}.png")
        entries.append({"index": index, "pose": POSES[index], "sourceRegion": list(regions[index]),
                        "sourceBounds": boxes[index], "bbox": list(ink), "footBaseline": baseline,
                        "uniformScale": scale, "rgbaHash": digest(frame.tobytes()),
                        "silhouetteHash": digest(frame.getchannel("A").tobytes()),
                        "visiblePixels": sum(1 for alpha in frame.getchannel("A").getdata() if alpha)})
    if len({entry["rgbaHash"] for entry in entries}) != 15:
        raise RuntimeError(f"{skin}: duplicate poses; regenerate art, do not duplicate standing frame")
    if len({entries[index]["silhouetteHash"] for index in (1, 2, 3, 4, 11, 12)}) != 6:
        raise RuntimeError(f"{skin}: six run poses need different silhouettes")
    destination = RUNTIME / f"{skin}-sheet.png"
    sheet.save(destination, optimize=True)
    # Keep an enlarged, labelled view of every registered pose for human animation QA.
    contact = Image.new("RGB", (1280, 762), "#eee3c9")
    contact_draw = ImageDraw.Draw(contact)
    contact_font_path = Path("C:/Windows/Fonts/arial.ttf")
    contact_font = ImageFont.truetype(str(contact_font_path), 15) if contact_font_path.exists() else ImageFont.load_default()
    for index, pose in enumerate(POSES):
        frame = sheet.crop(((index % 5) * 128, (index // 5) * 128 + 16,
                            (index % 5 + 1) * 128, (index // 5 + 1) * 128))
        actor = frame.resize((256, 224), Image.Resampling.NEAREST)
        x, y = (index % 5) * 256, (index // 5) * 254
        contact.paste(actor, (x, y), actor)
        contact_draw.text((x + 128, y + 238), f"{index:02} {pose}", anchor="mm", font=contact_font, fill="#553721")
    contact_path = REVIEW / f"{skin}-pose-contact.png"
    contact.save(contact_path)
    # QA-only animation, drawn from real registered runtime frames.
    animations = {}
    for name, sequence, duration in (("run", [1, 2, 3, 4, 11, 12], 90),
                                     ("all-poses", list(range(15)), 360)):
        frames = []
        for index in sequence:
            frame = sheet.crop(((index % 5) * 128, (index // 5) * 128 + 16,
                                (index % 5 + 1) * 128, (index // 5 + 1) * 128))
            background = Image.new("RGBA", (128, 112), "#e8dec8")
            background.alpha_composite(frame)
            frames.append(background.resize((256, 224), Image.Resampling.NEAREST).convert("RGB"))
        gif = REVIEW / f"{skin}-{name}.gif"
        frames[0].save(gif, save_all=True, append_images=frames[1:], duration=duration, loop=0, disposal=2)
        animations[name] = gif.relative_to(ROOT).as_posix()
    return {"id": skin, "provenance": "builtin-image_gen", "source": source_path.relative_to(ROOT).as_posix(),
            "sourceHash": digest(source_path.read_bytes()), "sourceSize": list(image.size),
            "runtime": destination.relative_to(ROOT).as_posix(), "runtimeHash": digest(destination.read_bytes()),
            "runtimeSize": [640, 384], "frameCount": 15, "frameWidth": 128, "frameHeight": 128,
            "renderFrameWidth": 128, "renderFrameHeight": 112, "topPadding": 16,
            "columns": 5, "rows": 3, "scale": scale, "alphaThreshold": 128, "filter": "nearest",
            "frames": entries, "qaAnimations": animations,
            "qaPoseContact": contact_path.relative_to(ROOT).as_posix()}


def preview(entries: list[dict]) -> None:
    font_path = Path("C:/Windows/Fonts/arial.ttf")
    font = ImageFont.truetype(str(font_path), 16) if font_path.exists() else ImageFont.load_default()
    image = Image.new("RGB", (1024, 584), "#f5ebd1")
    draw = ImageDraw.Draw(image)
    for index, entry in enumerate(entries):
        sheet = Image.open(ROOT / entry["runtime"]).convert("RGBA")
        actor = sheet.crop((0, 16, 128, 128)).resize((256, 224), Image.Resampling.NEAREST)
        x, y = (index % 4) * 256, (index // 4) * 292
        image.paste(actor, (x, y + 8), actor)
        draw.text((x + 128, y + 250), entry["id"], fill="#512e21", anchor="mm", font=font)
    image.save(RUNTIME / "preview.png")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--partial", action="store_true", help="Pack ready sources during generation; final audit requires all six")
    args = parser.parse_args()
    RUNTIME.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    protected = old_hashes()
    selected = [skin for skin in IDS if (GENERATED / f"{skin}-source.png").exists()]
    if not args.partial and selected != list(IDS):
        raise RuntimeError(f"Missing generated sources: {sorted(set(IDS) - set(selected))}")
    entries = [pack_skin(skin) for skin in selected]
    prompt_path = GENERATED / "prompts.json"
    manifest = {"formatVersion": 1, "generatedBy": "builtin-image_gen", "packingTool": "tools/skin-review/pack_skins_v5.py",
                "packingLibraries": {"Pillow": PIL.__version__, "numpy": np.__version__, "scipy": scipy.__version__},
                "promptSet": prompt_path.relative_to(ROOT).as_posix(),
                "promptSetHash": digest(prompt_path.read_bytes()) if prompt_path.is_file() else None,
                "frameNames": list(POSES), "oldAssetsUnchanged": protected["unchanged"],
                "protectedOldAssetHashes": protected["files"], "skins": entries}
    (RUNTIME / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if entries:
        preview(entries)
    (REVIEW / "old-skin-hashes-after.json").write_text(json.dumps(old_hashes(), indent=2) + "\n", encoding="utf-8")
    (REVIEW / "art-audit.json").write_text(json.dumps({"complete": len(entries) == 6,
        "skins": len(entries), "poses": len(entries) * 15, "uniformPerSkinScaling": True,
        "sourcePixelsRepainted": False, "hardAlpha": True, "allRunSilhouettesDistinct": True,
        "baseline": {"grounded": 128, "jump": 120}, "protectedOldFiles": protected["count"],
        "runtimeManifest": "assets/skins/runtime-v5/manifest.json", "mobileDeviceValidation": False}, indent=2) + "\n", encoding="utf-8")
    print(f"Packed {len(entries)} new skins, {len(entries) * 15} distinct poses; all {protected['count']} old asset hashes unchanged")


if __name__ == "__main__":
    main()
