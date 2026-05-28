"use client";

import { motion } from "framer-motion";
import type { JSX } from "react";
import { useMemo } from "react";

/**
 * Burst de confeti dorado disparado al revelar una carta de premio real
 * (no se usa en collectible common ni en none).
 *
 * - 16 partículas distribuidas en 360°, salen desde el centro de la carta.
 * - Duración total ~700ms con stagger sutil.
 * - Sin assets externos: cuadritos / círculos con `boxShadow` dorado.
 *
 * Pure decorativo, `aria-hidden`. Respeta `prefers-reduced-motion` desde
 * Framer Motion (cuando el usuario lo activa, las animaciones no corren).
 */

const PARTICLE_COUNT = 16;
const SPREAD_PX = 110;

type Particle = {
  id: number;
  dx: number;
  dy: number;
  rotate: number;
  delay: number;
  size: number;
};

function buildParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
    // Deterministic but varied: each particle gets a slight magnitude
    // jitter so the burst doesn't look like a perfect circle.
    const magnitude = SPREAD_PX * (0.7 + ((i * 13) % 7) / 10);
    particles.push({
      id: i,
      dx: Math.cos(angle) * magnitude,
      dy: Math.sin(angle) * magnitude,
      rotate: (i * 47) % 360,
      delay: (i % 4) * 40,
      size: 6 + ((i * 5) % 5),
    });
  }
  return particles;
}

export interface ConfettiProps {
  /** ms delay before the burst fires. Use to sync with card flip. */
  delay?: number;
}

export function Confetti({ delay = 0 }: ConfettiProps): JSX.Element {
  const particles = useMemo(() => buildParticles(), []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      data-confetti="true"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-sm"
          style={{
            width: p.size,
            height: p.size,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            background:
              "linear-gradient(135deg, #FFE08A 0%, #D4A017 60%, #B8860B 100%)",
            boxShadow: "0 0 6px 1px rgba(212, 160, 23, 0.7)",
          }}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.3 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: [0, p.dx * 0.6, p.dx],
            y: [0, p.dy * 0.6, p.dy + 16],
            rotate: [0, p.rotate / 2, p.rotate],
            scale: [0.3, 1, 0.6],
          }}
          transition={{
            duration: 0.75,
            delay: (delay + p.delay) / 1000,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

export default Confetti;
