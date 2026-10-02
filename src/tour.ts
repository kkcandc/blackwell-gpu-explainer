export type Features = {
  door: number;
  tray: number;
  gpu: number;
  explode: number;
  die: number;
  flow: number;
  sweep: number;
};

export type Beat = {
  at: number;
  text: string;
  /** Anchor id to emphasize. */
  highlight: string;
};

export type Chapter = {
  id: string;
  label: string;
  kicker: string;
  title: string;
  body: string;
  facts: { k: string; v: string }[];
  /** Seconds the autoplay tour holds this chapter. */
  duration: number;
  /** Local progress (0–1) where a click should land, after the camera has arrived. */
  settle: number;
  pose: Features;
  beats?: Beat[];
};

export const CAMERA_BLEND = 0.26;

export const FEATURE_WINDOWS: Record<keyof Features, number> = {
  door: 0.34,
  tray: 0.5,
  gpu: 0.44,
  explode: 0.78,
  die: 0.42,
  flow: 0.36,
  sweep: 0.2,
};

const rest: Features = {
  door: 0,
  tray: 0,
  gpu: 0,
  explode: 0,
  die: 0,
  flow: 0,
  sweep: 1,
};

export const INTRO_POSE: Features = { ...rest, sweep: 0 };

export const chapters: Chapter[] = [
  {
    id: "rack",
    label: "Rack",
    kicker: "Start here",
    title: "Seventy-two GPUs that act like one",
    body: "A Blackwell-class rack is a liquid-cooled cabinet wired so every accelerator shares one fast fabric. Software can treat the whole cabinet as a single pool of memory and matrix math.",
    facts: [
      { k: "72", v: "GPUs" },
      { k: "36", v: "CPUs" },
      { k: "1", v: "NVLink domain" },
    ],
    duration: 10,
    settle: 0.42,
    pose: { ...rest, door: 0, sweep: 1 },
  },
  {
    id: "open",
    label: "Open",
    kicker: "Inside the cabinet",
    title: "Trays, switches, power, coolant",
    body: "Compute trays hold the GPUs. Switch trays sit between them so every GPU has a path to every other GPU. Power shelves feed the rack. Manifolds carry heat out in liquid.",
    facts: [
      { k: "18", v: "compute trays" },
      { k: "9", v: "switch trays" },
      { k: "Liquid", v: "cooled" },
    ],
    duration: 9,
    settle: 0.46,
    pose: { ...rest, door: 1 },
  },
  {
    id: "tray",
    label: "Tray",
    kicker: "A compute tray",
    title: "CPUs schedule. GPUs multiply.",
    body: "Each compute tray carries two superchip modules. A Grace-class CPU runs the host work and keeps a wide, short link to its GPUs, so that hop does not fall back to an ordinary slot.",
    facts: [
      { k: "4", v: "GPUs on the tray" },
      { k: "2", v: "CPUs on the tray" },
      { k: "900 GB/s", v: "class CPU link" },
    ],
    duration: 10,
    settle: 0.58,
    pose: { ...rest, door: 1, tray: 1 },
  },
  {
    id: "gpu",
    label: "GPU",
    kicker: "One accelerator",
    title: "Pull one GPU off the board",
    body: "Under the cold plate is a single package that behaves as one GPU. It is built from two large dies, because one die cannot hold this much compute and still leave the factory.",
    facts: [
      { k: "2", v: "reticle-class dies" },
      { k: "208B", v: "transistors" },
      { k: "4NP", v: "class process" },
    ],
    duration: 9,
    settle: 0.55,
    pose: { ...rest, door: 1, tray: 1, gpu: 1 },
  },
  {
    id: "package",
    label: "Package",
    kicker: "The package",
    title: "Memory sits next to the math",
    body: "High-bandwidth memory stands beside the dies on a silicon interposer. A die-to-die bridge lets the pair behave as one chip. The cold plate above is doing real work: this part is in the kilowatt class.",
    facts: [
      { k: "192 GB", v: "HBM3e class" },
      { k: "8 TB/s", v: "memory class" },
      { k: "10 TB/s", v: "die-to-die" },
    ],
    duration: 12,
    settle: 0.84,
    pose: { ...rest, door: 1, tray: 1, gpu: 1, explode: 1, die: 0.2 },
    beats: [
      { at: 0.12, text: "The cold plate lifts off first. Heat goes into liquid, not into a fan.", highlight: "coldplate" },
      { at: 0.4, text: "Two compute dies, joined by a roughly 10 TB/s bridge, present themselves as one GPU.", highlight: "bridge" },
      { at: 0.68, text: "Eight HBM stacks sit on the interposer beside the dies. Weights and the attention cache live here.", highlight: "hbm" },
    ],
  },
  {
    id: "die",
    label: "Die",
    kicker: "On the silicon",
    title: "Most of the die is matrix math",
    body: "Streaming multiprocessors fill the floorplan. Tensor cores inside them multiply low-precision numbers fast enough for giant models. Cache and memory controllers keep the cores fed. Link blocks at the edge talk to the rest of the rack.",
    facts: [
      { k: "FP4", v: "and FP8" },
      { k: "Tensor", v: "cores" },
      { k: "On-die", v: "cache" },
    ],
    duration: 14,
    settle: 0.36,
    pose: { ...rest, door: 1, tray: 1, gpu: 1, explode: 1, die: 1 },
    beats: [
      { at: 0.28, text: "Tensor cores own most of the area. They are built for matrix multiply, in formats such as FP8 and FP4.", highlight: "tensor" },
      { at: 0.46, text: "A shared cache keeps tiles of the multiply close, so the cores are not waiting on memory for every step.", highlight: "cache" },
      { at: 0.62, text: "Memory controllers line the edge and feed those cores from the HBM stacks.", highlight: "memory" },
      { at: 0.78, text: "NVLink blocks on the rim, and the die-to-die bridge between the two dies, connect this math to the rest of the machine.", highlight: "nvlink" },
    ],
  },
  {
    id: "path",
    label: "Path",
    kicker: "A token's path",
    title: "Follow one step of a reply",
    body: "A request arrives at the CPU. Weights stream out of HBM into the tensor cores, which produce the next piece of the answer. If the model spans the rack, activations cross the switch trays. Heat leaves through liquid the entire time.",
    facts: [
      { k: "1.8 TB/s", v: "per GPU" },
      { k: "130 TB/s", v: "in the rack" },
      { k: "~120 kW", v: "class" },
    ],
    duration: 14,
    settle: 0.5,
    pose: { ...rest, door: 1, tray: 1, gpu: 0.12, flow: 1 },
    beats: [
      { at: 0.28, text: "The request lands on the CPU. The CPU's job is to schedule, not to do the giant multiply.", highlight: "cpu" },
      { at: 0.48, text: "Model weights move out of HBM and into the GPU. Bandwidth here is the whole point of those stacks.", highlight: "hbm" },
      { at: 0.66, text: "Tensor cores turn that stream into the next piece of the answer.", highlight: "gpu" },
      { at: 0.82, text: "When the model does not fit on one GPU, activations cross the switch tray to the other accelerators. The rack behaves as one domain.", highlight: "fabric" },
    ],
  },
  {
    id: "scale",
    label: "Scale",
    kicker: "Zoom back out",
    title: "The limit is the wires and the watts",
    body: "The same pattern repeats on every compute tray. Transistors matter, but the cabinet exists to feed them: memory bandwidth, GPU-to-GPU bandwidth, and a cooling loop that can carry the heat. That is why this machine is a rack, not a bigger card in a PC.",
    facts: [
      { k: "72-GPU", v: "domain" },
      { k: "Copper", v: "in-rack fabric" },
      { k: "One", v: "cooling loop" },
    ],
    duration: 11,
    settle: 0.5,
    pose: { ...rest, door: 0.72, tray: 0, flow: 0.15 },
  },
];

export const totalDuration = chapters.reduce((sum, chapter) => sum + chapter.duration, 0);

export type Sample = {
  progress: number;
  index: number;
  chapter: Chapter;
  /** 0–1 within the current chapter. */
  local: number;
  features: Features;
  beat: Beat | null;
  /** 1 while the opening title should cover the frame, fading to 0. */
  intro: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function bounds(index: number): { start: number; span: number } {
  let start = 0;
  for (let i = 0; i < index; i += 1) start += chapters[i].duration / totalDuration;
  return { start, span: chapters[index].duration / totalDuration };
}

export function settledProgress(index: number): number {
  const safe = Math.min(chapters.length - 1, Math.max(0, index));
  const { start, span } = bounds(safe);
  return clamp01(start + span * chapters[safe].settle);
}

function mixFeatures(prev: Features, next: Features, local: number): Features {
  const mixed = { ...prev };
  (Object.keys(FEATURE_WINDOWS) as (keyof Features)[]).forEach((key) => {
    const t = smoothstep(local / FEATURE_WINDOWS[key]);
    mixed[key] = prev[key] + (next[key] - prev[key]) * t;
  });
  return mixed;
}

export function activeBeat(chapter: Chapter, local: number): Beat | null {
  if (!chapter.beats?.length) return null;
  let current = chapter.beats[0];
  if (local + 1e-6 < current.at) return null;
  for (const beat of chapter.beats) {
    if (local + 1e-6 >= beat.at) current = beat;
  }
  return current;
}

export function sampleTour(progress: number): Sample {
  const p = clamp01(progress);
  let index = chapters.length - 1;
  let start = 0;
  for (let i = 0; i < chapters.length; i += 1) {
    const span = chapters[i].duration / totalDuration;
    if (p < start + span - 1e-8 || i === chapters.length - 1) {
      index = i;
      break;
    }
    start += span;
  }
  const chapter = chapters[index];
  const span = chapter.duration / totalDuration;
  const local = span === 0 ? 1 : clamp01((p - start) / span);
  const prev = index === 0 ? INTRO_POSE : chapters[index - 1].pose;
  const features = mixFeatures(prev, chapter.pose, local);
  const intro = index === 0 ? 1 - smoothstep((local - 0.2) / 0.38) : 0;
  return {
    progress: p,
    index,
    chapter,
    local,
    features,
    beat: activeBeat(chapter, local),
    intro,
  };
}

export function chapterIndexFromProgress(progress: number): number {
  return sampleTour(progress).index;
}
