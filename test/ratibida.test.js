import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPinnataModel,
  evaluatePinnataModel,
  getPinnataPhenology,
  PINNATA_PROFILE,
  PINNATA_RENDER_ASSUMPTIONS,
  PINNATA_SOURCES,
  Ratibida,
} from '../src/lib/index.js';
import { createPinnataHeadGeometry } from '../src/lib/plants/ratibida/geometry.js';

const model = createPinnataModel({ seed: 'test' });
const at = (ageYears, dayOfYear) =>
  evaluatePinnataModel(model, { ageYears, dayOfYear });

test('the planting season is a rosette with no tall stems and no heads', () => {
  for (const day of [120, 160, 205, 250]) {
    const state = at(0, day);
    assert.equal(state.axes.length, 0, `day ${day}`);
    assert.equal(state.heads.length, 0, `day ${day}`);
    assert.ok(state.leaves.length > 0, `day ${day}`);
    assert.ok(state.leaves.every((leaf) => leaf.rosette));
  }
});

test('flowering starts in the second season and never passes twelve heads', () => {
  assert.ok(at(1, 205).heads.length >= 1);
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const crowd = createPinnataModel({ seed });
    for (const age of [1, 2, 3, 5, 10]) {
      const heads = evaluatePinnataModel(crowd, { ageYears: age, dayOfYear: 205 }).heads;
      assert.ok(heads.length <= 12, `seed ${seed} age ${age}: ${heads.length} heads`);
    }
  }
});

test('mature stems stand 3 to 5 ft', () => {
  const height = at(5, 205).dimensions.heightM;
  assert.ok(height >= 0.9 && height <= 1.55, `height ${height}`);
});

test('bloom runs through summer and fades to the end of the owner chart window', () => {
  const open = (day) => at(5, day).stats.visibleFlowers;
  assert.equal(open(100), 0);
  assert.equal(open(150), 0);
  assert.ok(open(205) > 0);
  // Some head is still open on the last day of the window, and none after it.
  let lastOpenDay = 0;
  for (let day = 150; day <= 330; day += 1) if (open(day) > 0) lastOpenDay = day;
  assert.ok(lastOpenDay >= 270 && lastOpenDay <= 295, `last open day ${lastOpenDay}`);
});

test('heads go from bud to open to a dark cone, and rays are gone by then', () => {
  const stages = new Set();
  let sawRaysIn = false;
  for (let day = 150; day <= 330; day += 3) {
    for (const head of at(5, day).heads) {
      stages.add(head.stage);
      if (head.stage === 'open') {
        assert.equal(head.rayVisibility, 1);
        sawRaysIn = true;
      }
      if (head.stage === 'seed' && head.darkenProgress >= 1) {
        assert.equal(head.rayVisibility, 0);
      }
    }
  }
  assert.ok(sawRaysIn);
  for (const stage of ['bud', 'opening', 'open', 'fading', 'seed']) {
    assert.ok(stages.has(stage), `missing stage ${stage}`);
  }
});

test('the rosette stays on the plant all year and is smallest in winter', () => {
  const count = (day) => at(5, day).stats.visibleRosetteLeaves;
  for (const day of [1, 60, 120, 200, 280, 340]) assert.ok(count(day) > 0, `day ${day}`);
  const size = (day) => getPinnataPhenology(day).rosetteScale;
  assert.ok(size(20) < size(180));
  assert.ok(size(20) <= 0.4 + 1e-9);
  assert.equal(size(180), 1);
});

test('old stems and their black cones stand through winter and are cut in April', () => {
  const winter = at(5, 20);
  assert.ok(winter.axes.length > 0);
  assert.ok(winter.heads.length > 0);
  assert.ok(winter.heads.every((head) => head.stage === 'winter'));
  // Between the end of the cutback and the first new stems there is only the rosette.
  const { cutbackEnd, emergenceStart } = getPinnataPhenology(100).calendar;
  const after = at(5, cutbackEnd + 1);
  assert.ok(cutbackEnd + 1 < emergenceStart);
  assert.equal(after.axes.length, 0);
  assert.equal(after.heads.length, 0);
  assert.ok(after.stats.visibleRosetteLeaves > 0);
});

test('frost-killed stem leaves mostly fall by midwinter', () => {
  const standing = (day) =>
    at(5, day).leaves.filter((leaf) => !leaf.rosette && !leaf.fallen).length;
  assert.ok(standing(200) > standing(340));
  assert.ok(standing(20) <= standing(200) * 0.1);
});

test('evaluation is deterministic and JSON-safe', () => {
  const first = at(5, 205);
  const second = at(5, 205);
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first.heads)), first.heads);
});

test('care events are rejected; the cutback is part of the calendar', () => {
  assert.throws(
    () => evaluatePinnataModel(model, { ageYears: 3, dayOfYear: 100, events: [{}] }),
    RangeError,
  );
});

test('every source says what it supports and the assumptions are declared', () => {
  for (const [key, source] of Object.entries(PINNATA_SOURCES)) {
    assert.ok(source.title && source.supports, key);
  }
  assert.ok(PINNATA_RENDER_ASSUMPTIONS.length >= 10);
  assert.equal(PINNATA_PROFILE.cultivar, 'Species');
});

test('the head geometry is one draw with a ray weight and shrinks down its ladder', () => {
  const fine = createPinnataHeadGeometry({ rays: 9, raySegments: 3, radialSegments: 10, coneRings: 4 });
  const coarse = createPinnataHeadGeometry({ rays: 6, raySegments: 2, radialSegments: 6, coneRings: 2 });
  assert.ok(fine.getAttribute('ratibidaRay'));
  assert.equal(
    fine.getAttribute('ratibidaRay').count,
    fine.getAttribute('position').count,
  );
  assert.ok(coarse.index.count < fine.index.count);
  fine.dispose();
  coarse.dispose();
});

test('the renderer builds in three draws, moves in place and disposes', () => {
  const plant = new Ratibida({ seed: 'render', ageYears: 5, dayOfYear: 205 });
  try {
    assert.equal(plant.stats().drawCalls, 3);
    assert.ok(plant.stats().visibleFlowers > 0);
    plant.setTime({ dayOfYear: 340 });
    assert.equal(plant.stats().visibleFlowers, 0);
    assert.ok(plant.stats().visibleSeedHeads > 0);
    const saved = plant.serialize();
    assert.equal(saved.type, 'Ratibida');
    assert.deepEqual(JSON.parse(JSON.stringify(saved)), saved);
  } finally {
    plant.dispose();
  }
});

test('the profile, the calendar and the sources agree with each other', () => {
  const [low, high] = PINNATA_PROFILE.stem.targetHeightM;
  // Modelled at the average of the cited 3-5 ft, not at an extreme.
  assert.ok(
    Math.abs(PINNATA_PROFILE.architecture.matureHeightM - (low + high) / 2) < 0.1,
    'mature height is the middle of the stem height range',
  );
  assert.ok(low >= 0.9 && high <= 1.55, 'the stem range stays within 3-5 ft');

  // Bloom opens in July and the last head is open in October (owner chart).
  const { floweringStart } = getPinnataPhenology(100).calendar;
  const monthOf = (day) => new Date(Date.UTC(2023, 0, day)).getUTCMonth() + 1;
  assert.equal(monthOf(floweringStart), 7);
  let lastOpen = 0;
  for (let day = 150; day <= 330; day += 1) {
    if (at(5, day).stats.visibleFlowers > 0) lastOpen = day;
  }
  assert.equal(monthOf(lastOpen), 10);

  // The profile's own numbers match what the sources record.
  assert.equal(PINNATA_PROFILE.flowering.bloomWeeksPerHead[0], 4);
  assert.ok(PINNATA_PROFILE.flowerHead.rayCount[0] <= 9);
  assert.ok(PINNATA_PROFILE.flowerHead.rayCount[1] >= 9);
});

test('every assumption the model depends on is declared', () => {
  const text = PINNATA_RENDER_ASSUMPTIONS.join(' ');
  for (const phrase of [
    'order heads open in',
    'small gray-green bud',
    'cone darkens',
    'basal rosette leaves arch',
    'old stems are removed whole',
    'leaf wind',
    'second, smaller leaf',
    'winter rosette',
  ]) {
    assert.ok(text.includes(phrase), `missing assumption: ${phrase}`);
  }
});
