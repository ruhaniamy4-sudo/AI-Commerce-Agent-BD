"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import { classifyProductImageSource } from "@edutechs/shared";
import { cn } from "@/lib/utils";

export function SafeProductImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const kind = classifyProductImageSource(src);
  const fallback = failedSrc === src || kind === "invalid" || kind === "missing";

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-100">
      {fallback ? (
        <ImageOff
          className="h-1/3 w-1/3 text-slate-300"
          aria-label="Image unavailable"
        />
      ) : kind === "managed" || kind === "local" ? (
        <Image
          fill
          src={src!}
          alt={alt}
          sizes="(max-width: 640px) 50vw, 25vw"
          className={cn("object-cover", className)}
          onError={() => setFailedSrc(src || null)}
        />
      ) : (
        // Product imports can retain a validated external fallback URL when managed storage is unavailable.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={cn("h-full w-full object-cover", className)}
          onError={() => setFailedSrc(src || null)}
        />
      )}
    </div>
  );
}
