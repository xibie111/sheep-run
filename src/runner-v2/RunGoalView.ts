import type Phaser from 'phaser';
import { createDisplayOverlay } from '../ui/DisplayOverlay';
import { displayCanvasText } from '../ui/DisplayCanvasText';
import { runHudLayout } from '../ui/RunHudLayout';
import { safeUiInsets } from '../ui/UiLayout';
import { watchViewport, type ViewportSize } from '../game/Viewport';
import type { ArtRect, MenuSafeInsets } from '../ui/MenuArtLayout';
import type { RunGoal, RunGoalSnapshot } from './RunGoal';

export const RUN_GOAL_ART = { panel: 'runner-v2-goal-panel', stamp: 'runner-v2-goal-stamp' } as const;

/** The small right-hand sky pocket avoids pause, star/streak notices and the lead's high-jump lane. */
export function runGoalLayout(size: ViewportSize, safe: MenuSafeInsets): ArtRect {
  const hud = runHudLayout(size, safe), best = hud.best;
  // Large landscape safe insets can slightly narrow the gap beside the streak column.
  const x = Math.max(best.x, hud.streak.x + hud.streak.width + 4);
  const width = Math.max(1, best.x + best.width - x);
  return { x, y: best.y + best.height + 4, width, height: 22 * width / 116 };
}

export interface RunGoalPresentation {
  mode: 'intro' | 'active' | 'complete';
  message: string;
  words: ArtRect;
  stamp: ArtRect | null;
}

/** The reference strip has one clear text line and a left-hand completion seal. */
export function runGoalPresentation(goal: RunGoalSnapshot, elapsedMs: number, completedAtMs: number | null, box: ArtRect): RunGoalPresentation {
  const scale = box.width / 116;
  const stamp = goal.complete ? { x: box.x + 4 * scale, y: box.y + 2 * scale, width: 18 * scale, height: 18 * scale } : null;
  const left = stamp ? stamp.x + stamp.width + 3 * scale : box.x + 7 * scale;
  const words = { x: left, y: box.y + 3 * scale, width: box.x + box.width - 7 * scale - left, height: box.height - 6 * scale };
  const progress = `${goal.shortLabel} ${Math.floor(goal.progress)}/${goal.target}${goal.stamp === 'time' ? '秒' : ''}`;
  if (goal.complete) return { mode: 'complete', message: completedAtMs !== null && elapsedMs - completedAtMs < 2000 ? '小目标完成' : progress, words, stamp };
  return { mode: elapsedMs < 2200 ? 'intro' : 'active', message: elapsedMs < 2200 ? goal.label : progress, words, stamp };
}

/** Generated artwork + existing crisp bitmap type; no touch target, wall-clock timer or persistent state. */
export class RunGoalView {
  private readonly surface: ReturnType<typeof createDisplayOverlay>;
  private readonly stopLayout: () => void;
  private stopped = false;
  private elapsedMs = 0;
  private completedAtMs: number | null = null;
  private previous = '';
  private box!: ArtRect;
  constructor(private readonly scene: Phaser.Scene, private readonly goal: RunGoal, private readonly reducedMotion = false) {
    const text = displayCanvasText(scene);
    const panel = scene.textures.get(RUN_GOAL_ART.panel).getSourceImage() as HTMLImageElement;
    const stamp = scene.textures.get(RUN_GOAL_ART.stamp).getSourceImage() as HTMLImageElement;
    this.surface = createDisplayOverlay(scene, 'run-goal', ctx => {
      const state = goal.snapshot(), box = this.box;
      // Image aspect is preserved even if a later art iteration has different padding.
      const scale = Math.min(box.width / panel.width, box.height / panel.height);
      const art = { x: box.x + (box.width - panel.width * scale) / 2,
        y: box.y + (box.height - panel.height * scale) / 2, width: panel.width * scale, height: panel.height * scale };
      ctx.drawImage(panel, art.x, art.y, art.width, art.height);
      const presentation = runGoalPresentation(state, this.elapsedMs, this.completedAtMs, box);
      const stampBox = presentation.stamp;
      const ink = text(ctx, presentation.message, presentation.words,
        text.fitFontSize(presentation.message, presentation.words.width, 10 * box.width / 116));
      if (stampBox) {
        const ratio = Math.min(stampBox.width / stamp.width, stampBox.height / stamp.height);
        ctx.drawImage(stamp, stampBox.x + (stampBox.width - stamp.width * ratio) / 2,
          stampBox.y + (stampBox.height - stamp.height * ratio) / 2, stamp.width * ratio, stamp.height * ratio);
      }
      Object.assign(this.surface.canvas.dataset, { goal: JSON.stringify(state), layout: JSON.stringify(box),
        typography: JSON.stringify({ text: ink }), stamp: JSON.stringify(stampBox), message: presentation.message,
        mode: presentation.mode, reducedMotion: String(reducedMotion) });
    }, 1);
    this.stopLayout = watchViewport(scene, size => { this.box = runGoalLayout(size, safeUiInsets(scene)); this.surface.invalidate(); });
    this.surface.show(true);
  }
  update(deltaMs: number): void {
    if (this.stopped) return;
    if (Number.isFinite(deltaMs) && deltaMs > 0) this.elapsedMs += deltaMs;
    const goal: RunGoalSnapshot = this.goal.snapshot();
    if (goal.complete && this.completedAtMs === null) this.completedAtMs = this.elapsedMs;
    const state = JSON.stringify([goal.id, Math.floor(goal.progress), goal.complete, this.elapsedMs < 2200,
      this.completedAtMs !== null && this.elapsedMs - this.completedAtMs < 2000]);
    if (state !== this.previous) { this.previous = state; this.surface.invalidate(); }
  }
  clear(): void { if (this.stopped) return; this.stopped = true; this.stopLayout(); this.surface.show(false); }
}
