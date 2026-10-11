import { describe, expect, it } from "vitest";
import { mailLayout } from "./MailLayout";
import { MAIL_PANEL_ART } from "../data/mailboxAssets";

describe("compact letter card layout", () => {
  it.each([[480, 270, 0], [585, 270, 0], [584, 270, 0], [480, 360, 0], [480, 270, 40]])("keeps art proportional and reading/navigation separate at %sx%s with %s safe inset", (w, h, inset) => {
    const safe = { left: 0, right: 0, top: inset, bottom: inset };
    const layout = mailLayout(w, h, safe), { panel, body, left, right, pageCount, rows, close } = layout;
    expect(panel.width / panel.height).toBeCloseTo(MAIL_PANEL_ART.width / MAIL_PANEL_ART.height);
    expect(panel.width).toBeLessThanOrEqual(248);
    expect(panel.y).toBeGreaterThanOrEqual(inset);
    expect(panel.y + panel.height).toBeLessThanOrEqual(h - inset);
    expect(body.height).toBeGreaterThanOrEqual(17);
    expect(body.y + body.height).toBeLessThan(left.y);
    expect(left.x + left.width).toBeLessThan(pageCount.x);
    expect(pageCount.x + pageCount.width).toBeLessThan(right.x);
    expect(rows[0].y + rows[0].height).toBeLessThan(rows[1].y);
    expect(rows[1].y + rows[1].height).toBeLessThan(close.y);
    for (const box of [body, left, right, pageCount, ...rows, close, layout.headerBack]) {
      expect(box.x).toBeGreaterThanOrEqual(panel.x);
      expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
      expect(box.y).toBeGreaterThanOrEqual(panel.y);
      expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height);
    }
  });
});
