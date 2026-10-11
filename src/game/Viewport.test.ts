import { describe, expect, it, vi } from "vitest";
import { adaptiveViewportSize, runViewportOrigin, runViewportRight, viewportOffsetX, viewportOffsetY, viewportSizeFromScale, watchCanvasRounding } from "./Viewport";
import { PLAYER, WORLD } from "./Constants";

describe("adaptive viewport dimensions", () => {
  it.each([
    [480, 270, 480, 270], [1920, 1080, 480, 270], [1672, 941, 480, 270],
    [896, 414, 584, 270], [800, 600, 480, 360],
    [100000, 1, 960, 270], [1, 100000, 480, 540],
    [Number.MAX_VALUE, Number.MIN_VALUE, 960, 270],
    [Number.MIN_VALUE, Number.MAX_VALUE, 480, 540],
  ])("fits %sx%s within the logical bounds", (w, h, width, height) => {
    expect(adaptiveViewportSize(w, h)).toEqual({ width, height });
  });

  it.each([[0, 0], [-1, 270], [480, -1], [NaN, 270], [480, Infinity], [Infinity, 270]])(
    "uses the baseline for invalid parent %sx%s", (w, h) => {
      expect(adaptiveViewportSize(w, h)).toEqual({ width: 480, height: 270 });
    },
  );

  it("validates and bounds the scale dimensions as well", () => {
    expect(viewportSizeFromScale()).toEqual({ width: 480, height: 270 });
    expect(viewportSizeFromScale({ gameSize: { width: -1, height: 360 } })).toEqual({ width: 480, height: 270 });
    expect(viewportSizeFromScale({ gameSize: { width: 10000, height: 10000 } })).toEqual({ width: 960, height: 540 });
    expect(viewportSizeFromScale({ gameSize: { width: 584, height: 270 } })).toEqual({ width: 584, height: 270 });
  });

  it("centers panels and expands the camera without changing physical reaction distance", () => {
    const wide = adaptiveViewportSize(896, 414);
    expect(viewportOffsetX(wide)).toBe(52);
    expect(runViewportOrigin(wide)).toEqual({ x: 104, y: 0 });
    expect(PLAYER.x).toBe(80);
    expect(runViewportRight(wide) + 18 + runViewportOrigin(wide).x).toBe(wide.width + 18);
    expect(runViewportRight(wide) - PLAYER.x).toBe(WORLD.width - PLAYER.x);
    const narrow = adaptiveViewportSize(800, 600);
    expect(viewportOffsetY(narrow)).toBe(45);
    expect(runViewportOrigin(narrow)).toEqual({ x: 0, y: 45 });
    expect(WORLD.groundY + runViewportOrigin(narrow).y).toBe(263);
    expect(WORLD).toEqual({ width: 480, height: 270, groundY: 218 });
  });
});

describe("FIT raster rounding coverage", () => {
  it.each([
    [1672, 941, 1672, 940.5, 480, 270, 941 / 940.5],
    [896, 414, 584 * (414 / 270), 414, 584, 270, 896 / (584 * (414 / 270))],
    [800, 600, 800, 600, 480, 360, 1],
    [960, 540, 960, 540, 480, 270, 1],
    [2000, 270, 960, 270, 960, 270, 1],
  ])("uniformly corrects %ix%i rounding without covering clamped aspect ratios", (pw, ph, width, height, logicalWidth, logicalHeight, factor) => {
    const parent = { clientWidth: pw, clientHeight: ph };
    const canvas = { width: logicalWidth, height: logicalHeight, style: { width: `${width}px`, height: `${height}px`, transform: "", marginLeft: "-1px", marginTop: "-1px" } };
    const resize = new Map<string, () => void>();
    let destroy: (() => void) | undefined;
    const scale = {
      gameSize: { width: logicalWidth, height: logicalHeight },
      baseSize: { width: logicalWidth, height: logicalHeight },
      canvasBounds: { width: width * factor, height: height * factor },
      on: vi.fn((event: string, listener: () => void) => resize.set(event, listener)),
      off: vi.fn((event: string) => resize.delete(event)),
      updateBounds: vi.fn(), displayScale: { set: vi.fn() },
    };
    watchCanvasRounding({ canvas, scale, events: { once: (_event: string, callback: () => void) => { destroy = callback; } } } as never, parent as HTMLElement);
    const ratio = Math.min(pw / logicalWidth, ph / logicalHeight) * factor;
    expect(canvas.style.transform).toBe(`translate(-50%, -50%) scale(${ratio})`);
    expect(parseFloat(canvas.style.width) / logicalWidth).toBeCloseTo(parseFloat(canvas.style.height) / logicalHeight, 12);
    expect(canvas.style.marginLeft).toBe("0px");
    expect(canvas.style.marginTop).toBe("0px");
    expect(scale.updateBounds).toHaveBeenCalledOnce();
    expect(scale.displayScale.set).toHaveBeenCalledWith(logicalWidth / (width * factor), logicalHeight / (height * factor));
    resize.get("resize")?.();
    expect(canvas.style.transform).toBe(`translate(-50%, -50%) scale(${ratio})`);
    expect(scale.gameSize).toEqual({ width: logicalWidth, height: logicalHeight });
    destroy?.();
    expect(resize.has("resize")).toBe(false);
  });
});
