import type Phaser from 'phaser';
import { watchViewport, viewportSizeFromScale } from '../game/Viewport';
import { safeUiInsets } from '../ui/UiLayout';
import { createDeliveryDisplayOverlay } from './DeliveryDisplayOverlay';
import { displayCanvasText } from '../ui/DisplayCanvasText';
import { bindTouchTarget } from '../ui/TouchTarget';
import { acquireMenuModal, MENU_MODAL_CANCEL } from '../ui/MenuModal';
import { MAIL_BUTTON_ART, MAIL_PANEL_ART } from '../data/mailboxAssets';
import { AudioSystem } from '../systems/AudioSystem';
import type { ArtRect } from '../ui/MenuArtLayout';
import { CONTENT_V2_KEYS } from '../content-v2/assetManifest';
import { DELIVERY_CHAPTERS, type DeliveryChapterId } from './DeliveryChapters';
import { DeliverySelection } from './DeliverySelection';
import { deliveryStore } from './DeliveryStore';

export type DeliveryPanelMode = 'select' | 'brief' | 'postcard' | 'success' | 'failure';
export interface DeliveryPanelActions { start: (chapterId: DeliveryChapterId) => void; exit?: () => void }
/** Chapter UI uses generated frames; all text is drawn by the project's local bitmap font. */
export function createDeliveryPanel(scene: Phaser.Scene, actions: DeliveryPanelActions, inMailbox = false, chapterId?: string) {
  const text = displayCanvasText(scene), muted = displayCanvasText(scene, '#8a725e'), pressed = new Set<string>();
  const selection = new DeliverySelection(chapterId);
  const names = ['blocker', 'back', 'start', 'card', ...DELIVERY_CHAPTERS.map(chapter => `chapter:${chapter.id}`)];
  const targets = names.map(name => scene.add.container(0, 0, []).setScrollFactor(0).setName('delivery-' + name).setDepth(name === 'blocker' ? 260 : 261));
  let mode: DeliveryPanelMode = 'brief', visible = false, disposed = false, release: (() => void) | undefined;
  let cardReturn: DeliveryPanelMode = 'brief', panel: ArtRect, boxes: ArtRect[] = [], saveFailed = false;
  const source = (key: string) => scene.textures.get(key).getSourceImage() as HTMLImageElement;
  // The legacy paper remains available before A installs the new preload manifest.
  const paperKey = () => scene.textures.exists(CONTENT_V2_KEYS.tripPaper) ? CONTENT_V2_KEYS.tripPaper : MAIL_PANEL_ART.key;
  const chapterSelectReady = () => scene.textures.exists(CONTENT_V2_KEYS.chapterCard) && scene.textures.exists('content-v2-delivery-cottage');
  const sliced = (ctx: CanvasRenderingContext2D, key: string, box: ArtRect, edge = .12) => {
    const image = source(key), sx = Math.round(image.width * edge), sy = Math.round(image.height * edge);
    const dx = Math.min(box.width / 3, sx * box.height / image.height), dy = Math.min(box.height / 3, sy * box.height / image.height);
    const srcX = [0, sx, image.width - sx], srcY = [0, sy, image.height - sy];
    const srcW = [sx, image.width - 2 * sx, sx], srcH = [sy, image.height - 2 * sy, sy];
    // Shared rounded physical boundaries avoid fractional seams between adjoining slices.
    const transform = ctx.getTransform();
    const px = [box.x, box.x + dx, box.x + box.width - dx, box.x + box.width].map(value => Math.round(value * transform.a + transform.e));
    const py = [box.y, box.y + dy, box.y + box.height - dy, box.y + box.height].map(value => Math.round(value * transform.d + transform.f));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(image, srcX[x], srcY[y], srcW[x], srcH[y], px[x], py[y], px[x + 1] - px[x], py[y + 1] - py[y]);
    ctx.restore();
  };
  const fitImage = (ctx: CanvasRenderingContext2D, key: string, box: ArtRect) => {
    const image = source(key), k = Math.min(box.width / image.width, box.height / image.height), width = image.width * k, height = image.height * k;
    ctx.drawImage(image, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
  };
  const surface = createDeliveryDisplayOverlay(scene, ctx => {
    const lines: unknown[] = [], size = scene.scale.gameSize, chapter = selection.chapter;
    const line = (value: string, box: ArtRect, font = 12, soft = false) => {
      const painter = soft ? muted : text;
      const painted = painter(ctx, value, box, painter.fitFontSize(value, box.width, font));
      lines.push({ text: value, box, ink: painted.ink, fontSize: painted.fontSize });
    };
    ctx.fillStyle = 'rgba(24,30,34,.62)'; ctx.fillRect(0, 0, size.width, size.height);
    sliced(ctx, paperKey(), panel);
    const title = mode === 'select' ? '选一段送信路线' : mode === 'brief' ? chapter.title : mode === 'failure' ? chapter.failureTitle : chapter.postcardTitle;
    line(title, { x: panel.x + 26, y: panel.y + 13, width: panel.width - 52, height: 22 }, 18);
    if (mode === 'select') {
      const completed = deliveryStore.load().completedIds;
      DELIVERY_CHAPTERS.forEach((item, index) => {
        const box = boxes[index + 4], chosen = selection.id === item.id;
        ctx.save(); if (!chosen) ctx.globalAlpha = .8;
        if (pressed.has(targets[index + 4].name)) ctx.translate(0, 1);
        const frameKey = scene.textures.exists(CONTENT_V2_KEYS.chapterCard) ? CONTENT_V2_KEYS.chapterCard : MAIL_PANEL_ART.key;
        sliced(ctx, frameKey, box);
        fitImage(ctx, item.previewKey, { x: box.x + 10, y: box.y + 10, width: box.width - 20, height: 72 });
        line(item.title, { x: box.x + 7, y: box.y + 85, width: box.width - 14, height: 20 }, 13);
        line(completed.includes(item.id) ? '已收好' : '未送达', { x: box.x + 9, y: box.y + 102, width: box.width - 18, height: 17 }, 11, !chosen);
        ctx.restore();
      });
    } else if (mode === 'postcard' || mode === 'success') {
      const area = { x: panel.x + 26, y: panel.y + 43, width: panel.width - 52, height: panel.height - 112 - (saveFailed && mode === 'success' ? 17 : 0) };
      const image = source(chapter.postcardKey), k = Math.min(area.width / image.width, area.height / image.height);
      const framed = { x: area.x + (area.width - image.width * k) / 2 - 6, y: area.y - 4, width: image.width * k + 12, height: image.height * k + 8 };
      if (scene.textures.exists(CONTENT_V2_KEYS.chapterCard)) sliced(ctx, CONTENT_V2_KEYS.chapterCard, framed);
      fitImage(ctx, chapter.postcardKey, area);
      line(mode === 'success' ? chapter.successText : chapter.postcardText, { x: panel.x + 20, y: panel.y + panel.height - 64, width: panel.width - 40, height: 19 });
    } else if (mode === 'brief') {
      const width = Math.min(183, panel.width * .46), height = 109;
      fitImage(ctx, chapter.previewKey, { x: panel.x + 22, y: panel.y + 48, width, height });
      [...chapter.introduction, '', chapter.itinerary, '轻触跳跃 · 上滑高跳', '下滑下蹲'].forEach((value, i) => {
        if (value) line(value, { x: panel.x + width + 28, y: panel.y + 49 + i * 18, width: panel.width - width - 49, height: 17 }, 12);
      });
      line('约一分钟的小旅行', { x: panel.x + 20, y: panel.y + 166, width, height: 19 });
    } else {
      line(chapter.failureText, { x: panel.x + 24, y: panel.y + 74, width: panel.width - 48, height: 23 }, 16);
      line('准备好了，就重新出发。', { x: panel.x + 24, y: panel.y + 113, width: panel.width - 48, height: 20 });
    }
    if (saveFailed && mode === 'success') line('本次已收好，暂未保存到设备', { x: panel.x + 20, y: panel.y + panel.height - 83, width: panel.width - 40, height: 15 }, 10);
    const backLabel = mode === 'postcard' ? '返回' : inMailbox && mode === 'brief' && chapterSelectReady() ? '返回章节' : '返回邮箱';
    const labels = ['', backLabel, mode === 'brief' || mode === 'select' ? chapter.startLabel : '重新送一次', '查看明信片'];
    for (let i = 1; i <= 3; i++) {
      const target = targets[i]; if (!target.input?.enabled) continue;
      const box = boxes[i]; ctx.save(); if (pressed.has(target.name)) ctx.translate(0, 1);
      sliced(ctx, MAIL_BUTTON_ART.plain, box, .16);
      line(labels[i], { x: box.x + 7, y: box.y + 3, width: box.width - 14, height: box.height - 6 }, 12); ctx.restore();
    }
    Object.assign(surface.canvas.dataset, { mode, chapterId: chapter.id, lines: JSON.stringify(lines), panel: JSON.stringify(panel),
      targets: JSON.stringify(boxes), targetNames: JSON.stringify(targets.map(target => target.name)), pressed: JSON.stringify([...pressed]), saved: String(!saveFailed) });
  });
  const layout = () => {
    const size = viewportSizeFromScale(scene.scale), safe = safeUiInsets(scene);
    const width = Math.min(410, size.width - safe.left - safe.right - 20), height = Math.min(242, size.height - safe.top - safe.bottom - 20);
    panel = { x: (size.width - width) / 2, y: (size.height - height) / 2, width, height };
    const third = (width - 46) / 3, y = panel.y + height - 43, chapterWidth = (width - 58) / 2;
    boxes = [{ x: 0, y: 0, width: size.width, height: size.height },
      { x: panel.x + 14, y, width: third, height: 32 }, { x: panel.x + width - third - 14, y, width: third, height: 32 },
      { x: panel.x + (width - third) / 2, y, width: third, height: 32 },
      ...DELIVERY_CHAPTERS.map((_chapter, i) => ({ x: panel.x + 22 + i * (chapterWidth + 14), y: panel.y + 45, width: chapterWidth, height: Math.min(137, height - 98) }))];
    targets.forEach((target, index) => { const box = boxes[index]; target.setPosition(box.x + box.width / 2, box.y + box.height / 2).setSize(box.width, box.height); target.input!.hitArea.setSize(box.width, box.height); target.input!.enabled = visible && index < 4; });
    targets[2].input!.enabled = visible && mode !== 'postcard';
    targets[3].input!.enabled = visible && (mode === 'brief' || mode === 'select') && deliveryStore.load().completedIds.includes(selection.id);
    targets.slice(4).forEach(target => target.input!.enabled = visible && mode === 'select');
    surface.invalidate();
  };
  const sound = () => { const audio = scene.registry.get('audioSystem') as AudioSystem | undefined; audio?.initializeAfterGesture(); audio?.play('button'); };
  const close = () => { if (!visible) return; visible = false; pressed.clear(); release?.(); release = undefined; layout(); surface.show(false); };
  const callbacks = [() => {}, () => {
    if (mode === 'postcard') { mode = cardReturn; layout(); return; }
    if (inMailbox && mode === 'brief' && chapterSelectReady()) { mode = 'select'; layout(); return; }
    close(); actions.exit?.();
  }, () => { const id = selection.id; close(); actions.start(id); }, () => { cardReturn = mode; mode = 'postcard'; layout(); },
    ...DELIVERY_CHAPTERS.map(chapter => () => { selection.select(chapter.id); pressed.clear(); layout(); })];
  targets.forEach((target, i) => bindTouchTarget(scene, target, 1, 1, () => { if (!visible || !target.input?.enabled) return; if (i) sound(); callbacks[i](); }, value => { value ? pressed.add(target.name) : pressed.delete(target.name); surface.invalidate(); }));
  const stopViewport = watchViewport(scene, layout);
  const cancelTouches = () => { scene.events.emit(MENU_MODAL_CANCEL); pressed.clear(); surface.invalidate(); };
  scene.events.on('pause', cancelTouches);
  const clear = () => { if (disposed) return; close(); disposed = true; stopViewport(); scene.events.off('pause', cancelTouches); scene.events.off('shutdown', clear); targets.forEach(target => target.destroy()); surface.destroy(); };
  scene.events.once('shutdown', clear);
  return {
    show(next: DeliveryPanelMode, failedSave = false, selectedId?: string) {
      if (visible || disposed) return;
      if (selectedId) selection.select(selectedId);
      // Missing glyphs must be reported before acquiring the nested mailbox lock.
      const chapter = selection.chapter;
      const required = next === 'select' ? ['选一段送信路线', ...DELIVERY_CHAPTERS.map(item => item.title), '已收好', '未送达', chapter.startLabel, '返回邮箱', '查看明信片']
        : next === 'brief' ? [chapter.title, ...chapter.introduction, chapter.itinerary, '轻触跳跃 · 上滑高跳', '下滑下蹲', '约一分钟的小旅行', inMailbox && chapterSelectReady() ? '返回章节' : '返回邮箱', chapter.startLabel, '查看明信片']
        : next === 'postcard' ? [chapter.postcardTitle, chapter.postcardText, '返回']
        : next === 'failure' ? [chapter.failureTitle, chapter.failureText, '准备好了，就重新出发。', '返回邮箱', '重新送一次']
        : [chapter.postcardTitle, chapter.successText, '返回邮箱', '重新送一次', ...(failedSave ? ['本次已收好，暂未保存到设备'] : [])];
      required.forEach(value => text.fitFontSize(value, 1, 12));
      if (inMailbox) { const lease = acquireMenuModal(scene, 'delivery', targets, 'mailbox'); if (!lease) return; release = lease; }
      mode = next; saveFailed = failedSave; visible = true; pressed.clear();
      try { layout(); surface.show(true); } catch (error) { close(); throw error; }
    },
    close, clear, get chapterId() { return selection.id; }, get visible() { return visible; },
  };
}
