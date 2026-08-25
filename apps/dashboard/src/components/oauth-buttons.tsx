'use client';
import { Button } from '@/components/ui/button';
import { getProviders, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
export function OAuthButtons() {
    const [configured, setConfigured] = useState<Record<string, boolean>>({});
    useEffect(() => { getProviders().then((items) => setConfigured({ google: Boolean(items?.google), facebook: Boolean(items?.facebook) })); }, []);
    return <div className="grid grid-cols-2 gap-3">{['google', 'facebook'].map((provider) =>
        <Button key={provider} type="button" variant="outline" disabled={!configured[provider]} onClick={() => signIn(provider, { callbackUrl: '/onboarding' })}>
            {provider === 'google' ? 'Google' : 'Facebook'}{configured[provider] ? '' : ' · Not configured'}
        </Button>)}</div>;
}
