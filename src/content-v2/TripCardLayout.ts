import type { ViewportSize } from "../game/Viewport";
import type { ArtRect, MenuSafeInsets } from "../ui/MenuArtLayout";

export interface TripCardLayout {
  panel: ArtRect;
  scale: number;
  title: ArtRect;
  portrait: ArtRect;
  protagonistName: ArtRect;
  seasons: ArtRect;
  summary: ArtRect;
  highlights: readonly { text: ArtRect; stamp: ArtRect }[];
  footer: ArtRect;
  close: ArtRect;
}

/** Layout follows the generated page reference; all raster art keeps its ratio. */
export function tripCardLayout(size: ViewportSize, safe: MenuSafeInsets, paperAspect = 2.2): TripCardLayout {
  const aspect = Number.isFinite(paperAspect) && paperAspect > 0 ? paperAspect : 2.2;
  const width = Math.max(1, Math.min(390, size.width - safe.left - safe.right - 20, (size.height - safe.top - safe.bottom - 20) * aspect, 220 * aspect));
  const height = width / aspect;
  const panel = { x: safe.left + (size.width - safe.left - safe.right - width) / 2, y: safe.top + (size.height - safe.top - safe.bottom - height) / 2, width, height };
  const scale = Math.min(width / 390, height / 176);
  const authoredHeight = height / scale;
  const left = panel.x + (width - 390 * scale) / 2, top = panel.y;
  const box = (x: number, y: number, w: number, h: number): ArtRect => ({ x: left + x * scale, y: top + y * scale, width: w * scale, height: h * scale });
  const summaryY = authoredHeight * .20 + 6;
  const summaryHeight = Math.min(45, authoredHeight * .205);
  const closeY = authoredHeight - 37;
  const highlightY = summaryY + summaryHeight + 5;
  const rowHeight = (closeY - 4 - highlightY) / 3;
  const stampSize = Math.min(23, rowHeight - 1);
  const portraitY = summaryY + 5, portraitHeight = Math.min(88, authoredHeight * .40);
  const nameY = portraitY + portraitHeight - 1;
  return {
    panel, scale,
    title: box(130, 9, 130, 27),
    portrait: box(27, portraitY, 92, portraitHeight),
    protagonistName: box(19, nameY, 108, 20),
    seasons: box(21, nameY + 20, 104, 16),
    summary: box(143, summaryY, 222, summaryHeight),
    highlights: [0, 1, 2].map(index => ({ text: box(144, highlightY + index * rowHeight, 184, rowHeight - 1), stamp: box(340, highlightY + index * rowHeight, stampSize, stampSize) })),
    footer: box(19, authoredHeight - 25, 108, 22),
    close: box(153, closeY, 108, 34),
  };
}

/** Useful for A's result-page placement of the independently generated entry. */
export function fitTripArt(sourceWidth: number, sourceHeight: number, box: ArtRect): ArtRect {
  const factor = Math.min(box.width / Math.max(1, sourceWidth), box.height / Math.max(1, sourceHeight));
  return { x: box.x + (box.width - sourceWidth * factor) / 2, y: box.y + (box.height - sourceHeight * factor) / 2, width: sourceWidth * factor, height: sourceHeight * factor };
}
