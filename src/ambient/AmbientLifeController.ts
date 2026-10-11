import type Phaser from 'phaser';
import { runViewportOrigin, runViewportRight, type ViewportSize } from '../game/Viewport';
import { SceneEventScheduler, sceneEventSeed } from './SceneEventScheduler';
import { ANIMAL_ANCHORS, ANIMAL_DURATIONS, allowsAnimal, animalAnchorX, animalOffers, crowdedForAnimal, type AnimalOffer, type LandscapeState } from './AnimalRules';
import { ANIMAL_TEXTURE } from './animalAssets';
import { AnimalView } from './AnimalView';
import { COMPANION_RULES } from '../companions/CompanionRules';

interface Context {
  nowMs: number; speed: number; viewport: ViewportSize; landscape: LandscapeState;
  obstacles: readonly { active: boolean; x: number; rightEdge: number }[];
  companionState?: string; milestoneVisible?: boolean;
}
interface Playing { offer: AnimalOffer; theme: string; startedMs: number; view: AnimalView; exitAtMs?: number; }

export class AmbientLifeController {
  readonly scheduler: SceneEventScheduler;
  private playing: Playing | null = null;
  private ponds: Phaser.GameObjects.Image[] = [];
  private stopped = false;
  private nextCheckMs = 0;
  private companionStartedMs: number | null = null;
  private noticeVisible = false;
  private lastKind: string | null = null;
  private nowMs = 0;
  private startedCount = 0;
  constructor(private readonly scene: Phaser.Scene, private readonly reducedMotion: boolean, seed = sceneEventSeed()) {
    this.scheduler = new SceneEventScheduler(seed);
  }
  update(context: Context): void {
    if (this.stopped || this.scene.scene.isPaused() || !Number.isFinite(context.nowMs)) return;
    this.nowMs = context.nowMs;
    const { nowMs, landscape, viewport } = context;
    const left = -runViewportOrigin(viewport).x, right = runViewportRight(viewport);
    this.updatePonds(landscape, left, right);
    if (context.companionState === 'companion') this.companionStartedMs ??= nowMs;
    else this.companionStartedMs = null;
    if (nowMs >= this.nextCheckMs) {
      this.nextCheckMs = nowMs + 200;
      const parent = this.scene.game.canvas?.parentElement;
      this.noticeVisible = !!parent && [...parent.querySelectorAll<HTMLCanvasElement>(
        '[data-easter-egg="score"],[data-adventure-overlay="collection-toast"],[data-adventure-overlay="journey-toast"]')]
        .some(canvas => canvas.style.display === 'block');
    }
    if (this.playing) {
      const p = this.playing, elapsed = nowMs - p.startedMs, x = animalAnchorX(p.offer, landscape);
      if ((p.theme !== landscape.theme || !allowsAnimal(p.offer.kind, landscape))
        && p.exitAtMs === undefined) p.exitAtMs = nowMs + 250;
      if (elapsed >= ANIMAL_DURATIONS[p.offer.kind] || x + 48 < left || x - 48 > right || (p.exitAtMs !== undefined && nowMs >= p.exitAtMs)) {
        p.view.destroy(); this.playing = null; this.scheduler.finish(nowMs);
      } else p.view.update(elapsed, x, p.offer.y, landscape.landTint, p.exitAtMs === undefined ? 1 : Math.max(0, (p.exitAtMs - nowMs) / 250));
      return;
    }
    if (this.scheduler.state !== 'waiting' || nowMs < this.scheduler.nextEligibleAtMs) return;
    const companionAge = this.companionStartedMs === null ? null : nowMs - this.companionStartedMs;
    const companionBusy = context.companionState === 'bell' || (companionAge !== null &&
      (companionAge < COMPANION_RULES.entranceMs || companionAge >= COMPANION_RULES.visitMs - COMPANION_RULES.farewellMs));
    const blocked = this.noticeVisible || !!context.milestoneVisible || companionBusy || crowdedForAnimal(context.obstacles, context.speed);
    const offers = animalOffers(landscape, left, right, context.speed);
    const varied = offers.filter(offer => offer.kind !== this.lastKind);
    const offer = this.scheduler.choose(nowMs, varied.length ? varied : offers, blocked);
    if (!offer) return;
    this.lastKind = offer.kind; this.startedCount++;
    const view = new AnimalView(this.scene, offer.kind, this.reducedMotion);
    this.playing = { offer, theme: landscape.theme, startedMs: nowMs, view };
    view.update(0, offer.worldX, offer.y, landscape.landTint);
  }
  // A pond is part of the landscape, so it never pops into existence with a duck.
  private updatePonds(landscape: LandscapeState, left: number, right: number): void {
    const anchor = ANIMAL_ANCHORS[landscape.theme].find(a => a.kind === 'duck-family');
    const positions: number[] = [];
    if (anchor && landscape.nearRepeatWidth >= 480) {
      const first = Math.floor((left + landscape.nearOffset - anchor.x) / landscape.nearRepeatWidth);
      const last = Math.ceil((right + landscape.nearOffset - anchor.x) / landscape.nearRepeatWidth);
      for (let tile = first; tile <= last; tile++) {
        const x = anchor.x + tile * landscape.nearRepeatWidth - landscape.nearOffset;
        if (x + 44 >= left && x - 44 <= right) positions.push(x);
      }
    }
    while (this.ponds.length > positions.length) this.ponds.pop()!.destroy();
    positions.forEach((x, index) => {
      this.ponds[index] ??= this.scene.add.image(0, 0, ANIMAL_TEXTURE, 'pond').setOrigin(.5, 1).setScale(.25).setDepth(-10).setName('ambient-life:pond');
      this.ponds[index]!.setPosition(Math.round(x), anchor!.y).setTint(landscape.landTint);
    });
  }
  snapshot() {
    return { state: this.scheduler.state, nextEligibleAtMs: this.scheduler.nextEligibleAtMs, kind: this.playing?.offer.kind ?? null,
      startedCount: this.startedCount, elapsedMs: this.playing ? this.nowMs - this.playing.startedMs : 0,
      objects: this.ponds.length + (this.playing?.view.objectCount ?? 0), ponds: this.ponds.length };
  }
  clear(): void {
    if (this.stopped) return;
    this.stopped = true; this.scheduler.stop(); this.playing?.view.destroy(); this.playing = null;
    for (const pond of this.ponds) pond.destroy(); this.ponds = [];
  }
}
