import Phaser from "phaser";
import { COLORS, WORLD } from "../game/Constants";
import { addCanvasTexture } from "./TextureUtils";
import { createIllustratedPastureLayers } from "./IllustratedPastureTextures";

function drawHill(context: CanvasRenderingContext2D, offset: number, baseY: number, width: number, height: number, color: string): void {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(offset, baseY);
  context.lineTo(offset + width * 0.5, baseY - height);
  context.lineTo(offset + width, baseY);
  context.closePath();
  context.fill();
}

function registerTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`Canvas 2D context is unavailable while creating ${key}`);
  context.imageSmoothingEnabled = false;
  draw(context);
  addCanvasTexture(scene, key, canvas);
}

function drawCloud(context: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
  const rect = (left: number, top: number, width: number, height: number): void => {
    context.fillRect(
      Math.round(x + left * scale),
      Math.round(y + top * scale),
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );
  };
  context.fillStyle = COLORS.cloud;
  rect(8, 10, 34, 9);
  rect(15, 3, 19, 9);
  rect(23, 0, 18, 9);
  rect(0, 13, 13, 6);
  rect(43, 13, 15, 6);
}

function drawSkyLayer(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.sky;
  context.fillRect(0, 0, WORLD.width, WORLD.height);
  context.fillStyle = COLORS.yellow;
  context.fillRect(378, 37, 28, 28);
  context.fillStyle = COLORS.soilLight;
  context.fillRect(384, 32, 16, 4);
  context.fillRect(384, 66, 16, 4);
  context.fillRect(373, 44, 4, 14);
  context.fillRect(409, 44, 4, 14);
}

function drawCloudLayer(context: CanvasRenderingContext2D): void {
  drawCloud(context, 18, 42);
  drawCloud(context, 215, 70, 0.68);
  drawCloud(context, 390, 34, 0.55);
}

function drawFarMountainLayer(context: CanvasRenderingContext2D): void {
  for (let x = 0; x < WORLD.width; x += 160) {
    drawHill(context, x, 177, 160, 43, COLORS.hillFar);
  }
}

function drawTreeLineLayer(context: CanvasRenderingContext2D): void {
  for (let x = 0; x < WORLD.width; x += 120) {
    drawHill(context, x, 194, 120, 31, COLORS.hillNear);
  }
}

function drawFarmBuildingLayer(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.ink;
  context.fillRect(268, 151, 67, 49);
  context.fillStyle = COLORS.soilLight;
  context.fillRect(272, 155, 59, 45);
  context.fillStyle = COLORS.coral;
  context.beginPath();
  context.moveTo(260, 154);
  context.lineTo(301, 126);
  context.lineTo(343, 154);
  context.closePath();
  context.fill();
  context.fillStyle = COLORS.woodDark;
  context.fillRect(294, 173, 16, 27);
  context.fillStyle = COLORS.sky;
  context.fillRect(276, 163, 11, 10);
  context.fillRect(313, 163, 11, 10);
}

function drawFieldLayer(context: CanvasRenderingContext2D): void {
  for (let x = 0; x < WORLD.width; x += 40) {
    const cropX = x + 11;
    const cropY = 199;
    context.fillStyle = COLORS.grassDark;
    context.fillRect(cropX, cropY + 5, 3, 11);
    context.fillRect(cropX + 9, cropY + 3, 3, 13);
    context.fillStyle = COLORS.mint;
    context.fillRect(cropX - 3, cropY + 3, 7, 4);
    context.fillRect(cropX + 8, cropY, 7, 4);
    context.fillStyle = COLORS.yellow;
    context.fillRect(cropX + 2, cropY + 7, 4, 4);
  }
}

function drawFenceLayer(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.woodDark;
  context.fillRect(0, 196, WORLD.width, 4);
  context.fillRect(0, 207, WORLD.width, 3);
  for (let x = 40; x < WORLD.width; x += 80) context.fillRect(x, 192, 5, 22);
  context.fillStyle = COLORS.woodLight;
  context.fillRect(0, 196, WORLD.width, 2);
  context.fillRect(0, 207, WORLD.width, 2);
}

function drawGroundLayer(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.grass;
  context.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);
  context.fillStyle = COLORS.grassLight;
  context.fillRect(0, WORLD.groundY, WORLD.width, 5);
  context.fillStyle = COLORS.soil;
  context.fillRect(0, WORLD.groundY + 11, WORLD.width, WORLD.height - WORLD.groundY - 11);
  context.fillStyle = COLORS.soilLight;
  context.fillRect(0, WORLD.groundY + 11, WORLD.width, 4);
}

function drawForegroundGrassLayer(context: CanvasRenderingContext2D): void {
  for (let x = 8; x < WORLD.width; x += 40) {
    context.fillStyle = COLORS.grassDark;
    context.fillRect(x, 211, 2, 8);
    context.fillRect(x + 5, 214, 2, 6);
    context.fillStyle = COLORS.mint;
    context.fillRect(x - 1, 211, 4, 2);
    context.fillRect(x + 4, 214, 4, 2);
  }
}
function drawDecorationTexture(context: CanvasRenderingContext2D, id: string): void {
  const fill = (color: string, x: number, y: number, width: number, height: number): void => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  };
  switch (id) {
    case "tree":
      fill(COLORS.woodDark, 14, 22, 6, 18);
      fill(COLORS.grassDark, 4, 8, 28, 17);
      fill(COLORS.hillNear, 10, 2, 20, 10);
      fill(COLORS.mint, 7, 12, 8, 6);
      break;
    case "flower":
      fill(COLORS.grassDark, 9, 12, 3, 16);
      fill(COLORS.yellow, 4, 8, 7, 7);
      fill(COLORS.coral, 12, 8, 7, 7);
      fill(COLORS.paper, 8, 10, 7, 4);
      break;
    case "fence":
      fill(COLORS.woodDark, 2, 10, 28, 4);
      fill(COLORS.woodDark, 2, 21, 28, 4);
      fill(COLORS.woodLight, 5, 7, 4, 23);
      fill(COLORS.woodLight, 23, 7, 4, 23);
      break;
    case "barn":
      fill(COLORS.soilLight, 4, 12, 28, 24);
      fill(COLORS.coral, 1, 12, 34, 5);
      fill(COLORS.coral, 7, 5, 26, 8);
      fill(COLORS.woodDark, 16, 23, 7, 13);
      fill(COLORS.sky, 8, 19, 5, 6);
      break;
    case "hayBale":
      fill(COLORS.yellow, 3, 12, 29, 17);
      fill(COLORS.soilLight, 3, 15, 29, 3);
      fill(COLORS.soilLight, 3, 23, 29, 3);
      fill(COLORS.woodDark, 8, 11, 3, 19);
      fill(COLORS.woodDark, 24, 11, 3, 19);
      break;
    case "barrel":
      fill(COLORS.woodDark, 6, 8, 20, 24);
      fill(COLORS.woodLight, 9, 10, 14, 20);
      fill(COLORS.woodDark, 7, 13, 18, 3);
      fill(COLORS.woodDark, 7, 24, 18, 3);
      break;
    case "rock":
      fill(COLORS.woodDark, 3, 22, 28, 7);
      fill(COLORS.inkSoft, 7, 14, 22, 12);
      fill(COLORS.ink, 12, 10, 12, 8);
      fill(COLORS.cloud, 13, 11, 8, 4);
      break;
  }
}

const DECORATION_TEXTURES: readonly [string, string, number, number][] = [
  ["environment-tree", "tree", 36, 42],
  ["environment-flower", "flower", 24, 30],
  ["environment-fence-decoration", "fence", 36, 36],
  ["environment-barn", "barn", 36, 36],
  ["environment-hay-bale", "hayBale", 36, 36],
  ["environment-barrel", "barrel", 32, 36],
  ["environment-rock-decoration", "rock", 34, 30],
];

const PASTURE_ATMOSPHERE_LAYERS: readonly [string, (context: CanvasRenderingContext2D) => void][] = [
  ["pasture-sky", drawSkyLayer],
  ["pasture-cloud", drawCloudLayer],
  ["pasture-far-mountain", drawFarMountainLayer],
  ["pasture-treeline", drawTreeLineLayer],
  ["pasture-building", drawFarmBuildingLayer],
  ["pasture-field", drawFieldLayer],
  ["pasture-fence", drawFenceLayer],
  ["pasture-ground", drawGroundLayer],
  ["pasture-foreground-grass", drawForegroundGrassLayer],
];

export function createPastureTextures(scene: Phaser.Scene): void {
  createIllustratedPastureLayers(scene);
  registerTexture(scene, "farm-static", WORLD.width, WORLD.height, (context) => {
    context.fillStyle = COLORS.sky;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = COLORS.yellow;
    context.fillRect(378, 37, 28, 28);
    context.fillStyle = COLORS.soilLight;
    context.fillRect(384, 32, 16, 4);
    context.fillRect(384, 66, 16, 4);
    context.fillRect(373, 44, 4, 14);
    context.fillRect(409, 44, 4, 14);

    for (let x = 0; x < WORLD.width; x += 160) {
      drawHill(context, x, 177, 160, 43, COLORS.hillFar);
    }
    for (let x = 0; x < WORLD.width; x += 120) {
      drawHill(context, x, 194, 120, 31, COLORS.hillNear);
    }
    for (let x = 0; x < WORLD.width; x += 40) {
      const cropX = x + 11;
      const cropY = 199;
      context.fillStyle = COLORS.grassDark;
      context.fillRect(cropX, cropY + 5, 3, 11);
      context.fillRect(cropX + 9, cropY + 3, 3, 13);
      context.fillStyle = COLORS.mint;
      context.fillRect(cropX - 3, cropY + 3, 7, 4);
      context.fillRect(cropX + 8, cropY, 7, 4);
      context.fillStyle = COLORS.yellow;
      context.fillRect(cropX + 2, cropY + 7, 4, 4);
    }

    context.fillStyle = COLORS.grass;
    context.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);
    context.fillStyle = COLORS.grassLight;
    context.fillRect(0, WORLD.groundY, WORLD.width, 5);
    context.fillStyle = COLORS.soil;
    context.fillRect(0, WORLD.groundY + 11, WORLD.width, WORLD.height - WORLD.groundY - 11);
    context.fillStyle = COLORS.soilLight;
    context.fillRect(0, WORLD.groundY + 11, WORLD.width, 4);
  });

  registerTexture(scene, "fence", 36, 36, (context) => {
    context.fillStyle = COLORS.woodDark;
    context.fillRect(0, 5, 8, 31);
    context.fillRect(28, 5, 8, 31);
    context.fillRect(0, 4, 36, 8);
    context.fillRect(0, 34, 36, 2);
    context.fillStyle = COLORS.woodLight;
    context.fillRect(2, 6, 32, 3);
    context.fillRect(2, 16, 32, 5);
    context.fillStyle = COLORS.coral;
    context.fillRect(6, 17, 6, 4);
    context.fillRect(19, 17, 5, 4);
  });

  registerTexture(scene, "star", 24, 24, (context) => {
    context.fillStyle = COLORS.ink;
    context.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const radius = point % 2 === 0 ? 11 : 5;
      const x = 12 + Math.cos(angle) * radius;
      const y = 12 + Math.sin(angle) * radius;
      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
    context.fillStyle = COLORS.yellow;
    context.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const radius = point % 2 === 0 ? 8 : 4;
      const x = 12 + Math.cos(angle) * radius;
      const y = 12 + Math.sin(angle) * radius;
      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
    context.fillStyle = COLORS.cloud;
    context.fillRect(11, 6, 2, 4);
  });

  for (const [key, draw] of PASTURE_ATMOSPHERE_LAYERS) {
    registerTexture(scene, key, WORLD.width, WORLD.height, draw);
  }
  // Keep default-frame consumers on the full landscape when UI adds cropped clouds.
  // Phaser chooses the first named frame as the texture default; this adds metadata only.
  const clouds = scene.textures.get("pasture-cloud");
  if (!clouds.has("landscape")) clouds.add("landscape", 0, 0, 0, WORLD.width, WORLD.height);
  registerTexture(scene, "pasture-sky-fill", 1, 1, (context) => {
    context.fillStyle = COLORS.sky;
    context.fillRect(0, 0, 1, 1);
  });
  registerTexture(scene, "pasture-soil-fill", 1, 1, (context) => {
    context.fillStyle = COLORS.soil;
    context.fillRect(0, 0, 1, 1);
  });
  registerTexture(scene, "pasture-weather-rain", 4, 8, (context) => {
    context.fillStyle = COLORS.sky;
    context.fillRect(1, 0, 2, 8);
    context.fillStyle = COLORS.cloud;
    context.fillRect(0, 2, 1, 2);
  });
  registerTexture(scene, "pasture-weather-leaf", 8, 6, (context) => {
    context.fillStyle = COLORS.coral;
    context.fillRect(1, 1, 5, 3);
    context.fillStyle = COLORS.mint;
    context.fillRect(3, 0, 3, 5);
    context.fillStyle = COLORS.woodDark;
    context.fillRect(2, 4, 4, 1);
  });
  for (const [key, id, width, height] of DECORATION_TEXTURES) {
    registerTexture(scene, key, width, height, (context) => drawDecorationTexture(context, id));
  }
}
