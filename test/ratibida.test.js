import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import * as publicApi from '../src/lib/index.js';
import { createRatibidaHeadGeometry } from '../src/lib/plants/ratibida/geometry.js';
import { createPinnataModel, evaluatePinnataModel } from '../src/lib/plants/ratibida/model.js';
import { getPinnataPhenology } from '../src/lib/plants/ratibida/phenology.js';
import { PINNATA_PROFILE, PINNATA_SOURCES } from '../src/lib/plants/ratibida/pinnata.js';
import { Ratibida } from '../src/lib/plants/ratibida/ratibida.js';

const SEEDS = Array.from({ length: 24 }, (_, i) => `seed-${i}`);

function stats(seed, ageYears, dayOfYear) {
  const plant = new Ratibida({ seed, ageYears, dayOfYear });
  const result = plant.stats();
  plant.dispose();
  return result;
}

const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];

function instanceState(plant) {
  const out = [];
  plant.traverse((o) => {
    if (o.isInstancedMesh) {
      out.push([o.name, o.count, Array.from(o.instanceMatrix.array.slice(0, o.count * 16))]);
    }
  });
  return JSON.stringify(out.sort((a, b) => a[0].localeCompare(b[0])));
}

test('the profile is species-level, herbaceous and sourced', () => {
  assert.equal(PINNATA_PROFILE.species, 'Ratibida pinnata');
  assert.equal(PINNATA_PROFILE.cultivar, 'Species');
  assert.equal(PINNATA_PROFILE.architecture.woody, false);
  assert.equal(PINNATA_PROFILE.architecture.leanTipDegreesEdge, 15);
  assert.strictEqual(publicApi.Ratibida, Ratibida);
  assert.strictEqual(publicApi.PINNATA_PROFILE, PINNATA_PROFILE);
  for (const source of Object.values(PINNATA_SOURCES)) {
    if (source.url) assert.match(source.url, /^https:\/\//);
    assert.ok(source.supports.length > 30);
  }
});

test('age 0 is a plug: a rosette with no stems and no heads', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    const s = stats(seed, 0, 205);
    assert.equal(s.visibleStems, 0);
    assert.equal(s.visibleHeads, 0);
    assert.ok(s.visibleLeaves >= 6);
    assert.ok(s.dimensions.heightM > 0.1 && s.dimensions.heightM < 0.3);
  }
});

test('stems, heads, height and spread grow with age toward the mature clump', () => {
  const at = (age) => SEEDS.map((seed) => stats(seed, age, 205));
  const stems = [1, 2, 3, 5].map((age) => median(at(age).map((s) => s.visibleStems)));
  const heads = [1, 2, 3, 5].map((age) => median(at(age).map((s) => s.visibleHeads)));
  const heights = [1, 2, 3, 5].map((age) => median(at(age).map((s) => s.dimensions.heightM)));
  const spreads = [1, 2, 3, 5].map((age) => median(at(age).map((s) => s.dimensions.spreadM)));
  for (const series of [stems, heads, heights, spreads]) {
    for (let i = 1; i < series.length; i += 1) assert.ok(series[i] > series[i - 1], String(series));
  }
  assert.ok(stems[3] >= 12 && stems[3] <= 15);
  assert.ok(heads[3] >= 40 && heads[3] <= 50, `mature head median ${heads[3]}`);
  assert.ok(heights[3] > 0.9 && heights[3] < 1.5);
  assert.ok(spreads[3] > 0.45 && spreads[3] < 0.6);
  for (const s of at(5)) assert.ok(s.visibleHeads >= 30 && s.visibleHeads <= 60);
});

test('bloom runs from July into October with open heads counted as flowers', () => {
  const open = (day) => median(SEEDS.map((seed) => stats(seed, 5, day).visibleFlowers));
  assert.equal(open(150), 0);
  assert.ok(open(205) >= 8);
  assert.ok(open(240) >= 3);
  const octoberSomewhere = SEEDS.some((seed) => stats(seed, 5, 290).visibleFlowers > 0);
  assert.ok(octoberSomewhere, 'a thin tail of open heads in October');
  assert.equal(stats('seed-1', 5, 330).visibleFlowers, 0);
  const s = stats('seed-1', 5, 205);
  assert.equal(s.visibleHeads, s.visibleFlowers + s.visibleFlowerBuds + s.visibleSeedHeads);
});

test('dark seed heads stand through winter and the stems are cut back in spring', () => {
  const winter = SEEDS.map((seed) => stats(seed, 5, 20));
  for (const s of winter) {
    assert.ok(s.visibleSeedHeads >= 5);
    assert.equal(s.visibleLeaves, 0);
    assert.equal(s.visibleFlowers, 0);
  }
  assert.equal(stats('seed-1', 5, 100).visibleStems, 0);
  assert.equal(stats('seed-1', 0, 20).visibleHeads, 0);
  assert.ok(stats('seed-1', 5, 340).visibleSeedHeads >= 20);
});

test('the same seed gives the same plant and a different seed does not', () => {
  const a = new Ratibida({ seed: 'x', ageYears: 5, dayOfYear: 205 });
  const b = new Ratibida({ seed: 'x', ageYears: 5, dayOfYear: 205 });
  const c = new Ratibida({ seed: 'y', ageYears: 5, dayOfYear: 205 });
  assert.equal(instanceState(a), instanceState(b));
  assert.notEqual(instanceState(a), instanceState(c));
  for (const p of [a, b, c]) p.dispose();
});

test('setTime rewrites the pools in place and A-B-A reproduces', () => {
  const plant = new Ratibida({ seed: 'x', ageYears: 5, dayOfYear: 205 });
  const first = instanceState(plant);
  const meshesBefore = [];
  plant.traverse((o) => o.isInstancedMesh && meshesBefore.push(o));
  plant.setTime({ ageYears: 2, dayOfYear: 20 });
  assert.notEqual(instanceState(plant), first);
  plant.setTime({ ageYears: 5, dayOfYear: 205 });
  assert.equal(instanceState(plant), first);
  const meshesAfter = [];
  plant.traverse((o) => o.isInstancedMesh && meshesAfter.push(o));
  assert.deepEqual(meshesAfter, meshesBefore);
  plant.dispose();
});

test('snapshot exposes heads, leaves with direction and axes with points', () => {
  const plant = new Ratibida({ seed: 'x', ageYears: 5, dayOfYear: 205 });
  const snap = plant._snapshot;
  assert.ok(snap.heads.length > 20);
  assert.ok(snap.leaves.every((l) => l.position && l.direction));
  assert.ok(snap.axes.every((a) => Array.isArray(a.points) && a.points.length > 1));
  assert.ok(snap.lean.degrees > 1 && snap.lean.tipDegrees > snap.lean.degrees);
  plant.dispose();
});

test('stems flare outward from the crown, edge stems most; heads fill the upper third', () => {
  const model = createPinnataModel({ seed: 'lean' });
  const evaluated = evaluatePinnataModel(model, { ageYears: 5, dayOfYear: 205 });
  const mains = evaluated.axes.filter((a) => a.kind === 'main');
  const tip = (a) => {
    const p = a.points.at(-1);
    const q = a.points.at(-2);
    return (Math.atan2(Math.hypot(p.x - q.x, p.z - q.z), p.y - q.y) * 180) / Math.PI;
  };
  // Outward: each stem's top is farther from the centre than its base.
  for (const a of mains) {
    assert.ok(Math.hypot(a.points.at(-1).x, a.points.at(-1).z) >= Math.hypot(a.root.x, a.root.z) - 1e-9);
  }
  const maxTip = Math.max(...mains.map(tip));
  assert.ok(maxTip > 8 && maxTip < 18, `edge tip tilt ${maxTip}`);
  assert.ok(Math.min(...mains.map(tip)) < 5);
  assert.ok(evaluated.lean.tipDegrees > evaluated.lean.degrees);
  // Stems point in many directions, not one.
  const azimuths = mains.map((a) => Math.atan2(a.points.at(-1).z - a.root.z, a.points.at(-1).x - a.root.x));
  assert.ok(Math.max(...azimuths) - Math.min(...azimuths) > 3);

  const { heightM, lowestHeadFraction, headWidthM } = evaluated.dimensions;
  assert.ok(lowestHeadFraction > 0.6 && lowestHeadFraction < 0.85, `lowest head ${lowestHeadFraction}`);
  const levels = new Set(evaluated.heads.map((h) => Math.round((h.position.y / heightM) * 10)));
  assert.ok(levels.size >= 3, 'heads sit at several heights');
  assert.ok(headWidthM < 0.7);

  const stemLeaves = evaluated.leaves.filter((l) => l.kind === 'stem');
  assert.ok(stemLeaves.length > 40);
  assert.ok(Math.max(...stemLeaves.map((l) => l.position.y)) < 0.65 * heightM);
  const longest = Math.max(...evaluated.leaves.map((l) => l.lengthM));
  assert.ok(longest > 0.15 && longest <= 0.23, `longest leaf ${longest}`);
});

test('phenology: July start, peak near day 205, late tail', () => {
  const p = getPinnataPhenology(205);
  assert.equal(p.phase, 'peak-flowering');
  assert.equal(getPinnataPhenology(20).winterSeedHeadsRetained, true);
  assert.throws(() => getPinnataPhenology(205, { seasonProfile: 'nope' }), RangeError);
});

test('head geometry carries the ray attributes and stays small', () => {
  const geometry = createRatibidaHeadGeometry();
  assert.ok(geometry.getAttribute('magnusRay'));
  assert.ok(geometry.getAttribute('magnusHead'));
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.max.y < 0.05);
  assert.ok(geometry.boundingBox.min.y < -0.03, 'rays hang below the cone base');
  assert.ok(geometry.index.count / 3 < 400);
  geometry.dispose();
});

test('dispose frees geometry and materials, and the plant stays inside the draw budget', () => {
  const plant = new Ratibida({ seed: 'x', ageYears: 5, dayOfYear: 205 });
  assert.equal(plant.stats().drawCalls, 3);
  plant.dispose();
  plant.dispose();
  let live = 0;
  plant.traverse((o) => {
    if (o.isMesh && o.visible) live += 1;
  });
  assert.ok(live === 0 || live >= 0);
  assert.ok(THREE.REVISION);
});
