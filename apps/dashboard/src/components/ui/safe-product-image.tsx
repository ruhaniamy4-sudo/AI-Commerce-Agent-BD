'use client';

import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { classifyProductImageSource } from '@edutechs/shared';
import { cn } from '@/lib/utils';

export function SafeProductImage({ src, alt, className, imageClassName }: { src?: string | null; alt: string; className?: string; imageClassName?: string }) {
    const [failed, setFailed] = useState(false);
    const kind = classifyProductImageSource(src);
    useEffect(() => setFailed(false), [src]);
    const fallback = failed || kind === 'invalid' || kind === 'missing';

    return <div className={cn('relative flex h-full w-full items-center justify-center overflow-hidden bg-muted/40', className)}>
        {fallback ? <ImageOff className="h-1/3 w-1/3 text-muted-foreground/40" aria-label="Image unavailable"/> : kind === 'managed' || kind === 'local' ?
            <Image fill src={src!} alt={alt} sizes="200px" className={cn('object-cover', imageClassName)} onError={() => setFailed(true)}/> :
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src!} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={cn('h-full w-full object-cover', imageClassName)} onError={() => setFailed(true)}/>
        }
    </div>;
}
