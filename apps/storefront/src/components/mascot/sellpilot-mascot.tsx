'use client';

import React from 'react';
import { MascotController, MascotPose, MascotSize, MascotStatus } from './mascot-controller';
import { MascotActionState, MascotEyeExpression } from './mascot-3d-model';

export type { MascotPose, MascotSize, MascotStatus, MascotActionState, MascotEyeExpression };

export interface SellPilotMascotProps {
  pose?: MascotPose;
  size?: MascotSize;
  animated?: boolean;
  interactive?: boolean;
  status?: MascotStatus;
  state?: MascotActionState;
  eyeExpression?: MascotEyeExpression;
  ctaHovered?: boolean;
  scale?: number;
  position?: [number, number, number];
  className?: string;
}

export function SellPilotMascot({
  pose = 'idle',
  size = 'md',
  animated = true,
  interactive = true,
  status = 'idle',
  state,
  eyeExpression,
  ctaHovered = false,
  scale,
  position,
  className,
}: SellPilotMascotProps) {
  return (
    <MascotController
      pose={pose}
      size={size}
      status={status}
      state={state}
      eyeExpression={eyeExpression}
      ctaHovered={ctaHovered}
      scale={scale}
      position={position}
      interactive={interactive && animated}
      className={className}
    />
  );
}

export { MascotController };
