'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { onboardingApi } from '@/lib/api';
import { TrainingWorkspace } from '@/components/training/training-workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const businessTypes = [
    ['ECOMMERCE', 'Ecommerce / Online store'], ['VISA_CONSULTANCY', 'Visa consultancy'],
    ['EDUCATION_CONSULTANCY', 'Education consultancy'], ['EDTECH', 'Education / EdTech'],
    ['AGENCY', 'Agency / Professional service'], ['REAL_ESTATE', 'Real estate'],
    ['CLINIC_SERVICE', 'Clinic / Service provider'], ['RESTAURANT', 'Restaurant / Food business'],
    ['SAAS', 'Software / SaaS'], ['OTHER', 'Other'],
] as const;

export default function OnboardingPage() {
    const { data: session, update } = useSession(); const router = useRouter();
    const [businessCreated, setBusinessCreated] = useState(Boolean(session?.businessId));
    const [busy, setBusy] = useState(false); const [error, setError] = useState('');
    const [business, setBusiness] = useState({ name: '', businessType: '', description: '', phone: '', preferredLanguage: 'bn' });
    async function createBusiness() {
        setBusy(true); setError('');
        try {
            const result = await onboardingApi.createBusiness(business);
            await update({ accessToken: result.accessToken, accountToken: undefined, refreshToken: result.refreshToken, accessTokenExpiresAt: result.accessTokenExpiresAt, refreshTokenExpiresAt: result.refreshTokenExpiresAt, needsOnboarding: false, businessId: result.business.id, businessName: result.business.name, role: result.role, onboardingComplete: false });
            setBusinessCreated(true);
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create your business.'); }
        finally { setBusy(false); }
    }
    async function finish() {
        await onboardingApi.complete(); await update({ onboardingComplete: true }); router.push('/test-ai'); router.refresh();
    }
    if (businessCreated) return <main className="min-h-screen bg-background p-4 md:p-10"><TrainingWorkspace onboarding onFinish={finish}/></main>;
    return <main className="min-h-screen bg-slate-50 p-4 md:p-10"><div className="mx-auto max-w-2xl">
        <div className="mb-8"><p className="font-semibold text-primary">SELLPILOT</p><h1 className="text-3xl font-bold">Tell us the basics</h1><p className="mt-2 text-muted-foreground">Then connect your website, Facebook Page, or files and let SellPilot do the organizing.</p><div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="text-primary">BUSINESS BASICS</span><span>→</span><span>CONNECT</span><span>→</span><span>LEARN</span><span>→</span><span>REVIEW</span><span>→</span><span>TEST</span></div></div>
        <Card><CardHeader><CardTitle>Business basics</CardTitle></CardHeader><CardContent className="space-y-4">{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Input placeholder="Business name" value={business.name} onChange={(event) => setBusiness({...business,name:event.target.value})}/>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={business.businessType} onChange={(event) => setBusiness({...business,businessType:event.target.value})}><option value="">Choose business type</option>{businessTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <textarea className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" placeholder="Short description (optional)" value={business.description} onChange={(event) => setBusiness({...business,description:event.target.value})}/>
            <Input placeholder="Support phone (optional)" value={business.phone} onChange={(event) => setBusiness({...business,phone:event.target.value})}/>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={business.preferredLanguage} onChange={(event) => setBusiness({...business,preferredLanguage:event.target.value})}><option value="bn">Bangla / Banglish</option><option value="en">English</option></select>
            <Button disabled={busy || business.name.trim().length < 2 || !business.businessType.trim()} onClick={createBusiness}>{busy ? 'Creating...' : 'Continue to sources'}</Button>
        </CardContent></Card>
    </div></main>;
}
