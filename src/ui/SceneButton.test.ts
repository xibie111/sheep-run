import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: { Geom: { Rectangle: class Rectangle { constructor(readonly x: number, readonly y: number, readonly width: number, readonly height: number) {} } } },
}));
import { addSceneButton, buttonTextureKey } from "./SceneButton";
vi.mock("./UiIcon", () => ({ addUiIcon: (scene: ReturnType<typeof makeScene>, x: number, y: number, key: string, size: number) => scene.add.image(x, y, key).setDisplaySize(size, size) }));

class FakeObject {
  textureKey = ""; textureFrame?: string; tint = 0xffffff; alpha = 1; interactive = false; width = 40; height = 12; x = 0; y = 0; scaleX = 1; scaleY = 1;
  text = ""; data = new Map(); hitArea: unknown;
  listeners = new Map<string, (...args: unknown[]) => void>();
  on(event: string, callback: (...args: unknown[]) => void): this { this.listeners.set(event, callback); return this; }
  once(event: string, callback: (...args: unknown[]) => void): this { return this.on(event, callback); }
  off(event: string): this { this.listeners.delete(event); return this; }
  emit(event: string, ...args: unknown[]): void { this.listeners.get(event)?.(...args); }
  setTexture(key: string): this { this.textureKey = key; return this; }
  get displayWidth(): number { return this.width * this.scaleX; }
  get displayHeight(): number { return this.height * this.scaleY; }
  getTextBounds() { return { characters: this.text ? [{ x: 0, y: 0, w: this.width, h: this.height }] : [] }; }
  setScale(value: number): this { this.scaleX = this.scaleY = value; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setDisplaySize(width: number, height: number): this { this.width = width; this.height = height; return this; } setOrigin(): this { return this; }
  setDepth(): this { return this; } setTint(value: number): this { this.tint = value; return this; }
  setName(): this { return this; } setX(value: number): this { this.x = value; return this; }
  setY(value: number): this { this.y = value; return this; }
  setData(key: string, value: unknown): this { this.data.set(key, value); return this; }
  setSize(): this { return this; }
  setInteractive(area: unknown): this { this.hitArea = area; this.interactive = true; return this; }
}
class FakeContainer extends FakeObject { constructor(readonly list: FakeObject[]) { super(); } }
function makeScene() {
  const canvas = new EventTarget();
  const image = vi.fn((_x: number, _y: number, key: string, frame?: string) => Object.assign(new FakeObject().setTexture(key), { textureFrame: frame }));
  const nineslice = vi.fn((_x: number, _y: number, key: string, _frame: unknown, width: number, height: number) => Object.assign(new FakeObject().setTexture(key), { width, height }));
  const bitmapText = vi.fn((_x: number, _y: number, _font: string, label: string) => Object.assign(new FakeObject(), { text: label, width: label.length * 12 }));
  const container = vi.fn((_x: number, _y: number, children: FakeObject[]) => new FakeContainer(children));
  return { add: { image, nineslice, bitmapText, container }, game: { canvas }, input: new FakeObject(), events: new FakeObject() };
}
const touch = () => ({ wasTouch: true, wasCanceled: false, event: { type: "touchend", stopPropagation: vi.fn() } });

describe("SceneButton touch feedback", () => {
  it("maps press and disabled styles to clean-pack textures", () => {
    expect(buttonTextureKey("primary", true)).toBe("ui-button-primary-pressed");
    expect(buttonTextureKey("secondary", true)).toBe("ui-button-secondary-pressed");
    expect(buttonTextureKey("disabled", true)).toBe("ui-button-disabled");
  });
  it("activates only a touch that started on this button and restores the base", () => {
    const scene = makeScene(), activate = vi.fn(), p = touch();
    const button = addSceneButton(scene as never, 80, 100, "开始游戏", activate, { style: "primary", width: 180, height: 48 });
    const background = button.list[0] as unknown as FakeObject;
    button.emit("pointerup", p);
    expect(activate).not.toHaveBeenCalled();
    button.emit("pointerdown", p);
    expect(background.textureKey).toBe("ui-button-primary-pressed");
    button.emit("pointerup", p);
    expect(background.textureKey).toBe("ui-button-primary");
    expect(activate).toHaveBeenCalledOnce();
    expect((button as unknown as FakeObject).listeners.has("pointerover")).toBe(false);
  });
  it.each(["pointerout", "pointerupoutside"])("cancels on %s", event => {
    const scene = makeScene(), activate = vi.fn(), p = touch();
    const button = addSceneButton(scene as never, 0, 0, "开始游戏", activate, { style: "primary" });
    button.emit("pointerdown", p); button.emit(event, p); button.emit("pointerup", p);
    expect((button.list[0] as unknown as FakeObject).textureKey).toBe("ui-button-primary");
    expect(activate).not.toHaveBeenCalled();
  });
  it.each(["touchcancel", "pointercancel"])("restores on OS %s without activating", event => {
    const scene = makeScene(), activate = vi.fn(), p = touch();
    const button = addSceneButton(scene as never, 0, 0, "开始游戏", activate, { style: "primary" });
    button.emit("pointerdown", p); scene.game.canvas.dispatchEvent(new Event(event)); button.emit("pointerup", p);
    expect((button.list[0] as unknown as FakeObject).textureKey).toBe("ui-button-primary");
    expect(activate).not.toHaveBeenCalled();
  });
  it("ignores mouse and a different finger's release", () => {
    const scene = makeScene(), activate = vi.fn(), p = touch();
    const button = addSceneButton(scene as never, 0, 0, "开始游戏", activate);
    button.emit("pointerdown", { ...touch(), wasTouch: false });
    button.emit("pointerup", p);
    button.emit("pointerdown", p); button.emit("pointerup", touch());
    expect(activate).not.toHaveBeenCalled();
    button.emit("pointerup", p);
    expect(activate).toHaveBeenCalledOnce();
  });
  it("keeps disabled buttons inert and covers the full Container hit area", () => {
    const scene = makeScene(), activate = vi.fn();
    const button = addSceneButton(scene as never, 0, 0, "已装备", activate, { disabled: true, style: "equipped" });
    button.emit("pointerdown", touch()); button.emit("pointerup", touch());
    expect(activate).not.toHaveBeenCalled();
    expect((button as unknown as FakeObject).interactive).toBe(false);
    const active = addSceneButton(scene as never, 0, 0, "开始游戏", activate, { width: 172, height: 48 });
    expect((active as unknown as FakeObject).hitArea).toMatchObject({ x: 0, y: 0, width: 172, height: 48 });
  });

  it.each(["touchcancel", "pointercancel"])("keeps generated artwork proportional and restores it after %s", event => {
    const scene = makeScene(), activate = vi.fn(), pointer = touch();
    const button = addSceneButton(scene as never, 0, 0, "再跑一次", activate, {
      width: 110, height: 32, art: { key: "generated-controls", frame: "retry", width: 750, height: 190 },
    });
    const background = button.list[0] as unknown as FakeObject;
    expect(background.displayWidth / background.displayHeight).toBeCloseTo(750 / 190);
    expect(background.displayWidth).toBeLessThanOrEqual(110);
    expect(background.displayHeight).toBeLessThanOrEqual(32);
    expect(scene.add.nineslice).not.toHaveBeenCalled();
    button.emit("pointerdown", pointer);
    expect(background.tint).toBe(0xf3d29a);
    expect((button as unknown as FakeObject).data.get("pressed")).toBe(true);
    scene.game.canvas.dispatchEvent(new Event(event));
    button.emit("pointerup", pointer);
    expect(background).toMatchObject({ textureKey: "generated-controls", textureFrame: "retry", tint: 0xffffff, y: 0 });
    expect((button as unknown as FakeObject).data.get("pressed")).toBe(false);
    expect(activate).not.toHaveBeenCalled();
  });

  it("dims and disables a generated button without binding a touch target", () => {
    const scene = makeScene(), activate = vi.fn();
    const button = addSceneButton(scene as never, 0, 0, "再跑一次", activate, {
      disabled: true, art: { key: "generated-retry", width: 750, height: 190 },
    });
    expect((button.list[0] as unknown as FakeObject).tint).toBe(0xa79b84);
    expect((button as unknown as FakeObject).interactive).toBe(false);
    button.emit("pointerdown", touch()); button.emit("pointerup", touch());
    expect(activate).not.toHaveBeenCalled();
  });
});
