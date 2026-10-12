import type Phaser from "phaser";
import { sheepTextureKey, type SkinId } from "../data/sheepSkins";
import { sheepAnimationForState } from "../entities/SheepAnimation";
import { WORLD } from "../game/Constants";
import { COMPANION_BELL_ART } from "./companionAssets";
import { companionPose, type LeadPose } from "./CompanionPose";
import { companionAccessory } from "./CompanionAccessory";
import { companionCanCelebrate, CompanionResponses, COMPANION_RESPONSE_KEYS, type CompanionResponseKind } from "./CompanionResponses";

/** Display objects only: no Sheep instance, physics body, input, timers or tween. */
export class CompanionView {
  readonly sheep: Phaser.GameObjects.Sprite;
  private readonly bell: Phaser.GameObjects.Image;
  private readonly collar: Phaser.GameObjects.Rectangle;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly responses = new CompanionResponses();
  private readonly responseIcons: Readonly<Record<CompanionResponseKind, Phaser.GameObjects.Image>>;
  private disposed = false;
  constructor(scene: Phaser.Scene, readonly skin: SkinId, private readonly startedAtMs: number, private readonly reducedMotion: boolean) {
    this.sheep = scene.add.sprite(0, WORLD.groundY, sheepTextureKey(skin), 1).setOrigin(.5, 1).setDepth(7.5).setName("companion-sheep");
    this.sheep.setData("skin", skin).setData("visual-only", true);
    this.shadow = scene.add.ellipse(0, WORLD.groundY - 1, 27, 4, 0x3f704b, .18).setDepth(5.5).setName("companion-shadow");
    this.collar = scene.add.rectangle(0, 0, 5, 1, 0x6e7753).setDepth(7.6).setName("companion-collar");
    this.bell = scene.add.image(0, 0, COMPANION_BELL_ART.key).setOrigin(.5, 0).setDisplaySize(6, 7).setDepth(7.7).setName("companion-neck-bell");
    const createIcon = (kind: CompanionResponseKind, size: number) => {
      const image = scene.add.image(0, 0, COMPANION_RESPONSE_KEYS[kind]).setDepth(7.8)
        .setName(`companion-response-${kind}`).setData("visual-only", true).setVisible(false);
      image.setScale(size / Math.max(image.width, image.height));
      return image;
    };
    this.responseIcons = { star: createIcon("star", 12), crown: createIcon("crown", 16), heart: createIcon("heart", 13) };
  }
  respond(kind: "star" | "crown", nowMs: number): void { if (!this.disposed) this.responses.request(kind, nowMs); }
  update(nowMs: number, lead: LeadPose, viewportLeft: number): boolean {
    if (this.disposed) return true;
    const pose = companionPose(lead, Math.max(0, nowMs - this.startedAtMs), viewportLeft, this.reducedMotion);
    if (pose.phase === "gone") { this.destroy(); return true; }
    const response = this.responses.update(nowMs, pose.phase, companionCanCelebrate(lead));
    if (response?.kind === "star" && !this.reducedMotion) pose.angle += Math.sin(response.progress * Math.PI * 2) * 3;
    this.sheep.setPosition(pose.x, pose.y).setDisplaySize(pose.width, pose.height).setAngle(pose.angle).setData("phase", pose.phase);
    this.sheep.setData("response", response?.kind ?? null);
    for (const kind of ["star", "crown", "heart"] as const) {
      const icon = this.responseIcons[kind];
      icon.setVisible(response?.kind === kind);
      if (response?.kind !== kind) continue;
      const rise = this.reducedMotion ? 0 : Math.sin(response.progress * Math.PI) * 3;
      icon.setPosition(Math.round(pose.x), Math.round(pose.y - pose.height - 9 - rise));
      icon.setAngle(kind === "star" && !this.reducedMotion ? Math.sin(response.progress * Math.PI * 2) * 7 : 0);
    }
    const animation = sheepAnimationForState(pose.state, this.skin);
    if (this.sheep.anims.currentAnim?.key !== animation) this.sheep.play(animation, true);
    const accessory = companionAccessory(pose, this.sheep.frame.name, nowMs, this.reducedMotion);
    this.collar.setPosition(accessory.x, accessory.y).setAngle(accessory.collarAngle);
    this.bell.setPosition(accessory.bellX, accessory.bellY).setAngle(accessory.bellAngle);
    this.shadow.setPosition(pose.x, WORLD.groundY - 1).setAlpha(Math.max(.06, .18 - (WORLD.groundY - pose.y) / 700));
    return false;
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.responses.clear();
    this.sheep.destroy(); this.bell.destroy(); this.collar.destroy(); this.shadow.destroy();
    for (const icon of Object.values(this.responseIcons)) icon.destroy();
  }
}
