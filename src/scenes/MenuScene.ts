import Phaser from "phaser";
import { SCENE } from "../game/Constants";
import { SaveSystem } from "../systems/SaveSystem";
import { addPastureBackdrop } from "../ui/PastureUi";
import { centerSceneContent } from "../game/Viewport";
import { addMenuArtButton, attachMenuArt } from "../ui/MenuArtLayer";
import { attachMenuEasterEgg } from "../ui/EasterEggs";
import { attachCollectionAlbum } from "../ui/CollectionAlbum";
import { attachJourneyBook } from "../ui/JourneyBook";
import { journeyStore } from "../systems/JourneyStore";
import { collectionStore } from "../systems/CollectionStore";
import { attachMailbox } from "../ui/Mailbox";
import { openMenuSettings } from "../ui/MenuModal";

export class MenuScene extends Phaser.Scene {
  private openMailbox = false;
  constructor() { super({ key: SCENE.menu }); }
  init(data?: { openMailbox?: boolean }): void { this.openMailbox = data?.openMailbox === true; if (data) delete data.openMailbox; }
  create(): void {
    const status = document.getElementById("game-status");
    if (status) status.textContent = "牧场已就绪，可以开始奔跑。";
    const background = addPastureBackdrop(this);
    const settings = addMenuArtButton(this, "settings", "settings", () => openMenuSettings(this, () => {
      this.scene.pause(SCENE.menu);
      this.scene.launch(SCENE.pause, { returnScene: SCENE.menu });
    }));
    this.add.ellipse(240, 196, 63, 8, 0x466635, 0.28).setDepth(3);
    const sheep = this.add.image(240, 169, "sheep-runner", 0).setDisplaySize(72, 63).setDepth(4).setName("menu-sheep");
    this.add.image(191, 181, "ui-flower-white").setDisplaySize(11, 11).setDepth(4).setName("menu-flower-white");
    this.add.image(285, 189, "ui-flower-yellow").setDisplaySize(12, 12).setDepth(4).setName("menu-flower-yellow");
    const start = addMenuArtButton(this, "start", "开始游戏", () => this.startRun());
    const wardrobe = addMenuArtButton(this, "wardrobe", "衣橱", () => this.openWardrobe());
    centerSceneContent(this, [background, settings, start, wardrobe]);
    attachMenuArt(this, SaveSystem.load().highScore, { settings, start, wardrobe });
    attachMenuEasterEgg(this, sheep);
    journeyStore.reconcile(SaveSystem.load().unlockedSkins, collectionStore.load().ids);
    const journal = attachJourneyBook(this);
    attachCollectionAlbum(this, journal.openReward);
    attachMailbox(this, this.openMailbox);
  }
  private startRun(): void { this.scene.start(SCENE.run); }
  private openWardrobe(): void { this.scene.start(SCENE.wardrobe); }
}
