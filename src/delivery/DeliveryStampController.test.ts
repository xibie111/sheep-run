import { describe, expect, it, vi } from 'vitest';
import { DeliveryChallengeRun } from './DeliveryChallengeRun';
import { DeliveryStampController, type DeliveryStampRoutePort } from './DeliveryStampController';

const fixture = () => {
  const stamp = {id:'ordinary1',at:100,y:182,kind:'ordinary' as const,key:'postage'};
  const definition = {stamps:[stamp],keepsakeKey:'keepsake'};
  const challenge = new DeliveryChallengeRun(definition);
  const route: DeliveryStampRoutePort = {chapter:{challenge:definition},challenge,distance:0,state:'running'};
  let paused = false;
  const image = {setScale:vi.fn().mockReturnThis(),setDepth:vi.fn().mockReturnThis(),setName:vi.fn().mockReturnThis(),setVisible:vi.fn().mockReturnThis(),setPosition:vi.fn().mockReturnThis(),destroy:vi.fn()};
  const scene = {textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:64,height:64})})},add:{image:()=>image},scene:{isPaused:()=>paused},scale:{gameSize:{width:480,height:270}}};
  const lead = {body:{x:86,y:180,width:30,height:38}};
  const controller = new DeliveryStampController(scene as never,lead,route);
  return {route,challenge,image,controller,pause:(value:boolean)=>{paused=value;}};
};
describe('chapter-only visual postage',()=>{
  it('collects actual body overlap once, and never requires or mutates an Arcade/star group',()=>{
    const f=fixture();f.route.distance=498+100-101;f.controller.update();
    expect(f.challenge.snapshot().ordinaryCollected).toBe(1);f.controller.update();expect(f.challenge.snapshot().ordinaryCollected).toBe(1);
    expect(f.image.setScale).toHaveBeenCalledWith(20/64);
  });
  it('does not collect offscreen, during pause, or after failure; a fresh run starts empty',()=>{
    const f=fixture();f.controller.update();expect(f.challenge.snapshot().ordinaryCollected).toBe(0);
    f.route.distance=497;f.pause(true);f.controller.update();expect(f.challenge.snapshot().ordinaryCollected).toBe(0);
    f.pause(false);f.route.state='failed';f.controller.update();expect(f.challenge.snapshot().ordinaryCollected).toBe(0);
    expect(fixture().challenge.snapshot().ordinaryCollected).toBe(0);
  });
  it('clear destroys all scene objects once and forbids later updates',()=>{
    const f=fixture();f.controller.clear();f.controller.clear();expect(f.image.destroy).toHaveBeenCalledTimes(1);
    f.route.distance=497;f.controller.update();expect(f.challenge.snapshot().ordinaryCollected).toBe(0);
  });
});
