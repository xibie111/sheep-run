"""Pack approved built-in originals using uniform NEAREST resize and crop only.

Never draws production art, pads, stretches, or writes outside the new art folder.
--partial packs available final sources; filenames containing attempt/initial are
never runtime inputs. Full packing requires all 16 originals and measured road
rows. The immutable audit baseline is verified before and after every run.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import math
from pathlib import Path
from PIL import Image
import PIL

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "assets/delivery-menu-style-v2"
SOURCE = BASE / "sources"
RUNTIME = BASE / "runtime"
CONFIG = BASE / "processing-config.json"
BASELINE = ROOT / "docs/delivery-menu-style-v2/baseline.json"
THEMES = ("windmill", "rain", "lighthouse", "dinner")
STAGES = {
    "windmill": ("pasture", "middle", "destination", "ending"),
    "rain": ("pasture", "middle", "destination", "ending"),
    "lighthouse": ("pasture", "middle", "destination", "ending"),
    "dinner": ("dusk-pasture", "field", "cottage", "ending"),
}
EXPECTED_SOURCES = tuple(f"{theme}-{stage}" for theme in THEMES for stage in STAGES[theme])
ROAD_TARGET_Y = 389
BACKGROUND_SIZE = (960, 540)
POSTCARD_SIZE = (640, 360)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def verify_baseline() -> dict:
    baseline = json.loads(BASELINE.read_text(encoding="utf-8-sig"))
    errors = []
    for group in ("files", "protectedCode"):
        for name, expected in baseline[group].items():
            path = ROOT / name
            if not path.is_file() or digest(path).lower() != expected.lower():
                errors.append(name)
    if errors:
        raise ValueError("Protected baseline changed: " + ", ".join(errors))
    return {
        "path": relative(BASELINE), "sha256": digest(BASELINE),
        "oldAssetFiles": len(baseline["files"]),
        "protectedCodeFiles": len(baseline["protectedCode"]),
        "allMatched": True,
    }


def existing_path(text: str) -> Path | None:
    if "\n" in text or len(text) > 800:
        return None
    candidate = Path(text)
    candidates = (candidate,) if candidate.is_absolute() else (ROOT / candidate, BASE / candidate)
    return next((path for path in candidates if path.is_file()), None)


def generation_provenance(name: str) -> dict:
    candidates = [
        BASE / "metadata" / f"{name}.json",
        BASE / "metadata" / f"{name}-generation.json",
        BASE / "metadata" / f"{name}-request.json",
    ]
    found = [path for path in candidates if path.is_file()]
    if not found:
        raise FileNotFoundError(f"{name}: generation metadata missing")
    documents = [
        {"path": relative(path), "sha256": digest(path),
         "details": json.loads(path.read_text(encoding="utf-8-sig"))}
        for path in found
    ]
    prompt_paths = set()
    raw_paths = set()
    reference_paths = set()

    def visit(value: object, key: str = "") -> None:
        if isinstance(value, dict):
            for child_key, child in value.items():
                if key == "referenceHashes":
                    path = existing_path(child_key)
                    if path and path.suffix.lower() == ".png":
                        reference_paths.add(path.resolve())
                visit(child, child_key)
        elif isinstance(value, list):
            for child in value:
                visit(child, key)
        elif isinstance(value, str):
            if key in ("generated_original_path", "originalGeneratedPath", "originalOutput"):
                raw_paths.add(value)
            if "prompt" in key.lower():
                path = existing_path(value)
                if path:
                    prompt_paths.add(path.resolve())
            if key in ("path", "references", "referenced_image_paths"):
                path = existing_path(value)
                if path and path.suffix.lower() == ".png":
                    reference_paths.add(path.resolve())

    for document in documents:
        visit(document["details"])
    for extension in (".txt", ".json"):
        path = BASE / "prompts" / (name + extension)
        if path.is_file():
            prompt_paths.add(path.resolve())
    return {
        "metadata": documents,
        "promptFiles": [{"path": relative(path), "sha256": digest(path)} for path in sorted(prompt_paths)],
        "rawGeneratedPaths": sorted(raw_paths),
        "referenceFiles": [{"path": str(path), "sha256": digest(path)} for path in sorted(reference_paths)],
    }


def prepare(source: Path, size: tuple[int, int], road_row: int | None) -> tuple[Image.Image, dict]:
    with Image.open(source) as original:
        original.load()
        width, height = original.size
        if "A" in original.getbands() and original.getchannel("A").getextrema() != (255, 255):
            raise ValueError(f"{source.name}: background is not fully opaque")
        if "transparency" in original.info:
            # Account for PNG color-key transparency as well as alpha channels.
            if original.convert("RGBA").getchannel("A").getextrema() != (255, 255):
                raise ValueError(f"{source.name}: background has transparent pixels")
        image = original.convert("RGB")
    target_width, target_height = size
    if road_row is None:
        scale = max(target_width / width, target_height / height)
    else:
        if not 0 < road_row < height:
            raise ValueError(f"{source.name}: invalid road row {road_row}")
        scale = max(target_width / width, ROAD_TARGET_Y / road_row,
                    (target_height - ROAD_TARGET_Y) / (height - road_row))
    resized_size = (math.ceil(width * scale), math.ceil(height * scale))
    resized = image.resize(resized_size, Image.Resampling.NEAREST)
    left = (resized.width - target_width) // 2
    top = (resized.height - target_height) // 2 if road_row is None else round(road_row * scale) - ROAD_TARGET_Y
    crop = (left, top, left + target_width, top + target_height)
    if min(crop[:2]) < 0 or crop[2] > resized.width or crop[3] > resized.height:
        raise ValueError(f"{source.name}: crop outside resized original; padding is forbidden")
    output = resized.crop(crop)
    return output, {
        "originalSize": [width, height], "uniformScale": scale,
        "uniformScaleApplied": True, "resizedSize": list(resized_size), "crop": list(crop),
        "sourceRoadRow": road_row, "runtimeRoadRow": ROAD_TARGET_Y if road_row is not None else None,
        "size": list(output.size), "mode": output.mode, "sampler": "NEAREST",
        "padding": False, "authoredArt": False,
    }


def asset_key(name: str) -> str:
    if name.startswith("dinner-"):
        suffix = name.removeprefix("dinner-")
        suffix = "dinner-" + suffix if suffix in ("ending", "postcard") else suffix
        return "content-v2-delivery-" + suffix
    return "delivery-expansion-" + name


def save_asset(name: str, source_name: str, size: tuple[int, int], config: dict) -> dict:
    source = SOURCE / (source_name + ".png")
    before = digest(source)
    spec = config["sources"][source_name]
    if before.lower() != spec["sourceSha256"].lower():
        raise ValueError(f"{source_name}: source changed since road/style inspection")
    road_row = spec["roadRow"] if not source_name.endswith("-ending") else None
    provenance = generation_provenance(source_name)
    image, processing = prepare(source, size, road_row)
    output = RUNTIME / (name + ".png")
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    output.write_bytes(buffer.getvalue())
    if digest(source) != before:
        raise ValueError(f"{source_name}: original modified while packing")
    return {
        "name": name, "key": asset_key(name), "kind": "postcard" if name.endswith("-postcard") else
            "ending" if name.endswith("-ending") else "landscape",
        "source": relative(source), "sourceSha256": before,
        "sourceByteCount": source.stat().st_size,
        "runtime": relative(output), "runtimeSha256": digest(output),
        "runtimeByteCount": output.stat().st_size,
        "width": size[0], "height": size[1],
        "inspection": spec.get("inspection"),
        **processing, "generation": provenance,
    }


def contact_sheet(records: list[dict]) -> None:
    # Review-only montage of actual runtime pixels; no production content is drawn.
    preview_size = (240, 135)
    count = len(records)
    columns = min(5, count)
    rows = math.ceil(count / columns)
    canvas = Image.new("RGB", (columns * preview_size[0], rows * preview_size[1]), (245, 245, 245))
    index = []
    for i, record in enumerate(records):
        with Image.open(ROOT / record["runtime"]) as image:
            preview = image.resize(preview_size, Image.Resampling.NEAREST)
        x, y = i % columns, i // columns
        canvas.paste(preview, (x * preview_size[0], y * preview_size[1]))
        index.append({"row": y, "column": x, "name": record["name"], "runtime": record["runtime"]})
    canvas.save(BASE / "contact-sheet.png", optimize=True)
    write_json(BASE / "contact-sheet-index.json", {
        "reviewOnly": True, "cellSize": list(preview_size), "rows": rows, "columns": columns, "cells": index,
    })


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--partial", action="store_true", help="Pack only ready final originals.")
    args = parser.parse_args()
    checked_before = verify_baseline()
    config = json.loads(CONFIG.read_text(encoding="utf-8-sig"))
    missing_sources = [name for name in EXPECTED_SOURCES if not (SOURCE / (name + ".png")).is_file()]
    unconfigured = [
        name for name in EXPECTED_SOURCES if name not in missing_sources and (
            name not in config["sources"] or not config["sources"][name].get("sourceSha256") or (
                not name.endswith("-ending") and not isinstance(config["sources"][name].get("roadRow"), int)))
    ]
    if not args.partial and (missing_sources or unconfigured):
        raise FileNotFoundError("Final originals incomplete: missing=" + ",".join(missing_sources)
                                + "; uninspected=" + ",".join(unconfigured))
    ready = [name for name in EXPECTED_SOURCES if name not in missing_sources + unconfigured]
    if not ready:
        raise FileNotFoundError("No final, inspected sources ready to pack.")
    # Check all selected sources/provenance before writing any output.
    for name in ready:
        if digest(SOURCE / (name + ".png")).lower() != config["sources"][name]["sourceSha256"].lower():
            raise ValueError(f"{name}: inspected source hash no longer matches")
        generation_provenance(name)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    records = []
    for theme in THEMES:
        for stage in STAGES[theme]:
            name = theme + "-" + stage
            if name in ready:
                records.append(save_asset(name, name, BACKGROUND_SIZE, config))
                if stage == "ending":
                    records.append(save_asset(theme + "-postcard", name, POSTCARD_SIZE, config))
    checked_after = verify_baseline()
    for name in ready:
        if digest(SOURCE / (name + ".png")).lower() != config["sources"][name]["sourceSha256"].lower():
            raise ValueError(f"{name}: source modified during packing")
    contact_sheet(records)
    manifest = {
        "schemaVersion": 1, "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "tool": "builtin image_gen originals; tools/delivery-menu-style-v2/pack.py",
        "processingOnly": "uniform NEAREST resize and crop; RGB; no padding, drawing or stretching",
        "pillowVersion": PIL.__version__, "partial": args.partial,
        "complete": not missing_sources and not unconfigured,
        "expectedSourceCount": 16, "expectedRuntimeCount": 20,
        "sourceCount": len(ready), "runtimeCount": len(records),
        "missingSources": missing_sources, "uninspectedSources": unconfigured,
        "config": {"path": relative(CONFIG), "sha256": digest(CONFIG)},
        "baselineBefore": checked_before, "baselineAfter": checked_after,
        "records": records, "runtimeDependsOnExternalPaths": False,
    }
    write_json(BASE / "processing.json", manifest)
    print(json.dumps({
        "sourceCount": len(ready), "runtimeCount": len(records), "complete": manifest["complete"],
        "missingSources": missing_sources, "uninspectedSources": unconfigured,
        "runtimeBytes": sum(row["runtimeByteCount"] for row in records),
        "oldAssetsMatched": checked_after["oldAssetFiles"],
        "protectedCodeMatched": checked_after["protectedCodeFiles"],
    }))


if __name__ == "__main__":
    main()
