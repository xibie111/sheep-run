# Twelve early and intermediate achievement icons

This batch extends 32 achievements to 44. It fills gaps between existing goals without changing the highest star/obstacle caps (100/150), gameplay, scoring, touch input, economy or save schema.

| ID | Name | Condition |
| --- | --- | --- |
| three-runs | 又来牧场 | 3 completed runs |
| ten-runs | 熟悉的脚步 | 10 completed runs |
| ten-friends | 朋友陪我跑 | 10 actual companion summons |
| five-stars | 口袋里的光 | 5 stars in a single run |
| fifteen-stars | 星光陪我跑 | 15 stars in a single run |
| thirty-five-stars | 满满的星光 | 35 stars in a single run |
| five-obstacles | 小路向前 | 5 successful passes in a single run |
| ten-obstacles | 脚步轻轻 | 10 successful passes in a single run |
| thirty-five-obstacles | 一路有风景 | 35 successful passes in a single run |
| fifteen-skins | 可爱的模样 | 15 valid distinct owned skins |
| twenty-five-skins | 衣橱里的心意 | 25 valid distinct owned skins |
| three-seasons | 一路换季 | 3 distinct seasons visited across runs |

All twelve standalone images were independently generated with the built-in imagegen tool. `sources/` contains complete unchanged RGBA originals, not replacements for v1/v2 artwork. `prompts.json` consolidates all final prompts, generated paths and hashes. Group records `prompts-a/b/c/d.json` retain provenance and the intermittent connection failures; no CLI fallback or old icon substitute was used.

The last `three-runs` image was successfully generated after the user's explicit retry request. Its final successful request and SHA are in `prompts-d.json`; `pending-three-runs.json` preserves the now-resolved failure history.

Runtime preparation uses `tools/pack-expanded-achievement-icons.mjs --catalog src/data/journeyMilestonesV3.ts --bundle assets/achievement-icons-v3`. It measures hard-alpha bounds, fits the whole subject uniformly into 28×28 content on a transparent 32×32 canvas, uses nearest resampling and hard alpha in the runtime copy. Complete original source bytes stay unchanged. `processing.json` records bounds, dimensions, positions and source/runtime hashes; `preview.png` shows all twelve.

The old 32 IDs, conditions, messages, icon paths, dates and read markers remain valid. The v1 journal can backfill only observed stats. Single-run star/pass goals never add together across runs. The current 774-glyph font atlases are unchanged, with all new Chinese copy covered at every existing size. The existing touch-only book automatically expands to 11 achievement pages plus one scenery page.

Tests, production hashes and browser evidence are under `docs/aegis/work/2026-10-13-achievements-v3/`. Phone hardware validation and APK compilation are outside this feature request.
