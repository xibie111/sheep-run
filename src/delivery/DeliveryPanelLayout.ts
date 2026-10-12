import type { ViewportSize } from '../game/Viewport';
import type { ArtRect, MenuSafeInsets } from '../ui/MenuArtLayout';

/** Shared panel/touch geometry for landscape and the existing taller adaptive viewport. */
export function deliveryPanelLayout(size: ViewportSize, safe: MenuSafeInsets) {
  const available = Math.max(1, size.width - safe.left - safe.right);
  const width = Math.min(440, available - 16), height = Math.min(250, size.height - safe.top - safe.bottom - 16);
  const panel = { x: safe.left + (available - width) / 2, y: safe.top + (size.height - safe.top - safe.bottom - height) / 2, width, height };
  const third = (width - 44) / 3, bottom = panel.y + height - 43, cardWidth = (width - 52) / 2;
  const back = { x: panel.x + 14, y: bottom, width: third, height: 34 };
  const start = { x: panel.x + width - third - 14, y: bottom, width: third, height: 34 };
  const card = { x: panel.x + (width - third) / 2, y: bottom, width: third, height: 34 };
  return {
    panel, blocker: { x: 0, y: 0, width: size.width, height: size.height }, back, start, card, album: start,
    previous: { x: panel.x + 13, y: panel.y + 9, width: 32, height: 32 },
    next: { x: panel.x + width - 45, y: panel.y + 9, width: 32, height: 32 },
    title: { x: panel.x + 49, y: panel.y + 9, width: width - 98, height: 21 },
    cards: [0, 1].map(i => ({ x: panel.x + 20 + i * (cardWidth + 12), y: panel.y + 45, width: cardWidth, height: height - 102 })) as [ArtRect, ArtRect],
    albumSlots: [0, 1, 2].map(i => ({ x: panel.x + 28 + i * ((width - 56) / 3), y: panel.y + 49, width: (width - 72) / 3, height: 94 })),
  };
}
export type DeliveryPanelLayout = ReturnType<typeof deliveryPanelLayout>;
