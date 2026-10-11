import type Phaser from "phaser";
import { MAIL_LETTERS } from "../data/mailLetters";
import { MAILBOX_ART, MAIL_PANEL_ART, MAIL_BUTTON_ART } from "../data/mailboxAssets";
import { mailReadStore } from "../systems/MailReadStore";
import { AudioSystem } from "../systems/AudioSystem";
import { viewportOffsetY, viewportSizeFromScale, watchViewport, type ViewportSize } from "../game/Viewport";
import { safeUiInsets } from "./UiLayout";
import { bindTouchTarget } from "./TouchTarget";
import { createDisplayOverlay } from "./DisplayOverlay";
import { displayCanvasText } from "./DisplayCanvasText";
import type { ArtRect } from "./MenuArtLayout";
import { MailReader } from "./MailReader";
import { mailLayout } from "./MailLayout";
import { acquireMenuModal, menuModalOwner, MENU_MODAL_CHANGE } from "./MenuModal";
import { createDeliveryPanel } from '../delivery/DeliveryPanel';
import { DELIVERY_ID } from '../delivery/DeliveryRoute';
import { SCENE } from '../game/Constants';

/** A small pasture prop and a touch-only reader on the existing display surface. */
export function attachMailbox(scene: Phaser.Scene, initiallyOpen = false): void {
  if (!scene.game.canvas?.parentElement || !scene.game.events) return;
  const text = displayCanvasText(scene), muted = displayCanvasText(scene, "#8a725e");
  const reader = new MailReader(MAIL_LETTERS, mailReadStore);
  let open = false, release: (() => void) | undefined;
  let snapshot = mailReadStore.load(), panel: ArtRect, body: ArtRect, prop: ArtRect, hit: ArtRect;
  let card: ReturnType<typeof mailLayout>;
  const boxes = new Map<string, ArtRect>(), pressed = new Set<string>();
  const target = (name: string, depth: number) => scene.add.container(0, 0, []).setName(name).setDepth(depth);
  const entry = target("mailbox-entry", 9), blocker = target("mailbox-blocker", 240);
  const close = target("button:合上邮箱", 242), back = target("mailbox-back", 242);
  const prev = target("mailbox-prev", 242), next = target("mailbox-next", 242), keep = target("mailbox-keep", 242);
  const letters = MAIL_LETTERS.map(letter => target(`mailbox-letter:${letter.id}`, 242));
  const delivery = target('mailbox-delivery', 242);
  const trip = createDeliveryPanel(scene, { start: () => scene.scene.start(SCENE.run, { deliveryId: DELIVERY_ID }) }, true);
  const modal = [blocker, close, back, prev, next, keep, delivery, ...letters];
  const sound = () => { const audio = scene.registry.get("audioSystem") as AudioSystem | undefined; audio?.initializeAfterGesture(); audio?.play("button"); };
  const place = (object: Phaser.GameObjects.Container, box: ArtRect) => {
    boxes.set(object.name, box); object.setPosition(box.x + box.width / 2, box.y + box.height / 2).setSize(box.width, box.height);
    object.input!.hitArea.setSize(box.width, box.height);
  };
  const art = scene.textures.get(MAILBOX_ART.key).getSourceImage() as HTMLImageElement;
  const paper = scene.textures.get(MAIL_PANEL_ART.key).getSourceImage() as HTMLImageElement;
  const buttonImage = (ctx: CanvasRenderingContext2D, box: ArtRect, key: string) => {
    const image = scene.textures.get(key).getSourceImage() as HTMLImageElement, corner = key === MAIL_BUTTON_ART.floral ? 72 : 44, width = corner * box.height / image.height;
    ctx.drawImage(image, 0, 0, corner, image.height, box.x, box.y, width, box.height);
    ctx.drawImage(image, corner, 0, image.width - 2 * corner, image.height, box.x + width, box.y, box.width - 2 * width, box.height);
    ctx.drawImage(image, image.width - corner, 0, corner, image.height, box.x + box.width - width, box.y, width, box.height);
  };
  const surface = createDisplayOverlay(scene, "mailbox", ctx => {
    const lines: { text: string; box: ArtRect; ink: ArtRect; fontSize: number; paragraph?: number; signature?: boolean }[] = [];
    const line = (value: string, box: ArtRect, font = 12, soft = false, detail = {}) => {
      const painter = soft ? muted : text, result = painter(ctx, value, box, painter.fitFontSize(value, box.width, font));
      lines.push({ text: value, box, ink: result.ink, fontSize: result.fontSize, ...detail });
    };
    const button = (object: Phaser.GameObjects.Container, label: string, primary = false) => {
      const box = boxes.get(object.name)!;
      ctx.save(); if (!object.input!.enabled) ctx.globalAlpha = .45;
      if (pressed.has(object.name)) ctx.translate(0, 1);
      buttonImage(ctx, box, primary ? MAIL_BUTTON_ART.floral : MAIL_BUTTON_ART.plain);
      line(label, { x: box.x + 5, y: box.y + 3, width: box.width - 10, height: box.height - 6 }, 12);
      ctx.restore();
    };
    const unread = MAIL_LETTERS.some(letter => !snapshot.readIds.includes(letter.id));
    if (!open && !menuModalOwner(scene)) {
      const x = prop.x, y = prop.y;
      ctx.drawImage(art, x, y, prop.width, prop.height);
      // The same pivot and base sprite keep the two states perfectly registered.
      ctx.fillStyle = "#513723";
      if (unread) {
        ctx.fillRect(x + 16, y + 3, 2, 11); ctx.fillRect(x + 16, y + 3, 7, 5);
        ctx.fillStyle = "#d47858"; ctx.fillRect(x + 17, y + 4, 5, 3);
        ctx.fillStyle = "#513723"; ctx.fillRect(x + 4, y + 5, 7, 5);
        ctx.fillStyle = "#fff0c9"; ctx.fillRect(x + 5, y + 6, 5, 3);
        ctx.fillStyle = "#c6a574"; ctx.fillRect(x + 6, y + 7, 3, 1);
      } else {
        ctx.fillRect(x + 16, y + 12, 8, 2); ctx.fillRect(x + 20, y + 12, 5, 5);
        ctx.fillStyle = "#d47858"; ctx.fillRect(x + 21, y + 13, 3, 3);
      }
      if (scene.data.get("menu-bedtime") === true || pressed.has(entry.name)) {
        ctx.save(); ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = scene.data.get("menu-bedtime") === true ? "rgba(42,46,72,.30)" : "rgba(255,222,163,.18)";
        ctx.fillRect(x, y, prop.width, prop.height); ctx.restore();
      }
    }
    if (open && menuModalOwner(scene) !== 'delivery') {
      const size = scene.scale.gameSize;
      ctx.fillStyle = "rgba(29,32,27,.48)"; ctx.fillRect(0, 0, size.width, size.height);
      ctx.drawImage(paper, panel.x, panel.y, panel.width, panel.height);
      if (!reader.letter) {
        line("给催眠羊的", { ...card.title, y: panel.y + 25 * card.k, height: 13 }, 12);
        line("小邮局", { ...card.title, y: panel.y + 39 * card.k, height: 16 }, 16);
        MAIL_LETTERS.forEach((letter, index) => {
          const object = letters[index], box = boxes.get(object.name)!, read = snapshot.readIds.includes(letter.id);
          buttonImage(ctx, box, MAIL_BUTTON_ART.plain);
          line(letter.title, { x: box.x + 12, y: box.y + 3, width: box.width - 64, height: box.height - 6 }, 16);
          line(read ? "已读" : "未读", { x: box.x + box.width - 46, y: box.y + 3, width: 34, height: box.height - 6 }, 12, read);
        });
        button(delivery, '送信小旅行');
        button(close, "合上邮箱");
      } else {
        line(reader.letter.title, card.title, 18);
        line(`${reader.page + 1} / ${reader.pages.length}`, card.pageCount, 11);
        for (const row of reader.pages[reader.page] ?? []) {
          const width = 12 / text.fitFontSize(row.text, 1, 12);
          line(row.text, { x: row.signature ? body.x + body.width - width : body.x, y: body.y + row.y, width, height: row.height }, 12, false, { paragraph: row.paragraph, signature: row.signature });
        }
        button(back, "返回");
        if (reader.page > 0) button(prev, "上一页");
        if (reader.canKeep) button(keep, "收好这封信", true);
        else button(next, "下一页", true);
      }
    }
    Object.assign(surface.canvas.dataset, {
      open: String(open), mode: reader.letter ? "read" : "list", letter: reader.letter?.id ?? "", page: String(reader.page), pages: String(reader.pages.length),
      unread: String(unread), readIds: JSON.stringify(snapshot.readIds), saveFailed: String(snapshot.saveFailed), lines: JSON.stringify(lines),
      prop: JSON.stringify(prop), hit: JSON.stringify(hit), panel: JSON.stringify(panel), body: JSON.stringify(body), targets: JSON.stringify(Object.fromEntries(boxes)),
    });
  }, 12);
  const updateTargets = () => {
    const owner = menuModalOwner(scene), active = open && owner === "mailbox", reading = Boolean(reader.letter);
    entry.input!.enabled = !open && !owner;
    modal.forEach(object => object.input!.enabled = false);
    blocker.input!.enabled = active; close.input!.enabled = active && !reading;
    letters.forEach(object => object.input!.enabled = active && !reading);
    delivery.input!.enabled = active && !reading;
    back.input!.enabled = active && reading;
    prev.input!.enabled = active && reading && reader.page > 0;
    next.input!.enabled = active && reading && reader.page < reader.pages.length - 1;
    keep.input!.enabled = active && reader.canKeep;
  };
  const layout = (size: ViewportSize) => {
    const safe = safeUiInsets(scene);
    card = mailLayout(size.width, size.height, safe); panel = card.panel; body = card.body;
    prop = { x: Math.round(size.width - safe.right - 130 - MAILBOX_ART.width / 2), y: 201 + viewportOffsetY(size) - MAILBOX_ART.height, width: MAILBOX_ART.width, height: MAILBOX_ART.height };
    hit = { x: prop.x - 8, y: prop.y - 4, width: 44, height: 66 }; place(entry, hit);
    place(blocker, { x: 0, y: 0, width: size.width, height: size.height });
    letters.forEach((object, index) => place(object, card.rows[index]));
    place(close, card.close);
    place(delivery, { x: panel.x + 22 * card.k, y: panel.y + 160 * card.k, width: panel.width - 44 * card.k, height: 25 * card.k });
    reader.relayout(value => text.fitFontSize(value, body.width, 12) >= 12, body.height, 17, 10);
    place(back, reader.page > 0 ? card.headerBack : card.left);
    place(prev, card.left); place(next, card.right); place(keep, card.right);
    updateTargets(); surface.invalidate();
  };
  const changed = () => { snapshot = mailReadStore.load(); pressed.clear(); layout(viewportSizeFromScale(scene.scale)); };
  const feedback = (name: string) => (value: boolean) => { value ? pressed.add(name) : pressed.delete(name); surface.invalidate(); };
  const showMailbox = () => {
    const lease = acquireMenuModal(scene, "mailbox", modal); if (!lease) return;
    release = lease; open = true; reader.back(); sound(); changed();
  };
  bindTouchTarget(scene, entry, 44, 66, showMailbox, feedback(entry.name));
  bindTouchTarget(scene, delivery, 1, 1, () => { sound(); trip.show('brief'); }, feedback(delivery.name));
  bindTouchTarget(scene, blocker, 1, 1, () => {}, () => {});
  bindTouchTarget(scene, close, 144, 32, () => { open = false; reader.back(); release?.(); release = undefined; sound(); changed(); }, feedback(close.name));
  letters.forEach((object, i) => bindTouchTarget(scene, object, 1, 1, () => { if (reader.open(MAIL_LETTERS[i].id)) { sound(); changed(); } }, feedback(object.name)));
  bindTouchTarget(scene, back, 62, 32, () => { reader.back(); sound(); changed(); }, feedback(back.name));
  for (const [object, direction] of [[prev, -1], [next, 1]] as const) bindTouchTarget(scene, object, 72, 32, () => { reader.flip(direction); sound(); changed(); }, feedback(object.name));
  bindTouchTarget(scene, keep, 142, 32, () => { if (reader.keep()) { sound(); changed(); } }, feedback(keep.name));
  modal.forEach(object => object.input!.enabled = false);
  watchViewport(scene, layout);
  const modalChanged = () => { updateTargets(); surface.invalidate(); };
  scene.events.on(MENU_MODAL_CHANGE, modalChanged);
  let lastNight = scene.data.get("menu-bedtime");
  const night = () => { const value = scene.data.get("menu-bedtime"); if (value !== lastNight) { lastNight = value; surface.invalidate(); } };
  scene.events.on("postupdate", night);
  scene.events.once("shutdown", () => { scene.events.off(MENU_MODAL_CHANGE, modalChanged); scene.events.off("postupdate", night); open = false; release = undefined; });
  surface.show(true);
  if (initiallyOpen) showMailbox();
}
