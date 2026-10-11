import { LOADING_PIXEL_FONT_URL, LOADING_PIXEL_GLYPHS } from "../data/loadingPixelFont";

const TITLE = "小贴士";
const LINE_HEIGHT = 14;
const advance = (text: string): number => [...text].reduce((sum, character) => sum + LOADING_PIXEL_GLYPHS[character.codePointAt(0)!]!.advance, 0);
export interface LoadingTipLayout { width: number; height: number; titleScale: number; bodyScale: number; lines: string[]; titleY: number; bodyY: number; gap: number; }

/** Whole source pixels, complete copy and a bounded layout; no browser text. */
export function loadingTipLayout(text: string, width: number, height: number): LoadingTipLayout {
  for (const character of TITLE + text) {
    if (!LOADING_PIXEL_GLYPHS[character.codePointAt(0)!]) throw new Error(`Missing loading pixel glyph: ${character}`);
  }
  // Short tips can use larger blocks; long tips shrink by whole pixel steps.
  let bodyScale = Math.max(1, Math.floor(height / 26));
  let titleScale = bodyScale + 1;
  const gap = Math.max(2, Math.floor(height / 24));
  const wrap = (): string[] => {
    const lines: string[] = []; let line = "";
    for (const character of text) {
      if (line && advance(line + character) * bodyScale > width) {
        // Keep punctuation with its preceding character, without exceeding width.
        if (/[。，？！，]/.test(character) && line.length > 1) {
          const last = line.at(-1)!; lines.push(line.slice(0, -1)); line = last + character;
        } else { lines.push(line); line = character; }
      } else line += character;
    }
    if (line) lines.push(line);
    return lines;
  };
  let lines = wrap();
  const totalHeight = (): number => 12 * titleScale + gap + LINE_HEIGHT * bodyScale * lines.length;
  while (totalHeight() > height || advance(TITLE) * titleScale > width) {
    if (titleScale > bodyScale) titleScale--;
    else if (bodyScale > 1) { bodyScale--; titleScale = bodyScale + 1; lines = wrap(); }
    else throw new Error("Loading tip inner area is too small for its pixel text");
  }
  const titleY = Math.floor((height - totalHeight()) / 2);
  return { width, height, titleScale, bodyScale, lines, titleY, bodyY: titleY + 12 * titleScale + gap, gap };
}

export class LoadingTipArt {
  private readonly image = new Image();
  private tinted?: HTMLCanvasElement;
  private text = "";
  private disposed = false;
  constructor(private readonly canvas: HTMLCanvasElement) {
    this.image.onload = () => { if (!this.disposed) { this.prepare(); this.render(this.text); } };
    this.image.src = LOADING_PIXEL_FONT_URL;
  }
  render(text: string): void {
    this.text = text;
    if (!this.tinted || this.disposed) return;
    const box = this.canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(box.width * dpr);
    this.canvas.height = Math.floor(box.height * dpr);
    const layout = loadingTipLayout(text, this.canvas.width, this.canvas.height);
    const context = this.canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    const drawLine = (line: string, y: number, scale: number): void => {
      let x = Math.floor((layout.width - advance(line) * scale) / 2);
      for (const character of line) {
        const glyph = LOADING_PIXEL_GLYPHS[character.codePointAt(0)!]!;
        if (glyph.width && glyph.height) context.drawImage(this.tinted!, glyph.x, glyph.y, glyph.width, glyph.height,
          x + glyph.xoffset * scale, y + glyph.yoffset * scale, glyph.width * scale, glyph.height * scale);
        x += glyph.advance * scale;
      }
    };
    drawLine(TITLE, layout.titleY, layout.titleScale);
    layout.lines.forEach((line, index) => drawLine(line, layout.bodyY + LINE_HEIGHT * layout.bodyScale * index, layout.bodyScale));
    this.canvas.dataset.layout = JSON.stringify(layout);
    this.canvas.dataset.text = text;
    this.canvas.dataset.font = "Ark Pixel 12 / integer pixels";
  }
  destroy(): void { this.disposed = true; this.image.onload = null; this.tinted = undefined; }
  private prepare(): void {
    this.tinted = document.createElement("canvas");
    this.tinted.width = this.image.naturalWidth; this.tinted.height = this.image.naturalHeight;
    const context = this.tinted.getContext("2d")!;
    context.drawImage(this.image, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = "#4c2d16";
    context.fillRect(0, 0, this.tinted.width, this.tinted.height);
  }
}
