# Twelve additional achievement icons

Twelve independent PNGs were created with twelve built-in imagegen calls. `sources/` preserves the complete original RGBA outputs byte-for-byte. No original v1 icon has been replaced. `prompts.json` consolidates the full requests, generation file paths and source SHA256 values; original group records remain in `sources/prompts-a.json` and `prompts-b.json`.

`tools/pack-expanded-achievement-icons.mjs` measures the alpha>=128 subject box, fits it uniformly within 28×28 pixels on a transparent 32×32 canvas using nearest resampling, and creates hard alpha in the runtime copy. Original source pixels and alpha remain untouched. `processing.json` records source/runtime hashes, source dimensions, crop, scale result and placement. `preview.png` shows the twelve native sprites enlarged with nearest sampling.

The new IDs and exact Chinese copy live in `src/data/expandedAchievements.ts`. Existing 20 icons still load from `achievement-icons-v1/runtime/`; only these 12 load from this v2 folder. The journal, touch targets and renderer use their existing interfaces.

| ID | Name | Goal |
| --- | --- | --- |
| fifty-runs | 熟悉的小路 | 50 completed runs |
| hundred-runs | 百次出发 | 100 completed runs |
| two-hundred-fifty-runs | 牧场常客 | 250 completed runs |
| fifty-friends | 朋友常来 | 50 actual summons |
| hundred-friends | 百次同行 | 100 actual summons |
| seventy-five-stars | 星光小旅行 | 75 stars in one run |
| hundred-stars | 一口袋星河 | 100 stars in one run |
| hundred-obstacles | 跨过一百步 | 100 passed obstacles in one run |
| one-hundred-fifty-obstacles | 一路向前 | 150 passed obstacles in one run |
| twenty-skins | 多彩衣橱 | 20 valid distinct owned skins |
| thirty-skins | 满满的衣橱 | 30 valid distinct owned skins |
| two-seasons | 风景变了 | 2 distinct seasons visited across runs |

All are cosmetic goals. They do not grant currency, change difficulty, add random consumers or modify the main save schema. Existing v1 journal records remain valid; only actually recorded stats can backfill new goals. Older runs capped at 50 stars/obstacles cannot prove the new single-run goals.

Verification and production browser screenshots are saved under `docs/aegis/work/2026-10-13-expanded-achievements/`. Browser touch emulation is separate from phone hardware validation.
