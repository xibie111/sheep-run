import type Phaser from "phaser";
import type { Sheep } from "../entities/Sheep";
import { CollectionSchedule, COLLECTION_SEASON_NAMES, type CollectionBadge } from "../data/pastureCollections";
import { collectionStore } from "../systems/CollectionStore";
import { journeyStore } from "../systems/JourneyStore";
import { collectionRewards, type AchievementId } from "../data/journeyBook";
import { WORLD } from "../game/Constants";
import { runViewportRight, viewportSizeFromScale } from "../game/Viewport";
import { createDisplayOverlay } from "./DisplayOverlay";
import { displayCanvasText } from "./DisplayCanvasText";
import type { RunFeedback } from "./RunFeedback";

/** One rare, harmless sprite at a time; never joins Arcade groups or awards currency. */
export class HiddenCollectionRun {
  private readonly schedule=new CollectionSchedule();
  private readonly image:Phaser.GameObjects.Image;
  private readonly queue:CollectionBadge[]=[];
  private badge:CollectionBadge|null=null;
  private message="";
  private toastMs=0;
  private phase=0;
  private readonly unlocked=new Set(collectionStore.load().ids);
  private readonly surface:ReturnType<typeof createDisplayOverlay>;
  constructor(private readonly scene:Phaser.Scene,private readonly sheep:Sheep,private readonly feedback:RunFeedback,
    private readonly onAchievements:(ids:AchievementId[])=>void=()=>{},
    private readonly onCollected:(id:string)=>void=()=>{}){
    this.image=scene.add.image(0,0,"collection-spring-flower").setDisplaySize(23,23).setDepth(7).setVisible(false).setName("hidden-collection");
    const text=displayCanvasText(scene,"#fff5d6"),outline=displayCanvasText(scene,"#4a382f");
    this.surface=createDisplayOverlay(scene,"collection-toast",ctx=>{
      const size=scene.scale.gameSize,box={x:16,y:size.height-20,width:size.width-32,height:16};
      const fontSize=text.fitFontSize(this.message,box.width,11),pixel=1/ctx.getTransform().a;
      for(const [dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]])outline(ctx,this.message,{...box,x:box.x+dx*pixel,y:box.y+dy*pixel},fontSize);
      text(ctx,this.message,box,fontSize);
      this.surface.canvas.dataset.message=this.message;
    });
  }
  update(deltaSeconds:number,speed:number,score:number):void {
    this.queue.push(...this.schedule.observe(score).filter(badge=>!this.unlocked.has(badge.id)));
    const priorityNote=this.scene.game.canvas.parentElement?.querySelector<HTMLCanvasElement>('[data-easter-egg="score"]');
    const delayed=priorityNote?.style.display==="block";
    if(!delayed)this.toastMs-=deltaSeconds*1000;
    this.surface.show(this.toastMs>0&&!delayed);
    if(!this.badge&&this.queue.length){
      this.badge=this.queue.shift()!;this.phase=0;
      this.image.setTexture(`collection-${this.badge.id}`).setPosition(runViewportRight(viewportSizeFromScale(this.scene.scale))+16,WORLD.groundY-25).setVisible(true);
      this.image.setData("badge-id",this.badge.id);
    }
    if(!this.badge)return;
    this.phase+=deltaSeconds*3;
    this.image.x-=speed*deltaSeconds;this.image.y=WORLD.groundY-25+Math.sin(this.phase)*3;
    const body=this.sheep.body as Phaser.Physics.Arcade.Body;
    const x=this.image.x,y=this.image.y;
    if(body.enable&&body.x<x+9&&body.right>x-9&&body.y<y+9&&body.bottom>y-9){
      const previousRewards=collectionRewards([...this.unlocked]);
      const result=collectionStore.unlock(this.badge.id);
      if(result.added)this.onCollected(this.badge.id);
      this.unlocked.add(this.badge.id);
      this.feedback.collect(x,y);
      this.message=result.saved?`发现 ${this.badge.name} · 收藏册点亮了`:`发现 ${this.badge.name} · 暂未保存`;
      const ids=collectionStore.load().ids,newRewards=collectionRewards(ids).filter(id=>!previousRewards.includes(id));
      this.onAchievements(journeyStore.reconcile([],ids));
      if(result.added&&newRewards.length)this.message=result.saved
        ?newRewards.includes("all")?"四季收藏完成，完整来信已送达。":`${COLLECTION_SEASON_NAMES[this.badge.season]}收藏完成，来信已送达。`
        :"收藏完成 · 暂未保存，请稍后再试";
      this.toastMs=2400;this.surface.invalidate();this.surface.show(!delayed);
      this.image.setVisible(false);this.badge=null;
    }else if(x<this.sheep.x-45){this.image.setVisible(false);this.badge=null;}
  }
}
