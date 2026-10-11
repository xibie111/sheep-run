import type Phaser from "phaser";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import { sheepTextureKey } from "../data/sheepSkins";

export function addRecordCelebration(scene:Phaser.Scene,root:Phaser.GameObjects.Container):void {
  if(!scene.game.canvas?.parentElement||!scene.tweens)return;
  const sheep=scene.add.image(410,180,sheepTextureKey(ProgressionSystem.currentRun().skinId),0)
    .setDisplaySize(46,41).setName("result-cheer-sheep");
  root.add(sheep);
  const stars=[scene.add.image(390,148,"feedback-sparkle").setDisplaySize(11,11),scene.add.image(432,158,"feedback-sparkle").setDisplaySize(8,8)];
  stars.forEach(star=>{star.setName("result-cheer-sparkle");root.add(star);});
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  scene.tweens.add({targets:sheep,y:164,angle:5,duration:220,yoyo:true,repeat:2,ease:"Sine.easeOut"});
  scene.tweens.add({targets:stars,alpha:.25,duration:260,yoyo:true,repeat:3});
}
