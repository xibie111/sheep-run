import type Phaser from 'phaser';
import { watchViewport } from '../game/Viewport';
import { safeUiInsets } from '../ui/UiLayout';
import { displayCanvasText } from '../ui/DisplayCanvasText';
import { bindTouchTarget } from '../ui/TouchTarget';
import { acquireMenuModal, menuModalOwner, MENU_MODAL_CANCEL, MENU_MODAL_CHANGE } from '../ui/MenuModal';
import type { ArtRect } from '../ui/MenuArtLayout';
import type { AudioSystem } from '../systems/AudioSystem';
import { mailReadStore } from '../systems/MailReadStore';
import { deliveryStore } from '../delivery/DeliveryStore';
import { deliveryChallengeStore } from '../delivery/DeliveryChallengeStore';
import { createDeliveryPanel } from '../delivery/DeliveryPanel';
import { createDeliveryDisplayOverlay } from '../delivery/DeliveryDisplayOverlay';
import { deliveryFitArt, deliveryFrameArt } from '../delivery/DeliveryPanelArt';
import { DELIVERY_EXPANSION_UI_KEYS as ART } from '../delivery/DeliveryExpansionUiAssets';
import type { DeliveryChapterId } from '../delivery/DeliveryChapters';
import { wrapMailParagraph } from '../ui/MailReader';
import { RESIDENTS } from './ResidentCatalog';
import { RESIDENT_UI_KEYS, RESIDENT_GROUP_PHOTO_KEY } from './residentAssets';
import { RESIDENT_LETTERS } from './ResidentLetters';
import { canOpenResidentLetter, reconcileResidentProgress } from './ResidentProgress';
import { ResidentPanelModel, RESIDENT_UI_TEXT } from './ResidentPanelModel';
import { residentPanelLayout, RESIDENT_READING_STYLE } from './ResidentPanelLayout';

/** One mailbox child lease owns list, details, letters and keepsakes; a brief may nest inside it. */
export function createResidentPanel(scene: Phaser.Scene, start: (chapterId: DeliveryChapterId) => void) {
  const text = displayCanvasText(scene), muted = displayCanvasText(scene, '#8a725e');
  const model = new ResidentPanelModel(() => ({ completedIds: deliveryStore.load().completedIds, readIds: mailReadStore.load().readIds }), mailReadStore);
  const names = ['blocker', 'back', 'letters', 'keepsake', 'group', 'brief', 'previous', 'next', 'keep',
    ...RESIDENTS.map(item => 'resident:' + item.id), ...[0, 1, 2].map(index => 'stage:' + index), ...RESIDENT_LETTERS.map(item => 'letter:' + item.id)];
  const targets = names.map(name => scene.add.container(0, 0, []).setScrollFactor(0).setDepth(name === 'blocker' ? 250 : 251).setName('resident-' + name));
  const pressed = new Set<string>();
  let geometry = residentPanelLayout(scene.scale.gameSize, safeUiInsets(scene));
  let visible = false, disposed = false, release: (() => void) | undefined;
  const boxes = new Map<string, ArtRect>();
  const trip = createDeliveryPanel(scene, { start: id => { close(); start(id); } }, true, undefined, 'residents');
  const surface = createDeliveryDisplayOverlay(scene, ctx => {
    const panel = geometry.panel, lines: unknown[] = [], images: unknown[] = [];
    const line = (value: string, box: ArtRect, font = 12, soft = false) => {
      const painter = soft ? muted : text;
      const painted = painter(ctx, value, box, font);
      lines.push({ text: value, box, ink: painted.ink, fontSize: painted.fontSize });
    };
    const wrap = (value: string, box: ArtRect, font = 12, soft = false) => {
      const rows = wrapMailParagraph(value, value => text.fitFontSize(value, box.width, font) >= font);
      rows.forEach((value, index) => line(value, { ...box, y: box.y + index * 15, height: 15 }, font, soft));
    };
    const art = (key: string, box: ArtRect) => images.push(deliveryFitArt(scene, ctx, key, box));
    const frame = (box: ArtRect, key: string = RESIDENT_UI_KEYS.card) => deliveryFrameArt(scene, ctx, key, box);
    const button = (name: string, label: string) => {
      const target = targets[names.indexOf(name)], box = boxes.get(name)!;
      ctx.save(); if (!target.input?.enabled) ctx.globalAlpha = .5;
      if (pressed.has(name)) ctx.translate(0, 1);
      frame(box, ART.button); line(label, { x: box.x + 5, y: box.y + 3, width: box.width - 10, height: box.height - 6 }); ctx.restore();
    };
    ctx.fillStyle = 'rgba(24,30,34,.62)'; ctx.fillRect(0, 0, scene.scale.gameSize.width, scene.scale.gameSize.height);
    frame(panel, RESIDENT_UI_KEYS.paper);
    frame({ x: panel.x + 64, y: panel.y + 4, width: panel.width - 128, height: 29 }, ART.button);
    const selected = model.selected;
    const title = model.mode === 'list' ? '居民故事' : model.mode === 'letters' ? '居民来信' : model.mode === 'read' ? model.reader.letter!.title
      : model.mode === 'group' ? '牧场居民合照' : model.mode === 'keepsake' ? selected!.resident.name + ' · 纪念插画' : selected!.resident.name + ' · ' + selected!.resident.role;
    line(title, model.mode === 'read' ? geometry.readTitle : geometry.title, model.mode === 'read' ? 16 : 18);
    if (model.mode === 'list') {
      model.progress.residents.forEach((progress, index) => {
        const box = geometry.residents[index]; frame(box);
        art(progress.resident.portraitKey, { x: box.x + (box.width - 40) / 2, y: box.y, width: 40, height: 40 });
        line(progress.resident.name, { x: box.x + 7, y: box.y + 38, width: box.width - 14, height: 18 }, 16);
        line(progress.resident.role, { x: box.x + 5, y: box.y + 57, width: box.width - 10, height: 15 });
        line('故事进度 ' + progress.completedCount + '/3', { x: box.x + 4, y: box.y + 74, width: box.width - 8, height: 15 });
        wrap(progress.currentStage?.title ?? '故事已完成', { x: box.x + 8, y: box.y + 90, width: box.width - 16, height: 30 });
        line(progress.unreadCount ? '未读回信 ' + progress.unreadCount : '没有未读回信', geometry.residentUnread[index], 12, !progress.unreadCount);
      });
      button('letters', '居民来信'); button('group', model.progress.groupPhotoUnlocked ? '牧场居民合照' : '合照尚未解锁');
    } else if (model.mode === 'detail' && selected) {
      art(selected.resident.portraitKey, { x: panel.x + 22, y: panel.y + 42, width: 51, height: 43 });
      wrap(selected.resident.description, { x: panel.x + 84, y: panel.y + 46, width: panel.width - 105, height: 33 });
      selected.stages.forEach((progress, index) => {
        const box = geometry.stages[index]; ctx.save(); if (!progress.unlocked) ctx.globalAlpha = .5;
        frame(box, model.stageIndex === index ? ART.button : ART.frame);
        const status = progress.completed ? '已完成' : progress.unlocked ? '可出发' : '尚未解锁';
        line(String(index + 1) + ' · ' + progress.stage.title, { x: box.x + 11, y: box.y + 4, width: box.width - 113, height: 21 }, 12);
        line(status, { x: box.x + box.width - 88, y: box.y + 4, width: 76, height: 21 }, 12, !progress.unlocked); ctx.restore();
      });
      if (!selected.completed) line('后续委托只需完成上一段', { x: panel.x + 20, y: panel.y + 190, width: panel.width - 40, height: 16 }, 12, true);
      button('letters', '居民来信'); button('keepsake', '纪念插画'); button('brief', '查看委托');
    } else if (model.mode === 'letters') {
      const read = mailReadStore.load().readIds;
      model.letters.items.forEach((letter, index) => {
        const box = geometry.letters[index], unlocked = canOpenResidentLetter(letter.id, deliveryStore.load().completedIds);
        ctx.save(); if (!unlocked) ctx.globalAlpha = .5; frame(box);
        line(letter.title, { x: box.x + 10, y: box.y + 3, width: box.width - 95, height: 19 }, 14);
        line(unlocked ? read.includes(letter.id) ? '已读' : '未读' : '尚未解锁', { x: box.x + box.width - 81, y: box.y + 3, width: 70, height: 19 }, 12, !unlocked || read.includes(letter.id));
        line(unlocked ? RESIDENTS.find(resident => resident.stages.some(stage => stage.letterId === letter.id))!.name : '完成对应委托后收到回信', { x: box.x + 10, y: box.y + 23, width: box.width - 20, height: 16 }, 12, true); ctx.restore();
      });
      frame(geometry.readPage, ART.button);
      line((model.letters.index + 1) + ' / ' + model.letters.count, geometry.readPage);
    } else if (model.mode === 'read') {
      const body = geometry.readBody;
      for (const row of model.reader.pages[model.reader.page] ?? []) {
        const size = RESIDENT_READING_STYLE.fontSize;
        const width = size / text.fitFontSize(row.text, 1, size);
        line(row.text, { x: row.signature ? body.x + body.width - width : body.x, y: body.y + row.y, width, height: row.height }, size);
      }
      frame(geometry.readPage, ART.button);
      line((model.reader.page + 1) + ' / ' + model.reader.pages.length, geometry.readPage);
      if (model.reader.canKeep) button('keep', '收好这封信');
    } else if (model.mode === 'keepsake' || model.mode === 'group') {
      art(model.mode === 'group' ? RESIDENT_GROUP_PHOTO_KEY : selected!.resident.keepsakeKey, geometry.illustration);
    }
    if (model.mode === 'letters' || model.mode === 'read') for (const [name, key] of [['previous', ART.previous], ['next', ART.next]] as const) {
      ctx.save(); if (!targets[names.indexOf(name)].input?.enabled) ctx.globalAlpha = .4;
      art(key, boxes.get(name)!); ctx.restore();
    }
    button('back', model.mode === 'list' ? '返回邮箱' : '返回');
    const saveFailed = mailReadStore.load().saveFailed || deliveryStore.load().saveFailed || deliveryChallengeStore.load().saveFailed;
    if (saveFailed) line('暂未保存', geometry.saveNotice, 12);
    Object.assign(surface.canvas.dataset, { mode: model.mode, residentId: model.residentId ?? '', stageIndex: String(model.stageIndex),
      letterId: model.reader.letter?.id ?? '', page: String(model.mode === 'read' ? model.reader.page : model.letters.index),
      pageCount: String(model.mode === 'read' ? model.reader.pages.length : model.letters.count), saveFailed: String(saveFailed),
      progress: JSON.stringify(model.progress), lines: JSON.stringify(lines), images: JSON.stringify(images),
      targets: JSON.stringify(Object.fromEntries(boxes)), enabled: JSON.stringify(targets.filter(target => target.input?.enabled).map(target => target.name)) });
  });
  surface.canvas.dataset.adventureOverlay = 'resident-panel'; surface.canvas.style.zIndex = '13';
  const layout = () => {
    geometry = residentPanelLayout(scene.scale.gameSize, safeUiInsets(scene));
    const { fontSize, lineHeight, paragraphGap } = RESIDENT_READING_STYLE;
    model.reader.relayout(value => text.fitFontSize(value, geometry.readBody.width, fontSize) >= fontSize, geometry.readBody.height, lineHeight, paragraphGap);
    const active = visible && menuModalOwner(scene) === 'residents';
    for (let i = 0; i < names.length; i++) {
      const name = names[i], target = targets[i]; let box: ArtRect = { x: 0, y: 0, width: 1, height: 1 }, enabled = false;
      if (name === 'blocker') { box = geometry.blocker; enabled = true; }
      else if (name === 'back') { box = geometry.back; enabled = true; }
      else if (name === 'letters') { box = geometry.lettersButton; enabled = model.mode === 'list' || model.mode === 'detail'; }
      else if (name === 'group') { box = geometry.group; enabled = model.mode === 'list' && model.progress.groupPhotoUnlocked; }
      else if (name === 'keepsake') { box = geometry.artButton; enabled = model.mode === 'detail' && !!model.selected?.keepsakeUnlocked; }
      else if (name === 'brief') { box = geometry.brief; enabled = model.mode === 'detail' && !!model.selectedStage?.unlocked; }
      else if (name === 'keep') { box = geometry.keep; enabled = model.mode === 'read' && model.reader.canKeep; }
      else if (name === 'previous' || name === 'next') {
        box = geometry[name]; enabled = model.mode === 'letters' ? name === 'previous' ? model.letters.hasPrevious : model.letters.hasNext
          : model.mode === 'read' && (name === 'previous' ? model.reader.page > 0 : model.reader.page < model.reader.pages.length - 1);
      } else if (name.startsWith('resident:')) { box = geometry.residents[RESIDENTS.findIndex(item => item.id === name.slice(9))]; enabled = model.mode === 'list'; }
      else if (name.startsWith('stage:')) { const index = Number(name.slice(6)); box = geometry.stages[index]; enabled = model.mode === 'detail' && !!model.selected?.stages[index]?.unlocked; }
      else if (name.startsWith('letter:')) {
        const index = model.letters.items.findIndex(item => item.id === name.slice(7));
        if (index >= 0) box = geometry.letters[index];
        enabled = model.mode === 'letters' && index >= 0 && canOpenResidentLetter(name.slice(7), deliveryStore.load().completedIds);
      }
      boxes.set(name, box); target.setPosition(box.x + box.width / 2, box.y + box.height / 2).setSize(box.width, box.height);
      target.input!.hitArea.setSize(box.width, box.height); target.input!.enabled = active && enabled;
    }
    surface.invalidate(); surface.show(active);
  };
  const sound = () => { const audio = scene.registry.get('audioSystem') as AudioSystem | undefined; audio?.initializeAfterGesture(); audio?.play('button'); };
  const close = () => {
    if (!visible) return; trip.close(); visible = false; model.reset(); pressed.clear(); release?.(); release = undefined; layout();
  };
  const activate = (name: string) => {
    if (name === 'back' && !model.back()) { close(); return; }
    if (name === 'letters') model.showLetters();
    if (name === 'keepsake') model.showKeepsake();
    if (name === 'group') model.showGroup();
    if (name === 'brief' && model.selectedStage?.unlocked) trip.show('brief', false, model.selectedStage.stage.chapterId);
    if (name === 'keep') model.keepLetter();
    if (name === 'previous' || name === 'next') { const delta = name === 'previous' ? -1 : 1; if (model.mode === 'read') model.reader.flip(delta); else model.moveLetters(delta); }
    if (name.startsWith('resident:')) model.selectResident(name.slice(9));
    if (name.startsWith('stage:')) model.selectStage(Number(name.slice(6)));
    if (name.startsWith('letter:')) model.openLetter(name.slice(7));
    pressed.clear(); layout();
  };
  targets.forEach((target, index) => bindTouchTarget(scene, target, 1, 1, () => {
    if (!visible || menuModalOwner(scene) !== 'residents' || !target.input?.enabled || index === 0) return;
    sound(); activate(names[index]);
  }, value => { value ? pressed.add(names[index]) : pressed.delete(names[index]); surface.invalidate(); }));
  const stopViewport = watchViewport(scene, layout);
  const modalChanged = () => layout(); scene.events.on(MENU_MODAL_CHANGE, modalChanged);
  const cancel = () => { scene.events.emit(MENU_MODAL_CANCEL); pressed.clear(); surface.invalidate(); };
  scene.events.on('pause', cancel);
  const clear = () => {
    if (disposed) return; close(); disposed = true; trip.clear(); stopViewport(); surface.destroy(); targets.forEach(target => target.destroy());
    scene.events.off(MENU_MODAL_CHANGE, modalChanged); scene.events.off('pause', cancel); scene.events.off('shutdown', clear); scene.events.off('destroy', clear);
  };
  scene.events.once('shutdown', clear); scene.events.once('destroy', clear);
  return { show() {
    if (visible || disposed) return false;
    [...RESIDENT_UI_TEXT, ...RESIDENT_LETTERS.flatMap(letter => [letter.title, ...letter.paragraphs, letter.signature]),
      ...RESIDENTS.flatMap(item => [item.name, item.role, item.description, ...item.stages.map(stage => stage.title)])].forEach(value => text.fitFontSize(value, 1, 12));
    reconcileResidentProgress(deliveryStore, deliveryChallengeStore); mailReadStore.retrySave();
    const lease = acquireMenuModal(scene, 'residents', targets, 'mailbox'); if (!lease) return false;
    release = lease; visible = true; model.reset();
    try { layout(); } catch (error) { close(); throw error; } return true;
  }, close, clear, get visible() { return visible; } };
}
