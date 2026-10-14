import Phaser from "phaser";
import { SCENE } from "../game/Constants";
import { UI_ASSET_PATHS, UI_KEYS, uiIconKey } from "../data/uiAssets";
import { createGameplayTextures } from "../utils/GameplayTextures";
import { createPastureTextures } from "../utils/PastureTextures";
import { DISPLAY_FONTS } from "../ui/DisplayText";
import { BACKGROUND_ASSET_PATHS } from "../data/backgroundAssets";
import { loadSkinSpriteAssets, registerSkinRenderFrames, SKIN_SHEET_URLS } from "../data/skinSpriteAssets";
import { sheepTextureKey, type SkinId } from "../data/sheepSkins";
import { watchViewport } from "../game/Viewport";
import { bindTouchTarget } from "../ui/TouchTarget";
import { registerPauseDialogFrames } from "../ui/PauseDialog";
import { MENU_ART_ASSETS } from "../data/menuArtAssets";
import { RUN_HUD_ASSET } from "../data/runHudAssets";
import { loadSeasonArt, SEASON_SOURCE_KEYS } from "../data/seasonArtAssets";
import { createSeasonArtTextures, seasonRuntimeKeys } from "../utils/SeasonArtTextures";
import { createResultArtTextures, RESULT_ART_ASSETS, RESULT_SCORE_FONT, resultRuntimeKeys } from "../data/resultArtAssets";
import { ADDITIONAL_OBSTACLE_ART, ADDITIONAL_TOWER_ART, loadAdditionalObstacleArt, createAdditionalObstacleTextures, additionalObstacleRuntimeKeys } from "../data/additionalObstacleArt";
import { hideLoadingScreen, showLoadingScreen } from "../ui/LoadingScreen";
import { FAVORITE_FOOD_ART } from "../data/personalEggAssets";
import { RUN_STAR_ART } from "../data/collectibleArtAssets";
import { ADVENTURE_ASSETS } from "../data/adventureArtAssets";
import { COMPANION_BELL_ART } from "../companions/companionAssets";
import { JOURNEY_ART_ASSETS } from "../data/journeyArtAssets";
import { ACHIEVEMENT_ICON_ASSETS } from "../data/achievementIconAssets";
import { MAILBOX_ASSETS } from "../data/mailboxAssets";
import { NEW_OBSTACLE_ART, createNewObstacleTextures, newObstacleRuntimeKeys } from "../data/newObstacleArt";
import { EXPANDED_OBSTACLE_ART, createExpandedObstacleTextures, expandedObstacleRuntimeKeys } from "../data/expandedObstacleArt";
import { ANIMAL_SOURCE, ANIMAL_TEXTURE, prepareAnimalArt } from "../ambient/animalAssets";
import { SCENERY_ASSETS, validateSceneryTextures } from "../scenery/sceneryAssets";
import { DELIVERY_ASSETS } from '../delivery/deliveryAssets';
import { RUNNER_V2_ASSETS } from '../runner-v2/runnerAssets';
import { CONTENT_V2_ASSETS, prepareContentV2Textures, validateContentV2Textures } from '../content-v2';
import { RESIDENT_ASSETS, prepareResidentTextures, validateResidentTextures } from '../residents/residentAssets';

export class PreloadScene extends Phaser.Scene {
  private preparationGeneration = 0;
  constructor() {
    super({ key: SCENE.preload });
  }

  preload(): void {
    const loadingScreen = showLoadingScreen();
    const progress = (value: number): void => loadingScreen?.setProgress(value);
    this.load.on("progress", progress);
    this.events.once("shutdown", () => this.load.off("progress", progress));
    loadSkinSpriteAssets(this);
    loadSeasonArt(this);
    loadAdditionalObstacleArt(this);
    this.load.image(NEW_OBSTACLE_ART.key, NEW_OBSTACLE_ART.url);
    this.load.image(EXPANDED_OBSTACLE_ART.key, EXPANDED_OBSTACLE_ART.url);
    this.load.image(ANIMAL_SOURCE.key, ANIMAL_SOURCE.url);
    for (const asset of ADVENTURE_ASSETS) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    for (const asset of JOURNEY_ART_ASSETS) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    for (const asset of ACHIEVEMENT_ICON_ASSETS) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    for (const asset of SCENERY_ASSETS) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    for (const asset of DELIVERY_ASSETS) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    for (const asset of RUNNER_V2_ASSETS) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    for (const asset of CONTENT_V2_ASSETS) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    for (const asset of MAILBOX_ASSETS) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    for (const asset of RESIDENT_ASSETS) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    if (!this.textures.exists(RUN_STAR_ART.key)) this.load.image(RUN_STAR_ART.key, RUN_STAR_ART.url);
    if (!this.textures.exists(COMPANION_BELL_ART.key)) this.load.image(COMPANION_BELL_ART.key, COMPANION_BELL_ART.url);
    this.load.image(FAVORITE_FOOD_ART.key, FAVORITE_FOOD_ART.url);
    for (const asset of Object.values(MENU_ART_ASSETS)) this.load.image(asset.key, asset.url);
    this.load.image(RUN_HUD_ASSET.key, RUN_HUD_ASSET.url);
    for (const asset of Object.values(RESULT_ART_ASSETS)) this.load.image(asset.key, asset.url);
    this.load.bitmapFont(RESULT_SCORE_FONT.key, RESULT_SCORE_FONT.image, RESULT_SCORE_FONT.data);
    for (const font of Object.values(DISPLAY_FONTS)) this.load.bitmapFont(font.key, font.image, font.data);
    for (const [key, url] of Object.entries(UI_ASSET_PATHS)) {
      if (!this.textures.exists(key)) this.load.image(key, url);
    }
    for (const [key, url] of Object.entries(BACKGROUND_ASSET_PATHS)) this.load.image(key, url);
  }

  async create(): Promise<void> {
    const generation = ++this.preparationGeneration;
    this.events.once("shutdown", () => { this.preparationGeneration++; });
    const loadingScreen = showLoadingScreen();
    try {
      const steps = [
        () => this.validateFonts(), () => this.validateImages(),
        () => registerSkinRenderFrames(this), () => createPastureTextures(this),
        () => createSeasonArtTextures(this), () => createAdditionalObstacleTextures(this),
        () => createNewObstacleTextures(this),
        () => createExpandedObstacleTextures(this),
        () => prepareAnimalArt(this),
        () => createResultArtTextures(this), () => registerPauseDialogFrames(this),
        () => createGameplayTextures(this),
        () => prepareContentV2Textures(this),
        () => prepareResidentTextures(this),
      ];
      loadingScreen?.setPreparing(0, steps.length);
      for (let index = 0; index < steps.length; index++) {
        // Give the browser a paint between actual preparation jobs, including retries.
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (generation !== this.preparationGeneration) return;
        steps[index]!();
        loadingScreen?.setPreparing(index + 1, steps.length);
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (generation !== this.preparationGeneration) return;
      loadingScreen?.complete();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (generation !== this.preparationGeneration) return;
    } catch {
      hideLoadingScreen();
      this.showLocalAssetError();
      return;
    }
    this.scene.start(SCENE.menu);
    hideLoadingScreen();
  }

  private validateFonts(): void {
    for (const font of [...Object.values(DISPLAY_FONTS), RESULT_SCORE_FONT]) {
      if (!this.cache.bitmapFont.exists(font.key)) throw new Error(`Local pixel font failed to load: ${font.key}`);
    }
  }
  private validateImages(): void {
    const requiredKeys = [...Object.keys(BACKGROUND_ASSET_PATHS), ...Object.values(UI_KEYS), ...(["play", "settings", "hanger", "home", "retry", "back", "lock", "unlock", "check", "equip", "coin", "star", "mute", "volume", "pause", "close", "arrow-left", "arrow-right", "shirt"] as const).map(uiIconKey)];
    requiredKeys.push(...Object.values(MENU_ART_ASSETS).map(asset => asset.key));
    requiredKeys.push(RUN_HUD_ASSET.key);
    requiredKeys.push(FAVORITE_FOOD_ART.key);
    requiredKeys.push(RUN_STAR_ART.key);
    requiredKeys.push(COMPANION_BELL_ART.key);
    requiredKeys.push(...ADVENTURE_ASSETS.map(asset => asset.key));
    requiredKeys.push(...JOURNEY_ART_ASSETS.map(asset => asset.key));
    requiredKeys.push(...ACHIEVEMENT_ICON_ASSETS.map(asset => asset.key));
    requiredKeys.push(...SCENERY_ASSETS.map(asset => asset.key));
    requiredKeys.push(...DELIVERY_ASSETS.map(asset => asset.key));
    requiredKeys.push(...RUNNER_V2_ASSETS.map(asset => asset.key));
    requiredKeys.push(...CONTENT_V2_ASSETS.map(asset => asset.key));
    requiredKeys.push(...MAILBOX_ASSETS.map(asset => asset.key));
    requiredKeys.push(...SEASON_SOURCE_KEYS);
    requiredKeys.push(ADDITIONAL_OBSTACLE_ART.key, ADDITIONAL_TOWER_ART.key);
    requiredKeys.push(NEW_OBSTACLE_ART.key);
    requiredKeys.push(EXPANDED_OBSTACLE_ART.key);
    requiredKeys.push(ANIMAL_SOURCE.key);
    requiredKeys.push(...Object.values(RESULT_ART_ASSETS).map(asset => asset.key));
    for (const key of requiredKeys) {
      if (!this.textures.exists(key)) throw new Error(`Required local UI image failed to load: ${key}`);
    }
    const invalidContent = validateContentV2Textures(this);
    if (invalidContent.length) throw new Error(`Invalid content v2 textures: ${invalidContent.join(', ')}`);
    const invalidResidents = validateResidentTextures(this);
    if (invalidResidents.length) throw new Error(`Invalid resident textures: ${invalidResidents.join(', ')}`);
    const invalidScenery = validateSceneryTextures(this);
    if (invalidScenery.length) throw new Error(`Invalid postcard textures: ${invalidScenery.join(', ')}`);
  }

  private showLocalAssetError(): void {
    // This screen must work even when the bundled fonts and button images failed.
    const background = this.add.rectangle(0, 0, 480, 270, 0xfff3d6).setOrigin(0);
    const title = this.add.text(240, 88, "本地资源加载失败", {
      fontFamily: "sans-serif", fontSize: "20px", fontStyle: "bold", color: "#4a382f",
    }).setOrigin(0.5).setName("local-load-error");
    const message = this.add.text(240, 135, "请重试，或重新打开游戏\n已有存档不会被清除", {
      fontFamily: "sans-serif", fontSize: "12px", color: "#725b48", align: "center",
    }).setOrigin(0.5);
    const face = this.add.rectangle(0, 0, 144, 44, 0x725b48);
    const label = this.add.text(0, 0, "重试", {
      fontFamily: "sans-serif", fontSize: "18px", color: "#fff3d6",
    }).setOrigin(0.5);
    const retry = this.add.container(240, 200, [face, label]).setName("button:重试");
    bindTouchTarget(this, retry, 144, 44, () => this.retryLocalAssets(), pressed => face.setAlpha(pressed ? 0.7 : 1));
    watchViewport(this, size => {
      background.setSize(size.width, size.height);
      title.setPosition(size.width / 2, size.height / 2 - 47);
      message.setPosition(size.width / 2, size.height / 2);
      retry.setPosition(size.width / 2, size.height / 2 + 65);
    });
    const status = document.getElementById("game-status");
    if (status) status.textContent = "本地资源加载失败，可触摸重试。已有存档不会被清除。";
  }

  private retryLocalAssets(): void {
    // Clear only runtime asset caches, so restored or incomplete files reload.
    const keys = new Set([
      ...Object.keys(UI_ASSET_PATHS), ...Object.keys(BACKGROUND_ASSET_PATHS),
      ...Object.values(MENU_ART_ASSETS).map(asset => asset.key), RUN_HUD_ASSET.key,
      FAVORITE_FOOD_ART.key,
      RUN_STAR_ART.key,
      COMPANION_BELL_ART.key,
      ...ADVENTURE_ASSETS.map(asset => asset.key),
      ...JOURNEY_ART_ASSETS.map(asset => asset.key),
      ...ACHIEVEMENT_ICON_ASSETS.map(asset => asset.key),
      ...SCENERY_ASSETS.map(asset => asset.key),
      ...DELIVERY_ASSETS.map(asset => asset.key),
      ...RUNNER_V2_ASSETS.map(asset => asset.key),
      ...CONTENT_V2_ASSETS.map(asset => asset.key),
      ...MAILBOX_ASSETS.map(asset => asset.key),
      ...RESIDENT_ASSETS.map(asset => asset.key),
      ...Object.keys(SKIN_SHEET_URLS).map(id => sheepTextureKey(id as SkinId)),
      ...Object.values(DISPLAY_FONTS).map(font => font.key),
      ...SEASON_SOURCE_KEYS, ...seasonRuntimeKeys(),
      ADDITIONAL_OBSTACLE_ART.key, ADDITIONAL_TOWER_ART.key, ...additionalObstacleRuntimeKeys(),
      NEW_OBSTACLE_ART.key, ...newObstacleRuntimeKeys(),
      EXPANDED_OBSTACLE_ART.key, ...expandedObstacleRuntimeKeys(),
      ANIMAL_SOURCE.key, ANIMAL_TEXTURE,
      ...Object.values(RESULT_ART_ASSETS).map(asset => asset.key), ...resultRuntimeKeys(), RESULT_SCORE_FONT.key,
    ]);
    for (const key of keys) if (this.textures.exists(key)) this.textures.remove(key);
    for (const font of [...Object.values(DISPLAY_FONTS), RESULT_SCORE_FONT]) {
      this.cache.bitmapFont.remove(font.key);
      this.cache.xml.remove(font.key);
    }
    this.scene.restart();
  }
}
