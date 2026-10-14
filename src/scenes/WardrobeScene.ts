import Phaser from "phaser";
import { SCENE } from "../game/Constants";
import { SHEEP_SKINS, isSkinId, sheepTextureKey, type SkinId } from "../data/sheepSkins";
import { UI_KEYS, uiIconKey } from "../data/uiAssets";
import { SaveSystem } from "../systems/SaveSystem";
import { ProgressionSystem, type SkinUnlockResult } from "../systems/ProgressionSystem";
import { addSceneButton } from "../ui/SceneButton";
import { addPixelText } from "../ui/PixelText";
import { addPastureBackdrop, addCurrencyBadge, addUiPanel, addWoodTitle } from "../ui/PastureUi";
import { bindTouchTarget } from "../ui/TouchTarget";
import { safeUiInsets } from "../ui/UiLayout";
import { watchViewport, viewportSizeFromScale } from "../game/Viewport";
import { SKIN_NAMES } from "../data/skinSpriteAssets";
import { wardrobePurchaseState } from "../ui/WardrobePurchase";

const PREVIEW_COLORS: Record<SkinId, number> = { white: 0xffedc5, black: 0xc9c2ad, brown: 0xe6c596, golden: 0xffdd85, farmer: 0xd7e5ae,
  mint: 0xd6e9c0, rose: 0xf8d7cf, blueberry: 0xd5d9f1, lavender: 0xead7f6, pumpkin: 0xf7d4a0, forest: 0xd5e2af, chestnut: 0xe8c7a2, sunset: 0xf8d1b9,
  "sleepy-blue": 0xdce5ef, "sleepy-cream": 0xeee5d6, "sleepy-pink": 0xefdcdc, "sleepy-mint": 0xdfe8db, dream: 0xeadff2,
  peach: 0xffe3d5, milktea: 0xf0dfc4, cloud: 0xe3eef2, bearcap: 0xe5d5bb,
  "strawberry-v1": 0xf5dbcc, "lemon-v1": 0xf4ecc4, "sailor-v1": 0xd7e1eb, "starlight-v1": 0xdcd7ec,
  "postman-v1": 0xdbe6c6, "raincoat-v1": 0xf3dfac, "explorer-v1": 0xe4d9bc, "astronaut-v1": 0xdcebee,
  "bee-v1": 0xf5e6b5, "mushroom-v1": 0xf2d8cd, "chef-v1": 0xeeeee3, "pirate-v1": 0xe3d8cf,
  "fox-v1": 0xf3d5b6, "dinosaur-v1": 0xdce8c9 };
const CARDS_PER_PAGE = 5;
const SAVE_ERROR_MESSAGE = "保存失败，请重试";

export class WardrobeScene extends Phaser.Scene {
  private readonly progression = new ProgressionSystem();
  private selectedId: SkinId = "white";
  private starsText!: Phaser.GameObjects.BitmapText;
  private coinsText!: Phaser.GameObjects.BitmapText;
  private content?: Phaser.GameObjects.Container;
  private panel!: Phaser.GameObjects.Container;
  private message = "";
  constructor() { super({ key: SCENE.wardrobe }); }

  create(): void {
    addPastureBackdrop(this);
    this.content = undefined;
    const save = SaveSystem.load();
    this.selectedId = isSkinId(save.selectedSkin) ? save.selectedSkin : "white";
    this.message = "";
    const starsStart = this.children.list.length;
    this.starsText = addCurrencyBadge(this, 63, 26, SaveSystem.availableStars(save), "star").setName("wardrobe-available-stars");
    const starsBadge = this.add.container(0, 0, this.children.list.slice(starsStart)).setDepth(10);
    const coinsStart = this.children.list.length;
    this.coinsText = addCurrencyBadge(this, 417, 26, save.coins, "coin").setName("wardrobe-coins");
    const coinsBadge = this.add.container(0, 0, this.children.list.slice(coinsStart)).setDepth(10);
    const panelStart = this.children.list.length;
    addWoodTitle(this, 240, 35, "衣橱", 149, 49, 30);
    addUiPanel(this, 82, 151, 135, 161);
    addUiPanel(this, 311, 153, 311, 147);
    this.panel = this.add.container(0, 0, this.children.list.slice(panelStart)).setDepth(9);
    const back = addSceneButton(this, 47, 245, "返回", () => this.scene.start(SCENE.menu), { width: 76, height: 34, style: "back", icon: "back", fontSize: "12px" });
    this.refresh();
    watchViewport(this, (size) => {
      const safe = safeUiInsets(this);
      starsBadge.setPosition(safe.left, safe.top);
      coinsBadge.setPosition(size.width - 480 - safe.right, safe.top);
      back.setPosition(47 + safe.left, size.height - 25 - safe.bottom);
      this.positionContent();
    });
  }

  private refresh(): void {
    this.content?.destroy(true);
    const save = SaveSystem.load();
    this.starsText.setText(String(SaveSystem.availableStars(save)));
    this.coinsText.setText(String(save.coins));
    const start = this.children.list.length;
    const skin = SHEEP_SKINS.find((entry) => entry.id === this.selectedId)!;
    const action = wardrobePurchaseState(skin, save);
    const { unlocked, equipped } = action;
    this.add.rectangle(82, 133, 99, 95, PREVIEW_COLORS[skin.id]).setDepth(6);
    this.add.image(82, 138, sheepTextureKey(skin.id), 0).setDisplaySize(72, 63).setName("wardrobe-preview");
    this.add.image(82, 173, "ui-grass").setDisplaySize(88, 16);
    this.add.image(47, 167, "ui-flower-white").setDisplaySize(11, 11);
    this.add.image(118, 167, "ui-flower-yellow").setDisplaySize(10, 10);
    addSceneButton(this, 30, 137, "", () => this.cycle(-1), { width: 29, height: 32, style: "icon", icon: "arrow-left" });
    addSceneButton(this, 134, 137, "", () => this.cycle(1), { width: 29, height: 32, style: "icon", icon: "arrow-right" });
    this.add.image(82, 189, UI_KEYS.panelSmall).setDisplaySize(102, 27);
    addPixelText(this, 82, 188, SKIN_NAMES[skin.id], 12);
    const page = Math.floor(SHEEP_SKINS.findIndex((entry) => entry.id === this.selectedId) / CARDS_PER_PAGE);
    const pageCount = Math.ceil(SHEEP_SKINS.length / CARDS_PER_PAGE);
    const entries = SHEEP_SKINS.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);
    entries.forEach((entry, index) => this.addSkinCard(entry.id, 193 + (CARDS_PER_PAGE - entries.length) * 29 + index * 58, 151));
    addSceneButton(this, 177, 71, "", () => this.changePage(-1), { width: 26, height: 22, style: "icon", icon: "arrow-left" }).setName("button:page-prev");
    addPixelText(this, 311, 71, `${page + 1} / ${pageCount}`, 10);
    addSceneButton(this, 450, 71, "", () => this.changePage(1), { width: 26, height: 22, style: "icon", icon: "arrow-right" }).setName("button:page-next");

    if (!unlocked) addPixelText(this, 311, 212, action.explanation, 10).setName("wardrobe-price-explanation");
    addSceneButton(this, 311, 238, action.actionLabel, () => {
      if (unlocked) {
        const result = this.progression.equipSkin(skin.id);
        this.message = result.status === "storage-error" ? SAVE_ERROR_MESSAGE : result.status === "equipped" ? "已换上这套装扮" : "这套装扮还未解锁";
      } else {
        this.message = this.unlockMessage(this.progression.unlockSkin(skin.id), skin.unlock.type === "coins" || skin.unlock.type === "star-purchase");
      }
      this.refresh();
    }, { width: 126, height: 36, style: equipped ? "equipped" : "primary", icon: equipped ? "check" : unlocked ? "shirt" : "unlock", disabled: action.disabled, fontSize: "12px" });
    if (this.message) addPixelText(this, 303, 262, this.message, 10, 0xfff3ce).setName("wardrobe-feedback");
    const objects = this.children.list.slice(start);
    this.content = this.add.container(0, 0, objects).setDepth(9);
    this.panel.add(this.content);
    this.positionContent();
  }

  private positionContent(): void {
    const size = viewportSizeFromScale(this.scale);
    const safe = safeUiInsets(this);
    const width = size.width - safe.left - safe.right;
    const height = size.height - safe.top - safe.bottom;
    const factor = Math.min(1, width / 480, height / 270);
    // Scale the complete panel uniformly only when safe areas need the room.
    // Artwork, panel framing and touch regions retain the same proportions.
    this.panel.setScale(factor).setPosition(
      Math.floor(safe.left + (width - 480 * factor) / 2),
      Math.floor(safe.top + (height - 270 * factor) / 2),
    );
  }

  private addSkinCard(skinId: SkinId, x: number, y: number): void {
    const save = SaveSystem.load();
    const unlocked = save.unlockedSkins.includes(skinId);
    const equipped = save.selectedSkin === skinId;
    const selected = this.selectedId === skinId;
    const key = selected ? UI_KEYS.skinCardSelected : equipped ? UI_KEYS.skinCardEquipped : unlocked ? UI_KEYS.skinCardNormal : UI_KEYS.skinCardLocked;
    const background = this.add.image(0, 0, key).setDisplaySize(54, 111);
    const band = this.add.rectangle(0, -21, 42, 44, PREVIEW_COLORS[skinId]);
    const sheep = this.add.image(0, -22, sheepTextureKey(skinId), 0).setDisplaySize(36, 31.5);
    const name = addPixelText(this, 0, 6, SKIN_NAMES[skinId], 10);
    const definition = SHEEP_SKINS.find((entry) => entry.id === skinId)!;
    const purchase = wardrobePurchaseState(definition, save);
    const cost = addPixelText(this, purchase.currency ? 6 : 0, 26, purchase.costLabel, 10);
    const children: Phaser.GameObjects.GameObject[] = [background, band, sheep, name, cost];
    if (purchase.currency) children.push(this.add.image(-15, 26, uiIconKey(purchase.currency)).setDisplaySize(11, 11));
    if (equipped) {
      children.push(this.add.image(0, 43, UI_KEYS.buttonEquipped).setDisplaySize(45, 18));
      children.push(addPixelText(this, 0, 42, "已装备", 10, 0xfff3ce));
    } else if (unlocked) {
      children.push(addPixelText(this, 0, 42, "已解锁", 10, 0x46692b));
    } else {
      children.push(this.add.image(0, 43, uiIconKey("lock")).setDisplaySize(11, 11));
    }
    const card = this.add.container(x, y, children).setName("skin-card:" + skinId).setData("state", equipped ? "equipped" : unlocked ? "normal" : "locked").setData("selected", selected)
      .setData("currency", purchase.currency).setData("price", definition.unlock.amount).setData("unlockType", definition.unlock.type);
    bindTouchTarget(this, card, 54, 111, () => { this.selectedId = skinId; this.message = ""; this.refresh(); }, (pressed) => background.setTint(pressed ? 0xf4d797 : 0xffffff));
  }
  private cycle(direction: number): void {
    const current = SHEEP_SKINS.findIndex((entry) => entry.id === this.selectedId);
    this.selectedId = SHEEP_SKINS[(current + direction + SHEEP_SKINS.length) % SHEEP_SKINS.length].id;
    this.message = "";
    this.refresh();
  }
  private changePage(direction: number): void {
    const currentPage = Math.floor(SHEEP_SKINS.findIndex((entry) => entry.id === this.selectedId) / CARDS_PER_PAGE);
    const pages = Math.ceil(SHEEP_SKINS.length / CARDS_PER_PAGE);
    this.selectedId = SHEEP_SKINS[((currentPage + direction + pages) % pages) * CARDS_PER_PAGE].id;
    this.message = "";
    this.refresh();
  }
  private unlockMessage(result: SkinUnlockResult, purchase: boolean): string {
    if (result.status === "storage-error") return SAVE_ERROR_MESSAGE;
    if (result.status === "unlocked") return purchase ? "购买成功" : "解锁成功";
    if (result.status === "already-unlocked") return "已经解锁";
    if (result.status === "insufficient-stars") return "星星不足";
    if (result.status === "insufficient-coins") return "金币不足";
    return "暂不可用";
  }
}
