export const LOADING_STAGE_LABELS = {
  boot: "准备牧场", assets: "加载资源", preparing: "整理牧场", ready: "准备出发", error: "加载失败",
} as const;

export type LoadingStage = keyof typeof LOADING_STAGE_LABELS;
export interface LoadingProgressState { stage: LoadingStage; percent: number; label: string; indeterminate: boolean; }

/** Progress follows completed work; animation never advances the percentage. */
export class LoadingProgress {
  private stage: LoadingStage = "boot";
  private percent = 0;
  reset(): void { this.stage = "boot"; this.percent = 0; }
  assets(value: number): void {
    if (!Number.isFinite(value) || this.stage === "preparing" || this.stage === "ready" || this.stage === "error") return;
    this.stage = "assets";
    this.percent = Math.max(this.percent, Math.floor(Math.max(0, Math.min(1, value)) * 85));
  }
  preparing(completed: number, total: number): void {
    if (this.stage === "ready" || this.stage === "error" || !Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return;
    this.stage = "preparing";
    this.percent = Math.max(this.percent, 85 + Math.floor(Math.max(0, Math.min(1, completed / total)) * 14));
  }
  complete(): void { if (this.stage !== "error") { this.stage = "ready"; this.percent = 100; } }
  fail(): void { this.stage = "error"; }
  snapshot(): LoadingProgressState {
    return { stage: this.stage, percent: this.percent, label: LOADING_STAGE_LABELS[this.stage], indeterminate: this.stage === "boot" };
  }
}
