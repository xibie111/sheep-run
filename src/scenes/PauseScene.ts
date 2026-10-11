import Phaser from "phaser";
import { SCENE } from "../game/Constants";
import { AudioSystem } from "../systems/AudioSystem";
import { centerSceneContent, watchViewport } from "../game/Viewport";
import { addPauseDialog } from "../ui/PauseDialog";

export class PauseScene extends Phaser.Scene {
  private audioSystem!: AudioSystem;
  private returnScene: string = SCENE.run;
  constructor() { super({ key: SCENE.pause }); }
  init(data?: { returnScene?: string }): void {
    // Phaser may retain launch data after closing the menu's settings overlay.
    this.returnScene = this.scene.isPaused(SCENE.run) ? SCENE.run : data?.returnScene ?? SCENE.run;
  }
  create(): void {
    this.audioSystem = this.registry.get("audioSystem") as AudioSystem | undefined ?? new AudioSystem();
    this.registry.set("audioSystem", this.audioSystem);
    const overlay = this.add.rectangle(240, 135, 480, 270, 0x3b3528, 0.62).setDepth(40).setName("pause-dim-overlay");
    const activate = (action: () => void): (() => void) => () => { this.audioSystem.initializeAfterGesture(); action(); };
    addPauseDialog(this, [activate(() => this.resumeRun()), activate(() => this.restartRun()), activate(() => this.returnToMenu())]);
    centerSceneContent(this, [overlay]);
    watchViewport(this, (size) => overlay.setPosition(size.width / 2, size.height / 2).setSize(size.width, size.height));
  }
  private resumeRun(): void {
    this.audioSystem.initializeAfterGesture();
    this.audioSystem.play("button");
    this.scene.resume(this.returnScene ?? SCENE.run);
    this.scene.stop(SCENE.pause);
  }
  private restartRun(): void {
    this.audioSystem.play("button");
    const deliveryId = this.returnScene === SCENE.run ? this.scene.get(SCENE.run).data.get('delivery-id') : null;
    this.scene.stop(SCENE.run);
    if (deliveryId) this.scene.start(SCENE.run, { deliveryId });
    else this.scene.start(SCENE.run);
  }
  private returnToMenu(): void {
    this.audioSystem.play("button");
    const openMailbox = this.returnScene === SCENE.run && !!this.scene.get(SCENE.run).data.get('delivery-id');
    this.scene.stop(SCENE.run);
    this.scene.stop(SCENE.pause);
    if (openMailbox) this.scene.start(SCENE.menu, { openMailbox: true });
    else this.scene.start(SCENE.menu);
  }
}
