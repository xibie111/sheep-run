import type { ViewportSize } from '../game/Viewport';
import type { ArtRect, MenuSafeInsets } from '../ui/MenuArtLayout';

export const RESIDENT_READING_STYLE = { fontSize: 14, lineHeight: 20, paragraphGap: 14 } as const;

/** Fixed readable content widths; extra viewport space stays outside the centered panel. */
export function residentPanelLayout(size: ViewportSize, safe: MenuSafeInsets) {
  const width = Math.min(440, size.width - safe.left - safe.right - 16);
  const height = Math.min(250, size.height - safe.top - safe.bottom - 16);
  const panel: ArtRect = { x: safe.left + (size.width - safe.left - safe.right - width) / 2,
    y: safe.top + (size.height - safe.top - safe.bottom - height) / 2, width, height };
  const box = (x: number, y: number, w: number, h: number): ArtRect => ({ x: panel.x + x, y: panel.y + y, width: w, height: h });
  const cardWidth = (width - 52) / 3, bottom = height - 39, controlWidth = (width - 54) / 4;
  const readWidth = Math.min(272, width - 52);
  const residents = [0, 1, 2].map(i => box(18 + i * (cardWidth + 8), 43, cardWidth, bottom - 49));
  return { panel, blocker: { x: 0, y: 0, width: size.width, height: size.height },
    title: box(55, 10, width - 110, 24),
    saveNotice: box((width - 88) / 2, 31, 88, 12),
    residents,
    residentUnread: residents.map(card => ({ x: card.x + 3, y: card.y + card.height - 40, width: card.width - 6, height: 15 })),
    stages: [0, 1, 2].map(i => box(20, 93 + i * 33, width - 40, 29)),
    letters: [0, 1, 2].map(i => box(23, 48 + i * 48, width - 46, 42)),
    back: box(15, bottom, controlWidth, 29), lettersButton: box(23 + controlWidth, bottom, controlWidth, 29),
    artButton: box(31 + controlWidth * 2, bottom, controlWidth, 29), brief: box(39 + controlWidth * 3, bottom, controlWidth, 29),
    group: box(width - 192, bottom, 177, 29),
    previous: box(16, 9, 32, 28), next: box(width - 48, 9, 32, 28),
    readBody: box((width - readWidth) / 2, 48, readWidth, bottom - 59),
    readTitle: box(65, 10, width - 130, 24),
    readPage: box(24 + controlWidth, bottom, 78, 29), keep: box(width - 151, bottom, 136, 29),
    illustration: box(22, 43, width - 44, bottom - 52),
  };
}
