import type Phaser from "phaser";
import { SCENE } from "../game/Constants";
import { sizeDisplaySurface } from "./DisplaySurface";
import { sharpBitmap } from "./SharpBitmap";

const layers = new WeakMap<Phaser.Scene, Set<Phaser.GameObjects.BitmapText>>();

/** Keep Phaser layout/touch bounds, but paint letters at the actual display size. */
export function registerDisplayText(scene: Phaser.Scene, object: Phaser.GameObjects.BitmapText): void {
  const parent = scene.game.canvas?.parentElement;
  if (!parent || !scene.game.events) return;
  let objects = layers.get(scene);
  if (!objects) {
    objects = new Set();
    layers.set(scene, objects);
    createLayer(scene, parent, objects);
  }
  objects.add(object);
  // Their Phaser dimensions, visibility and transforms remain the layout authority.
  Object.assign(object, { renderWebGL: (): void => {}, renderCanvas: (): void => {} });
  const registered = objects;
  object.once("destroy", () => registered.delete(object));
}

function createLayer(scene: Phaser.Scene, parent: HTMLElement, objects: Set<Phaser.GameObjects.BitmapText>): void {
  const canvas = document.createElement("canvas");
  canvas.dataset.displayText = scene.sys.settings.key;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "auto", margin: "0", padding: "0",
    pointerEvents: "none", zIndex: "1", transform: "none", imageRendering: "pixelated" });
  parent.appendChild(canvas);
  const context = canvas.getContext("2d")!;
  const tinted = new Map<string, HTMLCanvasElement>();
  const glyphPainters = new Map<string, ReturnType<typeof sharpBitmap>>();
  const fontImage = (font: string, tint: number): HTMLCanvasElement => {
    const key = `${font}:${tint}`;
    const cached = tinted.get(key);
    if (cached) return cached;
    const source = scene.textures.get(font).getSourceImage() as HTMLImageElement;
    const image = document.createElement("canvas"); image.width = source.width; image.height = source.height;
    const ctx = image.getContext("2d")!;
    ctx.drawImage(source, 0, 0);
    if (tint !== 0xffffff) {
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = `#${tint.toString(16).padStart(6, "0")}`;
      ctx.fillRect(0, 0, image.width, image.height);
    }
    tinted.set(key, image);
    return image;
  };
  let previous = "";
  const paint = (): void => {
    const rect = scene.game.canvas.getBoundingClientRect(), parentRect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1, camera = scene.cameras.main;
    const entries = [...objects].map(text => {
      text.getTextBounds();
      let visible = text.visible && text.active, alpha = text.alpha;
      for (let container = text.parentContainer; container; container = container.parentContainer) {
        visible &&= container.visible && container.active; alpha *= container.alpha;
      }
      const matrix = text.getWorldTransformMatrix();
      return { text, visible, alpha, a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d,
        x: matrix.tx - camera.scrollX * text.scrollFactorX, y: matrix.ty - camera.scrollY * text.scrollFactorY,
        value: text.text, font: text.font, size: text.fontSize, ox: text.displayOriginX, oy: text.displayOriginY,
        tint: text.tintTopLeft, depth: text.depth, spacing: text.letterSpacing };
    }).filter(entry => entry.visible && entry.alpha > 0 && entry.value).sort((a, b) => a.depth - b.depth);
    const paused = scene.sys.settings.key === SCENE.run && scene.scene.isPaused(SCENE.run);
    const pause = paused ? scene.game.scene.getScene(SCENE.pause) : undefined;
    const panel = pause?.children.list.find(child => child.name === "pause-dialog-art") as Phaser.GameObjects.Image | undefined;
    const panelBounds = panel?.getBounds();
    const state = JSON.stringify([rect.x, rect.y, rect.width, rect.height, parentRect.x, parentRect.y, dpr,
      entries.map(({ text: _object, ...entry }) => entry), paused, panelBounds]);
    if (state === previous || rect.width <= 0 || rect.height <= 0) return;
    previous = state;
    const scale = sizeDisplaySurface(canvas, scene.game.canvas, parent, scene.scale.gameSize.width);
    context.imageSmoothingEnabled = false;
    for (const entry of entries) {
      const data = scene.cache.bitmapFont.get(entry.font).data;
      const image = fontImage(entry.font, entry.tint);
      const key = `${entry.font}:${entry.tint}`;
      let drawGlyph = glyphPainters.get(key);
      if (!drawGlyph) { drawGlyph = sharpBitmap(image); glyphPainters.set(key, drawGlyph); }
      const ratio = entry.size / data.size;
      context.setTransform(entry.a * scale, entry.b * scale, entry.c * scale, entry.d * scale, entry.x * scale, entry.y * scale);
      context.globalAlpha = entry.alpha;
      let advance = 0, line = 0;
      for (const character of entry.value) {
        if (character === "\n") { advance = 0; line += data.lineHeight; continue; }
        const glyph = data.chars[character.codePointAt(0)!];
        if (!glyph) throw new Error(`Missing display glyph: ${character}`);
        if (glyph.width && glyph.height) drawGlyph(context,
          { x: glyph.x, y: glyph.y, width: glyph.width, height: glyph.height },
          { x: (advance + glyph.xOffset) * ratio - entry.ox, y: (line + glyph.yOffset) * ratio - entry.oy,
            width: glyph.width * ratio, height: glyph.height * ratio });
        advance += glyph.xAdvance + entry.spacing;
      }
    }
    context.globalAlpha = 1;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    if (paused) {
      context.globalCompositeOperation = "source-atop";
      context.fillStyle = "rgba(59,53,40,0.62)";
      context.fillRect(0, 0, scene.scale.gameSize.width, scene.scale.gameSize.height);
      if (panel && panelBounds) {
        const image = panel.texture.getSourceImage() as HTMLImageElement, frame = panel.frame;
        context.globalCompositeOperation = "destination-out";
        context.drawImage(image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
          panelBounds.x, panelBounds.y, panelBounds.width, panelBounds.height);
      }
      context.globalCompositeOperation = "source-over";
    }
    canvas.dataset.count = String(entries.length);
  };
  const cleanup = (): void => {
    scene.game.events.off("postrender", paint); layers.delete(scene); objects.clear(); tinted.clear(); glyphPainters.clear(); canvas.remove();
    scene.events.off("shutdown", cleanup); scene.events.off("destroy", cleanup);
  };
  scene.game.events.on("postrender", paint);
  scene.events.once("shutdown", cleanup);
  scene.events.once("destroy", cleanup);
}
