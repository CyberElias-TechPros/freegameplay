import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as NativeApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { BreakoutEngine, DodgeEngine, SnakeEngine, GravityEngine, type EngineApi, type HudState } from '@fg/game-core';
import { games, type Game } from './catalog';
import './style.css';

function readSaved(): string[] { try { const value = JSON.parse(localStorage.getItem('fg-mobile-saved') ?? '[]'); return Array.isArray(value) ? value.filter(x => typeof x === 'string') : []; } catch { return []; } }
const constructors = { breakout: BreakoutEngine, dodge: DodgeEngine, snake: SnakeEngine, gravity: GravityEngine };

function GamePanel({ game, close }: { game: Game; close: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<EngineApi | null>(null);
  const [hud, setHud] = useState<HudState>({ phase: 'ready', score: 0, best: 0, lives: 0, detail: '' });
  const [error, setError] = useState('');
  useEffect(() => {
    let core: EngineApi;
    try { core = new constructors[game.id](canvas.current!, setHud); engine.current = core; }
    catch { setError('This device cannot start the canvas. Please update Android System WebView and try again.'); return; }
    const pause = () => { if (document.hidden) core.pause(); };
    document.addEventListener('visibilitychange', pause);
    let disposed = false;
    const native = Capacitor.isNativePlatform() ? NativeApp.addListener('appStateChange', ({ isActive }) => { if (!isActive) core.pause(); }) : null;
    native?.then(handle => { if (disposed) handle.remove(); });
    return () => { disposed = true; native?.then(handle => handle.remove()); document.removeEventListener('visibilitychange', pause); core.destroy(); engine.current = null; };
  }, [game.id]);
  function start() { if (hud.phase === 'paused') engine.current?.resume(); else engine.current?.start(); canvas.current?.focus(); }
  return <section className="game-screen" aria-label={game.title}>
    <button className="back" onClick={close}>← Back to arcade</button>
    <p className="eyebrow">{game.genre} / offline ready</p><h1>{game.title}</h1>
    <div className="stage">
      <canvas tabIndex={0} ref={canvas} aria-label={`${game.title} game canvas`} />
      {hud.phase !== 'playing' && <div className="overlay"><h2>{hud.phase === 'ready' ? 'Ready when you are.' : hud.phase === 'paused' ? 'Take your time.' : 'One more round?'}</h2><p>{hud.phase === 'over' ? `Score ${hud.score} · Personal best ${hud.best}` : game.description}</p><button className="primary" onClick={start} disabled={!!error}>{hud.phase === 'paused' ? 'Resume game' : hud.phase === 'over' ? 'Play again' : 'Start game'}</button></div>}
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="hud"><span>Score <b>{hud.score}</b></span><span>Best <b>{hud.best}</b></span><button onClick={() => hud.phase === 'playing' ? engine.current?.pause() : start()} disabled={!!error}>{hud.phase === 'playing' ? 'Pause' : 'Play'}</button></div>
    <div className="controls" aria-label="Touch game controls">{([['arrowleft','←','Left'],['arrowup','↑','Up'],['arrowdown','↓','Down'],['arrowright','→','Right'],[' ','●','Launch']] as const).map(([key, icon, label]) => <button key={key} aria-label={label} disabled={hud.phase !== 'playing'}
      onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); engine.current?.input(key,true); }}
      onPointerUp={() => engine.current?.input(key,false)} onPointerCancel={() => engine.current?.input(key,false)}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); engine.current?.input(key,true); } }}
      onKeyUp={() => engine.current?.input(key,false)} onBlur={() => engine.current?.input(key,false)}>{icon}<small>{label}</small></button>)}</div>
    <details open><summary>How to play</summary><p>{game.controls}</p><p>Keyboard: arrows or WASD, P to pause. Scores stay on this device and are not verified public rankings.</p></details>
  </section>;
}

function Arcade() {
  const [active, setActive] = useState<Game | null>(null);
  const [tab, setTab] = useState<'arcade'|'saved'|'settings'>('arcade');
  const [saved, setSaved] = useState(readSaved);
  const [query,setQuery] = useState('');
  const [notice,setNotice] = useState('');
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed=false;
    const listener=NativeApp.addListener('backButton', () => { if (active) setActive(null); else if(tab!=='arcade') setTab('arcade'); else if(Capacitor.isNativePlatform()) NativeApp.exitApp(); });
    listener.then(h=>{if(disposed)h.remove();});
    return ()=>{disposed=true;listener.then(h=>h.remove());};
  },[active,tab]);
  function toggle(id:string) { const next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];setSaved(next);try {localStorage.setItem('fg-mobile-saved',JSON.stringify(next));} catch {setNotice('Device storage is unavailable. Favorites will last only for this session.');} }
  async function share(game:Game) { try { await Share.share({title:game.title,text:`Try ${game.title} on FreeGameplay`,url:`https://freegameplay.site/games/${game.slug}`}); } catch {setNotice('Sharing was cancelled or is unavailable on this device.');} }
  const list=games.filter(g=>(tab!=='saved'||saved.includes(g.id))&&`${g.title} ${g.genre}`.toLowerCase().includes(query.toLowerCase()));
  return <><header><a href="#main" onClick={()=>{setActive(null);setTab('arcade');}} className="brand"><span>●</span> Free<em>Game</em>play</a><span className="badge">POCKET ARCADE</span></header>
    <main id="main">{active?<GamePanel key={active.id} game={active} close={()=>setActive(null)}/>:tab==='settings'?<section><p className="eyebrow">Your device. Your choices.</p><h1>Keep it simple.</h1><div className="panel"><h2>Built for offline play</h2><p>All four games are bundled with this app. No account, ad SDK, analytics or notification permission is required. Best scores and favorites stay in this app's local storage.</p><h2>Clear local data</h2><p>This removes favorites and personal bests on this device. It cannot be undone.</p><button className="danger" onClick={()=>{if(!confirm('Delete favorites and personal bests from this device?'))return;try {for(const g of games)localStorage.removeItem(`fg-best-${g.id}`);localStorage.removeItem('fg-mobile-saved');setSaved([]);setNotice('Local game data cleared.');}catch{setNotice('Storage could not be cleared. Use Android app settings to clear app data.');}}}>Clear my data</button><h2>About this build</h2><p>Version 1.0.0 · Development candidate. Public leaderboards, accounts, cloud sync, push notifications and advertising are not included. Share links point to the web edition; its availability depends on web deployment.</p></div></section>:<section><p className="eyebrow">Small sessions. Big personal bests.</p><h1>{tab==='saved'?'Your next round.':<>Good games.<br/><span>Zero waiting.</span></>}</h1><p className="intro">Four pocket-sized challenges. Play offline, keep your best, come back for one more round.</p><label className="search">Find your game<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try arcade, snake or precision…" type="search"/></label><div className="grid">{list.map((g,i)=><article className={`card accent-${g.id}`} key={g.id}><div className="card-art" aria-hidden><span>{g.symbol}</span><small>0{i+1} / {g.genre}</small></div><div className="card-body"><p className="eyebrow">{g.genre} · Offline</p><h2>{g.title}</h2><p>{g.description}</p><div className="actions"><button className="primary" onClick={()=>setActive(g)}>Play now ↗</button><button aria-pressed={saved.includes(g.id)} aria-label={`${saved.includes(g.id)?'Unsave':'Save'} ${g.title}`} onClick={()=>toggle(g.id)}>{saved.includes(g.id)?'★':'☆'}</button><button aria-label={`Share ${g.title}`} onClick={()=>share(g)}>Share</button></div></div></article>)}</div>{!list.length&&<p className="panel">{tab==='saved'?'Save a favorite from the Arcade to find it here.':'No matching games. Try another search.'}</p>}</section>}
      {notice&&<p role="status" className="notice">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss message">×</button></p>}
    </main><nav aria-label="Main navigation">{(['arcade','saved','settings'] as const).map(t=><button key={t} aria-current={!active&&tab===t?'page':undefined} onClick={()=>{setActive(null);setTab(t);setQuery('');}}>{t==='arcade'?'◈ Arcade':t==='saved'?'☆ Saved':'⚙ Settings'}</button>)}</nav></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Arcade/></React.StrictMode>);

// Packaged Android assets already work offline; only the hosted web edition needs a SW.
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* Installation remains optional; online play still works. */ });
}
