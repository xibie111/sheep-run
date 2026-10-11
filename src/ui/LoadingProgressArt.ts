import { LOADING_PIXEL_FONT_URL, LOADING_PIXEL_GLYPHS } from "../data/loadingPixelFont";
import type { LoadingProgressState } from "./LoadingProgress";

/** A compact pixel wood frame, gold fill and the same bitmap font as loading tips. */
export class LoadingProgressArt {
  private readonly font = new Image();
  private ink?: HTMLCanvasElement;
  private outline?: HTMLCanvasElement;
  private state: LoadingProgressState = { stage: "boot", percent: 0, label: "准备牧场", indeterminate: true };
  private time = 0;
  private disposed = false;
  constructor(private readonly canvas: HTMLCanvasElement, fontReady: () => void) {
    this.font.onload = () => {
      if (this.disposed) return;
      this.ink = this.tint("#fff3d6"); this.outline = this.tint("#4c2d16");
      fontReady(); this.render(this.state, this.time);
    };
    this.font.src = LOADING_PIXEL_FONT_URL;
  }
  render(state: LoadingProgressState, time = 0): void {
    this.state = state; this.time = time;
    if (this.disposed) return;
    const box = this.canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (box.width <= 0 || box.height <= 0) return;
    const width = Math.round(box.width * dpr), height = Math.round(box.height * dpr);
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    const ctx = this.canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
    const unit = Math.max(1, Math.round(height / 36));
    const rect = (color: string, x: number, y: number, w: number, h: number): void => {
      ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)));
    };
    const top = Math.round(height * 0.48), bottom = height - 2 * unit;
    // Stepped corners and narrow borders stay crisp at each backing-store size.
    rect("#4c2d16", 2 * unit, top + 2 * unit, width - 4 * unit, bottom - top);
    rect("#4c2d16", 4 * unit, top, width - 8 * unit, bottom - top);
    rect("#a45c2b", 3 * unit, top + 2 * unit, width - 6 * unit, bottom - top - 2 * unit);
    rect("#e3a84f", 5 * unit, top + unit, width - 10 * unit, unit);
    rect("#743d20", 5 * unit, bottom - 2 * unit, width - 10 * unit, unit);
    const track = { x: 7 * unit, y: top + 4 * unit, width: width - 14 * unit, height: bottom - top - 7 * unit };
    rect("#4e321f", track.x - unit, track.y - unit, track.width + 2 * unit, track.height + 2 * unit);
    rect("#68492b", track.x, track.y, track.width, track.height);
    const fillWidth = Math.floor(track.width * state.percent / 100);
    rect(state.stage === "error" ? "#c67745" : "#f5b547", track.x, track.y, fillWidth, track.height);
    if (fillWidth) {
      rect("#ffe9a0", track.x, track.y, fillWidth, unit);
      rect("#ce782a", track.x, track.y + track.height - unit, fillWidth, unit);
      for (let x = 12 * unit; x < fillWidth; x += 12 * unit) rect("#df9438", track.x + x, track.y + unit, unit, track.height - 2 * unit);
    }
    if (state.indeterminate) {
      const capsule = Math.min(track.width, 20 * unit);
      const x = Math.round((Math.sin(time / 650 - Math.PI / 2) + 1) / 2 * (track.width - capsule));
      rect("#f5b547", track.x + x, track.y, capsule, track.height);
      rect("#ffe9a0", track.x + x, track.y, capsule, unit);
    }
    const value = state.indeterminate ? "…" : `${state.percent}%`;
    if (this.ink && this.outline) {
      const scale = Math.max(1, Math.min(unit, Math.floor((top - unit) / 12)));
      const textY = Math.max(unit, Math.floor((top - 12 * scale) / 2));
      this.text(state.label, 4 * unit, textY, scale, ctx);
      this.text(value, width - 4 * unit - this.measure(value) * scale, textY, scale, ctx);
      this.canvas.dataset.font = "Ark Pixel 12 / integer pixels";
    }
    this.canvas.dataset.stage = state.stage;
    this.canvas.dataset.percent = String(state.percent);
    this.canvas.dataset.layout = JSON.stringify({ width, height, unit, track, fillWidth, label: state.label, value });
  }
  destroy(): void { this.disposed = true; this.font.onload = null; this.ink = this.outline = undefined; }
  private measure(text: string): number {
    return [...text].reduce((sum, character) => sum + LOADING_PIXEL_GLYPHS[character.codePointAt(0)!]!.advance, 0);
  }
  private text(text: string, x: number, y: number, scale: number, ctx: CanvasRenderingContext2D): void {
    for (const character of text) {
      const glyph = LOADING_PIXEL_GLYPHS[character.codePointAt(0)!]!;
      const dx = Math.round(x + glyph.xoffset * scale), dy = Math.round(y + glyph.yoffset * scale);
      for (const [ox, oy] of [[-scale, 0], [scale, 0], [0, -scale], [0, scale]]) {
        ctx.drawImage(this.outline!, glyph.x, glyph.y, glyph.width, glyph.height, dx + ox!, dy + oy!, glyph.width * scale, glyph.height * scale);
      }
      ctx.drawImage(this.ink!, glyph.x, glyph.y, glyph.width, glyph.height, dx, dy, glyph.width * scale, glyph.height * scale);
      x += glyph.advance * scale;
    }
  }
  private tint(color: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas"); canvas.width = this.font.naturalWidth; canvas.height = this.font.naturalHeight;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(this.font, 0, 0);
    ctx.globalCompositeOperation = "source-in"; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
}
