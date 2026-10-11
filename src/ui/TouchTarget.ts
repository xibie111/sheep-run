import Phaser from "phaser";
import { MENU_MODAL_CANCEL } from "./MenuModal";

/** One touch owns a press. Drag-out, OS cancellation and scene sleep cancel it. */
export function bindTouchTarget(scene: Phaser.Scene, target: Phaser.GameObjects.Container, width: number, height: number, activate: () => void, appearance: (pressed: boolean) => void): void {
  // Phaser adds the Container display origin before hit testing: use 0..size.
  target.setSize(width, height).setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
  let owner: Phaser.Input.Pointer | undefined;
  const reset = (): void => { owner = undefined; appearance(false); };
  target.on("pointerdown", (pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
    if (!pointer.wasTouch || owner) return;
    event?.stopPropagation();
    pointer.event?.stopPropagation();
    owner = pointer;
    appearance(true);
  });
  target.on("pointerup", (pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
    if (!pointer.wasTouch || owner !== pointer) return;
    event?.stopPropagation();
    pointer.event?.stopPropagation();
    const cancelled = pointer.wasCanceled || /cancel/.test(pointer.event?.type ?? "");
    reset();
    if (!cancelled) activate();
  });
  target.on("pointerout", reset);
  target.on("pointerupoutside", reset);
  scene.input.on("pointerupoutside", reset);
  const canvas = scene.game.canvas;
  canvas.addEventListener("touchcancel", reset, true);
  canvas.addEventListener("pointercancel", reset, true);
  scene.events.on("sleep", reset);
  scene.events.on(MENU_MODAL_CANCEL, reset);
  const cleanup = (): void => {
    scene.input.off("pointerupoutside", reset);
    canvas.removeEventListener("touchcancel", reset, true);
    canvas.removeEventListener("pointercancel", reset, true);
    scene.events.off("sleep", reset);
    scene.events.off(MENU_MODAL_CANCEL, reset);
  };
  target.once("destroy", cleanup);
}
