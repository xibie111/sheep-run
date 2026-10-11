import Phaser from "phaser";
import { createGameConfig } from "./GameConfig";
import { adaptiveViewportSize } from "./Viewport";
import { AudioSystem } from "../systems/AudioSystem";

export class SheepRunGame {
  readonly instance: Phaser.Game;
  private readonly viewportObserver: ResizeObserver;
  private readonly audio = new AudioSystem();
  private readonly unlockAudio = (event: PointerEvent): void => {
    if (event.pointerType === "touch") this.audio.initializeAfterGesture();
  };
  private readonly syncViewport = (): void => {
    if (!this.instance.isBooted) return;
    const size = adaptiveViewportSize(this.parent.clientWidth, this.parent.clientHeight);
    const current = this.instance.scale.gameSize;
    if (size.width !== current.width || size.height !== current.height) {
      this.instance.scale.setGameSize(size.width, size.height);
    } else {
      this.instance.scale.refresh();
    }
  };

  constructor(private readonly parent: HTMLElement) {
    this.instance = new Phaser.Game(createGameConfig(parent));
    this.instance.registry.set("audioSystem", this.audio);
    this.instance.events.once(Phaser.Core.Events.DESTROY, () => this.audio.destroy());
    parent.addEventListener("pointerdown", this.unlockAudio);
    this.viewportObserver = new ResizeObserver(this.syncViewport);
    this.viewportObserver.observe(parent);
    this.instance.events.once(Phaser.Core.Events.READY, this.syncViewport);
    window.addEventListener("resize", this.syncViewport);
    window.visualViewport?.addEventListener("resize", this.syncViewport);
  }

  destroy(): void {
    this.parent.removeEventListener("pointerdown", this.unlockAudio);
    this.audio.destroy();
    this.viewportObserver.disconnect();
    window.removeEventListener("resize", this.syncViewport);
    window.visualViewport?.removeEventListener("resize", this.syncViewport);
    this.instance.destroy(true);
  }
}
