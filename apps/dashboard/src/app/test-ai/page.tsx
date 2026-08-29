'use client';
import { useEffect, useRef, useState } from 'react';
import { testAiApi, TestAiState } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Loader2, RotateCcw, Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TestAiPage() {
    const [state, setState] = useState<TestAiState>({ conversation: null, messages: [], usage: { aiReplies: 0, totalTokens: 0, estimatedCost: 0 } });
    const [input, setInput] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const scroll = useRef<HTMLDivElement>(null);
    useEffect(() => { testAiApi.current().then(setState).catch(e=>setError(e.message)).finally(()=>setLoading(false)); }, []);
    useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [state.messages, loading]);
    async function send(event: React.FormEvent) { event.preventDefault(); const text = input.trim(); if (!text || loading) return; setInput(''); setLoading(true); setError('');
        setState(s=>({...s,messages:[...s.messages,{id:`pending-${Date.now()}`,role:'user',content:text,createdAt:new Date().toISOString()}]}));
        try { setState(await testAiApi.send(text)); } catch(e) { setError(e instanceof Error?e.message:'AI request failed'); await testAiApi.history().then(setState).catch(()=>undefined); } finally { setLoading(false); } }
    async function reset() { setLoading(true); setError(''); try { setState(await testAiApi.newConversation()); } catch(e) { setError(e instanceof Error?e.message:'Could not start a new chat'); } finally { setLoading(false); } }
    return <div className="mx-auto flex h-full max-w-4xl flex-col gap-4"><div className="flex items-end justify-between"><div><h1 className="text-3xl font-bold">Test your AI</h1><p className="text-muted-foreground">Real tenant-scoped agent · history persists</p></div><Button variant="outline" onClick={reset} disabled={loading}><RotateCcw className="mr-2 h-4 w-4"/>New conversation</Button></div>
    <Card className="flex min-h-[600px] flex-1 flex-col"><CardHeader className="border-b py-3"><CardTitle className="flex items-center justify-between text-sm"><span>SellPilot AI</span><span className="font-normal text-muted-foreground">{state.usage.aiReplies} AI replies · {state.usage.totalTokens.toLocaleString()} tokens · ${state.usage.estimatedCost.toFixed(4)}</span></CardTitle></CardHeader>
    <CardContent ref={scroll} className="flex-1 space-y-4 overflow-y-auto p-5">{!loading && !state.messages.length && <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground"><Bot className="mb-3 h-12 w-12 text-primary"/><b className="text-foreground">Say hello to your sales assistant</b><p>Try “Black t-shirt ache?”</p></div>}
    {state.messages.map(message=><div key={message.id} className={cn('flex max-w-[80%] gap-2',message.role==='user'?'ml-auto flex-row-reverse':'')} >{message.role==='user'?<User className="mt-2 h-4 w-4"/>:<Bot className="mt-2 h-4 w-4 text-primary"/>}<div className={cn('rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap',message.role==='user'?'bg-primary text-primary-foreground':'border bg-muted/40')}>{message.content}</div></div>)}
    {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>AI is thinking…</div>}{error&&<p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}</CardContent>
    <CardFooter className="border-t p-4"><form onSubmit={send} className="flex w-full gap-2"><Input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask about your products, delivery, returns…" maxLength={2000} disabled={loading}/><Button type="submit" size="icon" disabled={loading||!input.trim()}><Send className="h-4 w-4"/></Button></form></CardFooter></Card></div>;
}
