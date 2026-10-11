import type Phaser from "phaser";

export const MENU_MODAL_CHANGE = "menu-modal-change";
export const MENU_MODAL_CANCEL = "menu-modal-cancel";
export interface ModalTarget { input?: { enabled: boolean } | null }

/** Restores each captured state, including deliberately disabled objects. */
export class ModalInputStack {
  private stack: { owner: string; before: Map<ModalTarget, { input: NonNullable<ModalTarget["input"]>; enabled: boolean }> }[] = [];
  get owner(): string | undefined { return this.stack[this.stack.length - 1]?.owner; }
  acquire(owner: string, targets: readonly ModalTarget[], allowed: readonly ModalTarget[], parent?: string): (() => void) | undefined {
    if (this.owner && this.owner !== parent) return undefined;
    const before = new Map<ModalTarget, { input: NonNullable<ModalTarget["input"]>; enabled: boolean }>();
    for (const target of targets) if (target.input) {
      before.set(target, { input: target.input, enabled: target.input.enabled });
      if (!allowed.includes(target)) target.input.enabled = false;
    }
    const frame = { owner, before }; this.stack.push(frame);
    let released = false;
    return () => {
      if (released || this.stack[this.stack.length - 1] !== frame) return;
      released = true; this.stack.pop();
      for (const [target, prior] of before) if (target.input === prior.input) target.input.enabled = prior.enabled;
    };
  }
  clear(): void { this.stack = []; }
}

const stacks = new WeakMap<Phaser.Scene, ModalInputStack>();
export function menuModalOwner(scene: Phaser.Scene): string | undefined { return stacks.get(scene)?.owner; }

export function acquireMenuModal(scene: Phaser.Scene, owner: string, allowed: readonly Phaser.GameObjects.GameObject[], parent?: string): (() => void) | undefined {
  let stack = stacks.get(scene);
  if (!stack) {
    stack = new ModalInputStack(); stacks.set(scene, stack);
    const cleanup = () => { stack!.clear(); stacks.delete(scene); scene.data.remove("menu-modal-owner"); scene.events.off("shutdown", cleanup); scene.events.off("destroy", cleanup); };
    scene.events.once("shutdown", cleanup); scene.events.once("destroy", cleanup);
  }
  if (stack.owner && stack.owner !== parent) return undefined;
  const targets: ModalTarget[] = [];
  const collect = (objects: readonly Phaser.GameObjects.GameObject[]) => {
    for (const object of objects) { targets.push(object); if ("list" in object && Array.isArray(object.list)) collect(object.list); }
  };
  collect(scene.children.list);
  scene.events.emit(MENU_MODAL_CANCEL);
  const release = stack.acquire(owner, targets, allowed, parent);
  if (!release) return undefined;
  const changed = () => { scene.data.set("menu-modal-owner", stack!.owner ?? null); scene.events.emit(MENU_MODAL_CHANGE); };
  changed();
  return () => { scene.events.emit(MENU_MODAL_CANCEL); release(); changed(); };
}

export function openMenuSettings(scene: Phaser.Scene, open: () => void): void {
  const release = acquireMenuModal(scene, "settings", []);
  if (!release) return;
  const resume = () => { scene.events.off("shutdown", shutdown); release(); };
  const shutdown = () => scene.events.off("resume", resume);
  scene.events.once("resume", resume); scene.events.once("shutdown", shutdown); open();
}
