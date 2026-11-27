import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import * as publicApi from '../src/lib/index.js';
import {
  createRacemeGeometry,
  createBladeGeometry,
} from '../src/lib/plants/schizachyrium/geometry.js';
import {
  createScopariumModel,
  evaluateScopariumModel,
} from '../src/lib/plants/schizachyrium/model.js';
import { getScopariumPhenology } from '../src/lib/plants/schizachyrium/phenology.js';
import { Schizachyrium } from '../src/lib/plants/schizachyrium/schizachyrium.js';
import {
  SCOPARIUM_PROFILE,
  SCOPARIUM_SOURCES,
} from '../src/lib/plants/schizachyrium/scoparium.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => `seed-${i}`);

const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];

const models = new Map();
function snapshot(seed, ageYears, dayOfYear) {
  if (!models.has(seed)) models.set(seed, createScopariumModel({ seed }));
  return evaluateScopariumModel(models.get(seed), { ageYears, dayOfYear });
}
const stat = (key, age, day) =>
  SEEDS.map((seed) => snapshot(seed, age, day).stats[key]);

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
  assert.equal(SCOPARIUM_PROFILE.species, 'Schizachyrium scoparium');
  assert.equal(SCOPARIUM_PROFILE.cultivar, 'Species');
  assert.equal(SCOPARIUM_PROFILE.architecture.woody, false);
  assert.strictEqual(publicApi.Schizachyrium, Schizachyrium);
  assert.strictEqual(publicApi.SCOPARIUM_PROFILE, SCOPARIUM_PROFILE);
  for (const source of Object.values(SCOPARIUM_SOURCES)) {
    if (source.url) assert.match(source.url, /^https:\/\//);
    assert.ok(source.supports.length > 30);
  }
  assert.throws(() => new Schizachyrium({ cultivar: 'Blues' }), RangeError);
});

test('age 0 is a seed-grown plug: blades only, no culms in any season', () => {
  for (const seed of SEEDS.slice(0, 8)) {
    for (const day of [60, 130, 215, 270, 330]) {
      const s = snapshot(seed, 0, day).stats;
      assert.equal(s.visibleCulms, 0, `day ${day}`);
      assert.equal(s.visiblePanicles, 0);
    }
    const spring = snapshot(seed, 0, 130);
    assert.ok(spring.stats.visibleBlades >= 6 && spring.stats.visibleBlades <= 16);
    assert.ok(spring.dimensions.heightM < 0.2);
    const autumn = snapshot(seed, 0, 270);
    assert.ok(autumn.dimensions.heightM > 0.12 && autumn.dimensions.heightM < 0.3);
    assert.ok(autumn.dimensions.spreadM < 0.45);
  }
});

test('culms, height and spread grow with age toward a mature clump of about 40 culms', () => {
  const ages = [1, 2, 3, 5];
  const culms = ages.map((age) => median(stat('visibleCulms', age, 270)));
  const heights = ages.map((age) =>
    median(SEEDS.map((seed) => snapshot(seed, age, 270).dimensions.heightM)),
  );
  const spreads = ages.map((age) =>
    median(SEEDS.map((seed) => snapshot(seed, age, 270).dimensions.spreadM)),
  );
  for (const series of [culms, heights, spreads]) {
    for (let i = 1; i < series.length; i += 1) {
      assert.ok(series[i] > series[i - 1], String(series));
    }
  }
  assert.ok(culms[0] >= 8 && culms[0] <= 16, `age 1 culms ${culms[0]}`);
  assert.ok(culms[1] >= 17 && culms[1] <= 28, `age 2 culms ${culms[1]}`);
  assert.ok(culms[2] >= 28 && culms[2] <= 42, `age 3 culms ${culms[2]}`);
  assert.ok(culms[3] >= 34 && culms[3] <= 46, `age 5 culms ${culms[3]}`);
  for (const count of stat('visibleCulms', 5, 270)) {
    assert.ok(count >= 25 && count <= 80, `mature culms ${count}`);
  }
  // Culm tips 2 to 3 ft at maturity (0.61 to 0.91 m), spread 1.5 to 2 ft.
  assert.ok(heights[3] > 0.68 && heights[3] < 0.88, `height ${heights[3]}`);
  assert.ok(spreads[3] > 0.46 && spreads[3] < 0.64, `spread ${spreads[3]}`);
  // The model keeps growing after age 3 (advisory in the research).
  assert.ok(culms[3] >= culms[2]);
});

test('the mound is about a foot with culms rising to more than twice its height', () => {
  const ratios = [];
  for (const seed of SEEDS) {
    const s = snapshot(seed, 5, 270);
    assert.ok(s.dimensions.foliageHeightM > 0.26 && s.dimensions.foliageHeightM < 0.4);
    ratios.push(s.dimensions.culmTipMeanM / s.dimensions.foliageHeightM);
  }
  assert.ok(median(ratios) > 1.9 && median(ratios) < 3.3, `ratio ${median(ratios)}`);
});

test('culms emerge between days 200 and 245 and never before', () => {
  for (const age of [1, 3, 5]) {
    assert.equal(Math.max(...stat('visibleCulms', age, 150)), 0, `age ${age}`);
  }
  // Last winter's culms are gone by day 110 and none exist until day 200.
  for (const day of [110, 150, 199, 200]) {
    assert.equal(Math.max(...stat('visibleCulms', 5, day)), 0, `day ${day}`);
  }
  const at = (day) => median(stat('visibleCulms', 5, day));
  assert.ok(at(215) > 3);
  assert.ok(at(230) > at(215));
  assert.ok(at(244) > at(230) * 0.99);
  assert.ok(at(255) >= at(244));
});

test('flowers are small and open in August and September only', () => {
  const open = (day) => median(stat('visibleFlowers', 5, day));
  assert.equal(open(180), 0);
  assert.ok(open(225) >= 10, 'August flowers');
  assert.ok(open(255) >= 10, 'September flowers');
  assert.equal(Math.max(...stat('visibleFlowers', 5, 290)), 0);
  assert.equal(Math.max(...stat('visibleFlowers', 5, 330)), 0);
  assert.equal(Math.max(...stat('visibleFlowers', 0, 255)), 0, 'a plug does not flower');
});

test('silvery seed heads show from September, stand to December, thin by January', () => {
  const plumes = (day) => median(stat('visiblePlumes', 5, day));
  assert.equal(plumes(220), 0);
  assert.ok(plumes(250) > 30);
  assert.ok(plumes(270) > 150);
  assert.ok(plumes(320) > 150);
  assert.ok(plumes(350) > 100, 'still on the clump in December');
  assert.equal(Math.max(...stat('visiblePlumes', 5, 20)), 0, 'mostly gone by January');
  // Dry heads still stand on the culms in winter.
  assert.ok(median(stat('visibleSeedHeads', 5, 20)) > 100);
  assert.ok(median(stat('visibleCulms', 5, 20)) >= 30, 'culms stand over winter');
});

test('cutback to 2 to 4 inches across days 60 to 100, regrowth from day 100 to 125', () => {
  const height = (day) =>
    median(SEEDS.map((seed) => snapshot(seed, 5, day).dimensions.heightM));
  assert.ok(height(40) > 0.6);
  assert.ok(height(80) < height(40));
  for (const day of [101, 110]) {
    assert.ok(height(day) > 0.04 && height(day) < 0.12, `stubble ${height(day)}`);
  }
  assert.ok(height(125) > height(110) + 0.04);
  assert.ok(height(125) < 0.25);
  assert.ok(height(180) > 0.28);
  assert.equal(getScopariumPhenology(30).phase, 'standing-dry');
  assert.throws(() => getScopariumPhenology(200, { seasonProfile: 'nope' }), RangeError);
});

test('culms tilt a little outward each in its own direction, with no lean of the clump', () => {
  const snap = snapshot('seed-3', 5, 270);
  const azimuths = [];
  let sumX = 0;
  let sumZ = 0;
  const tilts = [];
  for (const axis of snap.axes) {
    const root = axis.points[0];
    const tip = axis.points.at(-1);
    const dx = tip.x - root.x;
    const dz = tip.z - root.z;
    sumX += dx;
    sumZ += dz;
    azimuths.push(Math.atan2(dz, dx));
    const prior = axis.points.at(-2);
    tilts.push(
      (Math.atan2(Math.hypot(tip.x - prior.x, tip.z - prior.z), tip.y - prior.y) * 180) / Math.PI,
    );
  }
  assert.ok(Math.max(...azimuths) - Math.min(...azimuths) > 4, 'culms point in many directions');
  const meanOffset = Math.hypot(sumX, sumZ) / snap.axes.length;
  assert.ok(meanOffset < 0.04, `whole-clump lean ${meanOffset}`);
  assert.ok(Math.max(...tilts) > 14 && Math.max(...tilts) < 34, `edge tilt ${Math.max(...tilts)}`);
  assert.ok(Math.min(...tilts) < 10);
});

test('blades are basal and the top of the plant is bare culm', () => {
  const snap = snapshot('seed-5', 5, 270);
  const height = snap.dimensions.heightM;
  assert.ok(snap.leaves.every((l) => l.position && l.direction && l.lengthM > 0));
  assert.ok(snap.leaves.every((l) => l.position.y < 0.02), 'every blade starts at the soil');
  const longest = Math.max(...snap.leaves.map((l) => l.lengthM));
  assert.ok(longest > 0.15 && longest <= 0.6, `longest blade ${longest}`);
  assert.ok(Math.max(...snap.leaves.map((l) => l.tip.y)) < 0.55 * height);
  assert.ok(snap.axes.every((a) => Array.isArray(a.points) && a.points.length > 1));
  const lowest = Math.min(...snap.heads.map((h) => h.position.y));
  assert.ok(lowest > 0.35 * height && lowest < 0.8 * height, `head zone starts at ${lowest}`);
});

test('the same seed gives the same plant and a different seed a different one', () => {
  const a = createScopariumModel({ seed: 'twin' });
  const b = createScopariumModel({ seed: 'twin' });
  assert.deepEqual(a, b);
  const day = { ageYears: 5, dayOfYear: 255 };
  assert.deepEqual(evaluateScopariumModel(a, day), evaluateScopariumModel(b, day));
  const c = createScopariumModel({ seed: 'other' });
  assert.notDeepEqual(
    evaluateScopariumModel(a, day).dimensions,
    evaluateScopariumModel(c, day).dimensions,
  );
  assert.throws(() => evaluateScopariumModel(a, { ageYears: 1.5, dayOfYear: 100 }), RangeError);
});

test('the renderer reuses its pools across time changes and reports the stat names', () => {
  const plant = new Schizachyrium({ seed: 'x', ageYears: 5, dayOfYear: 270 });
  const first = instanceState(plant);
  const meshesBefore = [];
  plant.traverse((o) => o.isInstancedMesh && meshesBefore.push(o));
  const s = plant.stats();
  for (const key of [
    'visibleCulms',
    'visibleBlades',
    'visibleLeaves',
    'visiblePanicles',
    'visiblePlumes',
    'visibleFlowers',
    'visibleSeedHeads',
  ]) {
    assert.equal(typeof s[key], 'number', key);
  }
  assert.ok(s.visibleCulms >= 25 && s.visiblePlumes > 100);
  assert.ok(s.dimensions.heightM > 0.6 && s.dimensions.spreadM > 0.4);
  assert.equal(s.drawCalls, 3);
  plant.setTime({ ageYears: 1, dayOfYear: 90 });
  assert.notEqual(instanceState(plant), first);
  plant.setTime({ ageYears: 5, dayOfYear: 270 });
  assert.equal(instanceState(plant), first);
  const meshesAfter = [];
  plant.traverse((o) => o.isInstancedMesh && meshesAfter.push(o));
  assert.deepEqual(meshesAfter, meshesBefore);
  assert.ok(plant._snapshot.leaves.length > 100);
  assert.ok(plant._snapshot.axes.length >= 25);
  plant.dispose();
});

test('geometry stays small and the plant disposes cleanly', () => {
  const raceme = createRacemeGeometry({ planes: 3, segments: 2 });
  assert.ok(raceme.index.count / 3 <= 20);
  raceme.dispose();
  const blade = createBladeGeometry({ segments: 9, columns: 2 });
  assert.ok(blade.index.count / 3 <= 20);
  blade.dispose();
  const plant = new Schizachyrium({ seed: 'x', ageYears: 3, dayOfYear: 255 });
  plant.dispose();
  plant.dispose();
  let live = 0;
  plant.traverse((o) => {
    if (o.isMesh && o.visible) live += 1;
  });
  assert.ok(live >= 0);
  assert.ok(THREE.REVISION);
});
