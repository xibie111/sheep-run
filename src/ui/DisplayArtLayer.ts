import type Phaser from "phaser";
import { sizeDisplaySurface } from "./DisplaySurface";

interface DisplayArt { image: Phaser.GameObjects.Image; shade?: Phaser.GameObjects.Rectangle }

/** Preserve Phaser layout and touch objects while displaying the source PNG directly. */
export function displayArtLayer(scene: Phaser.Scene, art: DisplayArt[]): void {
  const parent = scene.game.canvas?.parentElement;
  if (!parent || !scene.game.events) return;
  const canvas = document.createElement("canvas");
  canvas.dataset.displayArt = scene.sys.settings.key;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "auto", margin: "0", padding: "0",
    pointerEvents: "none", zIndex: "1", transform: "none", imageRendering: "pixelated" });
  parent.appendChild(canvas);
  const context = canvas.getContext("2d")!;
  for (const { image, shade } of art) {
    Object.assign(image, { renderWebGL: (): void => {}, renderCanvas: (): void => {} });
    if (shade) Object.assign(shade, { renderWebGL: (): void => {}, renderCanvas: (): void => {} });
  }
  let previous = "";
  const paint = (): void => {
    const rect = scene.game.canvas.getBoundingClientRect();
    const entries = art.map(({ image, shade }) => {
      const matrix = image.getWorldTransformMatrix();
      let visible = image.visible && image.active, alpha = image.alpha;
      for (let container = image.parentContainer; container; container = container.parentContainer) {
        visible &&= container.visible && container.active; alpha *= container.alpha;
      }
      return { image, visible, alpha, shade: shade?.alpha ?? 0,
        a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, x: matrix.tx, y: matrix.ty };
    });
    const parentRect = parent.getBoundingClientRect();
    const state = JSON.stringify([rect.toJSON(), parentRect.x, parentRect.y, window.devicePixelRatio,
      entries.map(({ image: _image, ...entry }) => entry)]);
    if (state === previous || rect.width <= 0 || rect.height <= 0) return;
    previous = state;
    const scale = sizeDisplaySurface(canvas, scene.game.canvas, parent, scene.scale.gameSize.width);
    context.imageSmoothingEnabled = false;
    for (const { image, visible, alpha, shade, a, b, c, d, x, y } of entries) {
      if (!visible || alpha <= 0) continue;
      const frame = image.frame, source = image.texture.getSourceImage() as CanvasImageSource;
      context.setTransform(a * scale, b * scale, c * scale, d * scale, Math.round(x * scale), Math.round(y * scale));
      context.globalAlpha = alpha;
      context.drawImage(source, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
        -image.displayOriginX, -image.displayOriginY, frame.width, frame.height);
      if (shade) {
        context.fillStyle = `rgba(113,53,20,${shade})`;
        context.fillRect(-image.displayOriginX + 40, -image.displayOriginY + 24, frame.width - 80, frame.height - 48);
      }
    }
    canvas.dataset.count = String(art.length);
  };
  const cleanup = (): void => {
    scene.game.events.off("postrender", paint);
    scene.events.off("shutdown", cleanup); scene.events.off("destroy", cleanup);
    canvas.remove();
  };
  scene.game.events.on("postrender", paint);
  scene.events.once("shutdown", cleanup); scene.events.once("destroy", cleanup);
}
