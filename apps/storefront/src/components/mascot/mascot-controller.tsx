'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { MascotActionState, MascotEyeExpression } from './mascot-3d-model';

export type MascotPose =
  | 'idle'
  | 'hero'
  | 'conversation'
  | 'recommendation'
  | 'availability_check'
  | 'inventory'
  | 'order_creation'
  | 'knowledge'
  | 'omnichannel'
  | 'human_handoff'
  | 'pricing'
  | 'demo'
  | 'about'
  | 'contact';

export type MascotSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
export type MascotStatus = 'idle' | 'listening' | 'thinking' | 'success' | 'alert';

export interface MascotControllerProps {
  pose?: MascotPose;
  size?: MascotSize;
  status?: MascotStatus;
  state?: MascotActionState;
  eyeExpression?: MascotEyeExpression;
  ctaHovered?: boolean;
  interactive?: boolean;
  scale?: number;
  position?: [number, number, number];
  className?: string;
  onAction?: (action: string) => void;
}

// Dynamically import MascotScene without SSR for WebGL / R3F Canvas
const DynamicMascotScene = dynamic(
  () => import('./mascot-scene').then((mod) => mod.MascotScene),
  {
    ssr: false,
    loading: () => (
      // Instant poster placeholder matching 3D framing (Zero spinner, Zero layout shift)
      <div className="w-full h-full flex items-center justify-center pointer-events-none">
        <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-[#16D9F5]/20 to-[#2F7DF6]/20 blur-xl animate-pulse" />
      </div>
    ),
  }
);

export function MascotController({
  pose = 'idle',
  size = 'md',
  status = 'idle',
  state: explicitState,
  eyeExpression,
  ctaHovered = false,
  interactive = true,
  scale: explicitScale,
  position: explicitPosition,
  className,
}: MascotControllerProps) {
  const [hasWebGL] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return Boolean(gl);
    } catch {
      return false;
    }
  });
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Derive optimal framing scale and vertical centering per size
  const scale = useMemo(() => {
    if (explicitScale !== undefined) return explicitScale;
    switch (size) {
      case 'full': return 1.0;
      case '2xl': return 0.95;
      case 'xl': return 0.88;
      case 'lg': return 0.80;
      case 'md': return 0.68;
      case 'sm': return 0.50;
      default: return 0.85;
    }
  }, [explicitScale, size]);

  const position: [number, number, number] = useMemo(() => {
    if (explicitPosition) return explicitPosition;
    return [0, 0, 0];
  }, [explicitPosition]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Map pose to 3D rig animation state
  const computedState: MascotActionState = useMemo(() => {
    if (explicitState) return explicitState;
    switch (pose) {
      case 'hero':
        return status === 'success' ? 'celebrate' : status === 'listening' ? 'wave' : 'look-at-pointer';
      case 'conversation':
        return status === 'thinking' ? 'curious' : status === 'listening' ? 'look-at-pointer' : 'wave';
      case 'order_creation':
        return 'order-success';
      case 'availability_check':
      case 'inventory':
        return 'product-found';
      case 'recommendation':
        return 'point-left';
      case 'human_handoff':
        return 'wave';
      case 'pricing':
      case 'contact':
        return 'point-right';
      default:
        return 'idle';
    }
  }, [explicitState, pose, status]);

  const sizeClasses: Record<MascotSize, string> = {
    sm: 'w-24 h-24',
    md: 'w-36 h-36',
    lg: 'w-52 h-52',
    xl: 'w-72 h-72',
    '2xl': 'w-88 h-88 sm:w-96 sm:h-96 md:w-[480px] md:h-[480px]',
    full: 'w-full h-full min-h-[380px]',
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center overflow-visible touch-pan-y',
        sizeClasses[size],
        className
      )}
      role="img"
      aria-label={`SellPilot 3D Mascot - ${pose}`}
    >
      {hasWebGL ? (
        <DynamicMascotScene
          state={computedState}
          status={status}
          eyeExpression={eyeExpression}
          ctaHovered={ctaHovered}
          interactive={interactive}
          reducedMotion={reducedMotion}
          scale={scale}
          position={position}
        />
      ) : (
        // High quality fallback if WebGL is disabled
        <div className="w-3/4 h-3/4 rounded-3xl bg-gradient-to-tr from-[#2F7DF6]/20 via-[#16D9F5]/20 to-[#7447FF]/20 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#2F7DF6] text-white flex items-center justify-center font-bold text-lg">
              SP
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-2">SellPilot AI Assistant</p>
          </div>
        </div>
      )}
    </div>
  );
}
