'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

export type MascotActionState =
  | 'idle'
  | 'arrival'
  | 'look-at-pointer'
  | 'curious'
  | 'wave'
  | 'point-left'
  | 'point-right'
  | 'product-found'
  | 'order-success'
  | 'handoff'
  | 'celebrate'
  | 'surprised'
  | 'confident'
  | 'thinking';

export type MascotEyeExpression =
  | 'idle'
  | 'curious'
  | 'happy'
  | 'surprised'
  | 'focused'
  | 'confident'
  | 'thinking';

interface Mascot3DModelProps {
  state?: MascotActionState;
  status?: 'idle' | 'listening' | 'thinking' | 'success' | 'alert';
  eyeExpression?: MascotEyeExpression;
  interactive?: boolean;
  scale?: number;
  position?: [number, number, number];
  reducedMotion?: boolean;
  ctaHovered?: boolean;
  onLoaded?: () => void;
}

interface MascotBones {
  body: THREE.Object3D | null;
  head: THREE.Object3D | null;
  armL: THREE.Object3D | null;
  armR: THREE.Object3D | null;
  earL: THREE.Object3D | null;
  earR: THREE.Object3D | null;
}

// --------------------------------------------------------------------------
// Digital Eyes Canvas Renderer
// Renders two expressive, luminous digital eyes onto a 512x256 texture.
// --------------------------------------------------------------------------
function renderDigitalEyes(
  ctx: CanvasRenderingContext2D,
  expression: MascotEyeExpression,
  blinkProgress: number,
  lookX: number,
  lookY: number,
  time: number
) {
  const w = 512;
  const h = 256;

  // Clear to transparent so only the luminous eyes and cyan glow are rendered
  ctx.clearRect(0, 0, w, h);

  // Digital eye colors (SellPilot signature cyan + electric blue)
  const cyanGlow = '#16D9F5';
  const cyanCore = '#FFFFFF';
  const electricBlue = '#168BFF';

  // Base eye coordinates on screen: Left (176), Right (336), Center Y (128)
  const leftX = 176 + lookX * 32;
  const rightX = 336 + lookX * 32;
  const eyeY = 128 - lookY * 22;

  const scaleY = Math.max(0.05, 1 - blinkProgress);

  ctx.save();

  if (expression === 'happy') {
    // Joyful crescent eyes (^ ^)
    ctx.strokeStyle = cyanGlow;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.shadowColor = cyanGlow;
    ctx.shadowBlur = 24;

    // Left arc
    ctx.beginPath();
    ctx.arc(leftX, eyeY + 12, 44, Math.PI * 1.15, Math.PI * 1.85, false);
    ctx.stroke();

    // Right arc
    ctx.beginPath();
    ctx.arc(rightX, eyeY + 12, 44, Math.PI * 1.15, Math.PI * 1.85, false);
    ctx.stroke();

    // Bright inner core
    ctx.strokeStyle = cyanCore;
    ctx.lineWidth = 7;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(leftX, eyeY + 12, 44, Math.PI * 1.2, Math.PI * 1.8, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightX, eyeY + 12, 44, Math.PI * 1.2, Math.PI * 1.8, false);
    ctx.stroke();
  } else if (expression === 'surprised') {
    // Large wide circular eyes with glowing outer ring and dilated center (Customer Chaos!)
    const r = 58;
    ctx.shadowColor = cyanGlow;
    ctx.shadowBlur = 28;

    [leftX, rightX].forEach((cx) => {
      // Outer bright glowing ring
      ctx.fillStyle = cyanGlow;
      ctx.beginPath();
      ctx.arc(cx, eyeY, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner dark pupil
      ctx.fillStyle = '#03081A';
      ctx.beginPath();
      ctx.arc(cx + lookX * 8, eyeY - lookY * 8, r * 0.52, 0, Math.PI * 2);
      ctx.fill();

      // Specular reflection highlight
      ctx.fillStyle = cyanCore;
      ctx.beginPath();
      ctx.arc(cx - 16, eyeY - 16, 9, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (expression === 'confident' || expression === 'focused') {
    // Sleek angled digital eyes (tilted inward)
    const eyeWidth = 74;
    const eyeHeight = 90 * scaleY;
    ctx.shadowColor = cyanGlow;
    ctx.shadowBlur = 22;

    // Left eye tilted inward
    ctx.save();
    ctx.translate(leftX, eyeY);
    ctx.rotate(0.24);
    drawRoundedEye(ctx, -eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight, 28, cyanGlow, cyanCore);
    ctx.restore();

    // Right eye tilted inward
    ctx.save();
    ctx.translate(rightX, eyeY);
    ctx.rotate(-0.24);
    drawRoundedEye(ctx, -eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight, 28, cyanGlow, cyanCore);
    ctx.restore();
  } else if (expression === 'curious') {
    // Left eye arched higher, right eye tilted
    const leftHeight = 100 * scaleY;
    const rightHeight = 84 * scaleY;
    ctx.shadowColor = cyanGlow;
    ctx.shadowBlur = 22;

    ctx.save();
    ctx.translate(leftX, eyeY - 14);
    drawRoundedEye(ctx, -38, -leftHeight / 2, 76, leftHeight, 36, cyanGlow, cyanCore);
    ctx.restore();

    ctx.save();
    ctx.translate(rightX, eyeY + 4);
    drawRoundedEye(ctx, -34, -rightHeight / 2, 68, rightHeight, 32, cyanGlow, cyanCore);
    ctx.restore();
  } else if (expression === 'thinking') {
    // Concentric scanning eyes with gentle pulse
    const pulse = 0.88 + Math.sin(time * 5) * 0.12;
    const eyeWidth = 70;
    const eyeHeight = 76 * scaleY * pulse;
    ctx.shadowColor = electricBlue;
    ctx.shadowBlur = 26;

    [leftX, rightX].forEach((cx) => {
      drawRoundedEye(ctx, cx - eyeWidth / 2, eyeY - 10 - eyeHeight / 2, eyeWidth, eyeHeight, 30, cyanGlow, cyanCore);
    });
  } else {
    // IDLE: Clean, friendly digital capsule eyes with soft blinking & pupil highlight
    const eyeWidth = 72;
    const eyeHeight = 104 * scaleY;
    ctx.shadowColor = cyanGlow;
    ctx.shadowBlur = 24;

    [leftX, rightX].forEach((cx) => {
      ctx.save();
      ctx.translate(cx, eyeY);
      drawRoundedEye(ctx, -eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight, 34, cyanGlow, cyanCore);
      ctx.restore();
    });
  }

  ctx.restore();
}

function drawRoundedEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  glowColor: string,
  coreColor: string
) {
  const radius = Math.min(r, w / 2, Math.max(1, h / 2));
  
  // Safe cross-browser rounded rectangle
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.fillStyle = glowColor;
  ctx.fill();

  // Specular core highlight
  if (h > 24) {
    const innerX = x + 10;
    const innerY = y + 8;
    const innerW = w - 20;
    const innerH = Math.max(8, h - 26);
    const innerR = Math.max(4, radius - 8);

    ctx.beginPath();
    ctx.moveTo(innerX + innerR, innerY);
    ctx.lineTo(innerX + innerW - innerR, innerY);
    ctx.quadraticCurveTo(innerX + innerW, innerY, innerX + innerW, innerY + innerR);
    ctx.lineTo(innerX + innerW, innerY + innerH - innerR);
    ctx.quadraticCurveTo(innerX + innerW, innerY + innerH, innerX + innerW - innerR, innerY + innerH);
    ctx.lineTo(innerX + innerR, innerY + innerH);
    ctx.quadraticCurveTo(innerX, innerY + innerH, innerX, innerY + innerH - innerR);
    ctx.lineTo(innerX, innerY + innerR);
    ctx.quadraticCurveTo(innerX, innerY, innerX + innerR, innerY);
    ctx.closePath();

    ctx.fillStyle = coreColor;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

// --------------------------------------------------------------------------
// Mascot 3D Model Component
// --------------------------------------------------------------------------
export function Mascot3DModel({
  state = 'idle',
  status = 'idle',
  eyeExpression,
  interactive = true,
  scale = 1.0,
  position = [0, 0, 0],
  reducedMotion = false,
  ctaHovered = false,
  onLoaded,
}: Mascot3DModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF('/models/sellpilot-mascot.glb');

  // Ref container for digital eyes canvas & texture
  const eyeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const eyeTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // Ref container for bones and rest rotations
  const bonesRef = useRef<MascotBones>({
    body: null,
    head: null,
    armL: null,
    armR: null,
    earL: null,
    earR: null,
  });

  const restPoseRef = useRef<{
    body: THREE.Euler;
    head: THREE.Euler;
    armL: THREE.Euler;
    armR: THREE.Euler;
    earL: THREE.Euler;
    earR: THREE.Euler;
  }>({
    body: new THREE.Euler(),
    head: new THREE.Euler(),
    armL: new THREE.Euler(),
    armR: new THREE.Euler(),
    earL: new THREE.Euler(),
    earR: new THREE.Euler(),
  });

  // Determine effective eye expression
  const effectiveExpression: MascotEyeExpression = useMemo(() => {
    if (eyeExpression) return eyeExpression;
    if (state === 'surprised') return 'surprised';
    if (state === 'celebrate' || state === 'order-success' || status === 'success') return 'happy';
    if (state === 'confident') return 'confident';
    if (state === 'curious' || state === 'product-found') return 'curious';
    if (state === 'thinking' || status === 'thinking') return 'thinking';
    if (ctaHovered) return 'focused';
    return 'idle';
  }, [eyeExpression, state, status, ctaHovered]);

  // Clone scene & configure materials, visor, and eyes
  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    // Center the model's visual pivot at (0, 0, 0)
    clone.position.set(0, 0.994, 0);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
      }

      // Hide static GLB circle glyphs and unskinned duplicate meshes
      if (child.name.startsWith('Circle')) {
        child.visible = false;
      }

      if (child.name === 'Cube003' || child.name === 'Cube.003') {
        child.visible = false;
      }

      if (child.name === 'Cube004' || child.name === 'Cube.004') {
        child.visible = false;
      }

      // Configure Cube_3: The actual skinned visor of the mascot
      if (child.name === 'Cube_3') {
        const visor = child as THREE.SkinnedMesh;
        const geom = visor.geometry;
        const pos = geom.attributes.position;
        const uv = geom.attributes.uv;
        if (pos && uv) {
          const minX = -0.941, maxX = 0.941;
          const minY = -0.636, maxY = 0.636;
          const rangeX = maxX - minX;
          const rangeY = maxY - minY;

          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const u = (x - minX) / rangeX;
            // Invert V so canvas (0 at top) maps upright onto Three.js texture
            const v = 1.0 - ((y - minY) / rangeY);
            uv.setXY(i, u, v);
          }
          uv.needsUpdate = true;
        }

        visor.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#030712'),
          emissive: new THREE.Color('#16D9F5'),
          emissiveIntensity: 1.8,
          roughness: 0.12,
          metalness: 0.25,
        });
        visor.renderOrder = 200;
      }
    });

    return clone;
  }, [gltf.scene]);

  // Populate bones and initialize eye texture on client mount
  useEffect(() => {
    let canvas = eyeCanvasRef.current;
    if (!canvas && typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      eyeCanvasRef.current = canvas;
    }

    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderDigitalEyes(ctx, effectiveExpression, 0, 0, 0, 0);
      }
    }

    let texture = eyeTextureRef.current;
    if (!texture && canvas) {
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      eyeTextureRef.current = texture;
    }

    // Attach texture directly to Cube_3 visor material
    let visorMesh: THREE.SkinnedMesh | null = null;
    clonedScene.traverse((child) => {
      if (child.name === 'Cube_3') {
        visorMesh = child as THREE.SkinnedMesh;
        const mat = visorMesh.material as THREE.MeshStandardMaterial;
        if (mat && texture) {
          mat.map = texture;
          mat.emissiveMap = texture;
          mat.needsUpdate = true;
        }
      }
    });

    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__mascotDebug = {
        visor: visorMesh,
        texture,
        canvas,
        clonedScene,
      };
    }

    // Populate bones
    const b: MascotBones = {
      body: null,
      head: null,
      armL: null,
      armR: null,
      earL: null,
      earR: null,
    };

    clonedScene.traverse((obj) => {
      if (obj.name === 'Body') b.body = obj;
      if (obj.name === 'Head') b.head = obj;
      if (obj.name === 'ArmL' || obj.name === 'Arm.L') b.armL = obj;
      if (obj.name === 'ArmR' || obj.name === 'Arm.R') b.armR = obj;
      if (obj.name === 'EarL' || obj.name === 'Ear.L') b.earL = obj;
      if (obj.name === 'EarR' || obj.name === 'Ear.R') b.earR = obj;
    });

    bonesRef.current = b;

    restPoseRef.current = {
      body: b.body ? b.body.rotation.clone() : new THREE.Euler(),
      head: b.head ? b.head.rotation.clone() : new THREE.Euler(),
      armL: b.armL ? b.armL.rotation.clone() : new THREE.Euler(),
      armR: b.armR ? b.armR.rotation.clone() : new THREE.Euler(),
      earL: b.earL ? b.earL.rotation.clone() : new THREE.Euler(),
      earR: b.earR ? b.earR.rotation.clone() : new THREE.Euler(),
    };

    if (onLoaded) {
      onLoaded();
    }
  }, [clonedScene, effectiveExpression, onLoaded]);

  // Animation frame loop via ref
  useFrame((threeState) => {
    if (!groupRef.current) return;
    const time = threeState.clock.getElapsedTime();
    if (typeof window !== 'undefined') {
      const win = window as unknown as Record<string, unknown>;
      win.__liveThree = threeState;
      win.__liveGroup = groupRef.current;
      if (scale <= 0.35) {
        win.__heroThree = threeState;
        win.__heroGroup = groupRef.current;
      }
    }

    // ----------------------------------------------------------------------
    // 1. Digital Eyes Animation & Texture Update
    // ----------------------------------------------------------------------
    const canvas = eyeCanvasRef.current;
    const texture = eyeTextureRef.current;
    if (canvas && texture) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Blink logic: quick blink every 3.6 seconds
        const blinkCycle = time % 3.6;
        let blink = 0;
        if (blinkCycle < 0.2) {
          blink = Math.sin((blinkCycle / 0.2) * Math.PI);
        }

        // Pointer look offset for eyes
        let lookX = threeState.pointer.x;
        let lookY = threeState.pointer.y;

        // If CTA is hovered, glance down-left toward the hero CTA
        if (ctaHovered) {
          lookX = -0.75;
          lookY = -0.6;
        }

        renderDigitalEyes(ctx, effectiveExpression, blink, lookX, lookY, time);
        texture.needsUpdate = true;
      }
    }

    if (reducedMotion) {
      return;
    }

    const { body, head, armL, armR, earL, earR } = bonesRef.current;
    const rest = restPoseRef.current;

    // ----------------------------------------------------------------------
    // 2. Gentle Full-Body Floating & Breathing
    // ----------------------------------------------------------------------
    const floatOffset = Math.sin(time * 1.8) * 0.04;
    groupRef.current.position.set(position[0], position[1] + floatOffset, position[2]);
    groupRef.current.scale.setScalar(scale);

    // ----------------------------------------------------------------------
    // 3. Head Look-At Pointer Tracking
    // ----------------------------------------------------------------------
    if (head && interactive) {
      let targetYaw = -threeState.pointer.x * 0.42; // -24 to +24 deg
      let targetPitch = threeState.pointer.y * 0.28; // -16 to +16 deg

      if (ctaHovered) {
        targetYaw = 0.35; // Turn slightly toward CTA
        targetPitch = -0.25;
      }

      if (state === 'surprised') {
        // Slight alert shake
        targetYaw += Math.sin(time * 14) * 0.08;
      }

      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, rest.head.y + targetYaw, 0.08);
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, rest.head.x - targetPitch, 0.08);
    }

    // ----------------------------------------------------------------------
    // 4. Arms & Gestures
    // ----------------------------------------------------------------------
    if (armR && rest.armR) {
      if (state === 'wave' || status === 'listening') {
        const waveAngle = Math.sin(time * 7) * 0.45;
        armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, rest.armR.z - 1.2 + waveAngle, 0.15);
        armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, rest.armR.x + 0.35, 0.15);
      } else if (state === 'celebrate' || state === 'order-success' || status === 'success') {
        const pump = Math.sin(time * 6) * 0.2;
        armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, rest.armR.z - 1.5 + pump, 0.15);
        armR.rotation.y = THREE.MathUtils.lerp(armR.rotation.y, rest.armR.y + 0.3, 0.15);
      } else if (state === 'confident' || state === 'point-right') {
        // Confident point / command gesture
        armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, rest.armR.z - 1.1, 0.12);
        armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, rest.armR.x + 0.45, 0.12);
      } else if (state === 'surprised') {
        // Arms pull back in brief surprise
        armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, rest.armR.z - 0.4, 0.15);
        armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, rest.armR.x - 0.3, 0.15);
      } else {
        const sway = Math.sin(time * 1.5) * 0.06;
        armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, rest.armR.z + sway, 0.08);
        armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, rest.armR.x, 0.08);
      }
    }

    if (armL && rest.armL) {
      if (state === 'celebrate' || state === 'order-success' || status === 'success') {
        const pump = Math.sin(time * 6) * 0.2;
        armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, rest.armL.z + 1.5 - pump, 0.15);
        armL.rotation.y = THREE.MathUtils.lerp(armL.rotation.y, rest.armL.y - 0.3, 0.15);
      } else if (state === 'point-left') {
        armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, rest.armL.z + 1.0, 0.1);
        armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, rest.armL.x + 0.4, 0.1);
      } else if (state === 'surprised') {
        armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, rest.armL.z + 0.4, 0.15);
        armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, rest.armL.x - 0.3, 0.15);
      } else {
        const sway = -Math.sin(time * 1.5) * 0.06;
        armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, rest.armL.z + sway, 0.08);
        armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, rest.armL.x, 0.08);
      }
    }

    // ----------------------------------------------------------------------
    // 5. Ear Reactions
    // ----------------------------------------------------------------------
    if (earL && earR) {
      if (state === 'curious' || state === 'surprised' || state === 'product-found' || status === 'thinking') {
        const wiggle = Math.sin(time * 10) * 0.18;
        earL.rotation.z = rest.earL.z + wiggle;
        earR.rotation.z = rest.earR.z - wiggle;
      } else {
        earL.rotation.z = THREE.MathUtils.lerp(earL.rotation.z, rest.earL.z, 0.1);
        earR.rotation.z = THREE.MathUtils.lerp(earR.rotation.z, rest.earR.z, 0.1);
      }
    }

    // ----------------------------------------------------------------------
    // 6. Body Leaning / Posture
    // ----------------------------------------------------------------------
    if (body) {
      let targetLean = Math.sin(time * 1.8) * 0.02;
      if (state === 'surprised') {
        targetLean = -0.12; // Leans back in surprise
      } else if (state === 'confident') {
        targetLean = 0.06; // Leans forward with confidence
      }
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, rest.body.x + targetLean, 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position} scale={[scale, scale, scale]}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload('/models/sellpilot-mascot.glb');
