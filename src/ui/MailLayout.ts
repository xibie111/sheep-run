import { MAIL_PANEL_ART } from "../data/mailboxAssets";
import type { ArtRect } from "./MenuArtLayout";

/** The approved compact card scales uniformly; body text never shrinks to fit. */
export function mailLayout(width: number, height: number, safe: { left: number; right: number; top: number; bottom: number }) {
  const w = Math.min(248, width - safe.left - safe.right - 24, (height - safe.top - safe.bottom - 24) * MAIL_PANEL_ART.width / MAIL_PANEL_ART.height);
  const h = w * MAIL_PANEL_ART.height / MAIL_PANEL_ART.width, k = w / 248;
  const panel: ArtRect = { x: Math.round(safe.left + (width - safe.left - safe.right - w) / 2), y: Math.round(safe.top + (height - safe.top - safe.bottom - h) / 2), width: w, height: h };
  const box = (x: number, y: number, width: number, height: number): ArtRect => ({ x: panel.x + x, y: panel.y + y, width, height });
  const footerY = h - 11 * k - 26, leftWidth = Math.max(50, 57 * k), rightWidth = Math.max(72, 88 * k);
  const left = box(21 * k, footerY, leftWidth, 26), right = box(w - 21 * k - rightWidth, footerY, rightWidth, 26);
  return {
    panel, k,
    title: box(w / 2 - 34 * k, 29 * k, 68 * k, 26 * k),
    body: box(24 * k, 61 * k, w - 48 * k, footerY - 61 * k - 10),
    left, right,
    pageCount: box(left.x - panel.x + left.width + 3, footerY, right.x - left.x - left.width - 6, 26),
    headerBack: box(12 * k, 21 * k, 36, 21),
    close: box(w / 2 - 53, footerY, 106, 26),
    rows: [0, 1].map(i => box(22 * k, 72 * k + i * (38 * k + 8), w - 44 * k, 38 * k)),
  };
}
