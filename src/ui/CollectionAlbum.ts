import type Phaser from "phaser";
import { COLLECTION_BADGES, COLLECTION_SEASON_NAMES, type CollectionBadgeId } from "../data/pastureCollections";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import type { ThemeId } from "../environment/types";
import { collectionStore } from "../systems/CollectionStore";
import { UI_KEYS, uiIconKey } from "../data/uiAssets";
import { watchViewport } from "../game/Viewport";
import { safeUiInsets } from "./UiLayout";
import { bindTouchTarget } from "./TouchTarget";
import { displayCanvasText } from "./DisplayCanvasText";
import { createDisplayOverlay } from "./DisplayOverlay";
import { menuBookEntryLayout, menuBookButtonContent, type ArtRect } from "./MenuArtLayout";
import { collectionCount, SEASON_LETTERS, type RewardId } from "../data/journeyBook";
import { journeyStore } from "../systems/JourneyStore";
import { acquireMenuModal, menuModalOwner, MENU_MODAL_CHANGE } from "./MenuModal";

export function attachCollectionAlbum(scene:Phaser.Scene,openReward:(id:RewardId,closed?:()=>void)=>void=()=>{}):void {
  if(!scene.game.canvas?.parentElement||!scene.game.events)return;
  scene.data.set("collection-album-open",false);
  const text=displayCanvasText(scene),softText=displayCanvasText(scene,"#8a725e");
  let open=false,season:ThemeId="spring",selected:CollectionBadgeId="spring-flower";
  let release:(()=>void)|undefined;
  let snapshot=collectionStore.load(),panel:ArtRect,entryBox:ArtRect,closeBox:ArtRect;
  const pressed=new Set<string>();
  const entry=scene.add.container(0,0,[]).setDepth(7).setName("button:收藏册");
  const blocker=scene.add.container(0,0,[]).setDepth(200).setName("collection-album-blocker");
  const close=scene.add.container(0,0,[]).setDepth(202).setName("button:合上收藏册");
  const letter=scene.add.container(0,0,[]).setDepth(202).setName("collection-reward");
  const complete=scene.add.container(0,0,[]).setDepth(202).setName("collection-complete-reward");
  const tabs=SEASON_ORDER.map(id=>scene.add.container(0,0,[]).setDepth(202).setName(`collection-tab:${id}`));
  const cards=Array.from({length:3},(_,i)=>scene.add.container(0,0,[]).setDepth(202).setName(`collection-card:${i}`));
  const tabBoxes:ArtRect[]=[],cardBoxes:ArtRect[]=[];
  const art=(ctx:CanvasRenderingContext2D,key:string,box:ArtRect)=>{
    const image=scene.textures.get(key).getSourceImage() as HTMLImageElement;
    ctx.drawImage(image,0,0,image.width,image.height,box.x,box.y,box.width,box.height);
  };
  const button=(ctx:CanvasRenderingContext2D,key:string,box:ArtRect)=>{
    const image=scene.textures.get(key).getSourceImage() as HTMLImageElement,corner=44,w=corner*box.height/image.height;
    ctx.drawImage(image,0,0,corner,image.height,box.x,box.y,w,box.height);
    ctx.drawImage(image,corner,0,image.width-corner*2,image.height,box.x+w,box.y,box.width-w*2,box.height);
    ctx.drawImage(image,image.width-corner,0,corner,image.height,box.x+box.width-w,box.y,w,box.height);
  };
  const surface=createDisplayOverlay(scene,"collection-album",ctx=>{
    const size=scene.scale.gameSize,lines:{text:string;box:ArtRect;ink:ArtRect}[]=[];
    const line=(value:string,box:ArtRect,max=12,muted=false)=>{
      const painter=muted?softText:text;
      const result=painter(ctx,value,box,painter.fitFontSize(value,box.width,max));
      lines.push({text:value,box,ink:result.ink});
    };
    if(!open&&!menuModalOwner(scene)){
      const shift=pressed.has("entry")?1:0;
      const paintBox={...entryBox,y:entryBox.y+shift},content=menuBookButtonContent(paintBox);
      art(ctx,"collection-album-button",paintBox);
      art(ctx,"collection-album-icon",content.icon);
      const journal=journeyStore.load();
      if(journal.rewards.all){
        ["spring-flower","summer-sunflower","autumn-maple","winter-snowflake"].forEach((id,i)=>art(ctx,`collection-${id}`,{x:entryBox.x+8+(i%2)*32,y:entryBox.y+7+Math.floor(i/2)*11+shift,width:8,height:8}));
      }
      if(Object.keys(journal.rewards).some(id=>!journal.readRewards.includes(id as RewardId))){ctx.fillStyle="#e57849";ctx.fillRect(entryBox.x+45,entryBox.y+5+shift,6,6);}
      line("收藏册",content.label,10);
      if(scene.data.get("menu-bedtime")===true||pressed.has("entry")){
        ctx.save();ctx.globalCompositeOperation="source-atop";
        ctx.fillStyle=scene.data.get("menu-bedtime")===true?(shift?"rgba(42,46,72,0.38)":"rgba(42,46,72,0.30)"):"rgba(237,181,92,0.22)";
        ctx.fillRect(entryBox.x,entryBox.y+shift,entryBox.width,entryBox.height);ctx.restore();
      }
    }else if(open){
      ctx.fillStyle="rgba(36,35,47,0.70)";ctx.fillRect(0,0,size.width,size.height);
      art(ctx,"collection-album-book",panel);
      const k=panel.width/430,box=(x:number,y:number,width:number,height:number):ArtRect=>({x:panel.x+x*k,y:panel.y+y*k,width:width*k,height:height*k});
      const journal=journeyStore.load(),count=collectionCount(snapshot.ids,season),ready=Boolean(journal.rewards[season]);
      line(journal.rewards.all?"四季都陪你 · 收藏册":"给催眠羊的四季收藏册",box(40,27,350,21),17*k);
      line(`${COLLECTION_SEASON_NAMES[season]}收藏 ${count} / 3 · 全册 ${snapshot.ids.length} / 12`,box(40,49,205,12),9*k);
      line(journal.rewards.all?"打开四季完整来信":"集齐四季，打开完整来信",box(257,49,133,12),9*k,!journal.rewards.all);
      SEASON_ORDER.forEach((id,i)=>{
        button(ctx,id===season?UI_KEYS.buttonSelected:pressed.has(`tab:${id}`)?UI_KEYS.buttonSecondaryPressed:UI_KEYS.buttonSecondary,tabBoxes[i]);
        line(COLLECTION_SEASON_NAMES[id],tabBoxes[i],12*k);
      });
      const badges=COLLECTION_BADGES.filter(badge=>badge.season===season);
      badges.forEach((badge,i)=>{
        const cell=cardBoxes[i],unlocked=snapshot.ids.includes(badge.id);
        art(ctx,badge.id===selected?UI_KEYS.skinCardSelected:unlocked?UI_KEYS.skinCardNormal:UI_KEYS.skinCardLocked,cell);
        const icon={x:cell.x+9*k,y:cell.y+9*k,width:38*k,height:38*k};
        ctx.save();ctx.globalAlpha=unlocked?1:.28;art(ctx,`collection-${badge.id}`,icon);ctx.restore();
        if(!unlocked)art(ctx,uiIconKey("lock"),{x:cell.x+39*k,y:cell.y+38*k,width:12*k,height:12*k});
        line(badge.name,{x:cell.x+2*k,y:cell.y+50*k,width:cell.width-4*k,height:15*k},11*k);
        line(unlocked?"已收集":"未发现",{x:cell.x+2*k,y:cell.y+65*k,width:cell.width-4*k,height:12*k},9*k,!unlocked);
      });
      const badge=COLLECTION_BADGES.find(badge=>badge.id===selected)!;
      const unlocked=snapshot.ids.includes(badge.id);
      art(ctx,`collection-${badge.id}`,box(289,92,48,48));
      line(unlocked?badge.name:"等你来发现",box(242,143,142,17),14*k);
      const value=unlocked?badge.message:"找到这枚徽章，就能读到藏在这里的悄悄话。";
      const rows:string[]=[];let row="";
      for(const char of value){if(text.fitFontSize(row+char,162*k,11*k)<11*k&&row){rows.push(row);row="";}row+=char;}
      if(row)rows.push(row);
      // Keep closing punctuation with the preceding character when wrapping.
      for(let i=1;i<rows.length;i++)if(/^[\u3002\uff0c\uff01\uff1f\u3001\uff1b\uff1a]/.test(rows[i])){
        const previous=[...rows[i-1]],last=previous.pop()!;rows[i-1]=previous.join("");rows[i]=last+rows[i];
      }
      rows.forEach((value,i)=>line(value,box(232,164+i*15,162,15),11*k));
      // Small folded envelope; the art and message live on a separate permanent reward page.
      const envelope=box(24,184,25,19);ctx.fillStyle=ready?"#ffdda0":"#cbb89a";ctx.fillRect(envelope.x,envelope.y,envelope.width,envelope.height);
      ctx.strokeStyle="#8c5935";ctx.lineWidth=k;ctx.strokeRect(envelope.x,envelope.y,envelope.width,envelope.height);
      ctx.beginPath();ctx.moveTo(envelope.x,envelope.y);ctx.lineTo(envelope.x+envelope.width/2,envelope.y+envelope.height/2);ctx.lineTo(envelope.x+envelope.width,envelope.y);ctx.stroke();
      line(ready?`打开${SEASON_LETTERS[season].title}`:`再找到 ${3-count} 枚，就能打开来信`,box(54,184,145,13),9*k,!ready);
      line(snapshot.saveFailed||journal.saveFailed?"收藏暂未保存，下次再试试":ready?"插画和留言，可以随时重看":"每季集齐三枚，收一封温柔来信",box(22,199,178,12),9*k,true);
      button(ctx,pressed.has("close")?UI_KEYS.buttonSecondaryPressed:UI_KEYS.buttonSecondary,closeBox);
      line("合上收藏册",closeBox,12*k);
    }
    surface.canvas.dataset.open=String(open);surface.canvas.dataset.season=season;surface.canvas.dataset.selected=selected;
    surface.canvas.dataset.unlocked=JSON.stringify(snapshot.ids);surface.canvas.dataset.lines=JSON.stringify(lines);
    surface.canvas.dataset.panel=JSON.stringify(panel);surface.canvas.dataset.entry=JSON.stringify(entryBox);
    surface.canvas.dataset.night=String(scene.data.get("menu-bedtime")===true);
    surface.canvas.dataset.rewards=JSON.stringify(journeyStore.load().rewards);
  },7);
  const modalTargets=[blocker,close,letter,complete,...tabs,...cards];
  const refresh=()=>{snapshot=collectionStore.load();const j=journeyStore.load(),active=open&&menuModalOwner(scene)==="collection";letter.input!.enabled=active&&Boolean(j.rewards[season]);complete.input!.enabled=active&&Boolean(j.rewards.all);surface.invalidate();};
  const setOpen=(value:boolean)=>{
    if(value){const lease=acquireMenuModal(scene,"collection",modalTargets);if(!lease)return;release=lease;}
    open=value;if(value)snapshot=collectionStore.retrySave();
    modalTargets.forEach(target=>target.input!.enabled=value);
    scene.data.set("collection-album-open",value);pressed.clear();surface.invalidate();
    if(!value){release?.();release=undefined;}
    refresh();
  };
  const feedback=(key:string)=>(value:boolean)=>{value?pressed.add(key):pressed.delete(key);surface.invalidate();};
  bindTouchTarget(scene,entry,56,48,()=>setOpen(true),feedback("entry"));
  bindTouchTarget(scene,blocker,1,1,()=>{},()=>{});
  bindTouchTarget(scene,close,128,36,()=>setOpen(false),feedback("close"));
  tabs.forEach((tab,i)=>bindTouchTarget(scene,tab,84,32,()=>{season=SEASON_ORDER[i];selected=COLLECTION_BADGES.find(badge=>badge.season===season)!.id;refresh();},feedback(`tab:${SEASON_ORDER[i]}`)));
  cards.forEach((card,i)=>bindTouchTarget(scene,card,56,81,()=>{selected=COLLECTION_BADGES.filter(badge=>badge.season===season)[i].id;surface.invalidate();},feedback(`card:${i}`)));
  bindTouchTarget(scene,letter,178,26,()=>openReward(season,refresh),feedback("letter"));
  bindTouchTarget(scene,complete,133,15,()=>openReward("all",refresh),feedback("complete"));
  modalTargets.forEach(target=>target.input!.enabled=false);
  watchViewport(scene,size=>{
    const safe=safeUiInsets(scene),k=Math.min(1,(size.width-safe.left-safe.right-16)/430,(size.height-safe.top-safe.bottom-16)/234);
    panel={x:safe.left+(size.width-safe.left-safe.right-430*k)/2,y:safe.top+(size.height-safe.top-safe.bottom-234*k)/2,width:430*k,height:234*k};
    entryBox=menuBookEntryLayout(size,safe).collection;entry.setPosition(entryBox.x+28,entryBox.y+24);
    closeBox={x:panel.x+151*k,y:panel.y+213*k,width:128*k,height:26*k};close.setPosition(closeBox.x+closeBox.width/2,closeBox.y+closeBox.height/2);
    close.setSize(128*k,36*k);close.input!.hitArea.setSize(128*k,36*k);
    tabs.forEach((target,i)=>{const box={x:panel.x+(31+i*94)*k,y:panel.y+65*k,width:86*k,height:26*k};tabBoxes[i]=box;target.setPosition(box.x+box.width/2,box.y+box.height/2).setSize(86*k,32*k);target.input!.hitArea.setSize(86*k,32*k);});
    cards.forEach((target,i)=>{const box={x:panel.x+(20+i*60)*k,y:panel.y+97*k,width:56*k,height:81*k};cardBoxes[i]=box;target.setPosition(box.x+28*k,box.y+40.5*k).setSize(56*k,81*k);target.input!.hitArea.setSize(56*k,81*k);});
    letter.setPosition(panel.x+111*k,panel.y+195*k).setSize(178*k,26*k);letter.input!.hitArea.setSize(178*k,26*k);
    complete.setPosition(panel.x+323.5*k,panel.y+55*k).setSize(133*k,15*k);complete.input!.hitArea.setSize(133*k,15*k);
    blocker.setPosition(size.width/2,size.height/2).setSize(size.width,size.height);blocker.input!.hitArea.setSize(size.width,size.height);
    surface.invalidate();
  });
  let previousNight=scene.data.get("menu-bedtime"),previousJournal=false;
  const night=()=>{
    const value=scene.data.get("menu-bedtime");if(value!==previousNight){previousNight=value;surface.invalidate();}
    const journalOpen=scene.data.get("journey-book-open")===true;
    if(journalOpen!==previousJournal){previousJournal=journalOpen;surface.show(!journalOpen);}
  };
  const modalChanged=()=>{if(open)refresh();else surface.invalidate();};
  scene.events.on(MENU_MODAL_CHANGE,modalChanged);
  scene.events.on("postupdate",night);scene.events.once("shutdown",()=>{scene.events.off(MENU_MODAL_CHANGE,modalChanged);scene.events.off("postupdate",night);scene.data.set("collection-album-open",false);});
  surface.show(true);
}
