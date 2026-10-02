export type BayKind = "power" | "compute" | "switch";

export type Bay = {
  kind: BayKind;
  /** Center height of the bay, meters. */
  y: number;
  h: number;
  index: number;
};

export const RACK = {
  w: 0.82,
  h: 2.16,
  d: 1.18,
};

const GAP = 0.008;

function push(bays: Bay[], kind: BayKind, h: number, cursor: { y: number }): void {
  bays.push({ kind, h, y: cursor.y + h / 2, index: bays.length });
  cursor.y += h + GAP;
}

/** Power, then nine (compute, compute, switch) groups, then power. */
export function buildBays(): Bay[] {
  const bays: Bay[] = [];
  const cursor = { y: 0.13 };
  push(bays, "power", 0.1, cursor);
  for (let i = 0; i < 9; i += 1) {
    push(bays, "compute", 0.058, cursor);
    push(bays, "compute", 0.058, cursor);
    push(bays, "switch", 0.04, cursor);
  }
  push(bays, "power", 0.092, cursor);
  return bays;
}

export const BAYS = buildBays();

const computeBays = BAYS.filter((bay) => bay.kind === "compute");

/** Compute tray nearest the vertical middle. The tour pulls this one. */
export const HERO_BAY = computeBays[Math.floor(computeBays.length / 2)];

export const HERO_Y = HERO_BAY.y;

/** The switch tray directly above the hero compute tray. */
export const SWITCH_BAY = BAYS.find((bay) => bay.kind === "switch" && bay.y > HERO_Y) ?? BAYS[0];

/** Another compute tray, used as the far end of a fabric hop. */
export const PEER_BAY = computeBays.find((bay) => bay.y > SWITCH_BAY.y) ?? computeBays[0];

export const MOTION = {
  trayPull: 0.74,
  gpuHome: { x: 0.13, y: 0.034, z: -0.04 },
  gpuPull: { x: 0.15, y: 0.24, z: 0.48 },
};
