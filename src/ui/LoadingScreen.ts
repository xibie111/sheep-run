import { loadingTipAt, LOADING_TIPS, LOADING_TIP_INTERVAL_MS } from "../data/loadingTips";
import { LoadingTipArt } from "./LoadingTipArt";
import { LoadingProgress } from "./LoadingProgress";
import { LoadingProgressArt } from "./LoadingProgressArt";

const SHEEP_URL = new URL("../../assets/skins/runtime-v1/white-sheet.png", import.meta.url).href;
const PANEL_URL = new URL("../../assets/ui/panels/panel_small.png", import.meta.url).href;
// Same six running frames and 16-row transport padding as skinSpriteAssets.
const RUN_FRAMES = [1, 2, 3, 4, 11, 12];

export class LoadingScreen {
  private tipIndex = 0;
  private timer?: number;
  private animation?: number;
  private previousFrame = -1;
  private active = false;
  private readonly sheep = new Image();
  private readonly panel = new Image();
  private readonly caption: HTMLElement;
  private readonly tip: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly sheepCanvas: HTMLCanvasElement;
  private readonly barCanvas: HTMLCanvasElement;
  private readonly tipsCanvas: HTMLCanvasElement;
  private readonly tipCopy: HTMLElement;
  private readonly tipArt: LoadingTipArt;
  private readonly progressState = new LoadingProgress();
  private readonly progressArt: LoadingProgressArt;
  private readonly resize = new ResizeObserver(() => { this.fitTip(); this.renderProgress(); });
  private readonly retry: HTMLButtonElement;
  private retryAction?: () => void;
  private owner?: number;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  constructor(private readonly root: HTMLElement) {
    this.caption = root.querySelector(".loading-caption")!;
    this.tip = root.querySelector(".loading-tip-text")!;
    this.progress = root.querySelector(".loading-progress")!;
    this.sheepCanvas = root.querySelector(".loading-sheep")!;
    this.barCanvas = root.querySelector(".loading-progress-art")!;
    this.tipsCanvas = root.querySelector(".loading-tips-art")!;
    this.tipCopy = root.querySelector(".loading-tips-copy")!;
    this.tipArt = new LoadingTipArt(root.querySelector(".loading-tip-text-art")!);
    this.progressArt = new LoadingProgressArt(this.barCanvas, () => { this.root.dataset.progressFont = "ready"; });
    this.retry = root.querySelector(".loading-retry")!;
    this.sheep.onload = () => this.drawSheep(0);
    this.panel.onload = () => this.drawTipPanel();
    this.sheep.src = SHEEP_URL;
    this.panel.src = PANEL_URL;
    this.retry.addEventListener("pointerdown", this.press);
    this.retry.addEventListener("pointerup", this.release);
    this.retry.addEventListener("pointercancel", this.cancelPress);
    this.retry.addEventListener("pointerleave", this.cancelPress);
  }
  show(): void {
    // Bootstrap and PreloadScene share this screen; keep the current tip on repeated show.
    if (this.active) return;
    this.active = true;
    this.root.hidden = false;
    this.retry.hidden = true;
    this.retryAction = undefined;
    this.progressState.reset();
    this.pickTip();
    this.resize.observe(this.tipCopy);
    this.resize.observe(this.progress);
    this.renderProgress();
    document.addEventListener("visibilitychange", this.visibility);
    this.resume();
  }
  setProgress(value: number): void {
    this.progressState.assets(value); this.renderProgress();
  }
  setPreparing(completed: number, total: number): void {
    this.progressState.preparing(completed, total); this.renderProgress();
  }
  complete(): void { this.progressState.complete(); this.renderProgress(); }
  private renderProgress(): void {
    const state = this.progressState.snapshot();
    this.progress.style.setProperty("--loading-progress", `${state.percent}%`);
    if (state.indeterminate) this.progress.removeAttribute("aria-valuenow");
    else this.progress.setAttribute("aria-valuenow", String(state.percent));
    const caption = state.stage === "error" ? "加载失败，请触摸重试" : state.indeterminate ? `${state.label}…` : `${state.label} ${state.percent}%`;
    this.progress.setAttribute("aria-valuetext", caption);
    this.root.dataset.progress = String(state.percent);
    this.root.dataset.stage = state.stage;
    if (this.caption.textContent !== caption) this.caption.textContent = caption;
    this.progressArt.render(state);
  }
  hide(): void { this.stop(); this.root.hidden = true; }
  showBootError(retry: () => void): void {
    this.show();
    this.progressState.fail(); this.renderProgress(); this.pause();
    this.retry.hidden = false;
    this.retryAction = retry;
  }
  destroy(): void {
    this.hide();
    this.sheep.onload = this.panel.onload = null;
    this.tipArt.destroy();
    this.progressArt.destroy();
    this.retry.removeEventListener("pointerdown", this.press);
    this.retry.removeEventListener("pointerup", this.release);
    this.retry.removeEventListener("pointercancel", this.cancelPress);
    this.retry.removeEventListener("pointerleave", this.cancelPress);
  }
  private readonly press = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || this.owner !== undefined || this.retry.hidden) return;
    event.preventDefault(); this.owner = event.pointerId;
  };
  private readonly release = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || this.owner !== event.pointerId) return;
    event.preventDefault(); this.owner = undefined;
    const box = this.retry.getBoundingClientRect();
    if (event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom) this.retryAction?.();
  };
  private readonly cancelPress = (): void => { this.owner = undefined; };
  private readonly visibility = (): void => {
    this.cancelPress();
    if (document.hidden) this.pause(); else this.resume();
  };
  private resume(): void {
    if (!this.active || document.hidden || this.progressState.snapshot().stage === "error") return;
    this.pause();
    this.timer = window.setInterval(() => this.pickTip(this.tipIndex), LOADING_TIP_INTERVAL_MS);
    if (!this.reducedMotion.matches) this.animation = requestAnimationFrame(this.animate);
    else this.drawSheep(0);
  }
  private readonly animate = (time: number): void => {
    if (!this.active || this.progressState.snapshot().stage === "error") return;
    const frame = Math.floor(time / 100) % RUN_FRAMES.length;
    if (frame !== this.previousFrame) this.drawSheep(frame);
    const state = this.progressState.snapshot();
    if (state.indeterminate) this.progressArt.render(state, time);
    this.animation = requestAnimationFrame(this.animate);
  };
  private drawSheep(index: number): void {
    if (!this.sheep.complete || this.sheep.naturalWidth !== 640) return;
    const context = this.sheepCanvas.getContext("2d");
    if (!context) return;
    const frame = RUN_FRAMES[index]!;
    context.clearRect(0, 0, 128, 112);
    context.imageSmoothingEnabled = false;
    context.drawImage(this.sheep, frame % 5 * 128, Math.floor(frame / 5) * 128 + 16, 128, 112, 0, 0, 128, 112);
    this.previousFrame = index;
  }
  private drawTipPanel(): void {
    const context = this.tipsCanvas.getContext("2d");
    if (!context || !this.panel.naturalWidth) return;
    context.clearRect(0, 0, this.tipsCanvas.width, this.tipsCanvas.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(this.panel, 0, 0, this.panel.naturalWidth, this.panel.naturalHeight, 0, 0, this.tipsCanvas.width, this.tipsCanvas.height);
  }
  private fitTip(): void {
    if (!this.root.hidden) this.tipArt.render(this.tip.textContent ?? "");
  }
  private pickTip(previousIndex?: number): void {
    // Sample all tips on entry, then all except the currently displayed tip.
    const choices = LOADING_TIPS.length - (previousIndex === undefined ? 0 : 1);
    const index = Math.floor(Math.random() * choices);
    this.tipIndex = previousIndex !== undefined && index >= previousIndex ? index + 1 : index;
    this.tip.textContent = loadingTipAt(this.tipIndex);
    this.root.dataset.tipIndex = String(this.tipIndex);
    this.fitTip();
  }
  private pause(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    this.timer = this.animation = undefined;
  }
  private stop(): void {
    this.active = false; this.pause(); this.cancelPress();
    this.resize.disconnect();
    document.removeEventListener("visibilitychange", this.visibility);
  }
}

let screen: LoadingScreen | undefined;
export function showLoadingScreen(): LoadingScreen | undefined {
  const root = document.getElementById("loading-screen");
  if (!root) return undefined;
  screen ??= new LoadingScreen(root);
  screen.show(); return screen;
}
export function hideLoadingScreen(): void { screen?.hide(); }
export function destroyLoadingScreen(): void { screen?.destroy(); screen = undefined; }
