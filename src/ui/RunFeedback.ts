import type Phaser from "phaser";
import type { Sheep } from "../entities/Sheep";
import type { ActivePowerUp } from "../systems/PowerUpSystem";

interface Fleck { image: Phaser.GameObjects.Image; age:number; duration:number; x:number; y:number; vx:number; vy:number; size:number; aspect:number }

/** Render-only feedback: no bodies, input, score, reward or physics updates. */
export class RunFeedback {
  private readonly flecks: Fleck[] = [];
  private readonly shield: Phaser.GameObjects.Image;
  private readonly magnet: Phaser.GameObjects.Image[];
  private readonly doubles: Phaser.GameObjects.Image[];
  private readonly reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  constructor(private readonly scene: Phaser.Scene, private readonly sheep: Sheep) {
    this.shield = scene.add.image(0,0,"feedback-shield-bubble").setDepth(10).setVisible(false).setName("effect:shield-bubble");
    this.magnet = Array.from({length:3},(_,i)=>scene.add.image(0,0,"star").setDisplaySize(8,8).setTint(0xffbcdd).setDepth(10).setVisible(false).setName(`effect:magnet-star:${i}`));
    this.doubles = Array.from({length:2},(_,i)=>scene.add.image(0,0,"star").setDisplaySize(11,11).setDepth(10).setVisible(false).setName(`effect:double-star:${i}`));
  }
  update(nowMs:number,deltaMs:number,effects:readonly ActivePowerUp[]):void {
    const active = new Set(effects.map(effect=>effect.type));
    const x=this.sheep.x,y=this.sheep.y-this.sheep.displayHeight/2,phase=this.reduced?0:nowMs/800;
    this.shield.setVisible(active.has("shield")).setPosition(x,y).setDisplaySize(this.sheep.displayWidth+17,this.sheep.displayHeight+17).setAlpha(.68);
    this.magnet.forEach((image,i)=>{const angle=phase+i*Math.PI*2/3;image.setVisible(active.has("magnet")).setPosition(x+Math.cos(angle)*29,y+Math.sin(angle)*23);});
    this.doubles.forEach((image,i)=>image.setVisible(active.has("starMultiplier")).setPosition(x+(i?19:-19),y-this.sheep.displayHeight/2-7+(this.reduced?0:Math.sin(phase*2+i)*2)));
    for (const fleck of this.flecks) {
      if(!fleck.image.visible)continue;
      fleck.age+=Math.max(0,deltaMs);
      if(fleck.age>=fleck.duration){fleck.image.setVisible(false);continue;}
      const t=fleck.age/fleck.duration,seconds=fleck.age/1000;
      fleck.image.setPosition(fleck.x+fleck.vx*seconds,fleck.y+fleck.vy*seconds)
        .setAlpha(1-t).setDisplaySize(fleck.size*(1-t*.45),fleck.size*fleck.aspect*(1-t*.45));
    }
  }
  collect(x:number,y:number,tint=0xffffff):void {
    for(let i=0;i<(this.reduced?2:5);i++){
      const angle=-Math.PI*.85+i*Math.PI*.43;
      this.emit("feedback-sparkle",x,y,Math.cos(angle)*28,Math.sin(angle)*28,8,360,tint);
    }
  }
  land(x:number,y:number):void {
    for(let i=0;i<(this.reduced?1:3);i++)this.emit("feedback-dust",x-12+i*10,y-3,-12-i*7,-3-i*2,13,300,0xffffff);
  }
  shieldBreak(x:number,y:number):void {
    this.shield.setVisible(false);
    for(let i=0;i<(this.reduced?3:8);i++){
      const angle=i*Math.PI/4;
      this.emit("feedback-sparkle",x+Math.cos(angle)*18,y+Math.sin(angle)*18,Math.cos(angle)*48,Math.sin(angle)*48,10,440,0xa5e9ff);
    }
  }
  private emit(key:string,x:number,y:number,vx:number,vy:number,size:number,duration:number,tint:number):void {
    let fleck=this.flecks.find(item=>!item.image.visible);
    if(!fleck){
      if(this.flecks.length>=24)return;
      fleck={image:this.scene.add.image(0,0,key).setDepth(12).setName("effect:fleck"),age:0,duration:0,x:0,y:0,vx:0,vy:0,size:0,aspect:1};
      this.flecks.push(fleck);
    }
    Object.assign(fleck,{age:0,duration,x,y,vx:this.reduced?0:vx,vy:this.reduced?0:vy,size,aspect:key==="feedback-dust"?.5:1});
    fleck.image.setTexture(key).setPosition(x,y).setTint(tint).setAlpha(1).setDisplaySize(size,size).setVisible(true);
    if(key==="feedback-dust")fleck.image.setDisplaySize(size,size/2);
  }
}
