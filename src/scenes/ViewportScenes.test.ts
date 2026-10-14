import { afterEach, describe, expect, it, vi } from "vitest";

const safe = vi.hoisted(() => ({ left: 0, right: 0, top: 0, bottom: 0 }));
vi.mock("phaser", () => ({ default: {
  Scene: class Scene {},
  Geom: { Rectangle: class Rectangle {
    constructor(readonly x: number, readonly y: number, readonly width: number, readonly height: number) {}
    static Contains(): boolean { return true; }
  } },
  Display: { Color: { HexStringToColor: () => ({ color: 0 }) } },
} }));
vi.mock("../ui/UiLayout", () => ({ safeUiInsets: () => ({ ...safe }) }));
vi.mock("../ui/UiIcon", () => ({ addUiIcon: (scene: Harness, x: number, y: number, key: string, size: number) => scene.add.image(x, y, key).setDisplaySize(size, size) }));
vi.mock("../systems/SaveSystem", () => ({ SaveSystem: { load: () => ({
  highScore: 25, totalStars: 10, coins: 20, selectedSkin: "white", unlockedSkins: ["white"],
  settings: { music: true, sfx: true, musicVolume: 0.5, sfxVolume: 0.5 },
}), availableStars: (save: { totalStars: number; spentStars?: number } = { totalStars: 10 }) => Math.max(0, save.totalStars - (save.spentStars ?? 0)) } }));
// Keep scene layout and actual SceneButton/TouchTarget behavior; texture construction is
// independently owned by the backdrop helpers and needs a browser's rendering context.
vi.mock("../ui/PastureUi", () => ({
  addPastureBackdrop: (scene: Harness) => scene.add.container(0, 0, []),
  addUiPanel: (scene: Harness, x: number, y: number, width: number, height: number) => scene.add.rectangle(x, y, width, height),
  addWoodTitle: (scene: Harness, x: number, y: number, label: string, width: number, height: number) => scene.add.text(x, y, label).setDisplaySize(width, height),
  addCurrencyBadge: (scene: Harness, x: number, y: number, amount: number) => scene.add.bitmapText(x, y, "font", String(amount), 12),
}));
vi.mock("../ui/ViewportBackdrop", () => ({ addTiledPastureBackdrop: (scene: Harness) => scene.add.container(0, 0, []) }));
// Keep B's real content keys/catalogs; its canvas modal has separate browser and component checks.
vi.mock('../content-v2', async importOriginal => ({
  ...await importOriginal<typeof import('../content-v2')>(),
  createTripCard: vi.fn(() => ({ show: vi.fn(() => true), hide: vi.fn(), destroy: vi.fn() })),
}));

import { MenuScene } from "./MenuScene";
import { WardrobeScene } from "./WardrobeScene";
import { PauseScene } from "./PauseScene";
import { ResultScene } from "./ResultScene";
import { SCENE } from "../game/Constants";
import type { ResultSceneData } from "../game/GameState";
import { createTripCard } from '../content-v2';

class Events {
  readonly listeners = new Map<string, Set<(...args: any[]) => void>>();
  on(event: string, callback: (...args: any[]) => void): this {
    const callbacks = this.listeners.get(event) ?? new Set();
    callbacks.add(callback); this.listeners.set(event, callbacks); return this;
  }
  once(event: string, callback: (...args: any[]) => void): this {
    const once = (...args: any[]): void => { this.off(event, once); callback(...args); };
    return this.on(event, once);
  }
  off(event: string, callback: (...args: any[]) => void): this { this.listeners.get(event)?.delete(callback); return this; }
  emit(event: string, ...args: any[]): void { for (const callback of [...this.listeners.get(event) ?? []]) callback(...args); }
}

class ObjectStub extends Events {
  x = 0; y = 0; width = 0; height = 0; scaleX = 1; scaleY = 1; name = ""; text = ""; textureKey = "";
  list: ObjectStub[] = []; parent?: ObjectStub; hitArea?: { width: number; height: number }; data = new Map<string, unknown>();
  get displayWidth(): number { return this.width * this.scaleX; }
  get displayHeight(): number { return this.height * this.scaleY; }
  getTextBounds() { return { characters: this.text ? [{ x: 0, y: 0, w: this.width, h: this.height }] : [] }; }
  constructor(readonly scene: Harness) { super(); }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setX(x: number): this { this.x = x; return this; }
  setY(y: number): this { this.y = y; return this; }
  setScale(x: number, y = x): this { this.scaleX = x; this.scaleY = y; return this; }
  setSize(width: number, height: number): this { this.width = width; this.height = height; return this; }
  setDisplaySize(width: number, height: number): this { return this.setSize(width, height); }
  setOrigin(): this { return this; } setTint(): this { return this; } setDepth(): this { return this; } setStrokeStyle(): this { return this; }
  setName(name: string): this { this.name = name; return this; }
  setText(text: string): this { this.text = text; return this; }
  setTexture(texture: string): this { this.textureKey = texture; return this; }
  setData(key: string, value: unknown): this { this.data.set(key, value); return this; }
  setInteractive(hitArea: { width: number; height: number }): this { this.hitArea = hitArea; return this; }
  add(child: ObjectStub): this {
    const siblings = child.parent?.list ?? this.scene.children.list;
    const index = siblings.indexOf(child); if (index >= 0) siblings.splice(index, 1);
    child.parent = this; this.list.push(child); return this;
  }
  destroy(children = false): void {
    if (children) for (const child of [...this.list]) child.destroy(true);
    this.emit("destroy");
    const siblings = this.parent?.list ?? this.scene.children.list;
    const index = siblings.indexOf(this); if (index >= 0) siblings.splice(index, 1);
  }
}

type Harness = ReturnType<typeof makeHarness>;
function makeHarness(SceneClass: typeof MenuScene | typeof WardrobeScene | typeof PauseScene | typeof ResultScene, width: number, height: number, result?: ResultSceneData) {
  const scene = new SceneClass();
  const children = { list: [] as ObjectStub[] };
  const create = (x: number, y: number, width = 0, height = 0): ObjectStub => {
    const object = new ObjectStub(harness).setPosition(x, y).setSize(width, height);
    children.list.push(object); return object;
  };
  const canvas = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const audio = { currentSettings: { music: true, sfx: true, musicVolume: 0.5, sfxVolume: 0.5 }, play: vi.fn(), initializeAfterGesture: vi.fn() };
  const harness = {
    children, game: { canvas }, input: new Events(), events: new Events(),
    scale: Object.assign(new Events(), { gameSize: { width, height } }),
    registry: { get: () => audio, set: vi.fn() },
    scene: { start: vi.fn(), stop: vi.fn(), launch: vi.fn(), pause: vi.fn(), resume: vi.fn() },
    add: {
      image: (x: number, y: number, key: string) => create(x, y).setTexture(key),
      nineslice: (x: number, y: number, key: string, _frame: unknown, width: number, height: number) => create(x, y, width, height).setTexture(key),
      rectangle: (x: number, y: number, width: number, height: number) => create(x, y, width, height),
      ellipse: (x: number, y: number, width: number, height: number) => create(x, y, width, height),
      text: (x: number, y: number, text: string) => create(x, y, text.length * 10, 12).setText(text),
      bitmapText: (x: number, y: number, _font: string, text: string, size: number) => create(x, y, text.length * size, size).setText(text),
      container: (x: number, y: number, list: ObjectStub[]) => {
        const object = create(x, y); for (const child of list) object.add(child); return object;
      },
    },
  };
  Object.assign(scene, harness);
  if (scene instanceof ResultScene && result) scene.init(result);
  scene.create();
  return harness;
}

function objects(scene: Harness): ObjectStub[] {
  const flatten = (object: ObjectStub): ObjectStub[] => [object, ...object.list.flatMap(flatten)];
  return scene.children.list.flatMap(flatten);
}
function named(scene: Harness, name: string): ObjectStub {
  const object = objects(scene).find(object => object.name === name);
  expect(object, name).toBeDefined(); return object!;
}
function position(object: ObjectStub): { x: number; y: number; scaleX: number; scaleY: number } {
  let { x, y, scaleX, scaleY } = object;
  for (let parent = object.parent; parent; parent = parent.parent) {
    x = parent.x + x * parent.scaleX; y = parent.y + y * parent.scaleY;
    scaleX *= parent.scaleX; scaleY *= parent.scaleY;
  }
  return { x, y, scaleX, scaleY };
}
function expectTouchBounds(scene: Harness): void {
  const { width, height } = scene.scale.gameSize;
  for (const object of objects(scene).filter(object => object.hitArea)) {
    const world = position(object);
    expect(world.scaleX, object.name).toBe(world.scaleY);
    expect(world.x - object.hitArea!.width * world.scaleX / 2, object.name).toBeGreaterThanOrEqual(safe.left);
    expect(world.x + object.hitArea!.width * world.scaleX / 2, object.name).toBeLessThanOrEqual(width - safe.right);
    expect(world.y - object.hitArea!.height * world.scaleY / 2, object.name).toBeGreaterThanOrEqual(safe.top);
    expect(world.y + object.hitArea!.height * world.scaleY / 2, object.name).toBeLessThanOrEqual(height - safe.bottom);
  }
}
function resize(scene: Harness, width: number, height: number): void { scene.scale.gameSize = { width, height }; scene.scale.emit("resize"); }
function press(object: ObjectStub, wasTouch: boolean): void {
  const pointer = { wasTouch, wasCanceled: false, event: { type: wasTouch ? "touchend" : "mouseup", stopPropagation: vi.fn() } };
  object.emit("pointerdown", pointer); object.emit("pointerup", pointer);
}

afterEach(() => { Object.assign(safe, { left: 0, right: 0, top: 0, bottom: 0 }); vi.unstubAllGlobals(); });

describe("scene viewport layout", () => {
  it.each([
    ["menu", MenuScene, "button:开始游戏", 225], ["wardrobe", WardrobeScene, "wardrobe-preview", 138],
    ["pause", PauseScene, "button:继续游戏", 116.625], ["result", ResultScene, "button:再跑一次", 222],
  ] as const)("keeps %s geometry and touch targets intact across wide/narrow resizing", (_name, SceneClass, key, y) => {
    vi.stubGlobal("document", { getElementById: () => null });
    const scene = makeHarness(SceneClass, 480, 270);
    const baseline = position(named(scene, key));
    expect(baseline.y).toBe(y);
    expectTouchBounds(scene);
    for (const [width, height] of [[584, 270], [480, 360], [480, 270]]) {
      resize(scene, width, height);
      const current = position(named(scene, key));
      expect(current).toEqual({ ...baseline, x: baseline.x + (width - 480) / 2, y: y + (height - 270) / 2 });
      expectTouchBounds(scene);
    }
    scene.events.emit("shutdown");
    expect(scene.scale.listeners.get("resize")?.size).toBe(0);
    if (SceneClass === ResultScene) expect(vi.mocked(createTripCard).mock.results.at(-1)!.value.destroy).toHaveBeenCalledOnce();
  });

  it("covers the entire pause viewport while preserving centered panel dimensions", () => {
    const scene = makeHarness(PauseScene, 584, 270);
    const overlay = scene.children.list[0];
    expect([overlay.x, overlay.y, overlay.width, overlay.height]).toEqual([292, 135, 584, 270]);
    resize(scene, 480, 360);
    expect([overlay.x, overlay.y, overlay.width, overlay.height]).toEqual([240, 180, 480, 360]);
    expect(named(scene, "pause-dialog-art")).toMatchObject({ width: 192, height: 204, x: 240, y: 173 });
  });

  it("keeps result actions touch-only after safe-area scaling", () => {
    Object.assign(safe, { left: 30, right: 10, top: 12, bottom: 18 });
    const scene = makeHarness(ResultScene, 584, 270);
    expectTouchBounds(scene);
    const root = named(scene, "result-ui");
    expect(root.scaleX).toBeLessThan(1);
    expect(root.scaleX).toBe(root.scaleY);
    press(named(scene, "button:再跑一次"), false);
    expect(scene.scene.start).not.toHaveBeenCalled();
    press(named(scene, "button:再跑一次"), true);
    expect(scene.scene.start).toHaveBeenLastCalledWith(SCENE.run);
    press(named(scene, "button:返回牧场"), true);
    expect(scene.scene.start).toHaveBeenLastCalledWith(SCENE.menu);
    const trip = vi.mocked(createTripCard).mock.results.at(-1)!.value;
    const entry = named(scene, 'button:查看这次旅行');
    press(entry, false); expect(trip.show).not.toHaveBeenCalled();
    press(entry, true); expect(trip.show).toHaveBeenCalledOnce();
    expect(scene.scene.start).toHaveBeenCalledTimes(2);
  });

  it("displays existing score, best and earned coins without balance or stars", () => {
    const scene = makeHarness(ResultScene, 584, 270, { score: 12345, best: 12345, newRecord: true, coinsEarned: 25, coinBalance: 98765 });
    expect(named(scene, "result-score").text).toBe("12345");
    expect(named(scene, "result-best").text).toBe("牧场纪录  12345");
    expect(named(scene, "result-earned").text).toBe("金币 +25");
    expect(named(scene, "result-new-record").text).toBe("催眠羊真厉害！");
    expect(objects(scene).some(object => /余额|星星|98765/.test(object.text))).toBe(false);
  });

  it("retains local-font save-failure messaging and both navigation actions", () => {
    const scene = makeHarness(ResultScene, 480, 270, { score: 25, best: 25, newRecord: true, coinsEarned: 0, coinBalance: 0, saveFailed: true });
    expect(named(scene, "result-score").text).toBe("00025");
    expect(named(scene, "save-error").text).toBe("保存失败，本局进度可能未完整保存");
    expect(named(scene, "save-hint").text).toBe("请重新打开游戏后再试");
    expect(objects(scene).some(object => ["result-new-record", "result-best", "result-earned", "result-whisper"].includes(object.name))).toBe(false);
    expectTouchBounds(scene);
  });

  it("encourages an ordinary run while preserving its score and reward", () => {
    const scene = makeHarness(ResultScene, 584, 270, { score: 250, best: 520, newRecord: false, coinsEarned: 1, coinBalance: 99 });
    expect(named(scene, "result-whisper").text).toBe("没关系，我陪催眠羊再跑一次。");
    expect(named(scene, "result-score").text).toBe("00250");
    expect(named(scene, "result-earned").text).toBe("金币 +1");
    expect(objects(scene).some(object => object.name === "result-record-badge")).toBe(false);
  });

  it("keeps wardrobe artwork and touch targets proportional inside asymmetric safe insets after refresh", () => {
    Object.assign(safe, { left: 28, right: 8, top: 3, bottom: 9 });
    const scene = makeHarness(WardrobeScene, 480, 270);
    expectTouchBounds(scene);
    press(named(scene, "skin-card:black"), true);
    expect(objects(scene).filter(object => object.name === "wardrobe-preview")).toHaveLength(1);
    expectTouchBounds(scene);
    Object.assign(safe, { left: 0, right: 0, top: 0, bottom: 0 });
    resize(scene, 584, 270);
    expect(position(named(scene, "wardrobe-preview"))).toEqual({ x: 134, y: 138, scaleX: 1, scaleY: 1 });
    expectTouchBounds(scene);
  });

  it("updates menu safe insets after rotation without stretching or losing touch navigation", () => {
    vi.stubGlobal("document", { getElementById: () => null });
    const scene = makeHarness(MenuScene, 480, 270);
    Object.assign(safe, { left: 30, right: 18, top: 12, bottom: 10 });
    resize(scene, 584, 270);
    expectTouchBounds(scene);
    expect(scene.children.list.some(object => object.name === "button:settings")).toBe(false);
    const wardrobe = named(scene, "button:衣橱");
    expect(position(wardrobe).x + wardrobe.width / 2).toBe(584 - safe.right - 10);
    expect(position(wardrobe).y + wardrobe.height / 2).toBe(270 - safe.bottom - 18);
    press(named(scene, "button:开始游戏"), false);
    expect(scene.scene.start).not.toHaveBeenCalled();
    press(named(scene, "button:开始游戏"), true);
    expect(scene.scene.start).toHaveBeenLastCalledWith(SCENE.run);
    press(named(scene, "button:衣橱"), true);
    expect(scene.scene.start).toHaveBeenLastCalledWith(SCENE.wardrobe);
  });
});
