import type Phaser from 'phaser';
import { createDisplayOverlay } from '../ui/DisplayOverlay';
import { displayCanvasText } from '../ui/DisplayCanvasText';
import { watchViewport } from '../game/Viewport';
import { safeUiInsets } from '../ui/UiLayout';
import { runHudLayout } from '../ui/RunHudLayout';
import { RUN_HUD_ASSET, RUN_HUD_FRAMES } from '../data/runHudAssets';
import type { ArtRect } from '../ui/MenuArtLayout';
import type { DeliveryRoute } from './DeliveryRoute';

export function attachDeliveryHud(scene: Phaser.Scene, route: DeliveryRoute, pauseButton: Phaser.GameObjects.Container) {
  const text = displayCanvasText(scene), source = scene.textures.get(RUN_HUD_ASSET.key).getSourceImage() as HTMLImageElement;
  let pause: ArtRect, left: ArtRect, right: ArtRect, previous = '';
  const surface = createDisplayOverlay(scene, 'delivery-hud', ctx => {
    for (const box of [left, right]) {
      ctx.fillStyle = '#66452e'; ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = '#ffe6ae'; ctx.fillRect(box.x + 2, box.y + 2, box.width - 4, box.height - 4);
    }
    text(ctx, route.state === 'ending' || route.state === 'complete' ? route.chapter.deliveredLabel : route.phase.label, left, 13);
    text(ctx, `${Math.floor(route.distance / route.chapter.length * 100)}%`, { ...right, height: 20 }, 12);
    ctx.fillStyle = '#aa8b5e'; ctx.fillRect(right.x + 8, right.y + 22, right.width - 16, 3);
    ctx.fillStyle = '#688650'; ctx.fillRect(right.x + 8, right.y + 22, (right.width - 16) * route.distance / route.chapter.length, 3);
    if (pauseButton.input?.enabled) { const frame = RUN_HUD_FRAMES.pause; ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, pause.x, pause.y + (pauseButton.getData('pressed') ? 1 : 0), pause.width, pause.height); }
    Object.assign(surface.canvas.dataset, { phase: route.phase.id, distance: String(route.distance), state: route.state, pause: JSON.stringify(pause) });
  }, 1);
  watchViewport(scene, size => {
    const safe = safeUiInsets(scene); pause = runHudLayout(size, safe).pause;
    pauseButton.setPosition(pause.x + pause.width / 2, pause.y + pause.height / 2).setSize(pause.width, pause.height).setData('hud-rect', pause);
    pauseButton.input!.hitArea.setSize(pause.width, pause.height);
    left = { x: safe.left + 12, y: safe.top + 10, width: 112, height: 30 };
    right = { x: size.width - safe.right - 116, y: safe.top + 10, width: 104, height: 30 };
    surface.invalidate();
  });
  const tick = () => { const state = `${Math.floor(route.distance)}:${route.state}:${pauseButton.input?.enabled}:${pauseButton.getData('pressed')}`; if (state !== previous) { previous = state; surface.invalidate(); } };
  scene.events.on('postupdate', tick); scene.events.once('shutdown', () => scene.events.off('postupdate', tick));
  surface.show(true);
}
