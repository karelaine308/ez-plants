import assert from 'node:assert/strict';
import test from 'node:test';

import * as publicApi from '../src/lib/index.js';
import { createAsterHeadGeometry } from '../src/lib/plants/symphyotrichum/geometry.js';
import {
  createNovaeAngliaeModel,
  evaluateNovaeAngliaeModel,
} from '../src/lib/plants/symphyotrichum/model.js';
import {
  NOVAE_ANGLIAE_PROFILE,
  NOVAE_ANGLIAE_RENDER_ASSUMPTIONS,
  NOVAE_ANGLIAE_SOURCES,
} from '../src/lib/plants/symphyotrichum/novaeangliae.js';
import { getNovaeAngliaePhenology } from '../src/lib/plants/symphyotrichum/phenology.js';
import { Symphyotrichum } from '../src/lib/plants/symphyotrichum/symphyotrichum.js';

const SEEDS = Array.from({ length: 16 }, (_, i) => `seed-${i}`);
const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];
const evaluate = (seed, ageYears, dayOfYear) =>
  evaluateNovaeAngliaeModel(createNovaeAngliaeModel({ seed }), { ageYears, dayOfYear });
const tipOf = (leaf) => leaf.position.y + leaf.direction.y * leaf.lengthM;

function stats(seed, ageYears, dayOfYear) {
  const plant = new Symphyotrichum({ seed, ageYears, dayOfYear });
  const result = plant.stats();
  plant.dispose();
  return result;
}

function instanceState(plant) {
  const out = [];
  plant.traverse((o) => {
    if (o.isInstancedMesh) {
      out.push([o.name, o.count, Array.from(o.instanceMatrix.array.slice(0, o.count * 16))]);
    }
  });
  return JSON.stringify(out.sort((a, b) => a[0].localeCompare(b[0])));
}

test('the profile is species-level, herbaceous, sourced and exported', () => {
  assert.equal(NOVAE_ANGLIAE_PROFILE.species, 'Symphyotrichum novae-angliae');
  assert.equal(NOVAE_ANGLIAE_PROFILE.cultivar, 'Species');
  assert.equal(NOVAE_ANGLIAE_PROFILE.architecture.woody, false);
  assert.equal(NOVAE_ANGLIAE_PROFILE.leaf.leafLitterDecomposition, 'slow');
  assert.ok(NOVAE_ANGLIAE_RENDER_ASSUMPTIONS.some((line) => /leafLitterDecomposition: slow/.test(line)));
  assert.strictEqual(publicApi.Symphyotrichum, Symphyotrichum);
  assert.strictEqual(publicApi.NOVAE_ANGLIAE_PROFILE, NOVAE_ANGLIAE_PROFILE);
  for (const [key, source] of Object.entries(NOVAE_ANGLIAE_SOURCES)) {
    if (source.url) assert.match(source.url, /^https:\/\//);
    else assert.match(key, /^(owner|uconn|inat)/, `${key} needs an address`);
    assert.ok(source.supports.length > 30);
  }
});

test('age 0 is a plug: one to three leafy stems, no branches, no heads', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    const s = stats(seed, 0, 266);
    assert.ok(s.visibleStems >= 1 && s.visibleStems <= 3);
    assert.equal(s.visibleHeads, 0);
    assert.equal(s.visibleFlowers, 0);
    assert.ok(s.visibleLeaves >= 20);
    assert.ok(s.dimensions.heightM > 0.2 && s.dimensions.heightM < 0.4, `plug height ${s.dimensions.heightM}`);
    assert.equal(evaluate(seed, 0, 266).axes.filter((a) => a.kind !== 'main').length, 0);
  }
});

test('stems, heads, height and spread grow with age to the owner figures', () => {
  const at = (age) => SEEDS.map((seed) => stats(seed, age, 266));
  const ages = [1, 2, 3, 5];
  const stems = ages.map((age) => median(at(age).map((s) => s.visibleStems)));
  const heads = ages.map((age) => median(at(age).map((s) => s.visibleHeads)));
  const heights = ages.map((age) => median(at(age).map((s) => s.dimensions.heightM)));
  const spreads = ages.map((age) => median(at(age).map((s) => s.dimensions.spreadM)));
  for (const series of [stems, heads, heights, spreads]) {
    for (let i = 1; i < series.length; i += 1) assert.ok(series[i] > series[i - 1], String(series));
  }
  for (const s of at(1)) assert.ok(s.visibleStems >= 3 && s.visibleStems <= 6);
  for (const s of at(2)) assert.ok(s.visibleStems >= 6 && s.visibleStems <= 10);
  for (const s of at(3)) assert.ok(s.visibleStems >= 15 && s.visibleStems <= 20);
  for (const s of at(4)) assert.ok(s.visibleStems >= 22 && s.visibleStems <= 30);
  for (const s of at(5)) {
    assert.ok(s.visibleStems >= 30 && s.visibleStems <= 40);
    assert.ok(s.visibleHeads >= 700 && s.visibleHeads <= 1150, `mature heads ${s.visibleHeads}`);
  }
  for (const s of at(1)) assert.ok(s.visibleHeads >= 10 && s.visibleHeads <= 60);
  for (const s of at(3)) assert.ok(s.visibleHeads >= 300 && s.visibleHeads <= 500);
  assert.ok(Math.abs(heads[3] - 900) < 90, `median mature heads ${heads[3]}`);
  assert.ok(Math.abs(heights[3] - 1.37) < 0.08, `median mature height ${heights[3]}`);
  assert.ok(Math.abs(spreads[3] - 1.07) < 0.1, `median mature spread ${spreads[3]}`);
});

test('bloom runs August to October, peaks near day 266 and counts open heads as flowers', () => {
  const open = (day) => median(SEEDS.map((seed) => stats(seed, 5, day).visibleFlowers));
  assert.equal(open(180), 0);
  assert.ok(open(240) > 0, 'August has open heads');
  const peakDay = [225, 235, 245, 255, 266, 275, 285, 295, 305].sort((a, b) => open(b) - open(a))[0];
  assert.ok(peakDay >= 255 && peakDay <= 280, `open heads peak on day ${peakDay}`);
  assert.ok(open(290) > 0, 'October has open heads');
  assert.equal(open(330), 0);
  const s = stats('seed-1', 5, 266);
  assert.equal(s.visibleHeads, s.visibleFlowers + s.visibleFlowerBuds + s.visibleSeedHeads);
  assert.equal(stats('seed-1', 5, 180).visibleHeads, 0, 'no heads before the buds');
});

test('at peak bloom most heads are open and spent heads are few', () => {
  for (const seed of SEEDS.slice(0, 8)) {
    const s = stats(seed, 5, 266);
    assert.ok(s.visibleFlowers / s.visibleHeads > 0.6, `open share ${s.visibleFlowers / s.visibleHeads}`);
    assert.ok(s.visibleSeedHeads / s.visibleHeads < 0.1, 'spent heads are few until October');
    assert.ok(s.visibleFlowerBuds / s.visibleHeads < 0.35);
  }
  assert.ok(stats('seed-1', 5, 285).visibleSeedHeads > stats('seed-1', 5, 266).visibleSeedHeads);
  assert.equal(stats('seed-1', 5, 305).visibleFlowers, 0, 'bloom ends by late October');
});

test('dry stems, seed heads and clinging brown leaves stand through winter over a green tuft', () => {
  for (const seed of SEEDS.slice(0, 8)) {
    const winter = evaluate(seed, 5, 20);
    assert.equal(winter.mode, 'previous-dry');
    assert.ok(winter.stats.visibleStems >= 15);
    assert.ok(winter.stats.visibleSeedHeads >= 100);
    assert.equal(winter.stats.visibleFlowers, 0);
    const clinging = winter.leaves.filter((l) => !l.litter && l.kind === 'stem');
    assert.ok(clinging.length > 100, 'dead leaves cling to the stems');
    assert.ok(clinging.every((l) => l.autumnProgress >= 0.99 && l.direction.y < 0), 'brown and hanging');
    const tuft = winter.leaves.filter((l) => l.kind === 'basal');
    assert.ok(tuft.length >= 10);
    for (const leaf of tuft) assert.ok(tuft && tipOf(leaf) < 0.25, 'the tuft is low');
  }
});

test('stems break down in spring and new shoots come up through the litter', () => {
  const stemsAt = (day) => evaluate('seed-1', 5, day).stats.visibleStems;
  assert.ok(stemsAt(60) > 10);
  assert.ok(stemsAt(90) < stemsAt(60), 'stems go in a seeded order');
  const calendar = getNovaeAngliaePhenology(266).calendar;
  assert.equal(evaluate('seed-1', 5, calendar.stemBreakEnd + 1).stats.visibleStems, 0);
  const shoots = evaluate('seed-1', 5, calendar.emergenceStart + 5);
  assert.ok(shoots.stats.visibleStems >= 15);
  assert.ok(shoots.dimensions.heightM < 0.3, 'shoots are short at first');
  assert.equal(evaluate('seed-1', 0, 20).stats.visibleHeads, 0);
});

test('the same seed gives the same plant and a different seed does not', () => {
  const a = new Symphyotrichum({ seed: 'x', ageYears: 5, dayOfYear: 266 });
  const b = new Symphyotrichum({ seed: 'x', ageYears: 5, dayOfYear: 266 });
  const c = new Symphyotrichum({ seed: 'y', ageYears: 5, dayOfYear: 266 });
  assert.equal(instanceState(a), instanceState(b));
  assert.notEqual(instanceState(a), instanceState(c));
  for (const p of [a, b, c]) p.dispose();
});

test('setTime rewrites the pools in place and A-B-A reproduces', () => {
  const plant = new Symphyotrichum({ seed: 'x', ageYears: 5, dayOfYear: 266 });
  const first = instanceState(plant);
  const meshesBefore = [];
  plant.traverse((o) => o.isInstancedMesh && meshesBefore.push(o));
  plant.setTime({ ageYears: 2, dayOfYear: 20 });
  assert.notEqual(instanceState(plant), first);
  plant.setTime({ ageYears: 5, dayOfYear: 266 });
  assert.equal(instanceState(plant), first);
  const meshesAfter = [];
  plant.traverse((o) => o.isInstancedMesh && meshesAfter.push(o));
  assert.deepEqual(meshesAfter, meshesBefore);
  plant.dispose();
});

test('snapshot exposes heads, leaves with position and direction, and axes with points', () => {
  const plant = new Symphyotrichum({ seed: 'x', ageYears: 5, dayOfYear: 266 });
  const snap = plant._snapshot;
  assert.ok(snap.heads.length > 400);
  assert.ok(snap.leaves.every((l) => l.position && l.direction));
  assert.ok(snap.axes.every((a) => Array.isArray(a.points) && a.points.length > 1));
  const s = plant.stats();
  for (const key of [
    'visibleHeads',
    'visibleFlowers',
    'visibleFlowerBuds',
    'visibleStems',
    'visibleSeedHeads',
    'visibleLeaves',
    'visibleLitterLeaves',
  ]) {
    assert.equal(typeof s[key], 'number', key);
  }
  assert.ok(s.dimensions.heightM > 1.2);
  plant.dispose();
});

test('stems flare out of the crown each in its own direction; heads fill the top two fifths', () => {
  const evaluated = evaluate('lean', 5, 266);
  const mains = evaluated.axes.filter((a) => a.kind === 'main');
  // A vase: stems leave the crown leaning, edge stems most, then ease toward upright.
  const lean = (a, from, to) => {
    const p = a.points[to];
    const q = a.points[from];
    return (Math.atan2(Math.hypot(p.x - q.x, p.z - q.z), p.y - q.y) * 180) / Math.PI;
  };
  const baseLean = mains.map((a) => lean(a, 0, 3));
  const topLean = mains.map((a) => lean(a, a.points.length - 4, a.points.length - 1));
  assert.ok(Math.max(...baseLean) > 10 && Math.max(...baseLean) < 24, `edge base lean ${Math.max(...baseLean)}`);
  assert.ok(Math.min(...baseLean) > 2, 'every stem flares from the base');
  assert.ok(median(topLean) < median(baseLean), 'stems ease toward upright at the top');
  const roots = mains.map((a) => Math.hypot(a.root.x, a.root.z));
  assert.ok(Math.max(...roots) > 0.1, 'stems emerge across a wide crown, not from one point');
  const azimuths = mains.map((a) => Math.atan2(a.points.at(-1).z - a.root.z, a.points.at(-1).x - a.root.x));
  assert.ok(Math.max(...azimuths) - Math.min(...azimuths) > 3, 'stems lean in many directions');
  // Lean differs stem to stem: no single shared direction.
  const leanDirs = new Set(mains.map((a) => Math.round(Math.atan2(a.points.at(-1).z - a.root.z, a.points.at(-1).x - a.root.x) * 2)));
  assert.ok(leanDirs.size >= 6);

  const { heightM, lowestHeadFraction, headZoneFraction } = evaluated.dimensions;
  assert.ok(lowestHeadFraction > 0.5 && lowestHeadFraction < 0.7, `lowest head ${lowestHeadFraction}`);
  assert.ok(headZoneFraction > 0.3 && headZoneFraction < 0.5, `head zone ${headZoneFraction}`);
  const branches = evaluated.axes.filter((a) => a.kind === 'branch');
  assert.ok(branches.length >= 12 * mains.length * 0.9, `many side branches: ${branches.length}`);
  const perBranch = evaluated.heads.length / branches.length;
  assert.ok(perBranch > 2 && perBranch <= 4, `heads crowd on each branch: ${perBranch}`);
  // Heads cluster at the top: the head zone is about 40% of the height and panicles are about 0.3 m across.
  const span = (stem) => {
    const mine = evaluated.heads.filter((h) => h.axisId.startsWith(stem.shootId));
    const xs = mine.map((h) => h.position.x);
    const zs = mine.map((h) => h.position.z);
    return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  };
  const spans = mains.map(span).sort((a, b) => a - b);
  assert.ok(spans[spans.length >> 1] > 0.15 && spans.at(-1) < 0.5, `panicle width ${spans[spans.length >> 1]}`);
  const stemLeaves = evaluated.leaves.filter((l) => l.kind === 'stem' && !l.litter);
  // A typical stem is bare in its lower third; the outermost stems carry leaves lower.
  const lowestOn = (stem) => Math.min(...stemLeaves.filter((l) => l.id.startsWith(stem.shootId)).map((l) => l.position.y));
  const inner = mains.filter((a) => Math.hypot(a.root.x, a.root.z) < 0.4 * 0.15);
  const lows = (inner.length >= 3 ? inner : mains).map(lowestOn).sort((a, b) => a - b);
  const outerLow = Math.min(...mains.map(lowestOn));
  assert.ok(lows[lows.length >> 1] > 0.28 * heightM, `lower third is bare on a typical stem; median lowest leaf ${lows[lows.length >> 1]}`);
  assert.ok(outerLow < 0.5 * lows[lows.length >> 1], `outer stems carry leaves low: ${outerLow}`);
  const longest = Math.max(...stemLeaves.map((l) => l.lengthM));
  assert.ok(longest > 0.075 && longest <= 0.125, `longest leaf at bloom ${longest}`);
  // In midsummer, before the lower leaves go, the lowest blades are about 9 cm.
  const summer = evaluate('lean', 5, 200).leaves.filter((l) => l.kind === 'stem' && !l.litter);
  const lowLeaf = Math.max(...summer.map((l) => l.lengthM));
  assert.ok(lowLeaf > 0.1 && lowLeaf <= 0.125, `lowest leaf ${lowLeaf}`);
});

test('leaves go dark brown and the dead ones cling, the rest drop to litter', () => {
  const calendar = getNovaeAngliaePhenology(266).calendar;
  for (const seed of SEEDS.slice(0, 6)) {
    const model = createNovaeAngliaeModel({ seed });
    const autumn = evaluateNovaeAngliaeModel(model, { ageYears: 5, dayOfYear: calendar.dryFull - 1 });
    const standing = autumn.leaves.filter((l) => l.kind === 'stem' && !l.litter);
    assert.ok(standing.length > 600);
    assert.ok(standing.every((l) => l.autumnProgress > 0.9));
    const later = evaluateNovaeAngliaeModel(model, { ageYears: 5, dayOfYear: 330 });
    assert.ok(later.stats.visibleLitterLeaves > autumn.stats.visibleLitterLeaves);
    const litter = later.leaves.filter((l) => l.litter);
    for (const leaf of litter) {
      assert.ok(leaf.position.y < 0.03 && tipOf(leaf) < 0.04, 'litter lies flat');
      assert.ok(Math.hypot(leaf.position.x, leaf.position.z) < 0.55);
    }
  }
});

test('litter stays through winter and the stem breakdown, then is covered by spring growth', () => {
  const calendar = getNovaeAngliaePhenology(266).calendar;
  for (const seed of SEEDS.slice(0, 6)) {
    const model = createNovaeAngliaeModel({ seed });
    const litterAt = (day) =>
      evaluateNovaeAngliaeModel(model, { ageYears: 5, dayOfYear: day }).stats.visibleLitterLeaves;
    assert.ok(litterAt(20) > 200);
    assert.ok(litterAt(calendar.stemBreakEnd - 1) >= litterAt(20), 'breaking stems drop their leaves, never clear the ground');
    assert.ok(litterAt(calendar.stemBreakEnd + 2) > 600, 'all of last year is on the ground');
    assert.ok(litterAt(calendar.emergenceStart - 1) >= litterAt(calendar.stemBreakEnd + 2));
    assert.ok(litterAt(calendar.emergenceStart + 30) === 0, 'covered by new growth');
  }
  assert.equal(evaluate('seed-1', 0, 20).stats.visibleLitterLeaves, 0);
  assert.ok(evaluate('seed-1', 2, 20).stats.visibleLitterLeaves > 0);
});

test('phenology: August to October bloom with the peak on 23 September', () => {
  const p = getNovaeAngliaePhenology(266);
  assert.equal(p.phase, 'peak-flowering');
  assert.equal(p.calendar.floweringPeak, 266);
  assert.equal(getNovaeAngliaePhenology(20).winterSeedHeadsRetained, true);
  assert.throws(() => getNovaeAngliaePhenology(266, { seasonProfile: 'nope' }), RangeError);
  assert.throws(() => evaluateNovaeAngliaeModel(createNovaeAngliaeModel({ seed: 1 }), { events: [{}] }), RangeError);
});

test('head geometry carries the ray attributes and each rung is cheaper', () => {
  const rungs = [
    { sides: 6, discSides: 3, puff: 1 },
    { sides: 0, discSides: 1, puff: 1 },
    { sides: 0, discSides: 0, puff: 0 },
  ].map((options) => createAsterHeadGeometry(options));
  const triangles = rungs.map((g) => g.index.count / 3);
  assert.deepEqual(triangles, [11, 5, 2]);
  for (const g of rungs) {
    assert.ok(g.getAttribute('magnusRay'));
    assert.ok(g.getAttribute('magnusHead'));
    assert.ok(g.getAttribute('uv'));
    g.computeBoundingBox();
    assert.ok(g.boundingBox.max.x < 0.025 && g.boundingBox.max.y < 0.025);
    g.dispose();
  }
  assert.throws(() => createAsterHeadGeometry({ sides: 3 }), RangeError);
  // The spent head is a rounded puff, flagged so only seed and winter heads show it.
  const puffed = createAsterHeadGeometry({ sides: 6, discSides: 3, puff: 1 });
  const flag = puffed.getAttribute('magnusHead');
  const flagged = Array.from({ length: flag.count }, (_, i) => flag.getX(i)).filter((v) => v === 1).length;
  assert.equal(flagged, 4, 'the four corners of the puff card');
  puffed.dispose();
});

test('dispose frees geometry and materials, and the plant stays inside the draw budget', () => {
  const plant = new Symphyotrichum({ seed: 'x', ageYears: 5, dayOfYear: 266 });
  assert.equal(plant.stats().drawCalls, 3);
  plant.dispose();
  plant.dispose();
});
