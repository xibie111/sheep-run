import { RUN_HUD_FRAMES } from "../data/runHudAssets";
import type { ViewportSize } from "../game/Viewport";
import type { ArtRect, MenuSafeInsets } from "./MenuArtLayout";

export type RunHudCounter = "score" | "best" | "stars" | "streak";
export const RUN_HUD_COUNTERS: readonly RunHudCounter[] = ["score", "best", "stars", "streak"];
export type RunHudLayout = Record<RunHudCounter | "pause" | "milestone", ArtRect>;

export function runHudLayout(size: ViewportSize, safe: MenuSafeInsets): RunHudLayout {
  const available = Math.max(1, size.width - safe.left - safe.right - 16);
  const scale = Math.min(1, available / 344);
  const width = 116 * scale, height = width * RUN_HUD_FRAMES.score.height / RUN_HUD_FRAMES.score.width;
  const center = safe.left + 8 + available / 2, top = safe.top + 7;
  const starsWidth = 82 * scale, starsHeight = starsWidth * RUN_HUD_FRAMES.stars.height / RUN_HUD_FRAMES.stars.width;
  const pauseWidth = 48 * scale, pauseHeight = pauseWidth * RUN_HUD_FRAMES.pause.height / RUN_HUD_FRAMES.pause.width;
  const starsY = top + 39 * scale;
  return {
    score: { x: safe.left + 8, y: top, width, height },
    best: { x: size.width - safe.right - 8 - width, y: top, width, height },
    pause: { x: center - pauseWidth / 2, y: top, width: pauseWidth, height: pauseHeight },
    stars: { x: center - starsWidth / 2, y: starsY, width: starsWidth, height: starsHeight },
    streak: { x: center - 60 * scale, y: starsY + starsHeight + 3 * scale, width: 120 * scale, height: 14 * scale },
    milestone: { x: center - 60 * scale, y: starsY + starsHeight + 23 * scale, width: 120 * scale, height: 14 * scale },
  };
}

export function runHudNumberBox(name: RunHudCounter, rect: ArtRect): ArtRect {
  if (name === "streak") return rect;
  if (name === "stars") return { x: rect.x + rect.width * 0.36, y: rect.y + rect.height * 0.33,
    width: rect.width * 0.45, height: rect.width / 82 * 14 };
  const scale = rect.width / 116;
  return { x: rect.x + 20 * scale, y: rect.y + 18 * scale, width: rect.width - 40 * scale, height: 14 * scale };
}

export function containsRunPausePoint(pause: ArtRect, x: number, y: number): boolean {
  return x >= pause.x && x <= pause.x + pause.width && y >= pause.y && y <= pause.y + pause.height;
}

