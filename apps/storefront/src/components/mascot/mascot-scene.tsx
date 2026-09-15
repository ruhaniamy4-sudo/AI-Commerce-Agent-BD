'use client';

import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Mascot3DModel, MascotActionState, MascotEyeExpression } from './mascot-3d-model';

interface MascotSceneProps {
  state?: MascotActionState;
  status?: 'idle' | 'listening' | 'thinking' | 'success' | 'alert';
  eyeExpression?: MascotEyeExpression;
  interactive?: boolean;
  scale?: number;
  position?: [number, number, number];
  reducedMotion?: boolean;
  ctaHovered?: boolean;
  showPosterFallback?: boolean;
}

// --------------------------------------------------------------------------
// Instant High-Fidelity Atmosphere Poster (First Paint with Zero Layout Shift)
// --------------------------------------------------------------------------
function MascotInstantPoster() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300">
      <div className="relative w-72 h-72 flex items-center justify-center">
        {/* Soft Ambient Cyan/Teal Radiant Glow */}
        <div className="w-56 h-56 rounded-full bg-gradient-to-tr from-[#16D9F5]/25 via-[#2F7DF6]/20 to-[#7447FF]/15 blur-3xl animate-pulse" />
      </div>
    </div>
  );
}

export function MascotScene({
  state = 'idle',
  status = 'idle',
  eyeExpression,
  interactive = true,
  scale = 1.0,
  position = [0, 0, 0],
  reducedMotion = false,
  ctaHovered = false,
  showPosterFallback = true,
}: MascotSceneProps) {
  const [is3DReady, setIs3DReady] = useState(false);

  return (
    <div className="w-full h-full relative touch-pan-y select-none overflow-hidden">
      {/* Soft radiant ambient glow until WebGL scene renders */}
      {showPosterFallback && !is3DReady && <MascotInstantPoster />}

      <Canvas
        camera={{ position: [0, 0, 9.0], fov: 36 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        shadows
        className={`w-full h-full transition-opacity duration-500 ${is3DReady ? 'opacity-100' : 'opacity-0'}`}
      >
        <ambientLight intensity={1.5} />
        <directionalLight
          position={[4, 6, 4]}
          intensity={1.9}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        {/* Brand rim & accent lights */}
        <directionalLight position={[-4, 2, -1]} intensity={0.9} color="#16D9F5" />
        <directionalLight position={[0, -3, 3]} intensity={0.5} color="#7447FF" />
        <pointLight position={[0, 2, 2]} intensity={0.6} color="#FFFFFF" />

        <Suspense fallback={null}>
          <Mascot3DModel
            state={state}
            status={status}
            eyeExpression={eyeExpression}
            interactive={interactive}
            scale={scale}
            position={position}
            reducedMotion={reducedMotion}
            ctaHovered={ctaHovered}
            onLoaded={() => setIs3DReady(true)}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
