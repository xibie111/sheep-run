import type Phaser from "phaser";
import { addCanvasTexture } from "../utils/TextureUtils";

export const RESULT_ART_ASSETS = {
  panel: { key: "result-panel-source", url: new URL("../../assets/ui/result-reference-v1/panel.png", import.meta.url).href },
  controls: { key: "result-controls-source", url: new URL("../../assets/ui/result-reference-v1/controls.png", import.meta.url).href },
} as const;

export const RESULT_SCORE_FONT = {
  key: "result-gold-digits",
  image: new URL("../../assets/ui/result-reference-v1/score-glyphs.png", import.meta.url).href,
  data: new URL("../../assets/ui/result-reference-v1/score-glyphs.fnt", import.meta.url).href,
} as const;

export const RESULT_ART_FRAMES = {
  retry: { x: 62, y: 124, width: 750, height: 190 },
  home: { x: 868, y: 125, width: 606, height: 188 },
  record: { x: 212, y: 419, width: 1136, height: 186 },
  coin: { x: 200, y: 726, width: 198, height: 200 },
  retryIcon: { x: 671, y: 733, width: 192, height: 192 },
  homeIcon: { x: 1130, y: 732, width: 196, height: 183 },
} as const;

export type ResultArtPart = keyof typeof RESULT_ART_FRAMES;
export const resultArtKey = (part: ResultArtPart | "panel"): string => `result-art-${part}`;
export const resultRuntimeKeys = (): string[] => [resultArtKey("panel"), ...Object.keys(RESULT_ART_FRAMES).map(part => resultArtKey(part as ResultArtPart))];

/** Split the generated atlas and snap edge alpha; never use the design screenshot. */
export function createResultArtTextures(scene: Phaser.Scene): void {
  const panel = scene.textures.get(RESULT_ART_ASSETS.panel.key).getSourceImage() as HTMLImageElement;
  const controls = scene.textures.get(RESULT_ART_ASSETS.controls.key).getSourceImage() as HTMLImageElement;
  if (panel.width !== 1672 || panel.height !== 941 || controls.width !== 1536 || controls.height !== 1024) {
    throw new Error("Invalid generated result UI dimensions");
  }
  const create = (key: string, source: HTMLImageElement, frame: { x: number; y: number; width: number; height: number }): void => {
    if (scene.textures.exists(key)) return;
    const canvas = document.createElement("canvas");
    canvas.width = frame.width; canvas.height = frame.height;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    let visible = 0;
    for (let index = 3; index < pixels.data.length; index += 4) {
      pixels.data[index] = pixels.data[index]! >= 128 ? 255 : 0;
      if (pixels.data[index]) visible++;
    }
    if (!visible) throw new Error(`Empty generated result UI: ${key}`);
    context.putImageData(pixels, 0, 0);
    addCanvasTexture(scene, key, canvas);
  };
  create(resultArtKey("panel"), panel, { x: 0, y: 0, width: panel.width, height: panel.height });
  for (const [part, frame] of Object.entries(RESULT_ART_FRAMES)) create(resultArtKey(part as ResultArtPart), controls, frame);
  for (const asset of Object.values(RESULT_ART_ASSETS)) scene.textures.remove(asset.key);
}
