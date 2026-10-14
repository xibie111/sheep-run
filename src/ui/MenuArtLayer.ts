import type Phaser from "phaser";
import { MENU_ART_ASSETS, MENU_ART_GEOMETRY } from "../data/menuArtAssets";
import { watchViewport } from "../game/Viewport";
import { menuArtLayout, scoreGlyphLayout, scoreNumberBox, type MenuArtLayout, type ArtRect } from "./MenuArtLayout";
import { safeUiInsets } from "./UiLayout";
import { bindTouchTarget } from "./TouchTarget";
import { sizeDisplaySurface } from "./DisplaySurface";

export type MenuButtonName = "start" | "wardrobe";
type MenuButtons = Record<MenuButtonName, Phaser.GameObjects.Container>;

export function addMenuArtButton(scene: Phaser.Scene, name: MenuButtonName, label: string, activate: () => void): Phaser.GameObjects.Container {
  const button = scene.add.container(0, 0, []).setName(`button:${label}`).setDepth(10);
  // The existing Phaser touch owner/cancellation path remains the input authority.
  const layout = menuArtLayout({ width: 480, height: 270 }, { left: 0, right: 0, top: 0, bottom: 0 })[name];
  bindTouchTarget(scene, button, layout.width, layout.height, activate, pressed => button.setData("pressed", pressed));
  return button;
}

/** Paint UI at display resolution so it never passes through the 480x270 raster. */
export function attachMenuArt(scene: Phaser.Scene, highScore: number, buttons: MenuButtons): void {
  let layout: MenuArtLayout;
  const stopLayout = watchViewport(scene, size => {
    layout = menuArtLayout(size, safeUiInsets(scene));
    for (const name of Object.keys(buttons) as MenuButtonName[]) {
      const rect = layout[name];
      buttons[name].setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
    }
  });
  const parent = scene.game.canvas.parentElement;
  if (!parent) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.menuArt = "reference-v2";
  Object.assign(canvas.style, { position: "absolute", inset: "auto", margin: "0", padding: "0",
    pointerEvents: "none", zIndex: "1", transform: "none", imageRendering: "pixelated" });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Menu art needs a 2D drawing context");
  parent.appendChild(canvas);
  const images = Object.fromEntries(Object.entries(MENU_ART_ASSETS).map(([name, asset]) =>
    [name, scene.textures.get(asset.key).getSourceImage()])) as Record<keyof typeof MENU_ART_ASSETS, HTMLImageElement>;
  let previous = "";
  const paint = (): void => {
    if (canvas.hidden) return;
    const rect = scene.game.canvas.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const size = scene.scale.gameSize;
    const dpr = window.devicePixelRatio || 1;
    const pressed = Object.fromEntries(Object.entries(buttons).map(([name, button]) => [name, button.getData("pressed") === true]));
    const night = scene.data.get("menu-bedtime") === true;
    const state = JSON.stringify([rect.x, rect.y, rect.width, rect.height, parentRect.x, parentRect.y, dpr, layout, pressed, night]);
    if (state === previous || rect.width <= 0 || rect.height <= 0) return;
    previous = state;
    // Use exactly one display ratio; backing pixels are independent of gameSize.
    const scale = sizeDisplaySurface(canvas, scene.game.canvas, parent, size.width);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.imageSmoothingEnabled = false;
    const draw = (image: HTMLImageElement, source: ArtRect, destination: ArtRect): void => {
      context.drawImage(image, source.x, source.y, source.width, source.height,
        destination.x, destination.y, destination.width, destination.height);
    };
    for (const name of Object.keys(layout) as (keyof MenuArtLayout)[]) {
      const destination = { ...layout[name] };
      if (pressed[name]) destination.y += 1;
      draw(images[name], MENU_ART_GEOMETRY[name].ink, destination);
    }
    // The reference uses sturdy block numerals; keep this face alongside its plaque.
    for (const glyph of scoreGlyphLayout(highScore, scoreNumberBox(layout.score))) draw(images.digits, glyph.source, glyph.destination);
    if (night) {
      for (const name of Object.keys(layout) as (keyof MenuArtLayout)[]) {
        const destination = { ...layout[name] };
        if (pressed[name]) destination.y += 1;
        // Include the title, score badge and digits in the same readable night tint.
        // Tint opaque artwork only; transparent corners stay transparent.
        context.save(); context.globalCompositeOperation = "source-atop";
        context.fillStyle = pressed[name] ? "rgba(42,46,72,0.38)" : "rgba(42,46,72,0.30)";
        context.resetTransform();
        const left = Math.round(destination.x * scale), top = Math.round(destination.y * scale);
        context.fillRect(left, top, Math.round((destination.x + destination.width) * scale) - left,
          Math.round((destination.y + destination.height) * scale) - top);
        context.restore();
      }
    }
    canvas.dataset.layout = JSON.stringify(layout);
    canvas.dataset.score = String(highScore);
    canvas.dataset.theme = night ? "night" : "day";
  };
  const hide = (): void => { canvas.hidden = true; canvas.style.display = "none"; };
  const show = (): void => { canvas.hidden = false; canvas.style.display = "block"; previous = ""; paint(); };
  const cleanup = (): void => {
    stopLayout();
    scene.game.events.off("postrender", paint);
    scene.events.off("pause", hide); scene.events.off("sleep", hide);
    scene.events.off("resume", show); scene.events.off("wake", show);
    scene.events.off("shutdown", cleanup); scene.events.off("destroy", cleanup);
    canvas.remove();
  };
  scene.game.events.on("postrender", paint);
  scene.events.on("pause", hide); scene.events.on("sleep", hide);
  scene.events.on("resume", show); scene.events.on("wake", show);
  scene.events.once("shutdown", cleanup);
  scene.events.once("destroy", cleanup);
  paint();
}
