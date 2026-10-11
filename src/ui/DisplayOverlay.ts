import type Phaser from "phaser";
import { sizeDisplaySurface } from "./DisplaySurface";

/** Cached physical-pixel display layer, with scene-owned pause and cleanup. */
export function createDisplayOverlay(scene: Phaser.Scene, kind: string, draw: (ctx: CanvasRenderingContext2D) => void, zIndex = 4) {
  const parent = scene.game.canvas.parentElement!;
  const canvas = document.createElement("canvas");
  canvas.dataset.adventureOverlay = kind;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {position:"absolute",margin:"0",padding:"0",pointerEvents:"none",zIndex:String(zIndex),imageRendering:"pixelated",display:"none"});
  parent.appendChild(canvas);
  const context = canvas.getContext("2d")!;
  let visible = false, revision = 0, previous = "";
  const paint = () => {
    if (!visible || scene.scene.isPaused()) return;
    const rect = scene.game.canvas.getBoundingClientRect(), size = scene.scale.gameSize;
    const state = JSON.stringify([rect.x,rect.y,rect.width,rect.height,size.width,size.height,window.devicePixelRatio,revision]);
    if (previous === state) return;
    previous = state;
    const scale = sizeDisplaySurface(canvas, scene.game.canvas, parent, size.width);
    context.setTransform(scale,0,0,scale,0,0); context.imageSmoothingEnabled = false;
    draw(context);
  };
  const pause = () => { canvas.style.display="none"; };
  const resume = () => { previous="";canvas.style.display=visible?"block":"none";paint(); };
  const destroy = () => {
    scene.game.events.off("postrender",paint);scene.events.off("pause",pause);scene.events.off("resume",resume);
    scene.events.off("shutdown",destroy);scene.events.off("destroy",destroy);canvas.remove();
  };
  scene.game.events.on("postrender",paint);scene.events.on("pause",pause);scene.events.on("resume",resume);
  scene.events.once("shutdown",destroy);scene.events.once("destroy",destroy);
  return {canvas,invalidate(){revision++;},show(value:boolean){if(visible===value)return;visible=value;revision++;canvas.style.display=value?"block":"none";if(value)paint();}};
}
