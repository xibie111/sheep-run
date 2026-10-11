import type Phaser from 'phaser';
import { watchViewport, viewportSizeFromScale } from '../game/Viewport';
import { safeUiInsets } from '../ui/UiLayout';
import { createDisplayOverlay } from '../ui/DisplayOverlay';
import { displayCanvasText } from '../ui/DisplayCanvasText';
import { bindTouchTarget } from '../ui/TouchTarget';
import { acquireMenuModal } from '../ui/MenuModal';
import { MAIL_BUTTON_ART } from '../data/mailboxAssets';
import { AudioSystem } from '../systems/AudioSystem';
import type { ArtRect } from '../ui/MenuArtLayout';
import { DELIVERY_ID, DELIVERY_TITLE } from './DeliveryRoute';
import { deliveryStore } from './DeliveryStore';

type Mode = 'brief' | 'postcard' | 'success' | 'failure';
/** Uses the same bitmap text, physical display surface and touch leases as the books. */
export function createDeliveryPanel(scene: Phaser.Scene, actions: { start: () => void; exit?: () => void }, inMailbox = false) {
  const text = displayCanvasText(scene), pressed = new Set<string>();
  const targets = ['blocker', 'back', 'start', 'card'].map(name => scene.add.container(0, 0, []).setScrollFactor(0).setName('delivery-' + name).setDepth(name === 'blocker' ? 260 : 261));
  const [blocker, back, start, card] = targets;
  let mode: Mode = 'brief', visible = false, release: (() => void) | undefined, cardReturn: Mode = 'brief';
  let panel: ArtRect, boxes: ArtRect[], saveFailed = false;
  const art = scene.textures.get('delivery-postcard-v1').getSourceImage() as HTMLImageElement;
  const preview = scene.textures.get('delivery-hill-v1').getSourceImage() as HTMLImageElement;
  const buttonArt = scene.textures.get(MAIL_BUTTON_ART.plain).getSourceImage() as HTMLImageElement;
  const surface = createDisplayOverlay(scene, 'delivery-panel', ctx => {
    const lines: unknown[] = [], size = scene.scale.gameSize;
    const line = (value: string, box: ArtRect, font = 12) => lines.push(text(ctx, value, box, text.fitFontSize(value, box.width, font)));
    ctx.fillStyle = 'rgba(24,30,34,.62)'; ctx.fillRect(0, 0, size.width, size.height);
    ctx.fillStyle = '#663c27'; ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    ctx.fillStyle = '#cb8d4b'; ctx.fillRect(panel.x + 3, panel.y + 3, panel.width - 6, panel.height - 6);
    ctx.fillStyle = '#ffedc7'; ctx.fillRect(panel.x + 7, panel.y + 7, panel.width - 14, panel.height - 14);
    const title = mode === 'brief' ? DELIVERY_TITLE : mode === 'failure' ? '这封晚安，再送一次吧' : '山坡晚安';
    line(title, { x: panel.x + 14, y: panel.y + 12, width: panel.width - 28, height: 22 }, 18);
    if (mode === 'postcard' || mode === 'success') {
      const height = panel.height - 105 - (saveFailed && mode === 'success' ? 18 : 0), width = Math.min(panel.width - 32, height * art.width / art.height);
      ctx.drawImage(art, panel.x + (panel.width - width) / 2, panel.y + 39, width, height);
      line(mode === 'success' ? '晚安已送达，明信片已收好。' : '山坡上的晚安，一直为你留着。',
        { x: panel.x + 14, y: panel.y + panel.height - 62, width: panel.width - 28, height: 17 });
    } else if (mode === 'brief') {
      const width = Math.min(190, panel.width * .49), height = 118;
      // Preview the destination; the postcard itself is revealed on completion.
      const sourceWidth = preview.height * width / height;
      ctx.drawImage(preview, preview.width * .62 - sourceWidth / 2, 0, sourceWidth, preview.height, panel.x + 16, panel.y + 45, width, height);
      ['山坡上的小屋，', '还在等一封晚安信。', '', '牧场 · 林间 · 山坡', '轻触跳跃 · 上滑高跳', '下滑下蹲'].forEach((value, i) => {
        if (value) line(value, { x: panel.x + width + 23, y: panel.y + 48 + i * 19, width: panel.width - width - 36, height: 17 }, 12);
      });
      line('约一分钟的小旅行', { x: panel.x + 16, y: panel.y + 50 + height, width, height: 19 });
    } else {
      line('信还在邮袋里。', { x: panel.x + 20, y: panel.y + 73, width: panel.width - 40, height: 22 }, 16);
      line('准备好了，就重新出发。', { x: panel.x + 20, y: panel.y + 108, width: panel.width - 40, height: 20 });
    }
    if (saveFailed && mode === 'success') line('本次已收好，暂未保存到设备', { x: panel.x + 12, y: panel.y + panel.height - 81, width: panel.width - 24, height: 14 }, 10);
    const labels = ['', mode === 'postcard' ? '返回' : '返回邮箱', mode === 'brief' ? '背上邮袋出发' : '重新送一次', '查看明信片'];
    targets.forEach((target, i) => {
      if (!i || !target.input?.enabled) return;
      const box = boxes[i]; ctx.save(); if (pressed.has(target.name)) ctx.translate(0, 1);
      ctx.drawImage(buttonArt, box.x, box.y, box.width, box.height);
      line(labels[i], { x: box.x + 5, y: box.y, width: box.width - 10, height: box.height }, 12); ctx.restore();
    });
    Object.assign(surface.canvas.dataset, { mode, lines: JSON.stringify(lines), panel: JSON.stringify(panel), targets: JSON.stringify(boxes), saved: String(!saveFailed) });
  }, 14);
  const layout = () => {
    const size = viewportSizeFromScale(scene.scale), safe = safeUiInsets(scene), width = Math.min(410, size.width - safe.left - safe.right - 20), height = Math.min(242, size.height - safe.top - safe.bottom - 20);
    panel = { x: (size.width - width) / 2, y: (size.height - height) / 2, width, height };
    const y = panel.y + height - 40, third = (width - 40) / 3;
    boxes = [{ x: 0, y: 0, width: size.width, height: size.height },
      { x: panel.x + 12, y, width: third, height: 29 },
      { x: panel.x + width - third - 12, y, width: third, height: 29 },
      { x: panel.x + (width - third) / 2, y, width: third, height: 29 }];
    targets.forEach((target, index) => { const box = boxes[index]; target.setPosition(box.x + box.width / 2, box.y + box.height / 2).setSize(box.width, box.height); target.input!.hitArea.setSize(box.width, box.height); target.input!.enabled = visible; });
    start.input!.enabled = visible && mode !== 'postcard';
    card.input!.enabled = visible && mode === 'brief' && deliveryStore.load().completedIds.includes(DELIVERY_ID);
    surface.invalidate();
  };
  const sound = () => { const audio = scene.registry.get('audioSystem') as AudioSystem | undefined; audio?.initializeAfterGesture(); audio?.play('button'); };
  const close = () => { visible = false; release?.(); release = undefined; layout(); surface.show(false); };
  const callbacks = [() => {}, () => {
    if (mode === 'postcard') { mode = cardReturn; layout(); return; }
    close(); actions.exit?.();
  }, () => { close(); actions.start(); }, () => { cardReturn = mode; mode = 'postcard'; layout(); }];
  targets.forEach((target, i) => bindTouchTarget(scene, target, 1, 1, () => { if (i) sound(); callbacks[i](); }, value => { value ? pressed.add(target.name) : pressed.delete(target.name); surface.invalidate(); }));
  watchViewport(scene, layout);
  scene.events.once('shutdown', () => { visible = false; release = undefined; });
  return { show(next: Mode, failedSave = false) {
    if (visible) return;
    if (inMailbox) { const lease = acquireMenuModal(scene, 'delivery', targets, 'mailbox'); if (!lease) return; release = lease; }
    mode = next; saveFailed = failedSave; visible = true; pressed.clear(); layout(); surface.show(true);
  } };
}
