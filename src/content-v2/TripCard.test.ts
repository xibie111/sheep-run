import type Phaser from "phaser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireMenuModal, menuModalOwner } from "../ui/MenuModal";
import { CONTENT_V2_KEYS } from "./assetManifest";

const missingGlyphs = vi.hoisted(() => new Set<string>());
vi.mock("../ui/UiLayout", () => ({ safeUiInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) }));
vi.mock("../ui/DisplaySurface", () => ({ sizeDisplaySurface: () => 1 }));
vi.mock("../ui/DisplayCanvasText", () => ({ displayCanvasText: () => {
  const painter = (_ctx: unknown, text: string, box: { x: number; y: number; width: number; height: number }, fontSize: number) => ({ text, fontSize, ...box, ink: box, baseline: box.y + fontSize });
  painter.fitFontSize = (text: string, width: number, maximum: number) => {
    if ([...text].some(char => missingGlyphs.has(char))) throw new Error(`Missing display glyph in: ${text}`);
    return Math.min(maximum, width / Math.max(1, [...text].length));
  };
  return painter;
} }));
vi.mock("../ui/TouchTarget", () => ({ bindTouchTarget: (_scene: unknown, target: Target, width: number, height: number, activate: () => void, appearance: (pressed: boolean) => void) => {
  target.setSize(width, height);
  target.input = { enabled: true, hitArea: { setSize() {} } }; target.activate = activate; target.appearance = appearance;
} }));

import { createTripCard } from "./TripCard";

class Emitter {
  handlers = new Map<string, { fn: (...args: unknown[]) => void; once: boolean }[]>();
  on(name: string, fn: (...args: unknown[]) => void) { this.handlers.set(name, [...(this.handlers.get(name) ?? []), { fn, once: false }]); return this; }
  once(name: string, fn: (...args: unknown[]) => void) { this.handlers.set(name, [...(this.handlers.get(name) ?? []), { fn, once: true }]); return this; }
  off(name: string, fn: (...args: unknown[]) => void) { this.handlers.set(name, (this.handlers.get(name) ?? []).filter(item => item.fn !== fn)); return this; }
  emit(name: string, ...args: unknown[]) { for (const item of [...(this.handlers.get(name) ?? [])]) { if (item.once) this.off(name, item.fn); item.fn(...args); } }
  count(name: string) { return this.handlers.get(name)?.length ?? 0; }
}
class Target extends Emitter {
  name = ""; input: { enabled: boolean; hitArea: { setSize: (w: number, h: number) => void } } | null = null;
  activate = () => {}; appearance = (_value: boolean) => {};
  constructor(private readonly ownerList: Target[]) { super(); }
  setName(value: string) { this.name = value; return this; }
  setDepth(_value: number) { return this; }
  setPosition(_x: number, _y: number) { return this; }
  setSize(_width: number, _height: number) { return this; }
  destroy() { this.emit("destroy"); this.input = null; const index = this.ownerList.indexOf(this); if (index >= 0) this.ownerList.splice(index, 1); }
}

function fixture() {
  const children: Target[] = [];
  const button = new Target(children), disabled = new Target(children);
  button.input = { enabled: true, hitArea: { setSize() {} } }; disabled.input = { enabled: false, hitArea: { setSize() {} } }; children.push(button, disabled);
  const data = new Map<string, unknown>();
  const events = new Emitter(), gameEvents = new Emitter(), scaleEvents = new Emitter();
  const canvases: { dataset: Record<string, string>; style: Record<string, string>; removed: boolean }[] = [];
  const ctx = { drawImage() {}, setTransform() {}, fillRect() {}, save() {}, restore() {}, translate() {}, imageSmoothingEnabled: true };
  const parent = { appendChild(canvas: typeof canvases[number]) { canvases.push(canvas); } };
  const missing = new Set<string>();
  vi.stubGlobal("document", { createElement: () => {
    const canvas = { dataset: {}, style: {}, removed: false, setAttribute() {}, getContext: () => ctx, remove() { this.removed = true; } };
    return canvas;
  } });
  const scene = {
    game: { canvas: { parentElement: parent, getBoundingClientRect: () => ({ x: 0, y: 0, width: 480, height: 270 }) }, events: gameEvents },
    textures: { exists: (key: string) => !missing.has(key), get: (key: string) => ({
      getSourceImage: () => ({ width: key === CONTENT_V2_KEYS.tripPaper ? 1800 : 128, height: key === CONTENT_V2_KEYS.tripPaper ? 1000 : 112 }),
      has: () => true, get: () => ({ cutX: 0, cutY: 16, cutWidth: 128, cutHeight: 112 }),
    }) },
    events, scene: { isPaused: () => false },
    children: { list: children },
    add: { container: () => { const value = new Target(children); children.push(value); return value; } },
    data: { get: (key: string) => data.get(key), set: (key: string, value: unknown) => data.set(key, value), remove: (key: string) => data.delete(key) },
    scale: { gameSize: { width: 480, height: 270 }, on: scaleEvents.on.bind(scaleEvents), off: scaleEvents.off.bind(scaleEvents) },
  };
  return { scene: scene as unknown as Phaser.Scene, events, gameEvents, scaleEvents, children, button, disabled, canvases, missing, data };
}

beforeEach(() => { missingGlyphs.clear(); vi.stubGlobal("window", { devicePixelRatio: 1 }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("travel card ownership and lifecycle", () => {
  it("locks other touch targets and restores each original enabled state exactly", () => {
    const f = fixture(), card = createTripCard(f.scene, { starsCollected: 2 });
    expect(card.show()).toBe(true); expect(card.show()).toBe(true);
    expect(f.button.input?.enabled).toBe(false); expect(f.disabled.input?.enabled).toBe(false);
    expect(f.canvases[0].style.display).toBe("block"); expect(card.isOpen()).toBe(true);
    card.hide(); expect(f.button.input?.enabled).toBe(true); expect(f.disabled.input?.enabled).toBe(false);
    expect(f.canvases[0].style.display).toBe("none"); expect(menuModalOwner(f.scene)).toBeUndefined();
    card.destroy();
  });

  it("refuses to open over another owner unless A deliberately supplies the parent", () => {
    const f = fixture(), card = createTripCard(f.scene), release = acquireMenuModal(f.scene, "other", [])!;
    expect(card.show()).toBe(false); expect(card.isOpen()).toBe(false); expect(menuModalOwner(f.scene)).toBe("other");
    release(); expect(card.show()).toBe(true); card.destroy();
  });

  it("restores a permitted parent first, keeping background buttons blocked", () => {
    const f = fixture(), card = createTripCard(f.scene, {}, { parentModalOwner: "other" });
    const parent = acquireMenuModal(f.scene, "other", [])!;
    expect(card.show()).toBe(true); card.hide();
    expect(menuModalOwner(f.scene)).toBe("other"); expect(f.button.input?.enabled).toBe(false);
    parent(); expect(f.button.input?.enabled).toBe(true); card.destroy();
  });

  it.each([["pause", "resume"], ["sleep", "wake"]])("hides on %s and safely restores the open modal on %s", (pause, resume) => {
    const f = fixture(), card = createTripCard(f.scene); card.show();
    const close = f.children.find(child => child.name === "button:收好旅行卡")!;
    f.events.emit(pause); expect(card.isOpen()).toBe(true); expect(f.canvases[0].style.display).toBe("none"); expect(close.input?.enabled).toBe(false);
    expect(card.show()).toBe(false);
    f.events.emit(resume); expect(f.canvases[0].style.display).toBe("block"); expect(close.input?.enabled).toBe(true);
    expect(f.button.input?.enabled).toBe(false); card.destroy();
  });

  it("invokes close once only for an active touch target", () => {
    const f = fixture(), onClose = vi.fn(), card = createTripCard(f.scene, {}, { onClose });
    const close = f.children.find(child => child.name === "button:收好旅行卡")!;
    close.activate(); expect(onClose).not.toHaveBeenCalled(); card.show(); close.activate(); close.activate();
    expect(onClose).toHaveBeenCalledTimes(1); expect(card.isOpen()).toBe(false); card.destroy();
  });

  it("updates actual data and shows only a valid supplied protagonist", () => {
    const f = fixture(), card = createTripCard(f.scene, { protagonist: { id: "not-a-skin", name: "未知羊" } });
    card.show(); expect(f.canvases[0].dataset.portraitVisible).toBe("false");
    card.update({ protagonist: { id: "mint", name: "薄荷羊" }, starsCollected: 12 }); f.gameEvents.emit("postrender");
    expect(f.canvases[0].dataset.portraitVisible).toBe("true");
    expect(JSON.parse(f.canvases[0].dataset.model).summary).toContain("12颗星星"); card.destroy();
  });

  it.each(["manual", "shutdown"])("cleans its DOM, viewport listener and touch objects on %s", mode => {
    const f = fixture(), card = createTripCard(f.scene); card.show();
    if (mode === "manual") card.destroy(); else f.events.emit("shutdown");
    expect(card.isOpen()).toBe(false); expect(card.show()).toBe(false);
    expect(f.canvases[0].removed).toBe(true); expect(f.children).toEqual([f.button, f.disabled]);
    expect(f.gameEvents.count("postrender")).toBe(0); expect(f.scaleEvents.count("resize")).toBe(0);
    expect(f.events.count("pause")).toBe(0); expect(f.events.count("resume")).toBe(0);
    expect(f.button.input?.enabled).toBe(true); expect(f.disabled.input?.enabled).toBe(false);
    card.destroy();
  });

  it("fails before adding any UI when a generated runtime texture was not loaded", () => {
    const f = fixture(); f.missing.add(CONTENT_V2_KEYS.tripPaper);
    expect(() => createTripCard(f.scene)).toThrow("Trip card textures not preloaded");
    expect(f.canvases).toHaveLength(0); expect(f.children).toHaveLength(2);
  });

  it("reports missing font glyphs before taking the result page's input lock", () => {
    const f = fixture(), card = createTripCard(f.scene);
    missingGlyphs.add("「");
    expect(() => card.show({ goals: [{ id: "g", title: "收星", completed: true }] })).toThrow("Missing display glyph");
    expect(card.isOpen()).toBe(false); expect(menuModalOwner(f.scene)).toBeUndefined();
    expect(f.button.input?.enabled).toBe(true); expect(f.disabled.input?.enabled).toBe(false);
    expect(f.canvases[0].style.display).toBe("none"); card.destroy();
  });

  it("retains the previous valid card when an update contains an unsupported glyph", () => {
    const f = fixture(), card = createTripCard(f.scene, { starsCollected: 12 }); card.show();
    missingGlyphs.add("「");
    expect(() => card.update({ goals: [{ id: "g", title: "收星", completed: true }] })).toThrow("Missing display glyph");
    f.gameEvents.emit("postrender");
    expect(JSON.parse(f.canvases[0].dataset.model).summary).toContain("12颗星星");
    expect(card.isOpen()).toBe(true); card.destroy();
  });
});
