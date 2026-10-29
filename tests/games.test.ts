import test from 'node:test';
import assert from 'node:assert/strict';
import { GameCore, BreakoutEngine, SnakeEngine, GravityEngine, RunClock } from '../packages/game-core/src/index.ts';

function canvasFixture() {
  const frames = new Map<number, FrameRequestCallback>();let next=0;
  const listeners = new Set<string>();
  Object.assign(globalThis, {
    window: {devicePixelRatio:1,addEventListener:(name:string)=>listeners.add(name),removeEventListener:(name:string)=>listeners.delete(name)},
    document: { activeElement:null },
    localStorage:{getItem:()=>null,setItem:()=>{}},
    requestAnimationFrame:(fn:FrameRequestCallback)=>{frames.set(++next,fn);return next;},
    cancelAnimationFrame:(id:number)=>frames.delete(id),
  });
  const ctx=new Proxy({},{get:(_,name)=>name==='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});
  const canvas:any={getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:960,height:600}),addEventListener(){},removeEventListener(){},focus(){(globalThis as any).document.activeElement=canvas;}};
  return {canvas,frames,listeners};
}
test('run timing excludes pauses, resets each replay and keeps one session per run',()=>{
  const clock=new RunClock();clock.update('playing',100);const first=clock.sessionId;
  clock.update('paused',1100);clock.update('playing',6100);clock.update('over',7100);
  assert.equal(clock.elapsed(9999),2000);assert.equal(clock.sessionId,first);
  clock.reported=true;clock.update('playing',10000);assert.notEqual(clock.sessionId,first);assert.equal(clock.reported,false);
  clock.update('over',11000);assert.equal(clock.elapsed(12000),1000);
});
test('Breakout space launches without pausing; form inputs are not intercepted',()=>{
  const {canvas}=canvasFixture();const core=new BreakoutEngine(canvas,()=>{});core.start();
  let prevented=false;const event:any={key:' ',preventDefault(){prevented=true;}};
  core.onKeyDown(event);assert.equal(prevented,false);assert.equal(core.ball.stuck,true);
  canvas.focus();core.onKeyDown(event);assert.equal(core.phase,'playing');assert.equal(core.ball.stuck,false);
  core.onKeyDown({key:'p',preventDefault(){}} as any);assert.equal(core.phase,'paused');core.destroy();
});
test('pause, resume and destruction have one or zero scheduled frames',()=>{
  const {canvas,frames}=canvasFixture();const core=new GameCore(canvas,'test',()=>{});core.start();assert.equal(frames.size,1);
  core.pause();assert.equal(frames.size,0);core.resume();assert.equal(frames.size,1);core.resume();assert.equal(frames.size,1);
  core.destroy();assert.equal(frames.size,0);
});
test('Snake fills the board without an infinite food-placement loop',()=>{
  const {canvas}=canvasFixture();const core=new SnakeEngine(canvas,()=>{});core.start();
  core.snake=Array.from({length:640},(_,i)=>({x:i%32,y:Math.floor(i/32)}));core.placeFood();
  assert.equal(core.phase,'over');assert.equal(core.detail,'BOARD CLEARED');core.destroy();
});
test('Snake may enter the departing tail cell and pointer release clears swipe',()=>{
  const {canvas}=canvasFixture();const core=new SnakeEngine(canvas,()=>{});core.start();
  core.snake=[{x:2,y:2},{x:2,y:3},{x:1,y:3},{x:1,y:2}];core.dir={x:-1,y:0};core.food={x:20,y:10};core.tick();
  assert.equal(core.lives,3);assert.deepEqual(core.snake[0],{x:1,y:2});
  core.lastSwipe={x:0,y:0};core.onPointerUp();assert.equal(core.lastSwipe,null);core.destroy();
});
test('Gravity directional adapter provides touch thrust and clears on pause',()=>{
  const {canvas}=canvasFixture();const core=new GravityEngine(canvas,()=>{});core.start();const vx=core.player.vx;
  core.input('arrowright',true);core.step(1/60);assert.ok(core.player.vx>vx);
  core.pause();assert.deepEqual(core.keys,{});core.destroy();
});
