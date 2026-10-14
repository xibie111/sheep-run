import type Phaser from "phaser";
import { sheepTextureKey, type SkinId } from "./sheepSkins";
import { assertMatchingOfficialSkinCatalog, REQUIRED_OFFICIAL_SKIN_IDS } from "./sheepSkinAssets";

export const SKIN_SHEET_URLS: Record<SkinId, string> = {
  white: new URL("../../assets/skins/runtime-v1/white-sheet.png", import.meta.url).href,
  black: new URL("../../assets/skins/runtime-v1/black-sheet.png", import.meta.url).href,
  brown: new URL("../../assets/skins/runtime-v1/brown-sheet.png", import.meta.url).href,
  golden: new URL("../../assets/skins/runtime-v1/golden-sheet.png", import.meta.url).href,
  farmer: new URL("../../assets/skins/runtime-v1/farmer-sheet.png", import.meta.url).href,
  mint: new URL("../../assets/skins/runtime-v1/mint-sheet.png", import.meta.url).href,
  rose: new URL("../../assets/skins/runtime-v1/rose-sheet.png", import.meta.url).href,
  blueberry: new URL("../../assets/skins/runtime-v1/blueberry-sheet.png", import.meta.url).href,
  lavender: new URL("../../assets/skins/runtime-v1/lavender-sheet.png", import.meta.url).href,
  pumpkin: new URL("../../assets/skins/runtime-v1/pumpkin-sheet.png", import.meta.url).href,
  forest: new URL("../../assets/skins/runtime-v1/forest-sheet.png", import.meta.url).href,
  chestnut: new URL("../../assets/skins/runtime-v1/chestnut-sheet.png", import.meta.url).href,
  sunset: new URL("../../assets/skins/runtime-v1/sunset-sheet.png", import.meta.url).href,
  "sleepy-blue": new URL("../../assets/skins/runtime-v2/sleepy-blue-sheet.png", import.meta.url).href,
  "sleepy-cream": new URL("../../assets/skins/runtime-v2/sleepy-cream-sheet.png", import.meta.url).href,
  "sleepy-pink": new URL("../../assets/skins/runtime-v2/sleepy-pink-sheet.png", import.meta.url).href,
  "sleepy-mint": new URL("../../assets/skins/runtime-v2/sleepy-mint-sheet.png", import.meta.url).href,
  dream: new URL("../../assets/skins/runtime-v2/dream-sheet.png", import.meta.url).href,
  peach: new URL("../../assets/skins/runtime-v3/peach-sheet.png", import.meta.url).href,
  milktea: new URL("../../assets/skins/runtime-v3/milktea-sheet.png", import.meta.url).href,
  cloud: new URL("../../assets/skins/runtime-v3/cloud-sheet.png", import.meta.url).href,
  bearcap: new URL("../../assets/skins/runtime-v3/bearcap-sheet.png", import.meta.url).href,
  'strawberry-v1': new URL('../../assets/skins/runtime-v4/strawberry-v1-sheet.png', import.meta.url).href,
  'lemon-v1': new URL('../../assets/skins/runtime-v4/lemon-v1-sheet.png', import.meta.url).href,
  'sailor-v1': new URL('../../assets/skins/runtime-v4/sailor-v1-sheet.png', import.meta.url).href,
  'starlight-v1': new URL('../../assets/skins/runtime-v4/starlight-v1-sheet.png', import.meta.url).href,
  'postman-v1': new URL('../../assets/skins/runtime-v4/postman-v1-sheet.png', import.meta.url).href,
  'raincoat-v1': new URL('../../assets/skins/runtime-v4/raincoat-v1-sheet.png', import.meta.url).href,
  'explorer-v1': new URL('../../assets/skins/runtime-v4/explorer-v1-sheet.png', import.meta.url).href,
  'astronaut-v1': new URL('../../assets/skins/runtime-v4/astronaut-v1-sheet.png', import.meta.url).href,
  'bee-v1': new URL('../../assets/skins/runtime-v5/bee-v1-sheet.png', import.meta.url).href,
  'mushroom-v1': new URL('../../assets/skins/runtime-v5/mushroom-v1-sheet.png', import.meta.url).href,
  'chef-v1': new URL('../../assets/skins/runtime-v5/chef-v1-sheet.png', import.meta.url).href,
  'pirate-v1': new URL('../../assets/skins/runtime-v5/pirate-v1-sheet.png', import.meta.url).href,
  'fox-v1': new URL('../../assets/skins/runtime-v5/fox-v1-sheet.png', import.meta.url).href,
  'dinosaur-v1': new URL('../../assets/skins/runtime-v5/dinosaur-v1-sheet.png', import.meta.url).href,
};

export const SKIN_NAMES: Record<SkinId, string> = {
  white: "奶油白", black: "炭黑", brown: "暖棕", golden: "闪金", farmer: "农夫羊",
  mint: "薄荷羊", rose: "樱花羊", blueberry: "蓝莓羊", lavender: "薰衣草羊",
  pumpkin: "南瓜羊", forest: "森林羊", chestnut: "栗木羊", sunset: "夕阳羊",
  "sleepy-blue": "催眠羊", "sleepy-cream": "月夜羊", "sleepy-pink": "柔粉睡羊", "sleepy-mint": "薄荷睡羊",
  dream: "梦境羊",
  peach: "蜜桃羊", milktea: "奶茶羊", cloud: "云朵羊", bearcap: "小熊帽羊",
  'strawberry-v1': '草莓羊', 'lemon-v1': '柠檬羊', 'sailor-v1': '水手羊', 'starlight-v1': '星灯羊',
  'postman-v1': '邮差羊', 'raincoat-v1': '雨衣羊', 'explorer-v1': '探险羊', 'astronaut-v1': '航天羊',
  'bee-v1': '蜜蜂羊', 'mushroom-v1': '蘑菇羊', 'chef-v1': '厨师羊', 'pirate-v1': '海盗羊',
  'fox-v1': '狐狸羊', 'dinosaur-v1': '恐龙羊',
};

export const SKIN_ANIMATION_FRAMES = {
  idle: [0, 10], run: [1, 2, 3, 4, 11, 12], jump: [5], fall: [6],
  hit: [7], dash: [8, 13], dead: [9, 14],
} as const;

export function loadSkinSpriteAssets(scene: Phaser.Scene): void {
  assertMatchingOfficialSkinCatalog(REQUIRED_OFFICIAL_SKIN_IDS.map((id) => ({
    id, frameWidth: 128, frameHeight: 128, frameCount: 15, files: [SKIN_SHEET_URLS[id]],
  })));
  for (const [id, url] of Object.entries(SKIN_SHEET_URLS)) {
    scene.load.spritesheet(sheepTextureKey(id as SkinId), url, { frameWidth: 128, frameHeight: 128, endFrame: 14 });
  }
}

export function registerSkinRenderFrames(scene: Phaser.Scene): void {
  for (const id of Object.keys(SKIN_SHEET_URLS) as SkinId[]) {
    const key = sheepTextureKey(id);
    if (!scene.textures.exists(key)) throw new Error(`Skin sheet failed to load: ${id}`);
    const texture = scene.textures.get(key);
    if (texture.source[0].width !== 640 || texture.source[0].height !== 384) throw new Error(`Invalid skin sheet dimensions: ${id}`);
    for (let i = 0; i < 15; i++) {
      if (!texture.has(String(i))) throw new Error(`Skin sheet ${id} is missing frame ${i}`);
      // 16 transparent top rows are packing padding. 128:112 = 48:42,
      // so all existing display sizes retain square pixels and fixed hitboxes.
      texture.get(i).setSize(128, 112, (i % 5) * 128, Math.floor(i / 5) * 128 + 16);
    }
  }
}
