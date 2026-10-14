import { MENU_ART_GEOMETRY, type MenuArtName } from "../data/menuArtAssets";
import { viewportOffsetY, type ViewportSize } from "../game/Viewport";

export interface ArtRect { x: number; y: number; width: number; height: number }
export interface MenuSafeInsets { left: number; right: number; top: number; bottom: number }
export type MenuArtLayout = Record<Exclude<MenuArtName, "settings">, ArtRect>;

function fit(name: MenuArtName, width: number, height: number): ArtRect {
  const ink = MENU_ART_GEOMETRY[name].ink;
  const scale = Math.min(width / ink.width, height / ink.height);
  return { x: 0, y: 0, width: ink.width * scale, height: ink.height * scale };
}

// Anchor the whole decorated artwork, including crown/leaves, inside safe edges.
export function menuArtLayout(size: ViewportSize, safe: MenuSafeInsets): MenuArtLayout {
  const title = fit("title", 220, 106);
  const start = fit("start", 153, 53);
  const wardrobe = fit("wardrobe", 64, 51);
  const score = fit("score", 62, 52);
  const offsetY = viewportOffsetY(size);
  title.x = (size.width - title.width) / 2;
  title.y = 7 + offsetY + safe.top;
  start.x = (size.width - start.width) / 2;
  start.y = 225 + offsetY - safe.bottom - start.height / 2;
  wardrobe.x = size.width - safe.right - 10 - wardrobe.width;
  wardrobe.y = size.height - safe.bottom - 18 - wardrobe.height;
  score.x = size.width - safe.right - 8 - score.width;
  score.y = safe.top + 8;
  return { title, start, wardrobe, score };
}

/** Use the former gear position; stack only when the second book would meet the title. */
export function menuBookEntryLayout(size: ViewportSize, safe: MenuSafeInsets): { collection: ArtRect; journey: ArtRect } {
  const collection = { x: safe.left + 8, y: safe.top + 8, width: 56, height: 48 };
  const journey = { ...collection, x: collection.x + 62 };
  if (journey.x + journey.width > menuArtLayout(size, safe).title.x - 4) {
    journey.x = collection.x;
    journey.y = collection.y + collection.height + 6;
  }
  return { collection, journey };
}

/** Keep the icon and caption apart and inside the generated button's cream face. */
export function menuBookButtonContent(button: ArtRect): { icon: ArtRect; label: ArtRect } {
  return {
    icon: { x: button.x + 17, y: button.y + 4, width: 22, height: 22 },
    label: { x: button.x + 7, y: button.y + 26, width: 42, height: 12 },
  };
}

// This is the empty number row inside the generated badge's golden face.
export function scoreNumberBox(badge: ArtRect): ArtRect {
  return { x: badge.x + badge.width * 0.19, y: badge.y + badge.height * 0.59,
    width: badge.width * 0.62, height: badge.height * 0.18 };
}

export function scoreGlyphLayout(score: number, box: ArtRect): { digit: string; source: ArtRect; destination: ArtRect }[] {
  const glyphs: Readonly<Record<string, ArtRect>> = MENU_ART_GEOMETRY.digits.glyphs;
  // SaveSystem accepts finite integer scores. Avoid exponent characters for large values.
  const digits = BigInt(Math.max(0, Math.floor(Number.isFinite(score) ? score : 0))).toString().padStart(5, "0").split("");
  const gap = 28;
  const width = digits.reduce((sum, digit) => sum + glyphs[digit].width, 0) + gap * (digits.length - 1);
  const height = Math.max(...digits.map(digit => glyphs[digit].height));
  const scale = Math.min(box.width / width, box.height / height);
  let x = box.x + (box.width - width * scale) / 2;
  return digits.map(digit => {
    const source = glyphs[digit];
    const destination = { x, y: box.y + (box.height - source.height * scale) / 2,
      width: source.width * scale, height: source.height * scale };
    x += (source.width + gap) * scale;
    return { digit, source, destination };
  });
}
