import type Phaser from "phaser";
import { FAVORITE_FOODS, GOOD_NIGHT, isBedtime, LOVE_LETTER, MenuEggTaps, SCORE_EASTER_EGGS, ScoreEggTracker } from "../data/easterEggs";
import { FAVORITE_FOOD_ART } from "../data/personalEggAssets";
import { UI_KEYS } from "../data/uiAssets";
import { watchViewport } from "../game/Viewport";
import { displayCanvasText, type DisplayCanvasPainter } from "./DisplayCanvasText";
import { sizeDisplaySurface } from "./DisplaySurface";
import { bindTouchTarget } from "./TouchTarget";
import { safeUiInsets } from "./UiLayout";
import type { ArtRect } from "./MenuArtLayout";
import { acquireMenuModal, menuModalOwner, MENU_MODAL_CHANGE } from "./MenuModal";

/** Use the existing hard-alpha bitmap font above the menu's display artwork. */
function eggSurface(scene: Phaser.Scene, kind: string, draw: (ctx: CanvasRenderingContext2D) => void) {
  const parent = scene.game.canvas?.parentElement;
  if (!parent || !scene.game.events) return null;
  const canvas = document.createElement("canvas");
  canvas.dataset.easterEgg = kind;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", margin: "0", padding: "0", pointerEvents: "none", zIndex: "3", imageRendering: "pixelated", display: "none" });
  parent.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  let visible = false, previous = "", revision = 0;
  const paint = () => {
    if (!visible || scene.scene.isPaused()) return;
    const rect = scene.game.canvas.getBoundingClientRect(), size = scene.scale.gameSize;
    const state = JSON.stringify([rect.x, rect.y, rect.width, rect.height, window.devicePixelRatio, size.width, size.height, revision]);
    if (state === previous) return;
    previous = state;
    const scale = sizeDisplaySurface(canvas, scene.game.canvas, parent, scene.scale.gameSize.width);
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.imageSmoothingEnabled = false;
    draw(ctx);
  };
  const pause = () => { canvas.style.display = "none"; };
  const resume = () => { previous = ""; canvas.style.display = visible ? "block" : "none"; paint(); };
  const cleanup = () => {
    scene.game.events.off("postrender", paint); scene.events.off("pause", pause); scene.events.off("resume", resume);
    scene.events.off("shutdown", cleanup); scene.events.off("destroy", cleanup); canvas.remove();
  };
  scene.game.events.on("postrender", paint);
  scene.events.on("pause", pause); scene.events.on("resume", resume);
  scene.events.once("shutdown", cleanup); scene.events.once("destroy", cleanup);
  return { canvas, invalidate() { revision++; }, show(value: boolean) { revision++; visible = value; canvas.style.display = value ? "block" : "none"; canvas.dataset.visible = String(value); if (value) paint(); } };
}

function drawArt(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, key: string, box: ArtRect): void {
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  ctx.drawImage(source, 0, 0, source.width, source.height, box.x, box.y, box.width, box.height);
}

/** Keep button corners at one scale and extend only their plain middle. */
function drawButton(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, key: string, box: ArtRect): void {
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const corner = 44, width = corner * box.height / source.height;
  ctx.drawImage(source, 0, 0, corner, source.height, box.x, box.y, width, box.height);
  ctx.drawImage(source, corner, 0, source.width - corner * 2, source.height, box.x + width, box.y, box.width - width * 2, box.height);
  ctx.drawImage(source, source.width - corner, 0, corner, source.height, box.x + box.width - width, box.y, width, box.height);
}

// Small native-grid hearts, drawn as UI geometry rather than a new sprite asset.
function pixelRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  const m = ctx.getTransform(), left = Math.round(x * m.a + m.e), top = Math.round(y * m.d + m.f);
  ctx.save(); ctx.resetTransform();
  ctx.fillRect(left, top, Math.round((x + width) * m.a + m.e) - left, Math.round((y + height) * m.d + m.f) - top);
  ctx.restore();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, pixel: number): void {
  const rows = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
  ctx.fillStyle = "#dc687c";
  rows.forEach((row, j) => [...row].forEach((on, i) => { if (on === "1") pixelRect(ctx, x + i * pixel, y + j * pixel, pixel, pixel); }));
}

function outlinedText(ctx: CanvasRenderingContext2D, value: string, box: ArtRect, fontSize: number,
  text: DisplayCanvasPainter, outline: DisplayCanvasPainter): ArtRect {
  const pixel = 1 / ctx.getTransform().a;
  for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    outline(ctx, value, { ...box, x: box.x + x * pixel, y: box.y + y * pixel }, fontSize);
  }
  return text(ctx, value, box, fontSize).ink;
}

export function attachMenuEasterEgg(scene: Phaser.Scene, sheep: Phaser.GameObjects.Image): void {
  // Lightweight scene test harnesses have no browser display surface.
  if (!scene.game.canvas?.parentElement || !scene.game.events) return;
  const text = displayCanvasText(scene), taps = new MenuEggTaps();
  const lightText = displayCanvasText(scene, "#cab999"), darkOutline = displayCanvasText(scene, "#25334c");
  let content: "letter" | "food" = "letter";
  let open = false, pressed = false;
  let release: (() => void) | undefined;
  let panel: ArtRect, closeBox: ArtRect;
  const target = scene.add.container(sheep.x, sheep.y, []).setDepth(5).setName("easter-egg:sheep");
  const blocker = scene.add.container(0, 0, []).setDepth(100).setName("easter-egg:letter-blocker");
  const close = scene.add.container(0, 0, []).setDepth(101).setName("button:收下这份喜欢");
  const picnic = scene.add.image(0, 0, FAVORITE_FOOD_ART.key).setDisplaySize(96, 967 * 96 / 1626).setDepth(4).setName("menu-food-picnic");
  const foodTarget = scene.add.container(0, 0, []).setDepth(6).setName("easter-egg:food");
  const flowers = scene.children.list.filter(child => child.name.startsWith("menu-flower-")) as Phaser.GameObjects.Image[];
  let sheepPressed = false, foodPressed = false;
  const tintForeground = () => {
    const night = scene.data.get("menu-bedtime") === true;
    const tint = (pressed: boolean) => night ? (pressed ? 0xb097a4 : 0xb0aebb) : (pressed ? 0xffdddf : 0xffffff);
    sheep.setTint(tint(sheepPressed)); picnic.setTint(tint(foodPressed));
    flowers.forEach(flower => flower.setTint(tint(false)));
  };
  let hint: ArtRect;
  const hintSurface = eggSurface(scene, "food-hint", ctx => {
    const night = scene.data.get("menu-bedtime") === true;
    const ink = outlinedText(ctx, FAVORITE_FOODS.hint, hint, 9, night ? lightText : text, night ? darkOutline : lightText);
    hintSurface.canvas.dataset.ink = JSON.stringify(ink);
    hintSurface.canvas.dataset.presentation = "transparent-outlined-text";
  })!;
  const surface = eggSurface(scene, "letter", ctx => {
    const lines: { text: string; ink: ArtRect }[] = [];
    const size = scene.scale.gameSize;
    ctx.fillStyle = "rgba(59,53,40,0.66)"; ctx.fillRect(0, 0, size.width, size.height);
    drawArt(scene, ctx, UI_KEYS.panelPause, panel);
    const line = (value: string, y: number, fontSize: number) => lines.push(text(ctx, value,
      { x: panel.x + 22, y: panel.y + y * panel.height, width: panel.width - 44, height: 20 }, text.fitFontSize(value, panel.width - 44, fontSize)));
    if (content === "letter") {
      line(LOVE_LETTER.title, .14, 21);
      LOVE_LETTER.lines.forEach((value, index) => line(value, .34 + index * .11, index ? 14 : 17));
      line(LOVE_LETTER.footer, .70, 11);
    } else {
      line(FAVORITE_FOODS.title, .14, 18);
      const image = scene.textures.get(FAVORITE_FOOD_ART.key).getSourceImage() as HTMLImageElement;
      // Source regions are the three separately illustrated bowls, never screenshot text.
      const bowls = [{ x: 130, y: 78, width: 450, height: 415 }, { x: 569, y: 133, width: 510, height: 373 }, { x: 1090, y: 204, width: 435, height: 289 }];
      FAVORITE_FOODS.names.forEach((name, index) => {
        const cell = (panel.width - 50) / 3, x = panel.x + 25 + index * cell;
        const bowl = bowls[index], scale = Math.min((cell - 8) / bowl.width, panel.height * .29 / bowl.height);
        ctx.drawImage(image, bowl.x, bowl.y, bowl.width, bowl.height, x + (cell - bowl.width * scale) / 2,
          panel.y + panel.height * .28 + (panel.height * .29 - bowl.height * scale) / 2, bowl.width * scale, bowl.height * scale);
        lines.push(text(ctx, name, { x, y: panel.y + panel.height * .59, width: cell, height: 20 }, 13));
      });
      line(FAVORITE_FOODS.message, .70, 11);
    }
    drawButton(scene, ctx, pressed ? UI_KEYS.buttonPrimaryPressed : UI_KEYS.buttonPrimary, closeBox);
    lines.push(text(ctx, content === "letter" ? LOVE_LETTER.close : FAVORITE_FOODS.close,
      { x: closeBox.x + 10, y: closeBox.y + 4, width: closeBox.width - 20, height: closeBox.height - 8 }, 12));
    surface.canvas.dataset.lines = JSON.stringify(lines);
    heart(ctx, panel.x + 25, panel.y + panel.height * .19, 1.5);
    heart(ctx, panel.x + panel.width - 36, panel.y + panel.height * .19, 1.5);
  })!;
  const setOpen = (value: boolean, kind = content) => {
    if (value) { const lease = acquireMenuModal(scene, "private-letter", [blocker, close]); if (!lease) return; release = lease; }
    content = kind;
    close.setName(`button:${content === "letter" ? LOVE_LETTER.close : FAVORITE_FOODS.close}`);
    surface.canvas.dataset.easterEgg = kind;
    open = value; blocker.input!.enabled = value; close.input!.enabled = value;
    if (!value) { release?.(); release = undefined; }
    bedtime.setBlocked(Boolean(menuModalOwner(scene)));
    hintSurface.show(!menuModalOwner(scene));
    surface.show(value);
  };
  bindTouchTarget(scene, blocker, 1, 1, () => {}, () => {});
  bindTouchTarget(scene, close, 144, 32, () => setOpen(false), value => { pressed = value; surface.invalidate(); });
  bindTouchTarget(scene, target, 72, 63, () => { if (!open && !menuModalOwner(scene) && taps.touch(scene.time.now)) setOpen(true, "letter"); }, value => { sheepPressed = value; tintForeground(); });
  bindTouchTarget(scene, foodTarget, 104, 86, () => { if (!open && !menuModalOwner(scene)) setOpen(true, "food"); }, value => { foodPressed = value; tintForeground(); });
  blocker.input!.enabled = close.input!.enabled = false;
  watchViewport(scene, size => {
    target.setPosition(sheep.x, sheep.y);
    const safe = safeUiInsets(scene), available = Math.min(320, size.width - safe.left - safe.right - 16);
    const picnicX = Math.min(safe.left + 84, sheep.x - 91), picnicY = sheep.y + 8;
    picnic.setPosition(picnicX, picnicY); foodTarget.setPosition(picnicX, picnicY);
    hint = { x: picnicX - 40, y: picnicY + picnic.displayHeight / 2 + 2, width: 80, height: 13 };
    hintSurface.canvas.dataset.box = JSON.stringify(hint); hintSurface.invalidate();
    const source = scene.textures.get(UI_KEYS.panelPause).getSourceImage() as HTMLImageElement;
    const scale = Math.min(available / source.width, (size.height - safe.top - safe.bottom - 16) / source.height);
    const width = source.width * scale, height = source.height * scale;
    panel = { x: safe.left + (size.width - safe.left - safe.right - width) / 2, y: safe.top + (size.height - safe.top - safe.bottom - height) / 2, width, height };
    closeBox = { x: panel.x + panel.width / 2 - 72, y: panel.y + panel.height * .82, width: 144, height: 32 };
    blocker.setPosition(size.width / 2, size.height / 2).setSize(size.width, size.height);
    blocker.input!.hitArea.setSize(size.width, size.height);
    close.setPosition(closeBox.x + 72, closeBox.y + 16);
    surface.canvas.dataset.panel = JSON.stringify(panel); surface.canvas.dataset.close = JSON.stringify(closeBox);
    surface.invalidate();
  });
  const bedtime = attachBedtimePasture(scene, lightText, darkOutline, () => { tintForeground(); hintSurface.invalidate(); });
  const modalChanged = () => { bedtime.setBlocked(Boolean(menuModalOwner(scene))); hintSurface.show(!menuModalOwner(scene)); };
  scene.events.on(MENU_MODAL_CHANGE, modalChanged);
  scene.events.once("shutdown", () => scene.events.off(MENU_MODAL_CHANGE, modalChanged));
  hintSurface.show(true);
}

/** Bedtime shades scenery while its transparent note stays crisp and readable. */
function attachBedtimePasture(scene: Phaser.Scene, text: DisplayCanvasPainter, outline: DisplayCanvasPainter,
  changed: () => void): { setBlocked(value: boolean): void } {
  const shade = scene.add.rectangle(0, 0, 1, 1, 0x17274e, .52).setOrigin(0).setDepth(-20).setName("menu-night-shade");
  const sky = scene.add.graphics().setDepth(-19).setName("menu-night-stars");
  const surface = eggSurface(scene, "good-night", ctx => {
    const size = scene.scale.gameSize, safe = safeUiInsets(scene);
    const width = Math.min(300, size.width - safe.left - safe.right - 20);
    const box = { x: safe.left + (size.width - safe.left - safe.right - width) / 2, y: size.height - safe.bottom - 18, width, height: 15 };
    const fontSize = text.fitFontSize(GOOD_NIGHT, width - 12, 11);
    // A one-physical-pixel dark outline replaces the solid cream ribbon.
    const ink = outlinedText(ctx, GOOD_NIGHT, box, fontSize, text, outline);
    surface.canvas.dataset.box = JSON.stringify(box); surface.canvas.dataset.ink = JSON.stringify(ink);
    surface.canvas.dataset.message = GOOD_NIGHT;
    surface.canvas.dataset.presentation = "transparent-outlined-text";
  })!;
  let previous: boolean | undefined, blocked = false;
  const refresh = () => {
    const night = isBedtime(new Date().getHours());
    if (night === previous) return;
    previous = night; shade.setVisible(night); sky.setVisible(night); surface.show(night && !blocked);
    scene.data.set("menu-bedtime", night); changed();
  };
  watchViewport(scene, size => {
    shade.setSize(size.width, size.height);
    const safe = safeUiInsets(scene), moonX = safe.left + 72, moonY = safe.top + 52;
    sky.clear().fillStyle(0xffefb6, 1);
    const moon = ["000011110000", "001111100000", "011111000000", "111110000000", "111110000000", "111110000000", "111111000000", "011111110001", "001111111110", "000011111000"];
    moon.forEach((row, y) => [...row].forEach((on, x) => { if (on === "1") sky.fillRect(moonX + x * 2, moonY + y * 2, 2, 2); }));
    for (const [x, y] of [[safe.left + 56, 94], [safe.left + 112, 39], [size.width - safe.right - 105, 92], [size.width - safe.right - 87, 119]]) {
      sky.fillRect(x, y - 2, 1, 5).fillRect(x - 2, y, 5, 1);
    }
    surface.invalidate();
  });
  refresh();
  const timer = scene.time.addEvent({ delay: 30000, loop: true, callback: refresh });
  scene.events.on("resume", refresh);
  scene.events.once("shutdown", () => { timer.remove(false); scene.events.off("resume", refresh); scene.data.remove("menu-bedtime"); });
  return { setBlocked(value) { blocked = value; surface.show(previous === true && !blocked); } };
}

export function attachRunEasterEggs(scene: Phaser.Scene, score: () => number): void {
  if (!scene.game.canvas?.parentElement || !scene.game.events) return;
  const tracker = new ScoreEggTracker(), text = displayCanvasText(scene);
  const queue: (typeof SCORE_EASTER_EGGS)[number][] = [];
  let current: (typeof SCORE_EASTER_EGGS)[number] | null = null;
  let timer: Phaser.Time.TimerEvent | null = null;
  const surface = eggSurface(scene, "score", ctx => {
    if (!current) return;
    const size = scene.scale.gameSize, safe = safeUiInsets(scene);
    const width = Math.min(296, size.width - safe.left - safe.right - 16);
    const box = { x: safe.left + (size.width - safe.left - safe.right - width) / 2, y: size.height - safe.bottom - 36, width, height: 28 };
    ctx.fillStyle = "#542b16"; pixelRect(ctx, box.x, box.y, box.width, box.height);
    ctx.fillStyle = "#fff0cd"; pixelRect(ctx, box.x + 2, box.y + 2, box.width - 4, box.height - 4);
    heart(ctx, box.x + 10, box.y + 10, 1.5);
    const line = { x: box.x + 29, y: box.y + 3, width: box.width - 37, height: 22 };
    const metrics = text(ctx, current.message, line, text.fitFontSize(current.message, line.width, 13));
    surface.canvas.dataset.box = JSON.stringify(box); surface.canvas.dataset.ink = JSON.stringify(metrics.ink);
  })!;
  const next = () => {
    current = queue.shift() ?? null;
    surface.canvas.dataset.message = current?.message ?? ""; surface.canvas.dataset.score = String(current?.score ?? "");
    surface.show(current !== null);
    timer = current ? scene.time.delayedCall(3800, () => { timer = null; current = null; next(); }) : null;
  };
  const update = () => { queue.push(...tracker.observe(score())); if (!current && queue.length) next(); };
  const cleanup = () => { scene.events.off("postupdate", update); timer?.remove(false); timer = null; queue.length = 0; };
  scene.events.on("postupdate", update); scene.events.once("shutdown", cleanup);
}
