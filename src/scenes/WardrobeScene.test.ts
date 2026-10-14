import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: { Scene: class {} } }));
vi.mock("../data/skinSpriteAssets", async () => {
  const { SHEEP_SKINS } = await import("../data/sheepSkins");
  return { SKIN_NAMES: Object.fromEntries(SHEEP_SKINS.map(skin => [skin.id, skin.label])) };
});
vi.mock("../ui/PixelText", () => ({ addPixelText: (scene: ReturnType<typeof makeScene>, x: number, y: number, text: string) => scene.add.bitmapText(x, y, text) }));
vi.mock("../ui/PastureUi", () => ({
  addPastureBackdrop: vi.fn(),
  addCurrencyBadge: (scene: ReturnType<typeof makeScene>, x: number, y: number, amount: number) => scene.add.bitmapText(x, y, String(amount)),
  addWoodTitle: vi.fn(),
  addUiPanel: (scene: ReturnType<typeof makeScene>, x: number, y: number) => scene.add.rectangle(x, y),
}));
vi.mock("../ui/SceneButton", () => ({ addSceneButton: (scene: ReturnType<typeof makeScene>, x: number, y: number, label: string, activate: () => void, options: { disabled?: boolean }) => {
  const button = scene.add.container(x, y, [scene.add.bitmapText(0, 0, label)]).setName("button:" + label);
  button.disabled = options.disabled === true;
  button.activate = activate;
  return button;
} }));
vi.mock("../ui/TouchTarget", () => ({ bindTouchTarget: (_scene: unknown, target: FakeObject, _width: number, _height: number, activate: () => void) => { target.activate = activate; } }));
vi.mock("../ui/UiLayout", () => ({ safeUiInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) }));
vi.mock("../game/Viewport", () => ({ watchViewport: vi.fn(), viewportSizeFromScale: () => ({ width: 480, height: 270 }) }));

import { SHEEP_SKINS, type SkinId } from "../data/sheepSkins";
import { STORAGE } from "../game/Constants";
import { SaveSystem, type SaveData } from "../systems/SaveSystem";
import { WardrobeScene } from "./WardrobeScene";

class FakeObject {
  name = ""; text = ""; data = new Map<string, unknown>(); disabled = false; destroyed = false;
  activate?: () => void;
  constructor(readonly scene: { children: { list: FakeObject[] } }, readonly list: FakeObject[] = []) {}
  setText(text: string) { this.text = text; return this; }
  setName(name: string) { this.name = name; return this; }
  setData(key: string, value: unknown) { this.data.set(key, value); return this; }
  setDepth() { return this; } setPosition() { return this; } setScale() { return this; }
  setDisplaySize() { return this; } setTint() { return this; }
  add(object: FakeObject) { this.list.push(object); this.removeFromScene(object); return this; }
  removeFromScene(object: FakeObject) { const index = this.scene.children.list.indexOf(object); if (index >= 0) this.scene.children.list.splice(index, 1); }
  destroy(recursive = false) { this.destroyed = true; this.removeFromScene(this); if (recursive) this.list.forEach(child => child.destroy(true)); }
}

function makeScene() {
  const scene = new WardrobeScene() as unknown as {
    create(): void;
    children: { list: FakeObject[] };
    add: { image: (...args: unknown[]) => FakeObject; rectangle: (...args: unknown[]) => FakeObject; bitmapText: (x: number, y: number, text: string) => FakeObject; container: (x: number, y: number, list: FakeObject[]) => FakeObject };
  };
  const children = { list: [] as FakeObject[] };
  const addObject = (list: FakeObject[] = []) => {
    const object = new FakeObject({ children }, list);
    list.forEach(child => object.removeFromScene(child));
    children.list.push(object);
    return object;
  };
  Object.assign(scene, {
    children, scale: {}, scene: { start: vi.fn() },
    add: { image: () => addObject(), rectangle: () => addObject(),
      bitmapText: (_x: number, _y: number, text: string) => addObject().setText(text),
      container: (_x: number, _y: number, list: FakeObject[]) => addObject(list),
    },
  });
  return scene;
}

function flattened(scene: ReturnType<typeof makeScene>): FakeObject[] {
  const visit = (object: FakeObject): FakeObject[] => object.destroyed ? [] : [object, ...object.list.flatMap(visit)];
  return scene.children.list.flatMap(visit);
}
function named(scene: ReturnType<typeof makeScene>, name: string) {
  const object = flattened(scene).find(entry => entry.name === name);
  if (!object) throw new Error(`Missing ${name}`);
  return object;
}
const content = (scene: ReturnType<typeof makeScene>) => flattened(scene).filter(object => object.text).map(object => object.text);
function select(scene: ReturnType<typeof makeScene>, id: SkinId) {
  const internals = scene as unknown as { selectedId: SkinId; refresh(): void };
  internals.selectedId = id;
  internals.refresh();
}
function install(overrides: Partial<SaveData> = {}, failure = false) {
  const save: SaveData = {
    version: 5, highScore: 88, totalStars: 0, spentStars: 0, coins: 0,
    unlockedSkins: ["white"], selectedSkin: "white", upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 },
    settings: { music: true, sfx: true, musicVolume: 1, sfxVolume: 1 }, ...overrides,
  };
  const values = new Map<string, string>([[STORAGE.saveKey, JSON.stringify(save)]]);
  const setItem = vi.fn((key: string, value: string) => { if (failure) throw new Error("Disk full"); values.set(key, value); });
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem } });
  const scene = makeScene(); scene.create();
  return { scene, values, setItem };
}

describe("WardrobeScene real purchase integration", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("displays spendable balance separately from cumulative unlock requirements", () => {
    const { scene } = install({ totalStars: 70, spentStars: 70 });
    expect(named(scene, "wardrobe-available-stars").text).toBe("0");
    expect(content(scene)).not.toContain("可用星星");
    expect(content(scene)).not.toContain("金币");
    select(scene, "black");
    expect(named(scene, "button:解锁").disabled).toBe(false);
    expect(content(scene)).toContain("累计星数达标解锁：10星星，不扣星星");
    select(scene, "strawberry-v1");
    expect(named(scene, "button:星星不足").disabled).toBe(true);
  });

  it.each(SHEEP_SKINS.filter(skin => skin.unlock.type === "star-purchase"))("buys $id once, retains the old equipped skin, then equips at zero balance", skin => {
    const { scene, setItem } = install({ totalStars: skin.unlock.amount });
    select(scene, skin.id);
    const buy = named(scene, "button:购买");
    expect(buy.disabled).toBe(false);
    buy.activate!(); buy.activate!();
    expect(SaveSystem.load()).toMatchObject({ spentStars: skin.unlock.amount, selectedSkin: "white", unlockedSkins: ["white", skin.id] });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(named(scene, "wardrobe-available-stars").text).toBe("0");
    const equip = named(scene, "button:装备");
    expect(equip.disabled).toBe(false);
    equip.activate!();
    expect(SaveSystem.load().selectedSkin).toBe(skin.id);
    expect(named(scene, "button:已装备").disabled).toBe(true);
    const reentered = makeScene(); reentered.create();
    expect(named(reentered, `skin-card:${skin.id}`).data.get("state")).toBe("equipped");
  });

  it("leaves ownership and money unchanged and keeps a clear pixel-font failure message", () => {
    const { scene, values } = install({ totalStars: 40 }, true);
    const before = values.get(STORAGE.saveKey);
    select(scene, "strawberry-v1"); named(scene, "button:购买").activate!();
    expect(values.get(STORAGE.saveKey)).toBe(before);
    expect(content(scene)).toContain("保存失败，请重试");
    expect(named(scene, "button:购买").disabled).toBe(false);
    expect(SaveSystem.load().unlockedSkins).toEqual(["white"]);
  });

  it("retains coin purchases and cumulative star unlocks without automatically equipping", () => {
    const { scene } = install({ totalStars: 30, spentStars: 30, coins: 60 });
    select(scene, "postman-v1"); named(scene, "button:购买").activate!();
    expect(SaveSystem.load()).toMatchObject({ coins: 0, spentStars: 30, selectedSkin: "white" });
    select(scene, "brown"); named(scene, "button:解锁").activate!();
    expect(SaveSystem.load()).toMatchObject({ totalStars: 30, spentStars: 30, coins: 0, unlockedSkins: ["white", "postman-v1", "brown"] });
  });

  it("appends all eight cards to automatically counted pages and clears old selected card objects", () => {
    const { scene } = install();
    for (const skin of SHEEP_SKINS.slice(-8)) {
      select(scene, skin.id);
      expect(named(scene, `skin-card:${skin.id}`).data.get("selected")).toBe(true);
      expect(flattened(scene).filter(object => object.name.startsWith("skin-card:")).length).toBeLessThanOrEqual(5);
      expect(content(scene)).toContain(`${Math.floor(SHEEP_SKINS.indexOf(skin) / 5) + 1} / ${Math.ceil(SHEEP_SKINS.length / 5)}`);
    }
  });
});
