import { chapters, sampleTour, settledProgress, totalDuration } from "./tour.ts";
import { anchorVisible, createExperience, type Orbit } from "./scene.ts";

const canvas = must(document.querySelector<HTMLCanvasElement>("#view"));
const veil = must(document.querySelector<HTMLElement>("#veil"));
const intro = must(document.querySelector<HTMLElement>("#intro"));
const card = must(document.querySelector<HTMLElement>("#card"));
const kicker = must(document.querySelector<HTMLElement>("#kicker"));
const title = must(document.querySelector<HTMLElement>("#title"));
const body = must(document.querySelector<HTMLElement>("#body"));
const beat = must(document.querySelector<HTMLElement>("#beat"));
const facts = must(document.querySelector<HTMLElement>("#facts"));
const count = must(document.querySelector<HTMLElement>("#count"));
const chaptersEl = must(document.querySelector<HTMLElement>("#chapters"));
const scrub = must(document.querySelector<HTMLInputElement>("#scrub"));
const playButton = must(document.querySelector<HTMLButtonElement>("#play"));
const prevButton = must(document.querySelector<HTMLButtonElement>("#prev"));
const nextButton = must(document.querySelector<HTMLButtonElement>("#next"));
const labelRoot = must(document.querySelector<HTMLElement>("#labels"));
const fallback = must(document.querySelector<HTMLElement>("#fallback"));
const iconPlay = must(document.querySelector<HTMLElement>("#icon-play"));
const iconPause = must(document.querySelector<HTMLElement>("#icon-pause"));

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 800;
const params = new URLSearchParams(window.location.search);
const requested = chapters.findIndex((chapter) => chapter.id === params.get("chapter"));

let progress = requested >= 0 ? settledProgress(requested) : 0;
let playing = !reduced && requested < 0 && params.get("autoplay") !== "0";
let scrubbing = false;
let dragging = false;
let moved = 0;
const orbit: Orbit = { yaw: 0, pitch: 0 };
let last = performance.now();
let lastIndex = -1;

const chapterButtons = chapters.map((chapter, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.role = "tab";
  button.textContent = chapter.label;
  button.setAttribute("aria-selected", "false");
  button.addEventListener("click", () => {
    goTo(index, true);
  });
  chaptersEl.append(button);
  return button;
});

function sync() {
  const sample = sampleTour(progress);
  playButton.setAttribute("aria-label", playing ? "Pause tour" : progress >= 0.999 ? "Replay tour" : "Play tour");
  playButton.setAttribute("aria-pressed", playing ? "true" : "false");
  iconPause.hidden = !playing;
  iconPlay.hidden = playing;
  if (!scrubbing) scrub.value = String(Math.round(progress * 1000));
  scrub.setAttribute("aria-valuetext", sample.chapter.title);
  if (sample.index !== lastIndex) {
    lastIndex = sample.index;
    count.textContent = `${String(sample.index + 1).padStart(2, "0")} / ${String(chapters.length).padStart(2, "0")}`;
    kicker.textContent = sample.chapter.kicker;
    title.textContent = sample.chapter.title;
    body.textContent = sample.chapter.body;
    facts.replaceChildren();
    for (const fact of sample.chapter.facts) {
      const item = document.createElement("li");
      const strong = document.createElement("b");
      strong.textContent = fact.k;
      item.append(strong, document.createTextNode(fact.v));
      facts.append(item);
    }
    chapterButtons.forEach((button, index) => {
      button.setAttribute("aria-selected", index === sample.index ? "true" : "false");
    });
    chapterButtons[sample.index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  if (sample.beat) {
    beat.hidden = false;
    beat.textContent = sample.beat.text;
  } else {
    beat.hidden = true;
    beat.textContent = "";
  }
  intro.style.opacity = String(sample.intro);
  intro.style.visibility = sample.intro < 0.02 ? "hidden" : "visible";
  const cardOpacity = sample.index === 0 ? 1 - sample.intro : 1;
  card.style.opacity = String(cardOpacity);
  card.style.pointerEvents = cardOpacity < 0.2 ? "none" : "auto";
}

function goTo(index: number, pause: boolean) {
  progress = settledProgress(index);
  if (pause) playing = false;
  orbit.yaw = 0;
  orbit.pitch = 0;
  sync();
}

function step(direction: number) {
  const sample = sampleTour(progress);
  const next = Math.min(chapters.length - 1, Math.max(0, sample.index + direction));
  goTo(next, true);
}

prevButton.addEventListener("click", () => step(-1));
nextButton.addEventListener("click", () => step(1));
playButton.addEventListener("click", () => {
  if (progress >= 0.999) progress = 0;
  playing = !playing;
  sync();
});

scrub.addEventListener("pointerdown", () => {
  scrubbing = true;
  playing = false;
});
scrub.addEventListener("input", () => {
  progress = Number(scrub.value) / 1000;
  playing = false;
  sync();
});
window.addEventListener("pointerup", () => {
  scrubbing = false;
});

canvas.addEventListener("pointerdown", (event) => {
  dragging = true;
  moved = 0;
  canvas.setPointerCapture(event.pointerId);
  document.body.classList.add("dragging");
  playing = false;
});
canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  moved += Math.abs(event.movementX) + Math.abs(event.movementY);
  orbit.yaw = clamp(orbit.yaw - event.movementX * 0.005, -0.65, 0.65);
  orbit.pitch = clamp(orbit.pitch - event.movementY * 0.0035, -0.3, 0.3);
});
canvas.addEventListener("pointerup", (event) => {
  dragging = false;
  document.body.classList.remove("dragging");
  if (moved < 6 && experience) {
    const chapter = experience.pick(event.clientX, event.clientY);
    if (chapter !== null) goTo(chapter, true);
  }
});
canvas.addEventListener("pointercancel", () => {
  dragging = false;
  document.body.classList.remove("dragging");
});

window.addEventListener("wheel", (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest("#card, #dock, #fallback")) return;
  event.preventDefault();
  playing = false;
  progress = clamp(progress + event.deltaY * 0.00035, 0, 1);
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
  if (event.key === "ArrowRight") {
    step(1);
    event.preventDefault();
  } else if (event.key === "ArrowLeft") {
    step(-1);
    event.preventDefault();
  } else if (event.key === " " || event.key === "k") {
    if (progress >= 0.999) progress = 0;
    playing = !playing;
    sync();
    event.preventDefault();
  } else if (event.key === "Home") {
    goTo(0, true);
  } else if (event.key === "End") {
    goTo(chapters.length - 1, true);
  }
});

let experience: ReturnType<typeof createExperience> | null = null;
try {
  experience = createExperience(canvas, mobile);
} catch (error) {
  showFallback(error instanceof Error ? error.message : "WebGL is unavailable.");
}

if (experience) start(experience);

function start(experience: ReturnType<typeof createExperience>) {

const labelButtons = new Map<string, HTMLButtonElement>();
for (const anchor of experience.anchors) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tag";
  button.hidden = true;
  const dot = document.createElement("i");
  dot.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = anchor.title;
  button.append(dot, text);
  button.addEventListener("click", () => {
    const index = chapters.findIndex((chapter) => anchor.chapters.includes(chapter.id));
    if (index >= 0) goTo(index, true);
  });
  labelRoot.append(button);
  labelButtons.set(anchor.id, button);
}

window.addEventListener("resize", () => experience.resize());

function placeLabels(sampleIndexHighlight: string) {
  const sample = sampleTour(progress);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const cardRect = card.getBoundingClientRect();
  const dockRect = document.querySelector("#dock")?.getBoundingClientRect();
  const placed: { x: number; y: number; button: HTMLButtonElement }[] = [];
  for (const anchor of experience.anchors) {
    const button = labelButtons.get(anchor.id);
    if (!button) continue;
    const visible = anchorVisible(anchor, sample);
    button.hidden = !visible;
    if (!visible) continue;
    const point = experience.project(anchor.object, width, height);
    if (point.behind || point.x < -80 || point.x > width + 80 || point.y < -80 || point.y > height + 80) {
      button.hidden = true;
      continue;
    }
    let x = point.x + (anchor.side === "right" ? 72 : -72);
    let y = point.y;
    const dockTop = (dockRect?.top ?? height) - 28;
    y = Math.min(Math.max(y, 78), dockTop);
    const overlapsCard = x > cardRect.left - 12 && x < cardRect.right + 12 && y > cardRect.top - 8 && y < cardRect.bottom + 8;
    if (overlapsCard) x = point.x < cardRect.left + cardRect.width / 2 ? cardRect.left - 88 : cardRect.right + 88;
    x = Math.min(width - 36, Math.max(36, x));
    for (const other of placed) {
      if (Math.abs(other.x - x) < 140 && Math.abs(other.y - y) < 28) y += 30;
    }
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    button.classList.toggle("hot", anchor.id === sampleIndexHighlight);
    placed.push({ x, y, button });
  }
}

function frame(now: number) {
  if (document.visibilityState === "hidden") return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    progress = Math.min(1, progress + dt / totalDuration);
    if (progress >= 1) playing = false;
  }
  if (!dragging) {
    const damp = 1 - Math.exp(-dt * 1.15);
    orbit.yaw += (0 - orbit.yaw) * damp;
    orbit.pitch += (0 - orbit.pitch) * damp;
  }
  const sample = sampleTour(progress);
  experience.update(sample, now / 1000, orbit, reduced);
  experience.render();
  sync();
  placeLabels(sample.beat?.highlight ?? "");
  if (veil.classList.contains("off") === false) veil.classList.add("off");
  requestAnimationFrame(frame);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    last = performance.now();
    requestAnimationFrame(frame);
  }
});

sync();
requestAnimationFrame(frame);
}

function showFallback(reason: string) {
  veil.classList.add("off");
  canvas.hidden = true;
  card.hidden = true;
  fallback.hidden = false;
  const reasonEl = document.querySelector<HTMLElement>("#fallback-reason");
  const host = document.querySelector<HTMLElement>("#fallback-body");
  if (reasonEl) reasonEl.textContent = `${reason} The tour is written out below.`;
  if (!host) return;
  for (const chapter of chapters) {
    const heading = document.createElement("h2");
    heading.textContent = chapter.title;
    const copy = document.createElement("p");
    copy.textContent = chapter.body;
    host.append(heading, copy);
    for (const item of chapter.beats ?? []) {
      const line = document.createElement("p");
      line.textContent = item.text;
      host.append(line);
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function must<T>(node: T | null): T {
  if (node === null || node === undefined) throw new Error("Missing interface node");
  return node;
}
