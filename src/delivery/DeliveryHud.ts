import type Phaser from 'phaser';
import { createDisplayOverlay } from '../ui/DisplayOverlay';
import { displayCanvasText } from '../ui/DisplayCanvasText';
import { watchViewport } from '../game/Viewport';
import { safeUiInsets } from '../ui/UiLayout';
import { runHudLayout } from '../ui/RunHudLayout';
import { RUN_HUD_ASSET, RUN_HUD_FRAMES } from '../data/runHudAssets';
import type { ArtRect } from '../ui/MenuArtLayout';
import type { DeliveryRoute } from './DeliveryRoute';
import { DELIVERY_EXPANSION_UI_KEYS as ART } from './DeliveryExpansionUiAssets';
import { deliveryFitArt, deliveryFrameArt } from './DeliveryPanelArt';

export function attachDeliveryHud(scene: Phaser.Scene, route: DeliveryRoute, pauseButton: Phaser.GameObjects.Container) {
  const text = displayCanvasText(scene), source = scene.textures.get(RUN_HUD_ASSET.key).getSourceImage() as HTMLImageElement;
  let pause: ArtRect, left: ArtRect, right: ArtRect, collection: ArtRect, previous = '';
  const surface = createDisplayOverlay(scene, 'delivery-hud', ctx => {
    for (const box of [left, right]) {
      if (route.challenge) deliveryFrameArt(scene, ctx, ART.button, box, .16);
      else {
        ctx.fillStyle = '#66452e'; ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.fillStyle = '#ffe6ae'; ctx.fillRect(box.x + 2, box.y + 2, box.width - 4, box.height - 4);
      }
    }
    const label = route.state === 'ending' || route.state === 'complete' ? route.chapter.deliveredLabel : route.phase.label;
    text(ctx, label, { ...left, x: left.x + 9, width: left.width - 18 }, text.fitFontSize(label, left.width - 18, 13));
    text(ctx, Math.floor(route.distance / route.chapter.length * 100) + '%', { ...right, height: 20 }, 12);
    ctx.fillStyle = '#aa8b5e'; ctx.fillRect(right.x + 8, right.y + 22, right.width - 16, 3);
    ctx.fillStyle = '#688650'; ctx.fillRect(right.x + 8, right.y + 22, (right.width - 16) * route.distance / route.chapter.length, 3);
    const challenge = route.challenge?.snapshot();
    if (challenge) {
      deliveryFrameArt(scene, ctx, ART.button, collection, .16);
      deliveryFitArt(scene, ctx, ART.counter, { x: collection.x + 9, y: collection.y + 4, width: 18, height: 18 });
      text(ctx, challenge.ordinaryCollected + '/5', { x: collection.x + 32, y: collection.y + 3, width: 38, height: 20 }, 12);
      ctx.save(); if (!challenge.hiddenCollected) { ctx.filter = 'grayscale(1)'; ctx.globalAlpha = .4; }
      deliveryFitArt(scene, ctx, route.chapter.challenge!.keepsakeKey, { x: collection.x + 94, y: collection.y + 3, width: 20, height: 20 }); ctx.restore();
    }
    if (pauseButton.input?.enabled) { const frame = RUN_HUD_FRAMES.pause; ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, pause.x, pause.y + (pauseButton.getData('pressed') ? 1 : 0), pause.width, pause.height); }
    Object.assign(surface.canvas.dataset, { phase: route.phase.id, distance: String(route.distance), state: route.state,
      ordinary: String(challenge?.ordinaryCollected ?? ''), hidden: String(challenge?.hiddenCollected ?? ''), pause: JSON.stringify(pause) });
  }, 1);
  watchViewport(scene, size => {
    const safe = safeUiInsets(scene); pause = runHudLayout(size, safe).pause;
    pauseButton.setPosition(pause.x + pause.width / 2, pause.y + pause.height / 2).setSize(pause.width, pause.height).setData('hud-rect', pause);
    pauseButton.input!.hitArea.setSize(pause.width, pause.height);
    left = { x: safe.left + 12, y: safe.top + 10, width: route.challenge ? 134 : 112, height: 30 };
    right = { x: size.width - safe.right - (route.challenge ? 134 : 104) - 12, y: safe.top + 10, width: route.challenge ? 134 : 104, height: 30 };
    collection = { x: left.x, y: left.y + 34, width: 134, height: 26 };
    surface.invalidate();
  });
  const tick = () => {
    const challenge = route.challenge?.snapshot();
    const state = [Math.floor(route.distance), route.state, route.phase.id, challenge?.ordinaryCollected, challenge?.hiddenCollected,
      pauseButton.input?.enabled, pauseButton.getData('pressed')].join(':');
    if (state !== previous) { previous = state; surface.invalidate(); }
  };
  scene.events.on('postupdate', tick); scene.events.once('shutdown', () => scene.events.off('postupdate', tick));
  surface.show(true);
}
