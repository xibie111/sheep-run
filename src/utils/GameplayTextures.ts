import { COLORS } from "../game/Constants";
import { SHEEP_SKINS, sheepTextureKey, type SheepSkinDefinition } from "../data/sheepSkins";
import { POWER_UP_DEFINITIONS, type PowerUpType } from "../data/powerups";
import { addCanvasTexture } from "./TextureUtils";
import { SKIN_ANIMATION_FRAMES } from "../data/skinSpriteAssets";

const SHEEP_FRAME_WIDTH = 24;
const SHEEP_FRAME_HEIGHT = 21;
const SHEEP_FRAMES = 10;

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable while creating gameplay textures");
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

function registerTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const { canvas, context } = createCanvas(width, height);
  draw(context);
  addCanvasTexture(scene, key, canvas);
}

function drawPumpkin(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.woodDark;
  context.fillRect(11, 2, 5, 5);
  context.fillStyle = COLORS.grassDark;
  context.fillRect(14, 1, 5, 3);
  context.fillStyle = COLORS.ink;
  context.fillRect(3, 8, 19, 13);
  context.fillStyle = COLORS.coral;
  context.fillRect(5, 6, 15, 14);
  context.fillRect(3, 10, 3, 8);
  context.fillRect(19, 10, 3, 8);
  context.fillStyle = COLORS.soilLight;
  context.fillRect(8, 7, 3, 12);
  context.fillRect(15, 7, 3, 12);
  context.fillStyle = COLORS.yellow;
  context.fillRect(7, 13, 3, 2);
  context.fillRect(15, 13, 3, 2);
  context.fillStyle = COLORS.woodDark;
  context.fillRect(10, 17, 6, 2);
}

function drawRock(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.ink;
  context.fillRect(3, 9, 5, 7);
  context.fillRect(7, 5, 13, 12);
  context.fillRect(18, 8, 8, 9);
  context.fillStyle = COLORS.inkSoft;
  context.fillRect(5, 10, 18, 6);
  context.fillRect(9, 7, 10, 3);
  context.fillStyle = COLORS.woolShade;
  context.fillRect(9, 7, 8, 3);
  context.fillRect(6, 11, 4, 3);
  context.fillStyle = COLORS.paper;
  context.fillRect(11, 8, 3, 2);
}

function drawPuddle(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.grassDark;
  context.fillRect(2, 7, 5, 4);
  context.fillRect(30, 6, 6, 5);
  context.fillRect(8, 9, 23, 3);
  context.fillStyle = COLORS.sky;
  context.fillRect(4, 6, 29, 5);
  context.fillRect(8, 4, 21, 3);
  context.fillStyle = COLORS.cloud;
  context.fillRect(8, 6, 7, 2);
  context.fillRect(21, 8, 6, 1);
}

function drawBird(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.ink;
  context.fillRect(6, 8, 17, 9);
  context.fillRect(2, 10, 7, 5);
  context.fillRect(19, 10, 6, 4);
  context.fillStyle = COLORS.wool;
  context.fillRect(7, 7, 15, 8);
  context.fillRect(3, 10, 5, 3);
  context.fillStyle = COLORS.woolShade;
  context.fillRect(10, 4, 9, 7);
  context.fillRect(12, 2, 5, 3);
  context.fillStyle = COLORS.coral;
  context.fillRect(11, 15, 2, 4);
  context.fillRect(18, 15, 2, 4);
  context.fillStyle = COLORS.yellow;
  context.fillRect(1, 11, 3, 2);
  context.fillRect(21, 10, 4, 2);
  context.fillStyle = COLORS.ink;
  context.fillRect(18, 8, 2, 2);
}

function drawSheepFrame(context: CanvasRenderingContext2D, x: number, y: number, frame: number, palette: SheepSkinDefinition["palette"] = COLORS): void {
  const role = frame === 0 ? "idle"
    : frame <= 4 ? "run"
      : frame === 5 ? "jump"
        : frame === 6 ? "fall"
          : frame === 7 ? "hit"
            : frame === 8 ? "dash" : "dead";
  type LegPair = readonly [number, number];
  const runLegPairs: readonly (readonly LegPair[])[] = [
    [[5, 15], [10, 14], [17, 16], [21, 14]],
    [[6, 14], [11, 16], [16, 14], [20, 16]],
    [[5, 16], [10, 14], [17, 15], [21, 14]],
    [[6, 14], [11, 15], [16, 16], [20, 14]],
  ];
  const legPairs: Record<string, readonly LegPair[]> = {
    idle: [[7, 15], [11, 15], [17, 15], [20, 15]],
    run: runLegPairs[(frame - 1) % 4],
    jump: [[7, 13], [10, 14], [17, 13], [20, 14]],
    fall: [[6, 15], [10, 16], [17, 15], [21, 16]],
    hit: [[7, 15], [11, 15], [17, 15], [20, 15]],
    dash: [[4, 14], [8, 16], [18, 14], [22, 16]],
    dead: [[6, 15], [10, 15], [17, 15], [21, 15]],
  };

  const squash = role === "hit" || role === "dead";
  const bodyY = squash ? y + 8 : y + 5;
  const bodyHeight = squash ? 7 : 10;
  context.fillStyle = COLORS.ink;
  context.fillRect(x + 3, bodyY + 1, 15, bodyHeight);
  context.fillRect(x + 5, bodyY - 1, 11, 2);
  context.fillStyle = palette.wool;
  context.fillRect(x + 4, bodyY, 13, bodyHeight - 2);
  context.fillRect(x + 6, bodyY - 2, 9, 3);
  context.fillRect(x + 2, bodyY + 3, 3, 4);
  context.fillRect(x + 16, bodyY + 3, 3, 4);
  context.fillStyle = palette.woolShade;
  context.fillRect(x + 6, bodyY + bodyHeight - 4, 9, 2);

  const headY = role === "jump" ? y + 3 : role === "fall" ? y + 6 : squash ? y + 8 : y + 5;
  context.fillStyle = COLORS.ink;
  context.fillRect(x + 16, headY + 1, 7, 8);
  context.fillRect(x + 18, headY, 4, 2);
  context.fillStyle = palette.face;
  context.fillRect(x + 17, headY + 2, 5, 6);
  context.fillStyle = palette.woolShade;
  context.fillRect(x + 16, headY, 4, 3);
  context.fillStyle = COLORS.ink;
  if (role !== "dead") context.fillRect(x + 20, headY + 3, 1, 1);
  else context.fillRect(x + 20, headY + 3, 2, 1);
  context.fillStyle = COLORS.coral;
  context.fillRect(x + 22, headY + 5, 1, 2);

  context.fillStyle = COLORS.ink;
  for (const [legX, legY] of legPairs[role]) context.fillRect(x + legX, y + legY, 2, 4);
  context.fillStyle = palette.face;
  context.fillRect(x + 7, y + 18, 2, 1);
  context.fillRect(x + 18, y + 18, 2, 1);
  if (palette.hat) {
    context.fillStyle = palette.hat;
    context.fillRect(x + 16, Math.max(y, headY - 3), 8, 3);
    context.fillRect(x + 15, Math.max(y + 3, headY), 10, 1);
  }
}

export function createSheepSpritesheets(scene: Phaser.Scene): void {
  for (const skin of SHEEP_SKINS) createSheepSpritesheetForSkin(scene, skin);
}

function createSheepSpritesheetForSkin(scene: Phaser.Scene, skin: SheepSkinDefinition): void {
  const key = sheepTextureKey(skin.id);
  if (scene.textures.exists(key)) return;
  const columns = 5;
  const rows = Math.ceil(SHEEP_FRAMES / columns);
  const { canvas, context } = createCanvas(columns * SHEEP_FRAME_WIDTH, rows * SHEEP_FRAME_HEIGHT);
  for (let frame = 0; frame < SHEEP_FRAMES; frame += 1) {
    const x = (frame % columns) * SHEEP_FRAME_WIDTH;
    const y = Math.floor(frame / columns) * SHEEP_FRAME_HEIGHT;
    drawSheepFrame(context, x, y, frame, skin.palette);
  }
  const source = scene.textures.addCanvas(key, canvas);
  if (!source) throw new Error(`Unable to register sheep spritesheet source: ${key}`);
  const sheet = scene.textures.addSpriteSheet(key, source, {
    frameWidth: SHEEP_FRAME_WIDTH,
    frameHeight: SHEEP_FRAME_HEIGHT,
    endFrame: SHEEP_FRAMES - 1,
  });
  if (!sheet) throw new Error(`Unable to register sheep spritesheet frames: ${key}`);
}

export function createSheepAnimations(scene: Phaser.Scene): void {
  const states = [
    { key: "idle", start: 0, end: 0, frameRate: 1, repeat: -1 },
    { key: "run", start: 1, end: 4, frameRate: 10, repeat: -1 },
    { key: "jump", start: 5, end: 5, frameRate: 1, repeat: 0 },
    { key: "fall", start: 6, end: 6, frameRate: 1, repeat: 0 },
    { key: "hit", start: 7, end: 7, frameRate: 1, repeat: 0 },
    { key: "dash", start: 8, end: 8, frameRate: 1, repeat: 0 },
    { key: "dead", start: 9, end: 9, frameRate: 1, repeat: 0 },
  ];
  for (const skin of SHEEP_SKINS) {
    const prefix = skin.id === "white" ? "sheep" : `sheep-${skin.id}`;
    const textureKey = sheepTextureKey(skin.id);
    const productionArt = scene.textures?.getFrame(textureKey, 0)?.width === 128;
    for (const state of states) {
      const key = `${prefix}-${state.key}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(textureKey, productionArt
          ? { frames: [...SKIN_ANIMATION_FRAMES[state.key as keyof typeof SKIN_ANIMATION_FRAMES]] }
          : { start: state.start, end: state.end }),
        frameRate: productionArt && (state.key === "idle" || state.key === "dash" || state.key === "dead") ? (state.key === "idle" ? 2 : 8) : state.frameRate,
        repeat: state.repeat,
      });
    }
  }
}

export function createPowerUpTextures(scene: Phaser.Scene): void {
  for (const definition of POWER_UP_DEFINITIONS) {
    registerTexture(scene, definition.textureKey, 24, 24, (context) => {
      context.fillStyle = definition.color;
      if (definition.type === "magnet") {
        context.fillRect(4, 4, 5, 12);
        context.fillRect(15, 4, 5, 12);
        context.fillRect(6, 16, 4, 4);
        context.fillRect(14, 16, 4, 4);
        context.fillStyle = "#fff3d6";
        context.fillRect(9, 12, 6, 4);
        context.fillStyle = "#d96d54";
        context.fillRect(4, 3, 5, 3);
        context.fillRect(15, 3, 5, 3);
      } else if (definition.type === "shield") {
        context.fillRect(4, 3, 16, 4);
        context.fillRect(3, 7, 18, 6);
        context.fillRect(5, 13, 14, 4);
        context.fillRect(8, 17, 8, 3);
        context.fillRect(11, 20, 2, 2);
        context.fillStyle = "#fff3d6";
        context.fillRect(7, 8, 3, 3);
        context.fillRect(14, 8, 3, 3);
      } else if (definition.type === "starMultiplier") {
        context.fillRect(10, 2, 4, 5);
        context.fillRect(8, 7, 8, 4);
        context.fillRect(3, 8, 5, 4);
        context.fillRect(16, 8, 5, 4);
        context.fillRect(6, 12, 12, 4);
        context.fillRect(7, 16, 4, 4);
        context.fillRect(13, 16, 4, 4);
        context.fillRect(10, 19, 4, 3);
        context.fillStyle = "#fff3d6";
        context.fillRect(11, 5, 2, 4);
      } else {
        context.fillRect(2, 6, 7, 3);
        context.fillRect(5, 11, 7, 3);
        context.fillRect(8, 16, 7, 3);
        context.fillRect(10, 4, 9, 4);
        context.fillRect(14, 8, 7, 4);
        context.fillRect(17, 12, 5, 4);
        context.fillRect(12, 17, 7, 4);
      }
      context.fillStyle = "#4a382f";
      context.fillRect(1, 1, 3, 2);
      context.fillRect(20, 21, 3, 2);
    });
  }
}

export function createGameplayTextures(scene: Phaser.Scene): void {
  createSheepSpritesheets(scene);
  createSheepAnimations(scene);
  registerTexture(scene, "obstacle-pumpkin", 26, 24, drawPumpkin);
  registerTexture(scene, "obstacle-rock", 30, 18, drawRock);
  registerTexture(scene, "obstacle-puddle", 38, 13, drawPuddle);
  registerTexture(scene, "obstacle-bird", 26, 21, drawBird);
  createPowerUpTextures(scene);
}
