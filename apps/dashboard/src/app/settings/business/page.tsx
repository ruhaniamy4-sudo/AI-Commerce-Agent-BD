'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrandVoiceProfile, businessApi, BusinessProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const voiceDefaults: BrandVoiceProfile = { tone: 'friendly', replyLength: 'balanced', language: 'auto', salesBehavior: 'balanced', emoji: 'light', examples: [] };

export default function BusinessSettings() {
    const { data: session } = useSession(); const qc = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ['business-profile'], queryFn: businessApi.get });
    const [form, setForm] = useState<Partial<BusinessProfile>>({}); const [voice, setVoice] = useState<BrandVoiceProfile>(voiceDefaults); const [example, setExample] = useState('');
    useEffect(() => { if (data) { setForm(data); setVoice({ ...voiceDefaults, ...data.brandVoice, examples: data.brandVoice?.examples || [] }); } }, [data]);
    const save = useMutation({ mutationFn: () => businessApi.update(form), onSuccess: () => qc.invalidateQueries({ queryKey: ['business-profile'] }) });
    const saveVoice = useMutation({ mutationFn: () => businessApi.updateBrandVoice(voice), onSuccess: () => qc.invalidateQueries({ queryKey: ['business-profile'] }) });
    const owner = session?.role === 'Owner';
    const field = (key: keyof BusinessProfile, label: string) => <label className="space-y-2 text-sm"><span>{label}</span><Input disabled={!owner} value={String(form[key] || '')} onChange={(event) => setForm({ ...form, [key]: event.target.value })}/></label>;
    const select = <K extends keyof BrandVoiceProfile>(key: K, label: string, options: Array<[BrandVoiceProfile[K], string]>) => <label className="space-y-2 text-sm"><span>{label}</span><select disabled={!owner} className="h-10 w-full rounded-md border bg-background px-3" value={String(voice[key])} onChange={(event) => setVoice({ ...voice, [key]: event.target.value as BrandVoiceProfile[K] })}>{options.map(([value, text]) => <option key={String(value)} value={String(value)}>{text}</option>)}</select></label>;
    return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Business settings</h1><p className="text-muted-foreground">Your customer-facing profile and SellPilot communication style.</p></div>
        <Card className="max-w-3xl"><CardHeader><CardTitle>Business profile</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">{isLoading ? <p>Loading…</p> : <>{field('name', 'Business name')}{field('businessType', 'Business type')}{field('phone', 'Phone')}{field('website', 'Website / Facebook Page')}<label className="space-y-2 text-sm"><span>Preferred language</span><select disabled={!owner} className="h-10 w-full rounded-md border bg-background px-3" value={form.preferredLanguage || 'bn'} onChange={(event) => setForm({ ...form, preferredLanguage: event.target.value as 'bn'|'en' })}><option value="bn">Bangla / Banglish</option><option value="en">English</option></select></label><label className="space-y-2 text-sm"><span>Currency</span><Input disabled value={form.currency || 'BDT'}/></label><div className="sm:col-span-2">{owner ? <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save changes'}</Button> : <p className="text-sm text-muted-foreground">Only the Owner can change business settings.</p>}</div></>}</CardContent></Card>
        <Card className="max-w-3xl"><CardHeader><CardTitle>AI Communication Style</CardTitle><p className="text-sm text-muted-foreground">Choose how SellPilot talks. Approved examples influence style gradually after at least three examples.</p></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
            {select('tone', 'Tone', [['friendly','Friendly'],['professional','Professional'],['casual','Casual'],['premium','Premium'],['custom','Custom']])}
            {select('replyLength', 'Reply length', [['short','Short'],['balanced','Balanced'],['detailed','Detailed']])}
            {select('language', 'Language', [['auto','Auto'],['bn','Bangla'],['en','English'],['banglish','Banglish']])}
            {select('salesBehavior', 'Sales behavior', [['helpful','Helpful'],['balanced','Balanced'],['sales_focused','Sales-focused']])}
            {select('emoji', 'Emoji', [['none','None'],['light','Light'],['normal','Normal']])}
            {voice.tone === 'custom' && <label className="space-y-2 text-sm"><span>Custom tone</span><Input disabled={!owner} maxLength={300} value={voice.customTone || ''} onChange={(event) => setVoice({ ...voice, customTone: event.target.value })} placeholder="Warm, direct, locally familiar…"/></label>}
            <div className="space-y-3 sm:col-span-2"><label className="space-y-2 text-sm"><span>Example of how we talk to customers</span><textarea disabled={!owner} className="min-h-24 w-full rounded-md border bg-background p-3" maxLength={1000} value={example} onChange={(event) => setExample(event.target.value)} placeholder="জি, Blackটা available আছে 😊 কোন size লাগবে?"/></label><Button type="button" variant="outline" disabled={!owner || !example.trim() || voice.examples.length >= 10} onClick={() => { setVoice({ ...voice, examples: [...voice.examples, example.trim()] }); setExample(''); }}>Add approved example</Button>{voice.examples.length > 0 && <div className="space-y-2">{voice.examples.map((item, index) => <div key={`${item}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm"><span>{item}</span><Button type="button" size="sm" variant="ghost" disabled={!owner} onClick={() => setVoice({ ...voice, examples: voice.examples.filter((_value, current) => current !== index) })}>Remove</Button></div>)}</div>}</div>
            <div className="sm:col-span-2">{owner && <Button disabled={saveVoice.isPending} onClick={() => saveVoice.mutate()}>{saveVoice.isPending ? 'Saving…' : 'Save AI style'}</Button>}</div>
        </CardContent></Card>
    </div>;
}
