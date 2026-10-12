import type Phaser from "phaser";
import { RUN_HUD_ASSET, RUN_HUD_DIGITS, RUN_HUD_FRAMES } from "../data/runHudAssets";
import { RUN_STAR_ART } from "../data/collectibleArtAssets";
import { SCENE } from "../game/Constants";
import { watchViewport } from "../game/Viewport";
import { safeUiInsets } from "./UiLayout";
import { formatHudNumber } from "./DisplayCanvasText";
import { RUN_HUD_COUNTERS, runHudLayout, runHudNumberBox, type RunHudLayout } from "./RunHudLayout";
import type { ArtRect } from "./MenuArtLayout";
import { sizeDisplaySurface } from "./DisplaySurface";
import { sharpBitmap } from "./SharpBitmap";

export interface RunHudValues { score: number; stars: number; best: number; streak: number; milestone: number | null }

/** Generated controls and live glyphs share one layout with the touch owner. */
export function attachRunHudArt(scene: Phaser.Scene, values: () => RunHudValues, pauseButton: Phaser.GameObjects.Container): void {
  const parent = scene.game.canvas.parentElement;
  if (!parent) return;
  let layout: RunHudLayout;
  const stopLayout = watchViewport(scene, size => {
    layout = runHudLayout(size, safeUiInsets(scene));
    const pause = layout.pause;
    pauseButton.setPosition(pause.x + pause.width / 2, pause.y + pause.height / 2)
      .setSize(pause.width, pause.height).setData("hud-rect", pause);
    pauseButton.input?.hitArea.setSize(pause.width, pause.height);
  });
  const canvas = document.createElement("canvas");
  canvas.dataset.runHudArt = "reference-v2";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "auto", margin: "0", padding: "0",
    pointerEvents: "none", zIndex: "1", transform: "none", imageRendering: "pixelated" });
  const context = canvas.getContext("2d")!;
  parent.appendChild(canvas);
  const source = scene.textures.get(RUN_HUD_ASSET.key).getSourceImage() as HTMLImageElement;
  const starIcon = scene.textures.get(RUN_STAR_ART.key).getSourceImage() as HTMLImageElement;
  const drawGlyph = sharpBitmap(source);
  const digits: Readonly<Record<string, ArtRect>> = RUN_HUD_DIGITS;
  const nativeHeight = 101, nativeGap = 14;
  const measure = (text: string): number => [...text].reduce((width, digit) => width + digits[digit]!.width, 0)
    + Math.max(0, text.length - 1) * nativeGap;
  const drawNumbers = (text: string, box: ArtRect, fontSize: number) => {
    const scale = fontSize / nativeHeight, width = measure(text) * scale;
    const baseline = box.y + (box.height + fontSize) / 2;
    let x = box.x + (box.width - width) / 2;
    const ink = { x, y: baseline - fontSize, width, height: fontSize };
    const glyphs = [...text].map(digit => {
      const frame = digits[digit]!, destination = { x, y: baseline - frame.height * scale,
        width: frame.width * scale, height: frame.height * scale };
      drawGlyph(context, frame, destination);
      x += (frame.width + nativeGap) * scale;
      return { digit, source: frame, destination };
    });
    return { text, fontSize, baseline, ink, ...ink, glyphs };
  };
  const drawLine = (prefix: ArtRect, text: string, box: ArtRect, fontSize: number) => {
    const scale = fontSize / nativeHeight, gap = 8 * scale;
    const prefixWidth = prefix.width * scale, numberWidth = measure(text) * scale;
    const x = box.x + (box.width - prefixWidth - gap - numberWidth) / 2;
    const baseline = box.y + (box.height + fontSize) / 2;
    drawGlyph(context, prefix, { x, y: baseline - prefix.height * scale,
      width: prefixWidth, height: prefix.height * scale });
    return drawNumbers(text, { x: x + prefixWidth + gap, y: box.y, width: numberWidth, height: box.height }, fontSize);
  };
  const drawArt = (frame: ArtRect, destination: ArtRect): void => {
    context.drawImage(source, frame.x, frame.y, frame.width, frame.height,
      destination.x, destination.y, destination.width, destination.height);
  };
  let previous = "";
  const paint = (): void => {
    const rect = scene.game.canvas.getBoundingClientRect(), parentRect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1, size = scene.scale.gameSize, current = values();
    const pressed = pauseButton.getData("pressed") === true, paused = scene.scene.isPaused(SCENE.run);
    const pauseScene = scene.game.scene.getScene(SCENE.pause);
    const panel = paused ? pauseScene.children.list.find(child => child.name === "pause-dialog-art") as Phaser.GameObjects.Image | undefined : undefined;
    const panelBounds = panel?.getBounds();
    const state = JSON.stringify([rect.x, rect.y, rect.width, rect.height, parentRect.x, parentRect.y, dpr, layout, current, pressed, paused, panelBounds]);
    if (previous === state || rect.width <= 0 || rect.height <= 0) return;
    previous = state;
    const surfaceScale = sizeDisplaySurface(canvas, scene.game.canvas, parent, size.width), hudScale = layout.score.width / 116;
    context.setTransform(surfaceScale, 0, 0, surfaceScale, 0, 0);
    context.imageSmoothingEnabled = false;
    const numberStrings = Object.fromEntries(RUN_HUD_COUNTERS.map(name =>
      [name, formatHudNumber(current[name], name === "score" || name === "best" ? 5 : name === "stars" ? 2 : 1)]));
    const fontSize = Math.min(12 * hudScale, ...RUN_HUD_COUNTERS.map(name => {
      const width = runHudNumberBox(name, layout[name]).width;
      const nativeWidth = measure(numberStrings[name]!) + (name === "streak" ? RUN_HUD_FRAMES.streakPrefix.width + 8 : 0);
      return width / nativeWidth * nativeHeight;
    }));
    const typography: Record<string, unknown> = {};
    for (const name of ["score", "best"] as const) {
      drawArt(RUN_HUD_FRAMES[name], layout[name]);
      typography[name] = { number: drawNumbers(numberStrings[name]!, runHudNumberBox(name, layout[name]), fontSize) };
    }
    const starBox = runHudNumberBox("stars", layout.stars), starWidth = 20 * hudScale, starGap = 4 * hudScale;
    const starNumberWidth = measure(numberStrings.stars!) * fontSize / nativeHeight;
    const starX = layout.stars.x + (layout.stars.width - starWidth - starGap - starNumberWidth) / 2;
    const starRect = { x: starX, y: starBox.y + (starBox.height - starWidth) / 2, width: starWidth, height: starWidth };
    context.drawImage(starIcon, 0, 0, starIcon.width, starIcon.height, starRect.x, starRect.y, starRect.width, starRect.height);
    typography.stars = { number: drawNumbers(numberStrings.stars!,
      { ...starBox, x: starX + starWidth + starGap, width: starNumberWidth }, fontSize) };
    if (current.streak > 1) typography.streak = { number: drawLine(RUN_HUD_FRAMES.streakPrefix, numberStrings.streak!, layout.streak, fontSize) };
    else typography.streak = { number: { text: "", fontSize, baseline: layout.streak.y + (layout.streak.height + fontSize) / 2,
      ink: { ...layout.streak, width: 0, height: fontSize }, width: 0, visible: false } };
    if (current.milestone !== null) drawLine(RUN_HUD_FRAMES.milestonePrefix, String(current.milestone), layout.milestone, fontSize);
    const pause = { ...layout.pause, y: layout.pause.y + (pressed ? hudScale : 0) };
    drawArt(RUN_HUD_FRAMES.pause, pause);
    if (pressed) {
      context.fillStyle = "rgba(113,53,20,0.14)";
      context.fillRect(pause.x + 10 * hudScale, pause.y + 7 * hudScale, pause.width - 20 * hudScale, pause.height - 14 * hudScale);
    }
    if (paused) {
      context.globalCompositeOperation = "source-atop";
      context.fillStyle = "rgba(59,53,40,0.62)";
      context.fillRect(0, 0, size.width, size.height);
      if (panel && panelBounds) {
        const image = panel.texture.getSourceImage() as HTMLImageElement, frame = panel.frame;
        context.globalCompositeOperation = "destination-out";
        context.drawImage(image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
          panelBounds.x, panelBounds.y, panelBounds.width, panelBounds.height);
      }
      context.globalCompositeOperation = "source-over";
    }
    canvas.dataset.layout = JSON.stringify(layout); canvas.dataset.values = JSON.stringify(current);
    canvas.dataset.typography = JSON.stringify(typography); canvas.dataset.paused = String(paused);
    canvas.dataset.pressed = String(pressed); canvas.dataset.plaques = "score,best";
    canvas.dataset.starIcon = JSON.stringify(starRect); canvas.dataset.starFrame = "false";
    canvas.dataset.starTexture = RUN_STAR_ART.key;
  };
  const cleanup = (): void => {
    stopLayout(); scene.game.events.off("postrender", paint);
    scene.events.off("shutdown", cleanup); scene.events.off("destroy", cleanup); canvas.remove();
  };
  scene.game.events.on("postrender", paint);
  scene.events.once("shutdown", cleanup); scene.events.once("destroy", cleanup); paint();
}

