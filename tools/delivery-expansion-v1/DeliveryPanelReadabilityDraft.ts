// QA draft only: not imported by production scenes; awaiting coordinated source gate.
import type Phaser from 'phaser';
import { watchViewport } from '../../src/game/Viewport';
import { safeUiInsets } from '../../src/ui/UiLayout';
import { createDeliveryDisplayOverlay } from '../../src/delivery/DeliveryDisplayOverlay';
import { displayCanvasText } from '../../src/ui/DisplayCanvasText';
import { bindTouchTarget } from '../../src/ui/TouchTarget';
import { acquireMenuModal, MENU_MODAL_CANCEL } from '../../src/ui/MenuModal';
import { MAIL_PANEL_ART } from '../../src/data/mailboxAssets';
import { AudioSystem } from '../../src/systems/AudioSystem';
import type { ArtRect } from '../../src/ui/MenuArtLayout';
import { CONTENT_V2_KEYS } from '../../src/content-v2/assetManifest';
import { DELIVERY_CHAPTERS, type DeliveryChapterId } from '../../src/delivery/DeliveryChapters';
import { DeliverySelection } from '../../src/delivery/DeliverySelection';
import { deliveryStore } from '../../src/delivery/DeliveryStore';
import { deliveryChallengeStore } from '../../src/delivery/DeliveryChallengeStore';
import { isDeliveryChallengeChapterId, type DeliveryChallengeSnapshot } from '../../src/delivery/DeliveryChallengeRun';
import { deliveryBestRating, deliveryResultSummary, deliveryRouteLines, DELIVERY_EXPANSION_UI_TEXT } from '../../src/delivery/DeliveryPanelModel';
import { deliveryPanelLayout, type DeliveryPanelLayout } from '../../src/delivery/DeliveryPanelLayout';
import { DELIVERY_EXPANSION_UI_KEYS as ART } from '../../src/delivery/DeliveryExpansionUiAssets';
import { deliveryFitArt, deliveryFrameArt } from '../../src/delivery/DeliveryPanelArt';

export type DeliveryPanelMode = 'select' | 'brief' | 'postcard' | 'success' | 'failure' | 'album';
export interface DeliveryPanelActions { start: (chapterId: DeliveryChapterId) => void; exit?: () => void }
/** Five chapters share one input lease; changing inner pages never unlocks the mailbox. */
export function createDeliveryPanel(scene: Phaser.Scene, actions: DeliveryPanelActions, inMailbox = false, chapterId?: string) {
  const text = displayCanvasText(scene), muted = displayCanvasText(scene, '#8a725e'), pressed = new Set<string>();
  const selection = new DeliverySelection(chapterId);
  const names = ['blocker', 'back', 'start', 'card', 'previous', 'next', 'album', ...DELIVERY_CHAPTERS.map(chapter => 'chapter:' + chapter.id)];
  const targets = names.map(name => scene.add.container(0, 0, []).setScrollFactor(0).setName('delivery-' + name).setDepth(name === 'blocker' ? 260 : 261));
  let mode: DeliveryPanelMode = 'brief', visible = false, disposed = false, release: (() => void) | undefined;
  let cardReturn: DeliveryPanelMode = 'brief', geometry: DeliveryPanelLayout, boxes: ArtRect[] = [], saveFailed = false;
  let runResult: DeliveryChallengeSnapshot | undefined;
  const legacyPaper = () => scene.textures.exists(CONTENT_V2_KEYS.tripPaper) ? CONTENT_V2_KEYS.tripPaper : MAIL_PANEL_ART.key;
  const frame = (ctx: CanvasRenderingContext2D, key: string, box: ArtRect, edge?: number) => deliveryFrameArt(scene, ctx, key, box, edge);
  const surface = createDeliveryDisplayOverlay(scene, ctx => {
    const lines: unknown[] = [], images: unknown[] = [], size = scene.scale.gameSize, chapter = selection.chapter, panel = geometry.panel;
    const challenge = !!chapter.challenge, result = challenge ? deliveryResultSummary(runResult, mode === 'success') : undefined;
    const record = deliveryChallengeStore.load(), completed = deliveryStore.load().completedIds;
    const line = (value: string, box: ArtRect, font = 12, soft = false) => {
      const painter = soft ? muted : text, painted = painter(ctx, value, box, painter.fitFontSize(value, box.width, font));
      lines.push({ text: value, box, ink: painted.ink, fontSize: painted.fontSize });
    };
    const art = (key: string, box: ArtRect) => images.push(deliveryFitArt(scene, ctx, key, box));
    const stars = (earned: readonly boolean[], box: ArtRect, size = 16) => {
      const gap = 4, width = size * 3 + gap * 2, left = box.x + (box.width - width) / 2;
      earned.forEach((flag, i) => art(flag ? ART.gold : ART.gray, { x: left + i * (size + gap), y: box.y, width: size, height: size }));
    };
    ctx.fillStyle = 'rgba(24,30,34,.62)'; ctx.fillRect(0, 0, size.width, size.height);
    frame(ctx, mode === 'select' || mode === 'album' || challenge ? ART.paper : legacyPaper(), panel);
    if (mode === 'select' || mode === 'album' || challenge) frame(ctx, ART.button, { x: panel.x + 64, y: panel.y + 4, width: panel.width - 128, height: 29 }, .16);
    const title = mode === 'select' ? '选一段送信路线' : mode === 'album' ? '章节邮票册' : mode === 'brief' ? chapter.title
      : mode === 'failure' ? chapter.failureTitle : mode === 'success' && challenge ? '投递完成' : chapter.postcardTitle;
    line(title, geometry.title, 18);
    if (mode === 'select') {
      selection.page.items.forEach((item, index) => {
        const box = geometry.cards[index], chosen = selection.id === item.id;
        ctx.save(); if (!chosen) ctx.globalAlpha = .88;
        if (pressed.has('delivery-chapter:' + item.id)) ctx.translate(0, 1);
        frame(ctx, ART.frame, box);
        art(item.previewKey, { x: box.x + 12, y: box.y + 8, width: box.width - 24, height: 31 });
        line(item.title, { x: box.x + 7, y: box.y + 40, width: box.width - 14, height: 18 }, 13);
        deliveryRouteLines(item.itinerary, 14).slice(0, 2).forEach((value, i) => line(value, { x: box.x + 8, y: box.y + 59 + i * 13, width: box.width - 16, height: 14 }, 11));
        line('难度 ' + (item.difficultyLabel ?? '轻松'), { x: box.x + 8, y: box.y + 86, width: box.width - 16, height: 14 }, 11);
        line(completed.includes(item.id) ? '已通关' : '未通关', { x: box.x + 8, y: box.y + 101, width: box.width - 16, height: 14 }, 11, !chosen);
        if (isDeliveryChallengeChapterId(item.id)) {
          const rating = deliveryBestRating(true, record.chapters[item.id]);
          line('最佳', { x: box.x + 8, y: box.y + 117, width: 27, height: 16 }, 11);
          stars([0, 1, 2].map(i => i < (rating?.stars ?? 0)), { x: box.x + 36, y: box.y + 117, width: 58, height: 16 }, 14);
          ctx.save(); if (!rating?.keepsake) { ctx.filter = 'grayscale(1)'; ctx.globalAlpha = .4; }
          art(item.challenge!.keepsakeKey, { x: box.x + 100, y: box.y + 116, width: 17, height: 17 }); ctx.restore();
          line(rating?.keepsake ? '已收藏' : '未收藏', { x: box.x + 120, y: box.y + 117, width: box.width - 128, height: 16 }, 11, !rating?.keepsake);
        }
        ctx.restore();
      });
      line((selection.page.index + 1) + '/' + selection.page.count, { x: panel.x + panel.width - 127, y: panel.y + 9, width: 25, height: 21 }, 11);
      for (const [name, key] of [['previous', ART.previous], ['next', ART.next]] as const) {
        const target = targets[names.indexOf(name)]; ctx.save(); if (!target.input!.enabled) ctx.globalAlpha = .35;
        const box = geometry[name]; art(key, { ...box, y: box.y + (pressed.has(target.name) ? 1 : 0) }); ctx.restore();
      }
      if (record.saveFailed || deliveryStore.load().saveFailed) line('暂未保存', { ...geometry.card, x: geometry.card.x + 5, width: geometry.card.width - 10 }, 11, true);
    } else if (mode === 'album') {
      const chapters = DELIVERY_CHAPTERS.filter(item => item.challenge);
      chapters.forEach((item, index) => {
        const box = geometry.albumSlots[index], collected = isDeliveryChallengeChapterId(item.id) && record.chapters[item.id]?.keepsake;
        ctx.save(); if (!collected) { ctx.filter = 'grayscale(1)'; ctx.globalAlpha = .42; }
        art(ART.slot, box); art(item.challenge!.keepsakeKey, { x: box.x + 13, y: box.y + 9, width: box.width - 26, height: box.height - 20 }); ctx.restore();
        if (!collected) art(ART.lock, { x: box.x + box.width - 26, y: box.y + box.height - 29, width: 18, height: 22 });
        line(['小风车', '小雨伞', '小灯塔'][index], { x: box.x - 5, y: box.y + 101, width: box.width + 10, height: 17 }, 13);
        line(collected ? '已收藏' : '未收藏', { x: box.x - 5, y: box.y + 121, width: box.width + 10, height: 16 }, 11, !collected);
      });
      line(record.saveFailed ? '暂未保存' : '先收集，再成功送达。', { x: panel.x + 24, y: panel.y + panel.height - 62, width: panel.width - 48, height: 16 }, 11, record.saveFailed);
    } else if (mode === 'success' && result) {
      const labels = ['送达', '四枚邮票', '隐藏纪念'], gap = 93;
      result.earned.forEach((flag, index) => {
        const x = panel.x + panel.width / 2 + (index - 1) * gap - 18;
        art(flag ? ART.gold : ART.gray, { x, y: panel.y + 39, width: 30, height: 30 });
        line(labels[index], { x: x - 25, y: panel.y + 69, width: 80, height: 16 }, 11, !flag);
      });
      art(chapter.postcardKey, { x: panel.x + 26, y: panel.y + 94, width: panel.width * .43, height: 83 });
      const x = panel.x + panel.width * .51, width = panel.width * .45 - 12;
      line('本局评价 ' + result.stars + '/3', { x, y: panel.y + 94, width, height: 20 }, 14);
      art(ART.counter, { x, y: panel.y + 122, width: 21, height: 21 });
      line('投递邮票 ' + result.ordinary + '/5', { x: x + 24, y: panel.y + 122, width: width - 24, height: 21 }, 12);
      art(chapter.challenge!.keepsakeKey, { x, y: panel.y + 151, width: 21, height: 21 });
      line(result.hidden ? '纪念邮票 已找到' : '纪念邮票 未找到', { x: x + 24, y: panel.y + 151, width: width - 24, height: 21 }, 11);
      if (saveFailed) line('暂未保存', { x: panel.x + 20, y: panel.y + panel.height - 62, width: panel.width - 40, height: 16 }, 11, true);
    } else if (mode === 'postcard' || mode === 'success') {
      const area = { x: panel.x + 26, y: panel.y + 43, width: panel.width - 52, height: panel.height - 124 - (saveFailed && mode === 'success' ? 17 : 0) };
      art(chapter.postcardKey, area);
      const ending = mode === 'success' ? chapter.successText : chapter.postcardText;
      deliveryRouteLines(ending, 30).forEach((value, i) => line(value, { x: panel.x + 20, y: panel.y + panel.height - 73 + i * 17, width: panel.width - 40, height: 17 }, 12));
      if (saveFailed && mode === 'success') line('本次已收好，暂未保存到设备', { x: panel.x + 20, y: panel.y + panel.height - 91, width: panel.width - 40, height: 16 }, 11, true);
    } else if (mode === 'brief') {
      const width = Math.min(160, panel.width * .39), x = panel.x + width + 27, columnWidth = panel.width - width - 49;
      art(chapter.previewKey, { x: panel.x + 22, y: panel.y + 52, width, height: 91 });
      chapter.introduction.forEach((value, i) => line(value, { x, y: panel.y + 47 + i * 19, width: columnWidth, height: 18 }, 12));
      deliveryRouteLines(chapter.itinerary, 16).forEach((value, i) => line(value, { x, y: panel.y + 110 + i * 16, width: columnWidth, height: 16 }, 11));
      line('轻触跳跃 · 上滑高跳', { x, y: panel.y + 150, width: columnWidth, height: 18 }, 11);
      line('下滑下蹲', { x, y: panel.y + 170, width: columnWidth, height: 18 }, 11);
      line(challenge ? '难度 ' + chapter.difficultyLabel : '约一分钟的小旅行', { x: panel.x + 20, y: panel.y + (challenge ? 144 : 154), width: width + 4, height: 19 }, 11);
      if (challenge) {
        for (const [index, key, label] of [[0, ART.counter, '四枚邮票'], [1, chapter.challenge!.keepsakeKey, '隐藏纪念']] as const) {
          const y = panel.y + 166 + index * 18;
          art(key, { x: panel.x + 31, y, width: 16, height: 16 });
          line(label, { x: panel.x + 51, y, width: 83, height: 16 }, 11);
          art(ART.gold, { x: panel.x + 135, y, width: 14, height: 14 });
        }
      }
    } else {
      line(chapter.failureText, { x: panel.x + 24, y: panel.y + 66, width: panel.width - 48, height: 22 }, 16);
      if (result) {
        line('投递邮票 ' + result.ordinary + '/5', { x: panel.x + 24, y: panel.y + 105, width: panel.width - 48, height: 20 }, 13);
        line(result.hidden ? '纪念邮票 已找到' : '纪念邮票 未找到', { x: panel.x + 24, y: panel.y + 132, width: panel.width - 48, height: 20 }, 12);
      }
      line('准备好了，就重新出发。', { x: panel.x + 24, y: panel.y + 169, width: panel.width - 48, height: 20 }, 12);
    }
    const labels: Record<string, string> = { back: mode === 'postcard' ? '返回' : mode === 'album' || inMailbox && mode === 'brief' ? '返回章节' : '返回邮箱',
      start: mode === 'brief' ? chapter.startLabel : '重新送一次', card: '查看明信片', album: '邮票册' };
    for (const name of ['back', 'start', 'card', 'album']) {
      const index = names.indexOf(name), target = targets[index]; if (!target.input?.enabled) continue;
      const box = boxes[index]; ctx.save(); if (pressed.has(target.name)) ctx.translate(0, 1);
      frame(ctx, ART.button, box, .16);
      if (name === 'album') art(ART.album, { x: box.x + 13, y: box.y + 6, width: 22, height: 22 });
      line(labels[name], { x: box.x + (name === 'album' ? 34 : 7), y: box.y + 3, width: box.width - (name === 'album' ? 44 : 14), height: box.height - 6 }, 12); ctx.restore();
    }
    Object.assign(surface.canvas.dataset, { mode, chapterId: chapter.id, page: String(selection.page.index), pageCount: String(selection.page.count),
      visibleChapterIds: JSON.stringify(mode === 'select' ? selection.page.items.map(item => item.id) : []), challenge: String(challenge),
      result: JSON.stringify(result ?? null), lines: JSON.stringify(lines), images: JSON.stringify(images), panel: JSON.stringify(panel),
      targets: JSON.stringify(boxes), targetNames: JSON.stringify(targets.map(target => target.name)), enabled: JSON.stringify(targets.map(target => !!target.input?.enabled)),
      pressed: JSON.stringify([...pressed]), saved: String(!saveFailed), albumCollected: JSON.stringify(DELIVERY_CHAPTERS.filter(item => item.challenge).map(item => isDeliveryChallengeChapterId(item.id) && !!record.chapters[item.id]?.keepsake)) });
  });
  const layout = () => {
    geometry = deliveryPanelLayout(scene.scale.gameSize, safeUiInsets(scene));
    const pageIds = selection.page.items.map(chapter => chapter.id);
    boxes = names.map(name => {
      if (!name.startsWith('chapter:')) return geometry[name as 'back' | 'start' | 'card' | 'blocker' | 'previous' | 'next' | 'album'];
      const index = pageIds.indexOf(name.slice(8) as DeliveryChapterId);
      return index >= 0 ? geometry.cards[index] : { x: 0, y: 0, width: 1, height: 1 };
    });
    targets.forEach((target, index) => {
      const box = boxes[index], name = names[index]; target.setPosition(box.x + box.width / 2, box.y + box.height / 2).setSize(box.width, box.height);
      target.input!.hitArea.setSize(box.width, box.height);
      target.input!.enabled = visible && (name === 'blocker' || name === 'back' ||
        name === 'start' && (mode === 'brief' || mode === 'success' || mode === 'failure') ||
        name === 'card' && (mode === 'success' && !!selection.chapter.challenge || mode === 'brief' && deliveryStore.load().completedIds.includes(selection.id)) ||
        name === 'previous' && mode === 'select' && selection.page.hasPrevious || name === 'next' && mode === 'select' && selection.page.hasNext ||
        name === 'album' && mode === 'select' || name.startsWith('chapter:') && mode === 'select' && pageIds.includes(name.slice(8) as DeliveryChapterId));
    });
    surface.invalidate();
  };
  const sound = () => { const audio = scene.registry.get('audioSystem') as AudioSystem | undefined; audio?.initializeAfterGesture(); audio?.play('button'); };
  const close = () => { if (!visible) return; visible = false; pressed.clear(); release?.(); release = undefined; layout(); surface.show(false); };
  const activate = (name: string) => {
    pressed.clear();
    if (name === 'back') {
      if (mode === 'postcard') { mode = cardReturn; layout(); return; }
      if (mode === 'album' || inMailbox && mode === 'brief') { mode = 'select'; layout(); return; }
      close(); actions.exit?.(); return;
    }
    if (name === 'start') { const id = selection.id; close(); actions.start(id); return; }
    if (name === 'card') { cardReturn = mode; mode = 'postcard'; }
    if (name === 'album') mode = 'album';
    if (name === 'previous') selection.movePage(-1);
    if (name === 'next') selection.movePage(1);
    if (name.startsWith('chapter:')) { selection.select(name.slice(8)); mode = 'brief'; }
    layout();
  };
  targets.forEach((target, index) => bindTouchTarget(scene, target, 1, 1, () => {
    if (!visible || !target.input?.enabled || index === 0) return; sound(); activate(names[index]);
  }, value => { value ? pressed.add(target.name) : pressed.delete(target.name); surface.invalidate(); }));
  const stopViewport = watchViewport(scene, layout);
  const cancelTouches = () => { scene.events.emit(MENU_MODAL_CANCEL); pressed.clear(); surface.invalidate(); };
  scene.events.on('pause', cancelTouches);
  const clear = () => {
    if (disposed) return; close(); disposed = true; stopViewport(); scene.events.off('pause', cancelTouches);
    scene.events.off('shutdown', clear); scene.events.off('destroy', clear); targets.forEach(target => target.destroy()); surface.destroy();
  };
  scene.events.once('shutdown', clear); scene.events.once('destroy', clear);
  return {
    show(next: DeliveryPanelMode, failedSave = false, selectedId?: string, result?: DeliveryChallengeSnapshot) {
      if (visible || disposed) return; if (selectedId) selection.select(selectedId);
      // Check all candidate text before taking the nested mailbox lease, so a failed font load cannot trap it.
      const chapter = selection.chapter;
      [...DELIVERY_EXPANSION_UI_TEXT, ...DELIVERY_CHAPTERS.flatMap(item => [item.title, item.itinerary, item.difficultyLabel ?? '轻松']),
        ...chapter.introduction, chapter.failureTitle, chapter.failureText, chapter.startLabel, chapter.postcardTitle, chapter.postcardText, chapter.successText,
        '0123456789/ ·'].forEach(value => text.fitFontSize(value, 1, 12));
      if (inMailbox) { const lease = acquireMenuModal(scene, 'delivery', targets, 'mailbox'); if (!lease) return; release = lease; }
      mode = next; saveFailed = failedSave; runResult = result; visible = true; pressed.clear();
      try { layout(); surface.show(true); } catch (error) { close(); throw error; }
    },
    close, clear, get chapterId() { return selection.id; }, get visible() { return visible; },
  };
}
