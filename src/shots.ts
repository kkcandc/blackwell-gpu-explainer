import { HERO_Y, MOTION } from "./layout.ts";
import { CAMERA_BLEND, chapters, type Sample } from "./tour.ts";

export type Shot = {
  cam: [number, number, number];
  look: [number, number, number];
  fov: number;
};

const px = MOTION.gpuPull.x;
const py = HERO_Y + MOTION.gpuPull.y;
const pz = MOTION.trayPull + MOTION.gpuPull.z;

const SHOTS: Record<string, Shot> = {
  intro: {
    cam: [1.72, HERO_Y - 0.18, 4.15],
    look: [0.04, HERO_Y, 0],
    fov: 30,
  },
  rack: {
    cam: [1.42, HERO_Y + 0.22, 3.35],
    look: [0, HERO_Y + 0.02, 0.05],
    fov: 28,
  },
  open: {
    cam: [0.86, HERO_Y + 0.24, 2.15],
    look: [-0.04, HERO_Y + 0.02, 0.18],
    fov: 32,
  },
  tray: {
    cam: [0.55, HERO_Y + 0.38, 1.62],
    look: [0.02, HERO_Y + 0.02, 0.32],
    fov: 30,
  },
  gpu: {
    cam: [px + 0.42, py + 0.2, pz + 0.52],
    look: [px, py + 0.02, pz],
    fov: 28,
  },
  package: {
    cam: [px + 0.4, py + 0.28, pz + 0.55],
    look: [px, py + 0.07, pz],
    fov: 26,
  },
  die: {
    cam: [px + 0.22, py + 0.2, pz + 0.4],
    look: [px - 0.005, py + 0.05, pz - 0.01],
    fov: 22,
  },
  path: {
    cam: [0.78, HERO_Y + 0.46, 1.88],
    look: [0.05, HERO_Y + 0.05, 0.4],
    fov: 32,
  },
  scale: {
    cam: [1.55, HERO_Y + 0.32, 3.4],
    look: [0, HERO_Y + 0.02, 0.06],
    fov: 30,
  },
};

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpShot(a: Shot, b: Shot, t: number): Shot {
  return {
    cam: [lerp(a.cam[0], b.cam[0], t), lerp(a.cam[1], b.cam[1], t), lerp(a.cam[2], b.cam[2], t)],
    look: [lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t)],
    fov: lerp(a.fov, b.fov, t),
  };
}

export function shotFor(id: string): Shot {
  return SHOTS[id] ?? SHOTS.rack;
}

export function frameShot(sample: Sample): Shot {
  const current = shotFor(sample.chapter.id);
  const previous = shotFor(sample.index === 0 ? "intro" : chapters[sample.index - 1].id);
  return lerpShot(previous, current, smoothstep(sample.local / CAMERA_BLEND));
}
