import type Phaser from 'phaser';
import { runViewportOrigin, type ViewportSize } from '../game/Viewport';
import type { SceneryId } from './sceneryCatalog';
import { SCENERY_RULES } from './ScenerySchedule';
import type { LandscapeState } from '../ambient/AnimalRules';

/** Pixel shapes are drawn behind the road. No particles, tweens, input or physics. */
export class SceneryView {
  private readonly art: Phaser.GameObjects.Graphics;
  private rendered = false;
  private visible = false;
  private meadowAnchor?: { x: number; offset: number };
  private readonly afterRender = () => { this.rendered = this.visible; };
  constructor(private readonly scene: Phaser.Scene, readonly id: SceneryId, private readonly reduced: boolean) {
    // The authored far panorama includes opaque sky. Paint above all background
    // sheets (last depth -12), while remaining behind sheep, obstacles and HUD.
    this.art = scene.add.graphics().setDepth(-9.6).setName(`rare-scenery:${id}`);
    scene.game.events.on('postrender', this.afterRender);
  }
  update(age: number, size: ViewportSize, landscape?: LandscapeState): boolean {
    const wasRendered = this.rendered; this.rendered = false;
    const origin = runViewportOrigin(size), left = -origin.x, top = -origin.y;
    const alpha = Math.max(0, Math.min(1, age / 1000, (SCENERY_RULES.durationMs - age) / 1500));
    this.art.clear().setAlpha(alpha);
    const cx = Math.round(left + size.width * .62), sky = Math.max(top + 76, 28);
    let total = 0, onScreen = 0;
    const pixel = (x: number, y: number, color: number, width = 2, height = 2, a = 1) => {
      x = Math.round(x); y = Math.round(y); total++;
      if (x >= left + 3 && x + width <= left + size.width - 3 && y >= top + 70 && y + height < 207) onScreen++;
      this.art.fillStyle(color, a).fillRect(x, y, width, height);
    };
    if (this.id === 'rainbow-v1') {
      [0xe7a0a6, 0xf0bd88, 0xf4df9a, 0xaccd99, 0x8bbac9, 0xb0a9d0].forEach((color, band) => {
        for (let x = -94; x <= 94; x += 2) {
          const y = sky + 57 - Math.sqrt(Math.max(0, 1 - (x / 96) ** 2)) * (54 - band * 3);
          pixel(cx + x, y, color, 2, 3, .68);
        }
      });
    } else if (this.id === 'meteors-v1') {
      for (let i = 0; i < 3; i++) {
        const p = this.reduced ? .4 : ((age + i * 1700) % 3400) / 3400;
        const x = cx - 78 + i * 60 - p * 26, y = sky + 4 + i * 12 + p * 18;
        for (let n = 0; n < 12; n++) pixel(x + n * 2, y - n, 0xffe9b4, 2, 2, 1 - n / 14);
        pixel(x - 1, y - 1, 0xfff9db, 3, 3);
      }
    } else {
      this.meadowAnchor ??= { x: cx, offset: landscape?.nearOffset ?? 0 };
      const meadowX = this.meadowAnchor.x - ((landscape?.nearOffset ?? 0) - this.meadowAnchor.offset);
      for (let i = 0; i < 12; i++) {
        const phase = this.reduced ? 0 : age / 1700 + i;
        const x = meadowX - 64 + (i * 37 % 135) + Math.sin(phase) * (this.reduced ? 0 : 3);
        const y = 174 + (i * 11 % 23) + Math.cos(phase) * (this.reduced ? 0 : 2);
        pixel(x - 2, y - 2, 0xf3d77b, 6, 6, .18);
        pixel(x - 1, y - 1, 0xecb753, 4, 4, .42);
        pixel(x, y, 0xfff3bf, 2, 2, this.reduced ? 1 : .65 + (Math.sin(phase) + 1) * .175);
      }
    }
    const rect = this.scene.game.canvas.getBoundingClientRect();
    this.visible = total > 0 && onScreen / total >= .85 && alpha >= .6 && this.art.visible && rect.width > 0 && rect.height > 0 && document.visibilityState !== 'hidden';
    return wasRendered && this.visible;
  }
  destroy(): void { this.scene.game.events.off('postrender', this.afterRender); this.art.destroy(); this.visible = this.rendered = false; }
}
