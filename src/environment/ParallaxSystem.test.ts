import { describe, expect, it, vi } from "vitest";
import { WORLD, ENVIRONMENT } from "../game/Constants";
import { ParallaxSystem } from "./ParallaxSystem";
import { ThemeSystem } from "./ThemeSystem";

describe('rain keeps the authored background colours', () => {
  it('removes night tint only during rain and restores it after rain without moving scenery', () => {
    const parallax = new ParallaxSystem();
    parallax.update(9500);
    const night = parallax.snapshot(), presentation = parallax.presentation();
    expect(presentation.dayPhase).toBe('night');
    expect(presentation.landTint).not.toBe(0xffffff);
    parallax.update(9500, 1);
    expect(parallax.snapshot().every(layer => layer.tint === 0xffffff)).toBe(true);
    expect(parallax.snapshot().map(layer => layer.x)).toEqual(night.map(layer => layer.x));
    expect(parallax.presentation().landTint).toBe(0xffffff);
    expect(parallax.presentation().dayPhase).toBe('night');
    parallax.update(9500, .5);
    expect(parallax.presentation().landTint).toBeGreaterThan(presentation.landTint);
    expect(parallax.presentation().landTint).toBeLessThan(0xffffff);
    parallax.update(9500, 0);
    expect(parallax.snapshot()).toEqual(night);
  });

  it('retains rain brightness through viewport layout while keeping camera and ground phase', () => {
    const h = createViewportHarness(480,270), parallax = new ParallaxSystem(h.scene as never);
    parallax.update(9500, 1);
    h.resize(584,270);
    expect(parallax.snapshot().every(layer=>layer.tint===0xffffff)).toBe(true);
    expect(h.sprites.get('pasture-ground')!.tilePositionX).toBe(9500%480-104);
    parallax.destroy();
  });
});

function createViewportHarness(width: number, height: number) {
  const sprites = new Map<string, {
    x: number; y: number; width: number; height: number; tilePositionX: number;
    scaleX: number; scaleY: number; tileScaleX: number; tileScaleY: number;
    frame: string;
    texture: string;
    destroyed: boolean;
  }>();
  const listeners = new Map<string, () => void>();
  const scene = {
    scale: {
      gameSize: { width, height },
      on: vi.fn((event: string, callback: () => void) => listeners.set(event, callback)),
      off: vi.fn((event: string) => listeners.delete(event)),
    },
    events: { once: vi.fn(), off: vi.fn() },
    add: {
      tileSprite(x: number, y: number, width: number, height: number, key: string, frame?: string) {
        const sprite = {
          x, y, width, height, tilePositionX: 0,
          // Phaser defaults to the first named frame once UI registers a subframe.
          frame: frame ?? (key === "pasture-cloud" ? "ui-cloud" : "__BASE"),
          texture: key,
          scaleX: 1, scaleY: 1, tileScaleX: 1, tileScaleY: 1, destroyed: false,
          setOrigin() { return this; },
          setDepth() { return this; },
          setTint() { return this; },
          setScrollFactor() { return this; },
          setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
          setSize(width: number, height: number) { this.width = width; this.height = height; return this; },
          setTexture(key: string, frame: string) { this.texture = key; this.frame = frame; return this; },
          destroy() { this.destroyed = true; },
        };
        sprites.set(key, sprite);
        return sprite;
      },
    },
  };
  return {
    scene,
    sprites,
    resize(width: number, height: number) {
      scene.scale.gameSize = { width, height };
      listeners.get("resize")?.();
    },
  };
}

describe("ParallaxSystem", () => {
  it("keeps calm scenery still while showing the actual day palette, including after resize", () => {
    const { scene, resize } = createViewportHarness(584, 270);
    const quiet = new ParallaxSystem(scene as never, { reducedMotion: true, calmAtmosphere: true });
    quiet.update(10_000);
    expect(quiet.presentation()).toMatchObject({ dayPhase: 'night', nearOffset: 0, nearRatio: 0 });
    const tint = quiet.presentation().landTint; resize(480, 360);
    expect(quiet.presentation()).toMatchObject({ dayPhase: 'night', nearOffset: 0, landTint: tint });
    expect(quiet.snapshot().every(layer => layer.x === 0)).toBe(true); quiet.destroy();
  });
  it("exposes the exact rendered landmark phase and tint through tile wrapping and reduced motion", () => {
    const themes = new ThemeSystem(); themes.setScore(3000);
    const { scene, sprites } = createViewportHarness(584, 270);
    Object.assign(scene, { textures: { exists: () => true } });
    const parallax = new ParallaxSystem(scene as never, { themes });
    Object.assign(sprites.get('pasture-treeline')!, { frame: { cutWidth: 1133 } });
    parallax.update(10_000);
    const p = parallax.presentation();
    expect(p).toMatchObject({ theme: 'autumn', dayPhase: 'night', nearOffset: 2400, nearRepeatWidth: 1133, nearRatio: .24 });
    expect(p.nearOffset % p.nearRepeatWidth - 104).toBe(sprites.get('pasture-treeline')!.tilePositionX);
    expect(p.landTint).toBe(themes.visualAtDistance(10_000, false, true).landTint);
    parallax.destroy();
    const quiet = new ParallaxSystem(undefined, { themes, reducedMotion: true }); quiet.update(10_000);
    expect(quiet.presentation()).toMatchObject({ theme: 'autumn', dayPhase: 'morning', nearOffset: 0, nearRatio: 0 });
    quiet.destroy();
  });
  it("wraps each layer at its authored frame width and preserves phase during resize", () => {
    const { scene, sprites, resize } = createViewportHarness(584, 270);
    const parallax = new ParallaxSystem(scene as never);
    for (const [key, width] of [["pasture-far-mountain", 1345], ["pasture-treeline", 1133], ["pasture-ground", 1133]] as const) {
      Object.assign(sprites.get(key)!, { frame: { cutWidth: width } });
    }
    parallax.update(1134);
    expect(sprites.get("pasture-ground")!.tilePositionX).toBe(1 - 104);
    const before = parallax.snapshot();
    expect(before.find(layer => layer.key === "pasture-far-mountain")?.repeatWidth).toBe(1345);
    resize(480, 360);
    expect(sprites.get("pasture-ground")!.tilePositionX).toBe(1);
    expect(parallax.snapshot()).toEqual(before);
    parallax.destroy();
  });
  it("changes authored texture bands at a score boundary without jumping their scroll phase", () => {
    const { scene, sprites } = createViewportHarness(584, 270);
    Object.assign(scene, { textures: { exists: () => true } });
    const themes = new ThemeSystem();
    themes.setScore(1499);
    const parallax = new ParallaxSystem(scene as never, { themes });
    parallax.update(400);
    const phase = sprites.get("pasture-ground")!.tilePositionX;
    expect(sprites.get("pasture-ground")!.texture).toBe("season-spring-road");
    themes.setScore(1500);
    parallax.update(400);
    expect(sprites.get("pasture-ground")).toMatchObject({ texture: "season-summer-road", tilePositionX: phase, width: 584, height: 270, scaleX: 1, scaleY: 1 });
    expect(sprites.get("pasture-treeline")!.texture).toBe("season-summer-near");
    expect(sprites.get("pasture-far-mountain")!.texture).toBe("season-summer-far");
    expect(sprites.get("pasture-sky-fill")!.texture).toBe("season-summer-sky-fill");
    parallax.destroy();
  });

  it("scrolls the extended soil at the road's phase during resize and seasonal texture changes", () => {
    const { scene, sprites, resize } = createViewportHarness(480, 360);
    Object.assign(scene, { textures: { exists: () => true } });
    const themes = new ThemeSystem(); themes.setScore(0);
    const parallax = new ParallaxSystem(scene as never, { themes });
    const ground = sprites.get("pasture-ground")!, soil = sprites.get("pasture-soil-fill")!;
    for (const sprite of [ground, soil]) Object.assign(sprite, { frame: { cutWidth: 1134 } });
    parallax.update(3900);
    expect(soil.tilePositionX).toBe(ground.tilePositionX);
    resize(584, 270);
    expect(soil.tilePositionX).toBe(ground.tilePositionX);
    themes.setScore(4500); parallax.update(3900);
    expect(soil.texture).toBe("season-winter-soil-fill");
    expect(soil.tilePositionX).toBe(ground.tilePositionX);
    parallax.destroy();
  });

  it("positions layers from absolute distance with integer pixel coordinates", () => {
    const direct = new ParallaxSystem();
    const partitioned = new ParallaxSystem();
    direct.update(1500);
    partitioned.update(700);
    partitioned.update(1500);

    expect(direct.snapshot().map((layer) => layer.x)).toEqual(
      Object.values(ENVIRONMENT.parallaxRatios).map((ratio) => Math.round(1500 * ratio) % WORLD.width),
    );
    expect(partitioned.snapshot()).toEqual(direct.snapshot());
  });

  it("does not own or mutate world speed or physics and freezes when motion is reduced", () => {
    const parallax = new ParallaxSystem(undefined, { reducedMotion: true });
    const world = { speed: 190, physics: { gravity: 1450 } };
    parallax.update(90000);
    expect(parallax.snapshot().map((layer) => layer.x)).toEqual(Object.values(ENVIRONMENT.parallaxRatios).map(() => 0));
    expect(world).toEqual({ speed: 190, physics: { gravity: 1450 } });
    expect(WORLD.groundY).toBe(218);
  });

  it("renders cached layers without constructing physics bodies", () => {
    const keys: string[] = [];
    const scene = {
      scale: { gameSize: { width: 480, height: 270 }, on() {}, off() {} },
      events: { once() {}, off() {} },
      add: { tileSprite: (_x: number, _y: number, _width: number, _height: number, key: string) => {
        keys.push(key);
        const target = { tilePositionX: 0 };
        return {
          get tilePositionX() { return target.tilePositionX; },
          set tilePositionX(value: number) { target.tilePositionX = value; },
          setOrigin() { return this; },
          setDepth() { return this; },
          setTint() { return this; },
          setScrollFactor() { return this; },
          setPosition() { return this; },
          setSize() { return this; },
          destroy() {},
        };
      } },
      physics: { add: { existing: () => { throw new Error("parallax must not add physics bodies"); } } },
    };
    const parallax = new ParallaxSystem(scene as never);
    parallax.update(960);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    parallax.destroy();
  });

  it.each([[584, 270, 0], [480, 360, 45]])("fills %ix%i while keeping a single horizon at offset %i", (width, height, top) => {
    const sprites = new Map<string, { x: number; y: number; width: number; height: number; tilePositionX: number }>();
    const scene = {
      scale: { gameSize: { width, height }, on() {}, off() {} },
      events: { once() {}, off() {} },
      add: { tileSprite: (x: number, y: number, width: number, height: number, key: string) => {
        const sprite = {
          x, y, width, height, tilePositionX: 0,
          setOrigin() { return this; }, setDepth() { return this; }, setTint() { return this; }, setScrollFactor() { return this; },
          setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
          setSize(width: number, height: number) { this.width = width; this.height = height; return this; }, destroy() {},
        };
        sprites.set(key, sprite);
        return sprite;
      } },
    };
    const parallax = new ParallaxSystem(scene as never);
    expect(sprites.get("pasture-ground")).toMatchObject({ width, height: 270, y: top + 135 });
    expect(sprites.get("pasture-sky-fill")).toMatchObject({ width, height });
    expect(sprites.get("pasture-soil-fill")).toMatchObject({ width, y: top + 270 });
    expect(sprites.get("pasture-ground")!.tilePositionX).toBe(WORLD.width - width);
    parallax.destroy();
  });

  it("covers the full wide view without stretching pixels and offsets the texture phase with the camera", () => {
    const { scene, sprites } = createViewportHarness(584, 270);
    const parallax = new ParallaxSystem(scene as never);
    parallax.update(960);

    for (const layer of parallax.snapshot()) {
      expect(sprites.get(layer.key)).toMatchObject({
        x: 292, y: 135, width: 584, height: 270,
        tilePositionX: layer.x - 104,
        scaleX: 1, scaleY: 1, tileScaleX: 1, tileScaleY: 1,
      });
    }
    parallax.destroy();
  });

  it("always tiles complete authored layers after the menu registers a cloud subframe", () => {
    const { scene, sprites, resize } = createViewportHarness(584, 270);
    const parallax = new ParallaxSystem(scene as never);

    expect(sprites.get("pasture-cloud")?.frame).toBe("__BASE");
    for (const layer of parallax.snapshot()) expect(sprites.get(layer.key)?.frame).toBe("__BASE");
    resize(480, 360);
    parallax.update(1500);
    expect(sprites.get("pasture-cloud")?.frame).toBe("__BASE");
    parallax.destroy();
  });

  it("fills taller views with sky and soil while preserving the single landscape and its ground alignment", () => {
    const { scene, sprites, resize } = createViewportHarness(480, 270);
    const parallax = new ParallaxSystem(scene as never);
    parallax.update(1500);
    const before = parallax.snapshot();

    resize(480, 360);

    for (const layer of before) {
      expect(sprites.get(layer.key)).toMatchObject({ x: 240, y: 180, width: 480, height: 270, tilePositionX: layer.x });
    }
    expect(sprites.get("pasture-sky-fill")).toMatchObject({ x: 0, y: 0, width: 480, height: 360 });
    expect(sprites.get("pasture-soil-fill")).toMatchObject({ x: 0, y: 315, width: 480, height: 45 });
    expect(parallax.snapshot()).toEqual(before);

    resize(960, 270);
    expect(sprites.get("pasture-ground")).toMatchObject({ x: 480, y: 135, width: 960, height: 270 });
    expect(sprites.get("pasture-soil-fill")).toMatchObject({ y: 270, width: 960, height: 1 });
    for (const layer of before) {
      expect(sprites.get(layer.key)).toMatchObject({
        tilePositionX: layer.x - 480,
        scaleX: 1, scaleY: 1, tileScaleX: 1, tileScaleY: 1,
      });
    }
    parallax.destroy();
    expect([...sprites.values()].every((sprite) => sprite.destroyed)).toBe(true);
    expect(scene.scale.off).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(scene.events.off).toHaveBeenCalledWith("shutdown", expect.any(Function));
  });
});
