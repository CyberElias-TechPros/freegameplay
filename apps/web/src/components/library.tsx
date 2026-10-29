'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readLibrary, updateLibrary, type SavedGame } from '@/lib/library';
function useLibrary() {
  const [library,setLibrary]=useState<{saved:SavedGame[];recent:SavedGame[]}>({saved:[],recent:[]});
  useEffect(()=>{const refresh=()=>setLibrary(readLibrary());refresh();window.addEventListener('storage',refresh);window.addEventListener('fg:library',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('fg:library',refresh);};},[]);
  return library;
}
export function SaveGame({slug,title}:SavedGame) {
  const library=useLibrary();const [error,setError]=useState('');const saved=library.saved.some(g=>g.slug===slug);
  return <><button className="btn btn-ghost save-game" aria-pressed={saved} onClick={()=>{if(!updateLibrary({slug,title},'save'))setError('Your browser cannot save favorites right now.');}}>{saved?'★ Saved':'☆ Save game'}</button>{error&&<p role="status">{error}</p>}</>;
}
export function Library() {
  const library=useLibrary();const [message,setMessage]=useState('');
  return <><p>Favorites and recent games stay in this browser. No account or cloud sync is involved.</p>{(['saved','recent'] as const).map(kind=><section key={kind} className="section"><h2>{kind==='saved'?'Saved games':'Recently played'}</h2>{library[kind].length?<ul>{library[kind].map(g=><li key={g.slug} style={{padding:'14px 0'}}><Link href={`/games/${g.slug}`}>{g.title} →</Link>{kind==='saved'&&<SaveGame {...g}/>}</li>)}</ul>:<p>No games here yet. <Link href="/games">Explore the arcade →</Link></p>}</section>)}<button className="btn btn-ghost" onClick={()=>{if(confirm('Clear saved games and recent history in this browser?'))setMessage(updateLibrary({slug:'',title:''},'clear')?'Library cleared.':'Browser storage is unavailable.');}}>Clear library</button><p role="status">{message}</p></>;
}
