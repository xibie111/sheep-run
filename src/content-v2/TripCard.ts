import type Phaser from "phaser";
import { isSkinId, sheepTextureKey } from "../data/sheepSkins";
import { watchViewport } from "../game/Viewport";
import { displayCanvasText, type DisplayCanvasPainter } from "../ui/DisplayCanvasText";
import { sizeDisplaySurface } from "../ui/DisplaySurface";
import { acquireMenuModal, menuModalOwner, MENU_MODAL_CHANGE, MENU_MODAL_CANCEL } from "../ui/MenuModal";
import type { ArtRect } from "../ui/MenuArtLayout";
import { bindTouchTarget } from "../ui/TouchTarget";
import { safeUiInsets } from "../ui/UiLayout";
import { CONTENT_V2_KEYS } from "./assetManifest";
import { fitTripArt, tripCardLayout, type TripCardLayout } from "./TripCardLayout";
import { tripCardModel, wrapTripText, type TripCardInput, type TripCardModel, type TripHighlightKind } from "./TripCardModel";

export interface TripCardOptions {
  onClose?: () => void;
  /** Only use when A intentionally opens this as a child of an existing modal. */
  parentModalOwner?: string;
}
export interface TripCardView {
  show(input?: TripCardInput): boolean;
  hide(): void;
  update(input: TripCardInput): void;
  destroy(): void;
  isOpen(): boolean;
  getLayout(): TripCardLayout;
}

const MODAL_OWNER = "content-v2-trip";
const STAMPS: Record<TripHighlightKind, string> = {
  record: CONTENT_V2_KEYS.stampRecord, collection: CONTENT_V2_KEYS.stampCollection,
  goal: CONTENT_V2_KEYS.stampGoal, companion: CONTENT_V2_KEYS.stampCompanion,
  animal: CONTENT_V2_KEYS.stampAnimal, landmark: CONTENT_V2_KEYS.stampLandmark,
};

/** Independent ResultScene modal. It only presents A's immutable current-run facts. */
export function createTripCard(scene: Phaser.Scene, input: TripCardInput = {}, options: TripCardOptions = {}): TripCardView {
  const parent = scene.game.canvas.parentElement;
  if (!parent) throw new Error("Trip card needs the game's canvas parent");
  const required = [CONTENT_V2_KEYS.tripPaper, CONTENT_V2_KEYS.close, ...Object.values(STAMPS)];
  const missing = required.filter(key => !scene.textures.exists(key));
  if (missing.length) throw new Error(`Trip card textures not preloaded: ${missing.join(", ")}`);
  const paper = scene.textures.get(CONTENT_V2_KEYS.tripPaper).getSourceImage() as HTMLImageElement;
  const text = displayCanvasText(scene), muted = displayCanvasText(scene, "#8a725e");
  // Report missing shared-font glyphs before taking input ownership, so a failed
  // integration cannot leave the result page locked behind a half-painted card.
  const preflight = (value: TripCardModel) => {
    const copy = [value.title, value.summary, "收好旅行卡", ...value.highlights.map(item => item.text)];
    if (value.protagonist) copy.push(value.protagonist.name);
    if (!value.highlights.length) copy.push(value.footer);
    for (const line of copy) text.fitFontSize(line, 1, Number.MAX_VALUE);
  };
  let model = tripCardModel(input), open = false, destroyed = false, paused = false, pressed = false;
  let revision = 0, previous = "", release: (() => void) | undefined;
  let layout: TripCardLayout;
  const canvas = document.createElement("canvas");
  canvas.dataset.contentV2Overlay = "trip-card";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", margin: "0", padding: "0", pointerEvents: "none", zIndex: "12", imageRendering: "pixelated", display: "none" });
  parent.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const blocker = scene.add.container(0, 0, []).setName("content-v2-trip-blocker").setDepth(320);
  const close = scene.add.container(0, 0, []).setName("button:收好旅行卡").setDepth(322);
  const targets = [blocker, close];
  const active = () => open && !paused && !scene.scene.isPaused() && menuModalOwner(scene) === MODAL_OWNER;
  const invalidate = () => { revision++; };
  const art = (key: string, box: ArtRect) => {
    const image = scene.textures.get(key).getSourceImage() as HTMLImageElement;
    const fitted = fitTripArt(image.width, image.height, box);
    ctx.drawImage(image, 0, 0, image.width, image.height, fitted.x, fitted.y, fitted.width, fitted.height);
  };
  const sync = () => {
    const value = active();
    targets.forEach(target => { if (target.input) target.input.enabled = value; });
    canvas.style.display = value ? "block" : "none";
    invalidate();
  };
  const hide = () => {
    if (!open) return;
    open = false; pressed = false;
    targets.forEach(target => { if (target.input) target.input.enabled = false; });
    release?.(); release = undefined;
    canvas.style.display = "none";
    scene.data.set("content-v2-trip-open", false);
    invalidate();
  };
  bindTouchTarget(scene, blocker, 1, 1, () => {}, () => {});
  bindTouchTarget(scene, close, 108, 34, () => {
    if (!active()) return;
    hide(); options.onClose?.();
  }, value => { pressed = active() && value; invalidate(); });
  targets.forEach(target => { target.input!.enabled = false; });
  const place = (target: Phaser.GameObjects.Container, box: ArtRect) => {
    target.setPosition(box.x + box.width / 2, box.y + box.height / 2).setSize(box.width, box.height);
    target.input!.hitArea.setSize(box.width, box.height);
  };
  const stopViewport = watchViewport(scene, size => {
    layout = tripCardLayout(size, safeUiInsets(scene), paper.width / paper.height);
    place(close, layout.close);
    place(blocker, { x: 0, y: 0, width: size.width, height: size.height });
    invalidate();
  });
  const paint = () => {
    if (destroyed || !active()) return;
    const rect = scene.game.canvas.getBoundingClientRect(), size = scene.scale.gameSize;
    const state = JSON.stringify([rect.x, rect.y, rect.width, rect.height, size.width, size.height, window.devicePixelRatio, revision]);
    if (previous === state) return;
    previous = state;
    const factor = sizeDisplaySurface(canvas, scene.game.canvas, parent, size.width);
    ctx.setTransform(factor, 0, 0, factor, 0, 0); ctx.imageSmoothingEnabled = false;
    const lines: { text: string; box: ArtRect; ink: ArtRect; fontSize: number }[] = [];
    const line = (value: string, box: ArtRect, fontSize: number, soft = false) => {
      const painter = soft ? muted : text;
      const result = painter(ctx, value, box, painter.fitFontSize(value, box.width, fontSize));
      lines.push({ text: value, box, ink: result.ink, fontSize: result.fontSize });
    };
    const paragraph = (value: string, box: ArtRect, fontSize: number, maximumLines: number, soft = false) => {
      const painter: DisplayCanvasPainter = soft ? muted : text;
      const rows = wrapTripText(value, box.width, value => fontSize / painter.fitFontSize(value, 1, Number.MAX_VALUE), maximumLines);
      const rowHeight = box.height / maximumLines;
      rows.forEach((value, i) => line(value, { x: box.x, y: box.y + i * rowHeight, width: box.width, height: rowHeight }, fontSize, soft));
    };
    ctx.fillStyle = "rgba(32,35,36,.65)"; ctx.fillRect(0, 0, size.width, size.height);
    art(CONTENT_V2_KEYS.tripPaper, layout.panel);
    const k = layout.scale;
    line(model.title, layout.title, 20 * k);
    const hero = model.protagonist;
    let portraitVisible = false;
    if (hero && isSkinId(hero.id)) {
      const key = sheepTextureKey(hero.id);
      if (scene.textures.exists(key) && scene.textures.get(key).has("0")) {
        const texture = scene.textures.get(key), frame = texture.get(0);
        const image = texture.getSourceImage() as HTMLImageElement;
        const fitted = fitTripArt(frame.cutWidth, frame.cutHeight, layout.portrait);
        ctx.drawImage(image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, fitted.x, fitted.y, fitted.width, fitted.height);
        portraitVisible = true;
      }
    }
    if (hero) paragraph(hero.name, layout.protagonistName, 10.5 * k, 2);
    const seasonLabels = ({ spring: "春", summer: "夏", autumn: "秋", winter: "冬" } as const);
    const seasonCopy = model.seasons.map(id => seasonLabels[id]).join(" · ");
    if (seasonCopy) line(seasonCopy, layout.seasons, 10 * k, true);
    paragraph(model.summary, layout.summary, 11 * k, 3);
    model.highlights.forEach((highlight, index) => {
      const box = layout.highlights[index];
      paragraph(highlight.text, box.text, 11 * k, box.text.height >= 23 * k ? 2 : 1);
      art(STAMPS[highlight.kind], box.stamp);
    });
    if (!model.highlights.length) paragraph(model.footer, layout.highlights[0].text, 11 * k, 1, true);
    ctx.save(); if (pressed) ctx.translate(0, k);
    art(CONTENT_V2_KEYS.close, layout.close);
    if (pressed) {
      ctx.save(); ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = "rgba(151,86,42,.16)";
      ctx.fillRect(layout.close.x, layout.close.y, layout.close.width, layout.close.height); ctx.restore();
    }
    line("收好旅行卡", { x: layout.close.x + 5 * k, y: layout.close.y + 3 * k, width: layout.close.width - 10 * k, height: layout.close.height - 6 * k }, 11 * k);
    ctx.restore();
    canvas.dataset.open = String(open); canvas.dataset.model = JSON.stringify(model);
    canvas.dataset.lines = JSON.stringify(lines); canvas.dataset.layout = JSON.stringify(layout);
    canvas.dataset.portraitVisible = String(portraitVisible);
    canvas.dataset.pressed = String(pressed);
  };
  const pause = () => { paused = true; pressed = false; scene.events.emit(MENU_MODAL_CANCEL); sync(); };
  const resume = () => { paused = false; previous = ""; sync(); paint(); };
  const modalChanged = () => { if (!destroyed) sync(); };
  const destroy = () => {
    if (destroyed) return;
    hide(); destroyed = true;
    scene.game.events.off("postrender", paint);
    scene.events.off("pause", pause); scene.events.off("sleep", pause);
    scene.events.off("resume", resume); scene.events.off("wake", resume);
    scene.events.off(MENU_MODAL_CHANGE, modalChanged);
    scene.events.off("shutdown", destroy); scene.events.off("destroy", destroy);
    stopViewport(); targets.forEach(target => target.destroy()); canvas.remove();
  };
  scene.game.events.on("postrender", paint);
  scene.events.on("pause", pause); scene.events.on("sleep", pause);
  scene.events.on("resume", resume); scene.events.on("wake", resume);
  scene.events.on(MENU_MODAL_CHANGE, modalChanged);
  scene.events.once("shutdown", destroy); scene.events.once("destroy", destroy);
  scene.data.set("content-v2-trip-open", false);
  return {
    show(nextInput) {
      if (destroyed || paused || scene.scene.isPaused()) return false;
      const owner = menuModalOwner(scene);
      if (owner && owner !== MODAL_OWNER && owner !== options.parentModalOwner) return false;
      const nextModel = nextInput ? tripCardModel(nextInput) : model;
      preflight(nextModel);
      if (nextInput) { input = nextInput; model = nextModel; }
      if (!open) {
        const lease = acquireMenuModal(scene, MODAL_OWNER, targets, options.parentModalOwner);
        if (!lease) return false;
        release = lease; open = true;
      }
      scene.data.set("content-v2-trip-open", true); sync(); paint(); return true;
    },
    hide,
    update(nextInput) { if (!destroyed) { const nextModel = tripCardModel(nextInput); preflight(nextModel); input = nextInput; model = nextModel; invalidate(); } },
    destroy,
    isOpen: () => open && !destroyed,
    getLayout: () => structuredClone(layout),
  };
}
