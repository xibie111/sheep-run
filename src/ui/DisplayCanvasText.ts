import type Phaser from "phaser";
import { DISPLAY_FONTS } from "./DisplayText";
import type { ArtRect } from "./MenuArtLayout";
import { sharpBitmap } from "./SharpBitmap";

export function formatHudNumber(value: number, minimumDigits = 5): string {
  return BigInt(Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))).toString().padStart(minimumDigits, "0");
}

export interface DisplayCanvasMetrics extends ArtRect { text: string; fontSize: number; baseline: number; ink: ArtRect }
export interface DisplayCanvasPainter {
  (context: CanvasRenderingContext2D, text: string, box: ArtRect, fontSize?: number): DisplayCanvasMetrics;
  fitFontSize(text: string, width: number, maximumSize: number): number;
}

// Font data and its decoded image are immutable during a load. Sharing painters
// lets notices reuse glyphs across scenes without retaining the scene itself.
const painters = new WeakMap<object, Map<string, { source: HTMLImageElement; painter: DisplayCanvasPainter }>>();

/** Use the very same local bitmap face as scene text at display resolution. */
export function displayCanvasText(scene: Phaser.Scene, color = "#542b16"): DisplayCanvasPainter {
  const font = scene.cache.bitmapFont.get(DISPLAY_FONTS.body.key).data;
  const source = scene.textures.get(DISPLAY_FONTS.body.key).getSourceImage() as HTMLImageElement;
  let colors = painters.get(font);
  if (!colors) { colors = new Map(); painters.set(font, colors); }
  const cached = colors.get(color);
  if (cached?.source === source) return cached.painter;
  // Tint the small final glyph, rather than allocating a full atlas per notice.
  const drawGlyph = sharpBitmap(source, color);
  type Measurement = { entries: { glyph: Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData; x: number }[];
    left: number; top: number; width: number; height: number };
  const measurements = new Map<string, Measurement>();
  const measure = (text: string) => {
    const cached = measurements.get(text);
    if (cached) return cached;
    const glyphs = [...text].map(char => font.chars[char.codePointAt(0)!]);
    if (glyphs.some(glyph => !glyph)) throw new Error(`Missing display glyph in: ${text}`);
    let advance = 0;
    const entries = glyphs.map(glyph => {
      const x = advance + glyph.xOffset;
      advance += glyph.xAdvance;
      return { glyph, x };
    });
    const left = entries.length ? Math.min(...entries.map(entry => entry.x)) : 0;
    const top = glyphs.length ? Math.min(...glyphs.map(glyph => glyph.yOffset)) : 0;
    const width = entries.length ? Math.max(...entries.map(entry => entry.x + entry.glyph.width)) - left : 0;
    const height = glyphs.length ? Math.max(...glyphs.map(glyph => glyph.yOffset + glyph.height)) - top : 0;
    const result = { entries, left, top, width, height };
    if (measurements.size >= 128) measurements.delete(measurements.keys().next().value!);
    measurements.set(text, result);
    return result;
  };
  const painter: DisplayCanvasPainter = (context, text, box, fontSize) => {
    const { entries, left, top, width, height } = measure(text);
    const scale = fontSize === undefined
      ? Math.min(box.width / Math.max(1, width), box.height / Math.max(1, height))
      : fontSize / font.size;
    const xOrigin = box.x + (box.width - width * scale) / 2;
    // A shared line box keeps different strings on the same baseline.
    const yOrigin = fontSize === undefined ? box.y + (box.height - height * scale) / 2 - top * scale
      : box.y + (box.height - font.lineHeight * scale) / 2;
    for (const { glyph, x } of entries) if (glyph.width && glyph.height) drawGlyph(context,
      { x: glyph.x, y: glyph.y, width: glyph.width, height: glyph.height },
      { x: xOrigin + (x - left) * scale,
        y: yOrigin + glyph.yOffset * scale,
        width: glyph.width * scale, height: glyph.height * scale });
    const bounds = { x: xOrigin, y: yOrigin + top * scale, width: width * scale, height: height * scale };
    return { text, fontSize: fontSize ?? scale * font.size, ...bounds, ink: bounds,
      baseline: yOrigin + font.lineHeight * scale };
  };
  painter.fitFontSize = (text, width, maximumSize) => Math.min(maximumSize, width / Math.max(1, measure(text).width) * font.size);
  if (colors.size >= 16) colors.delete(colors.keys().next().value!);
  colors.set(color, { source, painter });
  return painter;
}
