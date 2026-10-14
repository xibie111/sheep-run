import type Phaser from "phaser";
import { ACHIEVEMENTS, COMPLETE_LETTER, SEASON_LETTERS, type AchievementId, type RewardId } from "../data/journeyBook";
import { journeyStore, achievementProgress } from "../systems/JourneyStore";
import { UI_KEYS, uiIconKey } from "../data/uiAssets";
import { achievementIconKey } from "../data/achievementIconAssets";
import { watchViewport } from "../game/Viewport";
import { safeUiInsets } from "./UiLayout";
import { bindTouchTarget } from "./TouchTarget";
import { displayCanvasText, type DisplayCanvasPainter } from "./DisplayCanvasText";
import { createDisplayOverlay } from "./DisplayOverlay";
import { menuBookEntryLayout, menuBookButtonContent, type ArtRect } from "./MenuArtLayout";
import { AudioSystem } from "../systems/AudioSystem";
import { acquireMenuModal, menuModalOwner, MENU_MODAL_CHANGE } from "./MenuModal";
import { SCENERY_CARDS } from "../scenery/sceneryCatalog";
import { sceneryStore } from "../scenery/SceneryStore";
import { JOURNEY_CARDS_PER_PAGE, journeyPages, journeyPageContent, journeyCardIndex } from "./JourneyPostcardPages";

export function wrapJournalText(value:string,painter:DisplayCanvasPainter,width:number,font:number):string[]{
  const rows:string[]=[];let row="";
  for(const char of value){if(row&&painter.fitFontSize(row+char,width,font)<font){rows.push(row);row="";}row+=char;}
  if(row)rows.push(row);
  for(let i=1;i<rows.length;i++)if(/^[。，！？、；：]/.test(rows[i])){const prior=[...rows[i-1]],last=prior.pop()!;rows[i-1]=prior.join("");rows[i]=last+rows[i];}
  return rows;
}

/** Touch-only book, shared by the menu and the run's merged result summary. */
export function attachJourneyBook(scene:Phaser.Scene,resultIds?:readonly AchievementId[]){
  if(!scene.game.canvas?.parentElement||!scene.game.events)return {openReward:(_id:RewardId,_closed?:()=>void)=>{}};
  scene.data.set("journey-book-open",false);
  const text=displayCanvasText(scene),muted=displayCanvasText(scene,"#8a725e"),stampText=displayCanvasText(scene,"#446e50");
  const pages=journeyPages(ACHIEVEMENTS.length,SCENERY_CARDS.length);
  let open=false,page=0,mode:"achievements"|"reward"|"detail"|"postcard"="achievements",reward:RewardId="spring",selected:AchievementId="first-run";
  let scenery=sceneryStore.load(),postcard=0;
  let snapshot=journeyStore.load(),panel:ArtRect,entryBox:ArtRect,k=1,closed:(()=>void)|undefined;
  let release:(()=>void)|undefined;
  const pressed=new Set<string>();
  const entry=scene.add.container(0,0,[]).setDepth(8).setName(resultIds?"button:本局成就":"button:成就册");
  const blocker=scene.add.container(0,0,[]).setDepth(220).setName("journey-blocker");
  const close=scene.add.container(0,0,[]).setDepth(222).setName("button:合上手账");
  const prev=scene.add.container(0,0,[]).setDepth(222).setName("journey-prev"),next=scene.add.container(0,0,[]).setDepth(222).setName("journey-next");
  const cards=Array.from({length:JOURNEY_CARDS_PER_PAGE},(_,i)=>scene.add.container(0,0,[]).setDepth(222).setName(`achievement-card:${i}`));
  const modal=[blocker,close,prev,next,...cards];
  const b=(x:number,y:number,width:number,height:number):ArtRect=>({x:panel.x+x*k,y:panel.y+y*k,width:width*k,height:height*k});
  const art=(ctx:CanvasRenderingContext2D,key:string,box:ArtRect)=>{
    const image=scene.textures.get(key).getSourceImage() as HTMLImageElement;
    if(key.startsWith("journey-")||key.startsWith("scenery-")||key.startsWith("achievement-icon-")){const ratio=Math.min(box.width/image.width,box.height/image.height),w=image.width*ratio,h=image.height*ratio;ctx.drawImage(image,0,0,image.width,image.height,box.x+(box.width-w)/2,box.y+(box.height-h)/2,w,h);}
    else ctx.drawImage(image,0,0,image.width,image.height,box.x,box.y,box.width,box.height);
  };
  const button=(ctx:CanvasRenderingContext2D,box:ArtRect,key:string=UI_KEYS.buttonSecondary)=>{
    const image=scene.textures.get(key).getSourceImage() as HTMLImageElement,c=44,w=c*box.height/image.height;
    ctx.drawImage(image,0,0,c,image.height,box.x,box.y,w,box.height);ctx.drawImage(image,c,0,image.width-c*2,image.height,box.x+w,box.y,box.width-w*2,box.height);
    ctx.drawImage(image,image.width-c,0,c,image.height,box.x+box.width-w,box.y,w,box.height);
  };
  const surface=createDisplayOverlay(scene,"journey-book",ctx=>{
    const lines:{text:string;box:ArtRect;ink:ArtRect}[]=[];
    const content=journeyPageContent(pages,page);
    const line=(value:string,box:ArtRect,font=11,soft=false)=>{const p=soft?muted:text;lines.push({text:value,box,ink:p(ctx,value,box,p.fitFontSize(value,box.width,font)).ink});};
    const rows=(value:string,box:ArtRect,font=11,rowHeight=15)=>wrapJournalText(value,text,box.width,font).forEach((s,i)=>line(s,{...box,y:box.y+i*rowHeight,height:rowHeight},font));
    const unread=Object.keys(snapshot.achieved).some(id=>!snapshot.readAchievements.includes(id as AchievementId));
    if(!open){
      if(scene.data.get("collection-album-open")!==true&&!menuModalOwner(scene)){
        if(resultIds){button(ctx,entryBox);line(resultIds.length?`本局点亮 ${resultIds.length} 枚印章`:"看看小羊成就册",entryBox,11);}
        else {
          const paintBox={...entryBox,y:entryBox.y+(pressed.has("entry")?1:0)},content=menuBookButtonContent(paintBox);
          art(ctx,"collection-album-button",paintBox);art(ctx,"collection-album-icon",content.icon);
          art(ctx,uiIconKey("check"),{x:paintBox.x+29,y:paintBox.y+15,width:10,height:10});
          line("成就册",content.label,10);
          if(unread){ctx.fillStyle="#e57849";ctx.fillRect(paintBox.x+45,paintBox.y+5,6,6);}
          if(scene.data.get("menu-bedtime")===true){ctx.save();ctx.globalCompositeOperation="source-atop";ctx.fillStyle="rgba(42,46,72,0.30)";ctx.fillRect(paintBox.x,paintBox.y,paintBox.width,paintBox.height);ctx.restore();}
        }
      }
    }else {
      const size=scene.scale.gameSize;ctx.fillStyle="rgba(36,35,47,0.72)";ctx.fillRect(0,0,size.width,size.height);art(ctx,"collection-album-book",panel);
      if(mode==="postcard"){
        const card=SCENERY_CARDS[postcard];
        line(card.title,b(55,29,320,22),18*k);
        art(ctx,card.art,b(24,69,207,124));
        rows(card.message,b(246,75,157,15),12*k,19*k);
        line(scenery.saveFailed?"明信片暂未保存，本次仍可查看":"已遇见 · 随时可以回来看看",b(37,199,356,13),9*k,true);
      }else if(mode==="achievements"&&content.section==="postcards"){
        line("风景明信片",b(60,27,310,21),17*k);
        line(`已遇见 ${SCENERY_CARDS.filter(c=>scenery.seenIds.includes(c.id)).length} / ${SCENERY_CARDS.length} · 第 ${page+1} / ${pages.totalPages} 页`,b(80,50,270,13),10*k);
        SCENERY_CARDS.slice(content.first,content.end).forEach((card,i)=>{
          const x=25+(i%2)*195,y=77+Math.floor(i/2)*63,cell=b(x,y,185,57),seen=scenery.seenIds.includes(card.id);
          ctx.fillStyle=seen?"#fff0c9":"#e8d3ab";ctx.fillRect(cell.x,cell.y,cell.width,cell.height);
          if(seen)art(ctx,card.art,b(x+5,y+9,54,36));
          else art(ctx,uiIconKey("lock"),b(x+21,y+20,18,18));
          line(card.title,b(x+63,y+3,117,17),12*k);
          line(seen?"已遇见":"还未遇见",b(x+63,y+23,117,13),10*k,!seen);
          if(!seen)rows(card.hint,b(x+61,y+34,119,10),9*k,10*k);
        });
        line(scenery.saveFailed?"明信片暂未保存，本次仍可查看":"遇见后自动收好，轻点明信片重看",b(40,204,350,10),9*k,true);
      }else if(mode==="achievements"){
        line("小羊旅行手账",b(60,27,310,21),17*k);
        line(`点亮 ${Object.keys(snapshot.achieved).length} / ${ACHIEVEMENTS.length} · 第 ${page+1} / ${pages.totalPages} 页`,b(100,50,230,13),10*k);
        ACHIEVEMENTS.slice(content.first,content.end).forEach((a,i)=>{
          const x=25+(i%2)*195,y=77+Math.floor(i/2)*63,cell=b(x,y,185,57),done=Boolean(snapshot.achieved[a.id]);
          ctx.fillStyle=done?"#fff0c9":"#e8d3ab";ctx.fillRect(cell.x,cell.y,cell.width,cell.height);
          ctx.save();ctx.globalAlpha=done?1:.5;art(ctx,achievementIconKey(a.id),b(x+5,y+12,30,30));ctx.restore();
          line(a.name,b(x+41,y+3,138,17),12*k);
          line(a.condition,b(x+41,y+21,138,12),9*k,!done);
          line(done?`达成 ${snapshot.achieved[a.id]}`:`进度 ${achievementProgress(snapshot,a.id)} / ${a.goal}`,b(x+41,y+37,138,12),9*k,!done);
          if(resultIds?.includes(a.id)){ctx.fillStyle="#e57849";ctx.fillRect(cell.x+175*k,cell.y+4*k,5*k,5*k);}
        });
        line(snapshot.saveFailed?"手账暂未保存，请稍后再试":"轻点印章，读一段留给你的话",b(44,201,342,13),9*k,true);
      }else if(mode==="detail"){
        const a=ACHIEVEMENTS.find(a=>a.id===selected)!;
        line(a.name,b(55,30,320,22),18*k);line(a.condition,b(55,59,320,16),11*k);
        const done=Boolean(snapshot.achieved[a.id]);
        ctx.save();ctx.globalAlpha=done?1:.5;art(ctx,achievementIconKey(a.id),b(193,90,44,44));ctx.restore();
        stampText(ctx,done?"达成":"期待",b(243,102,56,20),14*k);
        rows(done?a.message:"每次奔跑都会留下进步。慢慢来，牧场一直等你。",b(57,151,316,15),11*k,15*k);
        line(done?`达成日期 ${snapshot.achieved[a.id]}`:`进度 ${achievementProgress(snapshot,a.id)} / ${a.goal}`,b(65,195,300,13),10*k,!done);
      }else if(reward==="all"){
        line("四季都陪你",b(70,29,290,22),18*k);
        if(page===0){
          ["spring","summer","autumn","winter"].forEach((s,i)=>art(ctx,`journey-${s}`,b(30+(i%2)*188,62+Math.floor(i/2)*67,180,64)));
          line("十二枚小纪念，换一封长长的喜欢",b(45,198,340,14),11*k);
        }else {
          line(`完整来信 · ${page} / ${COMPLETE_LETTER.length}`,b(80,58,270,14),10*k);
          rows(COMPLETE_LETTER[page-1],b(42,86,346,15),12*k,19*k);
        }
      }else {
        const letter=SEASON_LETTERS[reward];line(letter.title,b(55,28,320,22),18*k);
        art(ctx,`journey-${reward}`,b(23,69,197,132));rows(letter.message,b(233,71,171,15),11*k,17*k);
      }
      button(ctx,b(153,216,124,25),pressed.has("close")?UI_KEYS.buttonSecondaryPressed:UI_KEYS.buttonSecondary);line(mode==="detail"?"返回印章页":mode==="postcard"?"返回明信片":"合上手账",b(153,216,124,25),11*k);
      if(mode==="achievements"||(mode==="reward"&&reward==="all")){
        button(ctx,b(31,216,91,25));line("上一页",b(31,216,91,25),11*k);button(ctx,b(308,216,91,25));line("下一页",b(308,216,91,25),11*k);
      }
    }
    surface.canvas.dataset.open=String(open);surface.canvas.dataset.mode=mode;surface.canvas.dataset.page=String(page);surface.canvas.dataset.reward=reward;
    surface.canvas.dataset.lines=JSON.stringify(lines);surface.canvas.dataset.panel=JSON.stringify(panel);surface.canvas.dataset.entry=JSON.stringify(entryBox);
    surface.canvas.dataset.achieved=JSON.stringify(snapshot.achieved);surface.canvas.dataset.unread=String(unread);surface.canvas.dataset.saveFailed=String(snapshot.saveFailed);
    surface.canvas.dataset.scenery=JSON.stringify(scenery.seenIds);surface.canvas.dataset.postcard=String(postcard);
    surface.canvas.dataset.totalPages=String(pages.totalPages);surface.canvas.dataset.sceneryStartPage=String(pages.achievementPages);surface.canvas.dataset.sceneryPages=String(pages.postcardPages);
    surface.canvas.dataset.visibleCards=JSON.stringify(mode!=="achievements"?[]:(content.section==="postcards"?SCENERY_CARDS:ACHIEVEMENTS).slice(content.first,content.end).map(card=>card.id));
    surface.canvas.dataset.cardTargets=JSON.stringify(cards.map(card=>Boolean(card.input?.enabled)));
  },9);
  const updateTargets=()=>{
    const album=scene.data.get("collection-album-open")===true;
    const owner=menuModalOwner(scene),active=open&&owner==="journey";
    entry.input!.enabled=!open&&!album&&!owner;
    modal.forEach(t=>t.input!.enabled=active);
    const content=journeyPageContent(pages,page);
    const paging=mode==="achievements"||(mode==="reward"&&reward==="all"),last=mode==="achievements"?pages.totalPages-1:COMPLETE_LETTER.length;
    prev.input!.enabled=active&&paging&&page>0;next.input!.enabled=active&&paging&&page<last;
    cards.forEach((c,i)=>{const index=journeyCardIndex(content,i);c.input!.enabled=active&&mode==="achievements"&&index!==undefined&&(content.section!=="postcards"||scenery.seenIds.includes(SCENERY_CARDS[index].id));});
  };
  const changed=()=>{snapshot=journeyStore.load();scenery=sceneryStore.load();updateTargets();surface.invalidate();};
  const feedback=(key:string)=>(value:boolean)=>{value?pressed.add(key):pressed.delete(key);surface.invalidate();};
  const sound=()=>{const audio=scene.registry.get("audioSystem") as AudioSystem|undefined;audio?.initializeAfterGesture();audio?.play("button");};
  const show=(parent?:string)=>{const lease=acquireMenuModal(scene,"journey",modal,parent);if(!lease)return false;release=lease;open=true;scene.data.set("journey-book-open",true);sound();changed();return true;};
  const shut=()=>{if(mode==="detail"||mode==="postcard"){mode="achievements";changed();return;}open=false;scene.data.set("journey-book-open",false);release?.();release=undefined;sound();closed?.();closed=undefined;changed();};
  bindTouchTarget(scene,entry,56,48,()=>{mode="achievements";page=0;show();},feedback("entry"));
  bindTouchTarget(scene,blocker,1,1,()=>{},()=>{});bindTouchTarget(scene,close,124,32,shut,feedback("close"));
  const flip=(direction:number)=>{const last=mode==="achievements"?pages.totalPages-1:COMPLETE_LETTER.length;page=Math.max(0,Math.min(last,page+direction));if(mode==="reward"&&page===last)journeyStore.readReward("all");sound();changed();};
  bindTouchTarget(scene,prev,91,32,()=>flip(-1),feedback("prev"));bindTouchTarget(scene,next,91,32,()=>flip(1),feedback("next"));
  cards.forEach((target,i)=>bindTouchTarget(scene,target,185,57,()=>{
    if(mode!=="achievements")return;
    const content=journeyPageContent(pages,page),index=journeyCardIndex(content,i);if(index===undefined)return;
    if(content.section==="postcards"){if(!scenery.seenIds.includes(SCENERY_CARDS[index].id))return;postcard=index;mode="postcard";}
    else {const achievement=ACHIEVEMENTS[index];if(!achievement)return;selected=achievement.id;mode="detail";journeyStore.readAchievement(selected);}
    sound();changed();
  },feedback(`card:${i}`)));
  const place=(target:Phaser.GameObjects.Container,box:ArtRect,hitHeight=box.height)=>{target.setPosition(box.x+box.width/2,box.y+box.height/2).setSize(box.width,hitHeight);target.input!.hitArea.setSize(box.width,hitHeight);};
  watchViewport(scene,size=>{
    const safe=safeUiInsets(scene);k=Math.min(1,(size.width-safe.left-safe.right-16)/430,(size.height-safe.top-safe.bottom-12)/246);
    panel={x:safe.left+(size.width-safe.left-safe.right-430*k)/2,y:safe.top+(size.height-safe.top-safe.bottom-246*k)/2,width:430*k,height:246*k};
    entryBox=resultIds?{x:safe.left+7,y:safe.top+5,width:133,height:29}:menuBookEntryLayout(size,safe).journey;place(entry,entryBox);
    place(blocker,{x:0,y:0,width:size.width,height:size.height});place(close,b(153,216,124,25),32*k);place(prev,b(31,216,91,25),32*k);place(next,b(308,216,91,25),32*k);
    cards.forEach((c,i)=>place(c,b(25+(i%2)*195,77+Math.floor(i/2)*63,185,57)));changed();
  });
  let lastState="";const refresh=()=>{const value=JSON.stringify([scene.data.get("collection-album-open"),scene.data.get("menu-bedtime")]);if(value!==lastState){lastState=value;changed();}};
  const modalChanged=()=>{if(open)changed();else surface.invalidate();};
  scene.events.on(MENU_MODAL_CHANGE,modalChanged);
  scene.events.on("postupdate",refresh);scene.events.once("shutdown",()=>{scene.events.off(MENU_MODAL_CHANGE,modalChanged);scene.events.off("postupdate",refresh);scene.data.set("journey-book-open",false);});surface.show(true);
  return {openReward(id:RewardId,onClose?:()=>void){snapshot=journeyStore.load();if(!snapshot.rewards[id]||menuModalOwner(scene)!=="collection")return;reward=id;mode="reward";page=0;closed=onClose;if(show("collection")&&id!=="all")journeyStore.readReward(id);}};
}
