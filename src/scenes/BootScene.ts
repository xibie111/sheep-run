import Phaser from "phaser";
import { SCENE } from "../game/Constants";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.boot });
  }

  create(): void {
    this.scene.start(SCENE.preload);
  }
}
