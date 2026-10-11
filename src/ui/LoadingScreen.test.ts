import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingScreen } from "./LoadingScreen";
import { LOADING_TIPS, LOADING_TIP_INTERVAL_MS, loadingTipAt } from "../data/loadingTips";
vi.mock("./LoadingTipArt", () => ({ LoadingTipArt: class { render() {} destroy() {} } }));
vi.mock("./LoadingProgressArt", () => ({ LoadingProgressArt: class { render() {} destroy() {} } }));

function harness() {
  const nodes = new Map<string, any>();
  const drawImage = vi.fn();
  for (const selector of [".loading-caption", ".loading-tip-text", ".loading-progress", ".loading-sheep", ".loading-progress-art", ".loading-retry", ".loading-tips-art", ".loading-tips-copy", ".loading-tips strong"]) {
    const listeners = new Map<string, (event: any) => void>();
    nodes.set(selector, { textContent: "", style: { setProperty: vi.fn() }, hidden: false, listeners, width: 696, height: 88, clientHeight: 0,
      setAttribute: vi.fn(), removeAttribute: vi.fn(), getContext: () => ({ clearRect: vi.fn(), drawImage }),
      addEventListener: (key: string, callback: (event: any) => void) => listeners.set(key, callback),
      removeEventListener: (key: string) => listeners.delete(key),
      getBoundingClientRect: () => ({ left: 10, right: 80, top: 10, bottom: 50 }),
    });
  }
  const root = { hidden: true, dataset: {}, querySelector: (key: string) => nodes.get(key) };
  const screen = new LoadingScreen(root as unknown as HTMLElement);
  const fire = (type: string, patch = {}) => nodes.get(".loading-retry").listeners.get(type)?.({ pointerType: "touch", pointerId: 1, clientX: 40, clientY: 30, preventDefault: vi.fn(), ...patch });
  return { screen, root, nodes, fire, drawImage };
}

describe("loading screen ownership and real progress", () => {
  let frames: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setInterval, clearInterval, matchMedia: () => ({ matches: false }) });
    vi.stubGlobal("document", { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("Image", class { complete = true; naturalWidth = 640; naturalHeight = 114; src = ""; onload = null; });
    frames = vi.fn(() => 42);
    vi.stubGlobal("requestAnimationFrame", frames);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it.each([0, 0.5, 0.999999])("randomizes the entry tip using sample %s", sample => {
    vi.spyOn(Math, "random").mockReturnValue(sample);
    const { screen, nodes, root } = harness();
    screen.show();
    const index = Math.floor(sample * LOADING_TIPS.length);
    expect(nodes.get(".loading-tip-text").textContent).toBe(loadingTipAt(index));
    expect(root.dataset).toMatchObject({ tipIndex: String(index) });
    screen.destroy();
  });
  it("randomizes every switch, skips the current tip and keeps one timer on repeated show", () => {
    const random = vi.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValueOnce(0).mockReturnValue(0.999999);
    const startIndex = Math.floor(0.5 * LOADING_TIPS.length);
    const { screen, nodes, root } = harness();
    screen.show(); screen.setProgress(0.37); screen.show();
    expect(vi.getTimerCount()).toBe(1);
    expect(random).toHaveBeenCalledOnce();
    expect(root.dataset).toMatchObject({ tipIndex: String(startIndex), progress: "31" });
    vi.advanceTimersByTime(LOADING_TIP_INTERVAL_MS - 1);
    expect(nodes.get(".loading-tip-text").textContent).toBe(LOADING_TIPS[startIndex]);
    vi.advanceTimersByTime(1);
    expect(nodes.get(".loading-tip-text").textContent).toBe(LOADING_TIPS[0]);
    vi.advanceTimersByTime(LOADING_TIP_INTERVAL_MS);
    expect(nodes.get(".loading-tip-text").textContent).toBe(LOADING_TIPS.at(-1));
    vi.advanceTimersByTime(LOADING_TIP_INTERVAL_MS);
    expect(nodes.get(".loading-tip-text").textContent).toBe(LOADING_TIPS.at(-2));
    expect(random).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(1);
    screen.destroy();
  });
  it("can choose every other tip without consecutive repetition", () => {
    const random = vi.spyOn(Math, "random");
    const { screen, nodes } = harness();
    for (let previous = 0; previous < LOADING_TIPS.length; previous++) {
      const seen = new Set<string>();
      for (let choice = 0; choice < LOADING_TIPS.length - 1; choice++) {
        random.mockReturnValue((previous + 0.5) / LOADING_TIPS.length);
        screen.show();
        random.mockReturnValue((choice + 0.5) / (LOADING_TIPS.length - 1));
        vi.advanceTimersByTime(LOADING_TIP_INTERVAL_MS);
        const tip = nodes.get(".loading-tip-text").textContent;
        expect(tip).not.toBe(LOADING_TIPS[previous]);
        seen.add(tip);
        screen.hide();
      }
      expect(seen.size).toBe(LOADING_TIPS.length - 1);
    }
    screen.destroy();
  });
  it("selects a new random starting tip after hide and re-entry", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.999999);
    const { screen, nodes } = harness();
    screen.show();
    expect(nodes.get(".loading-tip-text").textContent).toBe(LOADING_TIPS[0]);
    screen.hide();
    expect(vi.getTimerCount()).toBe(0);
    screen.show();
    expect(nodes.get(".loading-tip-text").textContent).toBe(LOADING_TIPS.at(-1));
    expect(vi.getTimerCount()).toBe(1);
    screen.destroy();
  });
  it("stops timers, animation and touch listeners when destroyed", () => {
    const { screen, root, nodes } = harness();
    screen.show();
    screen.destroy();
    expect(root.hidden).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(nodes.get(".loading-retry").listeners.size).toBe(0);
    expect(document.removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
  it("displays loader progress without advancing by elapsed time", () => {
    const { screen, root, nodes } = harness();
    screen.show(); screen.setProgress(0.37);
    vi.advanceTimersByTime(10000);
    expect(nodes.get(".loading-progress").style.setProperty).toHaveBeenLastCalledWith("--loading-progress", "31%");
    expect(root.dataset).toMatchObject({ progress: "31", stage: "assets" });
    screen.setProgress(1);
    expect(nodes.get(".loading-caption").textContent).toBe("加载资源 85%");
    screen.setPreparing(2, 9);
    expect(root.dataset).toMatchObject({ progress: "88", stage: "preparing" });
    screen.setPreparing(9, 9);
    expect(root.dataset).toMatchObject({ progress: "99" });
    screen.complete();
    expect(root.dataset).toMatchObject({ progress: "100", stage: "ready" });
    screen.destroy();
  });
  it("exposes an indeterminate boot and freezes failed progress until re-entry", () => {
    const { screen, root, nodes } = harness();
    screen.show();
    expect(nodes.get(".loading-progress").removeAttribute).toHaveBeenCalledWith("aria-valuenow");
    screen.setProgress(0.5);
    screen.showBootError(vi.fn());
    screen.setProgress(1); screen.complete();
    expect(root.dataset).toMatchObject({ progress: "42", stage: "error" });
    expect(vi.getTimerCount()).toBe(0);
    screen.hide(); screen.show();
    expect(root.dataset).toMatchObject({ progress: "0", stage: "boot" });
    expect(vi.getTimerCount()).toBe(1);
    screen.destroy();
  });
  it("ignores mouse, other fingers, cancelled and outside releases for retry", () => {
    const { screen, fire } = harness();
    const retry = vi.fn(); screen.showBootError(retry);
    fire("pointerdown", { pointerType: "mouse" }); fire("pointerup", { pointerType: "mouse" });
    fire("pointerdown"); fire("pointerup", { pointerId: 2 }); fire("pointercancel"); fire("pointerup");
    fire("pointerdown"); fire("pointerleave"); fire("pointerup");
    fire("pointerdown"); fire("pointerup", { clientX: 200 });
    expect(retry).not.toHaveBeenCalled();
    fire("pointerdown"); fire("pointerup"); fire("pointerup");
    expect(retry).toHaveBeenCalledOnce();
    screen.destroy();
  });
  it("uses a static sheep when reduced motion is enabled", () => {
    vi.stubGlobal("window", { setInterval, clearInterval, matchMedia: () => ({ matches: true }) });
    const { screen, drawImage } = harness(); screen.show();
    expect(frames).not.toHaveBeenCalled();
    expect(drawImage).toHaveBeenCalledWith(expect.any(Object), 128, 16, 128, 112, 0, 0, 128, 112);
    screen.destroy();
  });
});
