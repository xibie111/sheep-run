export const RUN_HUD_ASSET = {
  key: "run-hud-reference-v2",
  url: new URL("../../assets/ui/run-hud-v2/hud-atlas.png", import.meta.url).href,
} as const;

// Alpha bounds measured from the built-in generated transparent sprite sheet.
// The screenshot fixes the composition; the atlas leaves every count field blank.
export const RUN_HUD_FRAMES = {
  score: { x: 34, y: 136, width: 718, height: 260 },
  best: { x: 784, y: 136, width: 718, height: 260 },
  stars: { x: 66, y: 511, width: 522, height: 167 },
  pause: { x: 640, y: 474, width: 324, height: 240 },
  streakPrefix: { x: 1095, y: 559, width: 284, height: 93 },
  milestonePrefix: { x: 1214, y: 826, width: 234, height: 76 },
} as const;

export const RUN_HUD_DIGITS = {
  "0": { x: 83, y: 811, width: 76, height: 100 },
  "1": { x: 194, y: 810, width: 44, height: 101 },
  "2": { x: 287, y: 811, width: 74, height: 100 },
  "3": { x: 391, y: 811, width: 74, height: 100 },
  "4": { x: 496, y: 811, width: 82, height: 100 },
  "5": { x: 610, y: 811, width: 73, height: 100 },
  "6": { x: 719, y: 811, width: 75, height: 100 },
  "7": { x: 828, y: 811, width: 72, height: 100 },
  "8": { x: 935, y: 811, width: 74, height: 100 },
  "9": { x: 1044, y: 810, width: 75, height: 101 },
} as const;
