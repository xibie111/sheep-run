import type Phaser from "phaser";
import { ACHIEVEMENTS, type AchievementId } from "../data/journeyBook";
import { createDisplayOverlay } from "./DisplayOverlay";
import { displayCanvasText } from "./DisplayCanvasText";
import { AudioSystem } from "../systems/AudioSystem";

/** Small queued notice; effective scene delta freezes it with pause. Details stay in the book. */
export class JourneyToast {
  private pending:string[]=[];private message="";private remaining=0;
  private readonly surface:ReturnType<typeof createDisplayOverlay>;
  constructor(private readonly scene:Phaser.Scene){
    const text=displayCanvasText(scene,"#fff5d6"),outline=displayCanvasText(scene,"#4a382f");
    this.surface=createDisplayOverlay(scene,"journey-toast",ctx=>{
      const size=scene.scale.gameSize,box={x:24,y:size.height-38,width:size.width-48,height:15},font=text.fitFontSize(this.message,box.width,11),pixel=1/ctx.getTransform().a;
      for(const [x,y]of[[-1,0],[1,0],[0,-1],[0,1]])outline(ctx,this.message,{...box,x:box.x+x*pixel,y:box.y+y*pixel},font);
      text(ctx,this.message,box,font);this.surface.canvas.dataset.message=this.message;
    });
  }
  achievements(ids:readonly AchievementId[]):void {if(ids.length)this.pending.push(ids.length===1?`点亮印章 · ${ACHIEVEMENTS.find(a=>a.id===ids[0])!.name}`:`点亮 ${ids.length} 枚印章 · 回牧场看看吧`);}
  notice(message:string):void { this.pending.push(message); }
  update(deltaMs:number):void {
    const parent=this.scene.game.canvas.parentElement;
    const priority=parent?.querySelector<HTMLCanvasElement>('[data-easter-egg="score"]')?.style.display==="block"||parent?.querySelector<HTMLCanvasElement>('[data-adventure-overlay="collection-toast"]')?.style.display==="block";
    if(priority){this.surface.show(false);return;}
    this.remaining=Math.max(0,this.remaining-deltaMs);
    if(!this.remaining&&this.pending.length){this.message=this.pending.shift()!;this.remaining=2200;this.surface.invalidate();(this.scene.registry.get("audioSystem") as AudioSystem|undefined)?.play("starCollect");}
    this.surface.show(this.remaining>0);
  }
  clear():void {this.pending=[];this.remaining=0;this.surface.show(false);}
}
