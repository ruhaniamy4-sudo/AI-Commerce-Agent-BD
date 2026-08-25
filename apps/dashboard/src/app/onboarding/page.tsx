'use client';
import { Dispatch, SetStateAction, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { onboardingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export default function OnboardingPage() {
    const { update } = useSession(); const router = useRouter(); const [step, setStep] = useState(1); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
    const [business, setBusiness] = useState({ name: '', businessType: '', phone: '', website: '', preferredLanguage: 'bn' });
    const [product, setProduct] = useState({ name: 'Black T-Shirt', price: '1490', stock: '10', description: 'Comfortable black cotton t-shirt. Sizes M, L, XL.', sku: '' });
    const [knowledge, setKnowledge] = useState({ title: 'Delivery policy', content: 'Delivery usually takes 2–3 business days inside Dhaka and 3–5 days elsewhere in Bangladesh.' });
    async function run(action: () => Promise<unknown>, next: number) { setBusy(true); setError(''); try { await action(); setStep(next); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this step.'); } finally { setBusy(false); } }
    async function createBusiness() { const result = await onboardingApi.createBusiness(business); await update({ accessToken: result.accessToken, accountToken: undefined, needsOnboarding: false, businessId: result.business.id, businessName: result.business.name, role: result.role, onboardingComplete: false }); }
    async function finish() { await onboardingApi.complete(); await update({ onboardingComplete: true }); router.push('/test-ai'); router.refresh(); }
    function field<T extends Record<keyof T, string>>(state: T, setter: Dispatch<SetStateAction<T>>, key: keyof T, placeholder: string, type = 'text') {
        return <Input type={type} placeholder={placeholder} value={state[key]} onChange={e => setter({ ...state, [key]: e.target.value })}/>;
    }
    return <main className="min-h-screen bg-slate-50 p-4 md:p-10"><div className="mx-auto max-w-2xl"><div className="mb-8"><p className="font-semibold text-primary">SELLPILOT</p><h1 className="text-3xl font-bold">Set up your AI sales assistant</h1><p className="mt-2 text-muted-foreground">Step {step} of 5 · You can finish optional setup later.</p><div className="mt-4 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-primary transition-all" style={{ width: `${step * 20}%` }}/></div></div>
    <Card><CardHeader><CardTitle>{['','Create your business','Add a product','Add business knowledge','Choose a channel','Try your AI'][step]}</CardTitle></CardHeader><CardContent className="space-y-4">{error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {step === 1 && <>{field(business,setBusiness,'name','Business name')}{field(business,setBusiness,'businessType','Business type (e.g. Fashion)')}{field(business,setBusiness,'phone','Phone')}{field(business,setBusiness,'website','Website or Facebook Page (optional)')}<select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={business.preferredLanguage} onChange={e=>setBusiness({...business,preferredLanguage:e.target.value})}><option value="bn">Bangla / Banglish</option><option value="en">English</option></select><p className="text-sm text-muted-foreground">Currency: BDT</p><Button disabled={busy} onClick={()=>run(createBusiness,2)}>Create business</Button></>}
    {step === 2 && <>{field(product,setProduct,'name','Product name')}{field(product,setProduct,'price','Price','number')}{field(product,setProduct,'stock','Stock','number')}{field(product,setProduct,'description','Description')}{field(product,setProduct,'sku','SKU (optional)')}<div className="flex gap-2"><Button disabled={busy} onClick={()=>run(()=>onboardingApi.addProduct({...product,price:Number(product.price),stock:Number(product.stock)}),3)}>Save product</Button><Button variant="ghost" onClick={()=>setStep(3)}>Skip</Button></div></>}
    {step === 3 && <>{field(knowledge,setKnowledge,'title','Knowledge title')}<textarea className="min-h-32 w-full rounded-md border bg-background p-3 text-sm" value={knowledge.content} onChange={e=>setKnowledge({...knowledge,content:e.target.value})}/><div className="flex gap-2"><Button disabled={busy} onClick={()=>run(()=>onboardingApi.addKnowledge({...knowledge,type:'POLICY',language:business.preferredLanguage}),4)}>Save knowledge</Button><Button variant="ghost" onClick={()=>setStep(4)}>Skip</Button></div></>}
    {step === 4 && <><div className="rounded-lg border p-4"><b>Website / Test Chat</b><p className="text-sm text-muted-foreground">Available now</p></div><div className="rounded-lg border p-4"><b>Facebook Messenger</b><p className="text-sm text-muted-foreground">Configure later in Integrations</p></div><div className="rounded-lg border p-4 opacity-60"><b>WhatsApp</b><p className="text-sm">Coming Soon</p></div><Button disabled={busy} onClick={()=>run(()=>onboardingApi.configureChannel(),5)}>Use Website / Test Chat</Button></>}
    {step === 5 && <><p>Your tenant-safe AI is ready. Test it with your products, knowledge, recent-memory pipeline, and persistent history.</p><div className="rounded-lg bg-slate-100 p-4 text-sm">Try: “Black t-shirt ache?” then “XL er price koto?”</div><Button disabled={busy} onClick={finish}>Open Test AI</Button></>}
    </CardContent></Card></div></main>;
}
