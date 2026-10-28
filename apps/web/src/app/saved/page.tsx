import { Library } from '@/components/library';
export const metadata = { title: 'Your saved games', robots: { index: false, follow: false } };
export default function SavedPage() { return <div className="container section" style={{paddingTop:140}}><h1>Your next round</h1><Library/></div>; }
