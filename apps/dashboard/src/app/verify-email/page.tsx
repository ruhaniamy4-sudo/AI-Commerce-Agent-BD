'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Verification(){const token=useSearchParams().get('token')||'';const [state,setState]=useState<'loading'|'success'|'error'>('loading');useEffect(()=>{if(!token){setState('error');return;}fetch('/api/auth-actions/email-verification-confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}).then(response=>setState(response.ok?'success':'error')).catch(()=>setState('error'));},[token]);return <Card className="w-full max-w-md"><CardHeader><CardTitle className="text-3xl">Email verification</CardTitle></CardHeader><CardContent className="space-y-4"><p>{state==='loading'?'Verifying your email…':state==='success'?'Your email is verified. You can now sign in.':'This verification link is invalid or expired.'}</p><Link className="font-semibold text-primary" href="/login">Go to sign in</Link></CardContent></Card>}
export default function VerifyEmailPage(){return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><Suspense fallback={<p>Loading…</p>}><Verification/></Suspense></main>}
