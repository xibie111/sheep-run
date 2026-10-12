import type { ViewportSize } from "../game/Viewport";
import type { MenuSafeInsets } from "./MenuArtLayout";
import type { ArtRect } from "./MenuArtLayout";

export const RESULT_BOXES = {
  panel: { x: 102, y: 4, width: 276, height: 262 },
  title: { x: 176, y: 42, width: 128, height: 28 },
  score: { x: 164, y: 85, width: 152, height: 40 },
  record: { x: 164, y: 126, width: 152, height: 23 },
  recordText: { x: 217, y: 133, width: 75, height: 12 },
  whisper: { x: 151, y: 131, width: 178, height: 16 },
  best: { x: 163, y: 155, width: 154, height: 15 },
  earned: { x: 191, y: 184, width: 110, height: 16 },
  saveError: { x: 153, y: 155, width: 174, height: 15 },
  saveHint: { x: 163, y: 184, width: 154, height: 16 },
  retry: { x: 139, y: 206, width: 110, height: 32 },
  home: { x: 255, y: 206, width: 86, height: 32 },
} as const satisfies Record<string, ArtRect>;

/** Opposite the existing achievement entry, above the result title and actions. */
export function resultTripEntry(size: ViewportSize, safe: MenuSafeInsets): ArtRect {
  return { x: size.width - safe.right - 135, y: safe.top + 5, width: 128, height: 34 };
}

/** Safe-area adjustments move and uniformly scale the UI; never resize the Canvas. */
export function resultPlacement(size: ViewportSize, safe: MenuSafeInsets): { x: number; y: number; scale: number } {
  const width = Math.max(1, size.width - safe.left - safe.right);
  const height = Math.max(1, size.height - safe.top - safe.bottom);
  const scale = Math.min(1, Math.max(1, width - 8) / RESULT_BOXES.panel.width, Math.max(1, height - 8) / RESULT_BOXES.panel.height);
  return {
    x: safe.left + width / 2 - 240 * scale,
    y: safe.top + height / 2 - 135 * scale,
    scale,
  };
}
