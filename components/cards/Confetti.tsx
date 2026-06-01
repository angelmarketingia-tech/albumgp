import type { CSSProperties, JSX } from "react";

/**
 * Burst de confeti dorado disparado al revelar una carta de premio real.
 * Server component: precompute particles deterministically, hand off the
 * animation to pure CSS keyframes (see app/globals.css `confetti-burst`).
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
    const magnitude = SPREAD_PX * (0.7 + ((i * 13) % 7) / 10);
    particles.push({
      id: i,
      dx: Math.cos(angle) * magnitude,
      dy: Math.sin(angle) * magnitude + 16,
      rotate: (i * 47) % 360,
      delay: (i % 4) * 40,
      size: 6 + ((i * 5) % 5),
    });
  }
  return particles;
}

const PARTICLES: readonly Particle[] = buildParticles();

export interface ConfettiProps {
  /** ms delay before the burst fires. Use to sync with card flip. */
  delay?: number;
}

export function Confetti({ delay = 0 }: ConfettiProps): JSX.Element {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      data-confetti="true"
      style={{ color: "#D4A017" }}
    >
      {PARTICLES.map((p) => {
        // CSS vars consumed by the `confetti-burst` keyframes.
        const style: CSSProperties = {
          ["--dx" as string]: `${p.dx}px`,
          ["--dy" as string]: `${p.dy}px`,
          ["--rot" as string]: `${p.rotate}deg`,
          ["--size" as string]: `${p.size}px`,
          marginLeft: `${-p.size / 2}px`,
          marginTop: `${-p.size / 2}px`,
          animationDelay: `${delay + p.delay}ms`,
        };
        return <span key={p.id} className="confetti-particle" style={style} />;
      })}
    </div>
  );
}

export default Confetti;
