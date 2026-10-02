import assert from "node:assert/strict";
import test from "node:test";
import { BAYS, HERO_BAY } from "./layout.ts";
import { chapters, sampleTour, settledProgress, totalDuration } from "./tour.ts";

test("rack stack matches the public tray pattern", () => {
  assert.equal(BAYS.filter((bay) => bay.kind === "compute").length, 18);
  assert.equal(BAYS.filter((bay) => bay.kind === "switch").length, 9);
  assert.equal(BAYS.filter((bay) => bay.kind === "power").length, 2);
  assert.equal(HERO_BAY.kind, "compute");
});

test("tour progress stays inside a chapter and settles on that chapter", () => {
  assert.equal(chapters.length, 8);
  assert.ok(totalDuration > 60);
  assert.equal(sampleTour(0).index, 0);
  assert.equal(sampleTour(0).features.sweep, 0);
  assert.equal(sampleTour(1).index, chapters.length - 1);
  assert.ok(sampleTour(1).features.sweep > 0.99);

  let previous = -1;
  for (let step = 0; step <= 200; step += 1) {
    const sample = sampleTour(step / 200);
    assert.ok(sample.index >= previous);
    previous = sample.index;
    assert.ok(sample.local >= 0 && sample.local <= 1);
  }

  chapters.forEach((chapter, index) => {
    const settled = sampleTour(settledProgress(index));
    assert.equal(settled.index, index);
    assert.ok(Math.abs(settled.local - chapter.settle) < 0.02);
  });
});

test("the package chapter finishes exploded when settled", () => {
  const index = chapters.findIndex((chapter) => chapter.id === "package");
  const settled = sampleTour(settledProgress(index));
  assert.ok(settled.features.explode > 0.95);
  assert.ok(settled.features.gpu > 0.95);
  assert.equal(settled.beat?.highlight, "hbm");
});

test("die and path beats advance inside the chapter", () => {
  const die = chapters.find((chapter) => chapter.id === "die");
  assert.ok(die);
  const dieStart = settledProgress(chapters.indexOf(die));
  assert.equal(sampleTour(dieStart).beat?.highlight, "tensor");

  const path = chapters.find((chapter) => chapter.id === "path");
  assert.ok(path);
  const atEnd = sampleTour(1);
  assert.equal(atEnd.chapter.id, "scale");
  assert.ok(atEnd.features.door > 0.6);
  assert.ok(atEnd.features.tray < 0.05);
});
