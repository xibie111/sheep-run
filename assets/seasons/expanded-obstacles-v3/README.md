# Expanded pasture obstacles v3

Four additions to the fourteen existing hazards: HayCart, WaterTrough, HangingLantern, FlyingGoose. Each has spring/summer/autumn/winter artwork, for sixteen measured subject frames.

`atlas.png` was generated with the built-in imagegen skill and copied byte-for-byte into this versioned directory. Its complete request is in `atlas.prompt.txt`; `generation.json` records source, dimensions and SHA-256. Existing artwork has not been overwritten.

The source is 1448×1086. `frames.json` uses measured alpha bounding boxes rather than assuming exact equal cells: the trough's wider silhouette extends past a nominal grid column. Runtime preparation uniformly fits each whole subject, bottom aligned, into its authored canvas at 4× logical resolution, with smoothing off and hard alpha. The source PNG is never changed.

Art and physical geometry have separate jobs: four seasonal variants share a single obstacle definition and the same collision body. The cart/trough require the existing normal jump, lantern requires the existing down-swipe crouch, and goose stays above the grounded sheep while remaining an airborne collision hazard.

Production browser evidence and reproducible QA scripts are recorded under `docs/aegis/work/2026-10-13-expanded-obstacles/`. Browser emulation does not constitute a phone hardware test.
