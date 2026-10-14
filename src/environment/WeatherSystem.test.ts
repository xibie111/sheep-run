import { describe, expect, it, vi } from "vitest";
import { ENVIRONMENT } from "../game/Constants";
import { WeatherSystem } from "./WeatherSystem";

describe("WeatherSystem schedule", () => {
  it("retains real rain-to-sun conditions for calm static atmosphere without emitters", () => {
    const calm = new WeatherSystem(undefined, true, 2, true);
    calm.setWeather('rain'); expect(calm.update(8300)).toEqual({ weather: 'rain', alpha: 1 });
    calm.setWeather('sunny'); expect(calm.update(8500)).toEqual({ weather: 'sunny', alpha: 0 }); calm.destroy();
  });
  it("starts sunny and chooses a stable weather within each distance segment", () => {
    const weather = new WeatherSystem(undefined, false, 2);
    expect(weather.atDistance(0)).toEqual({ weather: "sunny", alpha: 0 });
    expect(weather.atDistance(ENVIRONMENT.weatherSegmentDistancePx - 1).weather).toBe("sunny");
    expect(weather.atDistance(ENVIRONMENT.weatherSegmentDistancePx).weather).toBe("rain");
    expect(weather.atDistance(ENVIRONMENT.weatherSegmentDistancePx + 300).weather).toBe("rain");
  });

  it("reproduces a seed independently of frame partitioning and uses different sequences for different seeds", () => {
    const direct = new WeatherSystem(undefined, false, 2);
    const partitioned = new WeatherSystem(undefined, false, 2);
    const other = new WeatherSystem(undefined, false, 3);
    const distances = Array.from({ length: 32 }, (_, index) => index * ENVIRONMENT.weatherSegmentDistancePx + 300);
    const trace = distances.map(distance => direct.atDistance(distance));
    expect(trace).toEqual(distances.map(distance => {
      partitioned.update(distance - 100);
      return partitioned.update(distance);
    }));
    expect(trace).not.toEqual(distances.map(distance => other.atDistance(distance)));
    expect(direct.atDistance(distances[1]!)).toEqual(trace[1]);
  });

  it("weights sunny weather most often while allowing rain and wind", () => {
    const counts = { sunny: 0, rain: 0, wind: 0 };
    for (let seed = 1; seed <= 1000; seed++) {
      counts[new WeatherSystem(undefined, false, seed).atDistance(ENVIRONMENT.weatherSegmentDistancePx).weather]++;
    }
    expect(counts.sunny).toBeGreaterThan(counts.rain);
    expect(counts.rain).toBeGreaterThan(counts.wind);
    expect(counts.wind).toBeGreaterThan(80);
    expect(counts.sunny).toBeLessThan(650);
  });

  it("only schedules allowed seasonal weather and suppresses effects for reduced motion", () => {
    const weather = new WeatherSystem(undefined, false, 2);
    for (let segment = 0; segment < 50; segment++) {
      expect(["sunny", "wind"]).toContain(weather.atDistance(segment * ENVIRONMENT.weatherSegmentDistancePx, ["sunny", "wind"]).weather);
    }
    expect(weather.atDistance(8000, [])).toEqual({ weather: "sunny", alpha: 0 });
    const reduced = new WeatherSystem(undefined, true, 2);
    reduced.setWeather("rain");
    expect(reduced.update(8300)).toEqual({ weather: "sunny", alpha: 0 });
  });

  it("does not consume global gameplay randomness to seed or schedule weather", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("gameplay random consumed"); });
    try {
      const weather = new WeatherSystem();
      weather.update(8300);
      weather.update(16300);
      expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });

  it("honors explicit weather and selects an allowed fallback independently of theme", () => {
    const weather = new WeatherSystem(undefined, false, 2);
    weather.setWeather("wind");
    expect(weather.atDistance(0).weather).toBe("wind");
    expect(weather.atDistance(0, ["sunny", "rain"]).weather).toBe("sunny");
    weather.setWeather(null);
    expect(weather.atDistance(ENVIRONMENT.weatherSegmentDistancePx).weather).toBe("rain");
  });

  it("fades cosmetic weather in and out over the configured visual distance", () => {
    const weather = new WeatherSystem(undefined, false, 2);
    expect(weather.atDistance(ENVIRONMENT.weatherSegmentDistancePx + ENVIRONMENT.weatherFadeDistancePx / 2).alpha).toBe(0.5);
    expect(weather.atDistance(ENVIRONMENT.weatherSegmentDistancePx + ENVIRONMENT.weatherFadeDistancePx).alpha).toBe(1);
    expect(weather.atDistance(ENVIRONMENT.weatherSegmentDistancePx * 2 - ENVIRONMENT.weatherFadeDistancePx / 2).alpha).toBe(0.5);
    expect(weather.atDistance(ENVIRONMENT.weatherSegmentDistancePx * 2).alpha).toBe(0);
  });
});

describe("WeatherSystem renderer", () => {
  it("creates capped cosmetic emitters without accessing Arcade physics", () => {
    const added: Array<{ key: string; config: Record<string, unknown>; start: number; stop: number; alpha: number; destroyed: boolean }> = [];
    const scene = {
      scale: { gameSize: { width: 480, height: 270 }, on() {}, off() {} },
      events: { once() {}, off() {} },
      add: {
        particles: (_x: number, _y: number, key: string, config: Record<string, unknown>) => {
          const emitter = { key, config: { ...config }, start: 0, stop: 0, alpha: 0, destroyed: false };
          added.push(emitter);
          return {
            setDepth() { return this; },
            setScrollFactor() { return this; },
            updateConfig(config: object) { Object.assign(emitter.config, config); return this; },
            setAlpha(value: number) { emitter.alpha = value; return this; },
            start() { emitter.start += 1; },
            stop() { emitter.stop += 1; },
            destroy() { emitter.destroyed = true; },
          };
        },
      },
      physics: { add: { existing: () => { throw new Error("weather must not add physics bodies"); } } },
    };
    const weather = new WeatherSystem(scene as never, false, 2);

    weather.update(ENVIRONMENT.weatherSegmentDistancePx + ENVIRONMENT.weatherFadeDistancePx / 2);

    expect(added).toHaveLength(2);
    expect(added[0]?.config).toMatchObject({ maxAliveParticles: ENVIRONMENT.maxRainParticles, reserve: 0,
      blendMode: 'ADD', alpha: {start:.9,end:.35}, speedY: {min:300,max:390} });
    expect(added[0]?.config.frequency as number).toBeLessThan(55);
    expect((added[0]?.config.lifespan as number)*.3).toBeGreaterThanOrEqual(270);
    expect(added[1]?.config).toMatchObject({ maxAliveParticles: ENVIRONMENT.maxWindParticles, reserve: 0 });
    expect(added[0]?.start).toBe(1);
    expect(added[0]?.alpha).toBe(0.5);
    weather.destroy();
    expect(added.every((emitter) => emitter.destroyed)).toBe(true);
  });

  it('uses only small static drops without a dark screen rectangle for reduced-motion calm rain', () => {
    const rectangles: number[][] = [];
    const art = { setDepth(){return this;},setScrollFactor(){return this;},setName(){return this;},
      clear(){rectangles.length=0;return this;},fillStyle(){return this;},
      fillRect(x:number,y:number,w:number,h:number){rectangles.push([x,y,w,h]);return this;},destroy:vi.fn() };
    const particles=vi.fn();
    const scene={scale:{gameSize:{width:584,height:360},on(){},off(){}},events:{once(){},off(){}},
      add:{graphics:()=>art,particles}};
    const weather=new WeatherSystem(scene as never,true,2,true);
    weather.setWeather('rain');weather.update(9500);
    expect(particles).not.toHaveBeenCalled();expect(rectangles).toHaveLength(32);
    expect(rectangles.every(([, , w,h])=>w===1&&h===4)).toBe(true);
    weather.setWeather('sunny');weather.update(9500);expect(rectangles).toHaveLength(0);
    weather.destroy();weather.destroy();expect(art.destroy).toHaveBeenCalledOnce();
  });

  it("emits real bounded particles across repeated rain and wind segments", async () => {
    let Phaser: typeof import("phaser");
    class FakeCanvas {
      width = 1;
      height = 1;
      getContext() {
        return {
          fillStyle: "",
          fillRect: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(4) }),
          putImageData: () => {},
        };
      }
    }
    class FakeImage {
      onload: (() => void) | null = null;
      set src(_value: string) {}
    }
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      documentElement: {},
      createElement: (tag: string) => tag === "canvas" ? new FakeCanvas() : { canPlayType: () => "" },
    });
    vi.stubGlobal("navigator", { userAgent: "node", appVersion: "", maxTouchPoints: 0 });
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("HTMLCanvasElement", FakeCanvas);
    try {
      Phaser = (await import("phaser") as unknown as { default: typeof import("phaser") }).default;
    } finally {
      vi.unstubAllGlobals();
    }

    const frame = { cutWidth: 4, cutHeight: 8, texture: null as unknown };
    const texture = { get: vi.fn(() => frame) };
    frame.texture = texture;
    type Emitter = InstanceType<typeof Phaser.GameObjects.Particles.ParticleEmitter>;
    const emitters: Emitter[] = [];
    const viewportListeners = new Map<string, () => void>();
    const scene: Record<string, unknown> = {
      scale: { gameSize: { width: 480, height: 270 },
        on(event: string, callback: () => void) { viewportListeners.set(event, callback); },
        off(event: string) { viewportListeners.delete(event); } },
      events: { once() {}, off() {} },
      sys: {
        queueDepthSort: vi.fn(),
        renderer: null,
        updateList: { add: vi.fn(), remove: vi.fn() },
        textures: { get: vi.fn(() => texture) },
      },
    };
    scene.add = {
      particles: (x: number, y: number, key: string, config: object) => {
        const emitter = new Phaser.GameObjects.Particles.ParticleEmitter(scene as never, x, y, key, config as never);
        emitters.push(emitter);
        return emitter;
      },
    };

    const weather = new WeatherSystem(scene as never);
    const [rain, wind] = emitters;
    expect(rain?.maxAliveParticles).toBe(ENVIRONMENT.maxRainParticles);
    expect(wind?.maxAliveParticles).toBe(ENVIRONMENT.maxWindParticles);
    let rainEmits = 0;
    let windEmits = 0;
    rain?.onParticleEmit(() => { rainEmits += 1; });
    wind?.onParticleEmit(() => { windEmits += 1; });
    let time = 0;
    const advance = (durationMs: number): void => {
      for (let index = 0; index < Math.ceil(durationMs / 16); index += 1) {
        time += 16;
        for (const emitter of emitters) {
          emitter.preUpdate(time, 16);
          expect(emitter.getAliveParticleCount()).toBeLessThanOrEqual(emitter.maxAliveParticles);
          expect(emitter.getParticleCount()).toBeLessThanOrEqual(emitter.maxAliveParticles);
        }
      }
    };

    for (const [expected, durationMs] of [
      ["rain", 1664], ["wind", 2688], ["sunny", 512],
      ["rain", 1664], ["wind", 2688], ["sunny", 512],
    ] as const) {
      weather.setWeather(expected);
      weather.update(8300);
      for (let resize = 0; resize < 8; resize++) {
        viewportListeners.get("resize")?.();
        expect(rain?.emitting).toBe(expected === "rain");
        expect(wind?.emitting).toBe(expected === "wind");
        expect(rain?.getParticleCount()).toBeLessThanOrEqual(ENVIRONMENT.maxRainParticles);
        expect(wind?.getParticleCount()).toBeLessThanOrEqual(ENVIRONMENT.maxWindParticles);
      }
      const beforeRain = rainEmits;
      const beforeWind = windEmits;
      advance(durationMs);
      if (expected === "rain") {
        expect(rainEmits).toBeGreaterThan(beforeRain);
        expect(windEmits).toBe(beforeWind);
      } else if (expected === "wind") {
        expect(windEmits).toBeGreaterThan(beforeWind);
        expect(rainEmits).toBe(beforeRain);
      } else {
        expect(rainEmits).toBe(beforeRain);
        expect(windEmits).toBe(beforeWind);
      }
    }
    expect(rainEmits).toBeGreaterThan(ENVIRONMENT.maxRainParticles);
    expect(windEmits).toBeGreaterThan(ENVIRONMENT.maxWindParticles);
    weather.destroy();
  });
});
