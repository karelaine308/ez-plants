import assert from 'node:assert/strict';
import test from 'node:test';

import { createMaculatumModel, evaluateMaculatumModel } from '../src/lib/plants/eutrochium/model.js';
import { MACULATUM_PROFILE } from '../src/lib/plants/eutrochium/maculatum.js';
import { getMaculatumPhenology } from '../src/lib/plants/eutrochium/phenology.js';

const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const evaluate = (model, ageYears, dayOfYear) => evaluateMaculatumModel(model, { ageYears, dayOfYear });

test('leaf litter decomposition is a declared slow assumption', () => {
  assert.equal(MACULATUM_PROFILE.leaf.leafLitterDecomposition, 'slow');
});

test('fallen leaves stay on the ground through winter and the cutback', () => {
  for (const seed of SEEDS) {
    const model = createMaculatumModel({ seed });
    const litterAt = (day) => evaluate(model, 5, day).stats.visibleLitterLeaves;
    const winter = evaluate(model, 5, 20);
    assert.ok(winter.stats.visibleLitterLeaves > 20, `litter at day 20: ${winter.stats.visibleLitterLeaves}`);
    // Dead leaves still on the stems are not litter; everything fallen lies low.
    for (const leaf of winter.leaves.filter((l) => l.fallen)) assert.ok(leaf.position.y < 0.03);
    // No tidy at the cutback: the ground is not cleared as the stems are cut.
    assert.ok(litterAt(60) >= winter.stats.visibleLitterLeaves * 0.9);
    const calendar = getMaculatumPhenology(205).calendar;
    assert.ok(litterAt(calendar.cutbackEnd + 1) > 20, 'litter survives the end of the cutback');
    assert.ok(litterAt(calendar.cutbackEnd + 1) >= litterAt(calendar.cutbackEnd - 5) * 0.9);
    assert.ok(litterAt(calendar.emergenceStart - 1) > 20, 'litter lasts until emergence');
  }
});

test('litter is no longer drawn once the plant has leafed out', () => {
  for (const seed of SEEDS) {
    const model = createMaculatumModel({ seed });
    assert.equal(evaluate(model, 5, 150).stats.visibleLitterLeaves, 0);
  }
});

test('after leaf-fall every leaf is either on the ground or hanging on a standing stem', () => {
  const model = createMaculatumModel({ seed: 'a' });
  const snap = evaluate(model, 5, 20);
  const stemPoints = snap.axes.flatMap((a) => a.points);
  assert.ok(snap.leaves.some((l) => l.fallen));
  for (const leaf of snap.leaves.filter((l) => !l.fallen)) {
    assert.ok(
      stemPoints.some((p) => p.x === leaf.position.x && p.y === leaf.position.y && p.z === leaf.position.z),
      'a leaf off the ground hangs on a standing stem',
    );
  }
});

test('a plug has no litter before its first season, and the stats are unchanged otherwise', () => {
  const model = createMaculatumModel({ seed: 'a' });
  assert.equal(evaluate(model, 0, 20).stats.visibleLitterLeaves, 0);
  const stats = evaluate(model, 5, 205).stats;
  for (const key of ['visibleShoots', 'visibleStems', 'visibleAxes', 'visibleLeaves', 'visibleHeads']) {
    assert.ok(key in stats);
  }
  assert.equal(stats.visibleLitterLeaves, 0);
});

const MANY_SEEDS = Array.from({ length: 12 }, (_, i) => `stem-${i}`);
const mainStems = (snap) => snap.axes.filter((a) => a.kind === 'main');
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const leanDegrees = (axis) => {
  const tip = axis.points.at(-1);
  return (Math.atan2(Math.hypot(tip.x - axis.root.x, tip.z - axis.root.z), tip.y - axis.root.y) * 180) / Math.PI;
};
const tipTiltDegrees = (axis) => {
  const p = axis.points.at(-1);
  const q = axis.points.at(-2);
  return (Math.atan2(Math.hypot(p.x - q.x, p.z - q.z), p.y - q.y) * 180) / Math.PI;
};
const meanTipReach = (snap) => {
  const tips = mainStems(snap).map((a) => a.points.at(-1));
  return tips.reduce((sum, p) => sum + Math.hypot(p.x, p.z), 0) / tips.length;
};

test('summer stems differ in lean and bow, not one parallel vertical', () => {
  const angles = [];
  const headings = [];
  for (const seed of MANY_SEEDS) {
    const snap = evaluate(createMaculatumModel({ seed }), 5, 205);
    for (const axis of mainStems(snap)) {
      angles.push(leanDegrees(axis));
      const tip = axis.points.at(-1);
      headings.push(Math.atan2(tip.z - axis.root.z, tip.x - axis.root.x));
    }
  }
  const spread = Math.max(...angles) - Math.min(...angles);
  assert.ok(spread > 10, `lean angles span only ${spread} degrees`);
  // Leans point in many directions, not one for the whole clump.
  assert.ok(Math.max(...headings) - Math.min(...headings) > 4);
});

test('stems droop over winter: tips reach further out at day 20 than at day 205', () => {
  const summerReach = [];
  const winterReach = [];
  const summerHeight = [];
  const winterHeight = [];
  const allBends = [];
  for (const seed of MANY_SEEDS) {
    const model = createMaculatumModel({ seed });
    const summer = evaluate(model, 5, 205);
    const winter = evaluate(model, 5, 20);
    summerReach.push(meanTipReach(summer));
    winterReach.push(meanTipReach(winter));
    summerHeight.push(summer.dimensions.heightM);
    winterHeight.push(winter.dimensions.heightM);
    allBends.push(...mainStems(winter).map(tipTiltDegrees));
  }
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  assert.ok(mean(winterReach) > mean(summerReach) * 1.5, `${mean(winterReach)} vs ${mean(summerReach)}`);
  assert.ok(median(winterHeight) < median(summerHeight));
  // Each stem droops by its own amount: most arc over, a few stay near upright.
  assert.ok(Math.max(...allBends) - Math.min(...allBends) > 40, 'droop differs from stem to stem');
  assert.ok(allBends.filter((b) => b > 45).length > allBends.length / 2, 'most stems arc over');
  assert.ok(allBends.some((b) => b < 30), 'a few stay near upright');
  // Mature height is held where it was (about 1.75 m).
  const height = median(summerHeight);
  assert.ok(height > 1.7 && height < 1.8, `mature height ${height}`);
});

test('droop grows progressively between leaf-fall and the cutback', () => {
  const model = createMaculatumModel({ seed: 'stem-1' });
  const reach = [330, 365, 20, 50].map((day) => meanTipReach(evaluate(model, day > 300 ? 4 : 5, day)));
  for (let i = 1; i < reach.length; i += 1) assert.ok(reach[i] >= reach[i - 1] - 1e-9, String(reach));
});

const meanTipOffset = (snap) => {
  const stems = mainStems(snap);
  return (
    stems.reduce((sum, a) => {
      const p = a.points.at(-1);
      return sum + Math.hypot(p.x - a.root.x, p.z - a.root.z);
    }, 0) / stems.length
  );
};

test('heavy heads bow the stems at bloom and the curve stays through seed set', () => {
  const growth = [];
  const bloom = [];
  const seedHead = [];
  const heights = [];
  const headings = [];
  for (const seed of MANY_SEEDS) {
    const model = createMaculatumModel({ seed });
    growth.push(meanTipOffset(evaluate(model, 5, 150)));
    const atBloom = evaluate(model, 5, 225);
    bloom.push(meanTipOffset(atBloom));
    seedHead.push(meanTipOffset(evaluate(model, 5, 300)));
    heights.push(evaluate(model, 5, 205).dimensions.heightM);
    for (const axis of mainStems(atBloom)) {
      const tip = axis.points.at(-1);
      headings.push(Math.atan2(tip.z - axis.root.z, tip.x - axis.root.x));
    }
  }
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  assert.ok(mean(bloom) > mean(growth) * 1.3, `bloom ${mean(bloom)} vs growth ${mean(growth)}`);
  // Stems do not perk back up when the heads go to seed.
  assert.ok(mean(seedHead) >= mean(bloom) - 1e-9, `seed ${mean(seedHead)} vs bloom ${mean(bloom)}`);
  assert.ok(Math.max(...headings) - Math.min(...headings) > 4, 'bow directions differ stem to stem');
  const height = median(heights);
  assert.ok(height > 1.747 * 0.96 && height < 1.747 * 1.04, `height ${height}`);
});

test('the bow grows with the head: stems barely bow in bud and most at full bloom', () => {
  const model = createMaculatumModel({ seed: 'stem-3' });
  const offsets = [150, 185, 200, 215, 225].map((day) => meanTipOffset(evaluate(model, 5, day)));
  for (let i = 1; i < offsets.length; i += 1) assert.ok(offsets[i] >= offsets[i - 1] - 1e-9, String(offsets));
});

const chordAngle = (a, b) => (Math.atan2(Math.hypot(b.x - a.x, b.z - a.z), b.y - a.y) * 180) / Math.PI;
/** Lean of the lower half (base to midpoint) and of the upper third (two thirds up to the tip), from vertical. */
const lowerAndUpperLean = (axis) => {
  const last = axis.points.length - 1;
  return [
    chordAngle(axis.points[0], axis.points[Math.round(last / 2)]),
    chordAngle(axis.points[Math.round((2 * last) / 3)], axis.points[last]),
  ];
};
const SEEDS_21 = Array.from({ length: 21 }, (_, i) => `s${i}`);
const MODELS_21 = SEEDS_21.map((seed) => createMaculatumModel({ seed }));
const leans = (age, day) =>
  MODELS_21.flatMap((model) => mainStems(evaluate(model, age, day)).map(lowerAndUpperLean));

test('mature stems lean outward from near the ground all the way to the head, outer stems most', () => {
  const rows = leans(5, 218).sort((a, b) => a[0] - b[0]);
  const moreLeaning = rows.slice(Math.floor(rows.length / 2));
  const lower = median(moreLeaning.map((r) => r[0]));
  const upper = median(moreLeaning.map((r) => r[1]));
  assert.ok(lower >= 12 && lower <= 28, `lower-half lean ${lower}`);
  assert.ok(upper >= 8 && upper <= 25, `upper-third angle ${upper}`);
  // Inner stems stay near vertical, so the lean varies with position in the clump.
  assert.ok(rows[Math.floor(rows.length * 0.1)][0] < 10, 'inner stems stay near upright');
  // Stems differ one from another and lean in several directions.
  // Stems never bend back in: the upper third travels the same way as the lower half.
  const horizontal = (a, b) => [b.x - a.x, b.z - a.z];
  const bentBack = MODELS_21.flatMap((model) => mainStems(evaluate(model, 5, 218))).map((axis) => {
    const last = axis.points.length - 1;
    const lowerDir = horizontal(axis.points[0], axis.points[Math.round(last / 2)]);
    const upperDir = horizontal(axis.points[Math.round((2 * last) / 3)], axis.points[last]);
    return { lean: Math.hypot(...lowerDir), back: lowerDir[0] * upperDir[0] + lowerDir[1] * upperDir[1] < 0 };
  });
  bentBack.sort((a, b) => a.lean - b.lean);
  const outerHalf = bentBack.slice(Math.floor(bentBack.length / 2));
  assert.ok(outerHalf.filter((r) => r.back).length / outerHalf.length <= 0.1, 'stems bend back in');
  const headings = MODELS_21.flatMap((model) =>
    mainStems(evaluate(model, 5, 218)).map((a) => Math.atan2(a.points.at(-1).z - a.root.z, a.points.at(-1).x - a.root.x)),
  );
  assert.ok(Math.max(...headings) - Math.min(...headings) > 4);
});

test('stem bases fill a disc that grows with age, measured from each stem first point', () => {
  const footprint = (age) => {
    const diameters = MODELS_21.map((model) => {
      const radii = mainStems(evaluate(model, age, 218))
        .map((a) => Math.hypot(a.points[0].x, a.points[0].z))
        .sort((x, y) => x - y);
      return 2 * radii[Math.max(0, Math.ceil(0.9 * radii.length) - 1)];
    });
    return median(diameters);
  };
  const [one, three, five] = [1, 3, 5].map(footprint);
  assert.ok(five >= 0.2 && five <= 0.36, `age 5 footprint ${five} m`);
  assert.ok(three >= 0.13 && three <= 0.25, `age 3 footprint ${three} m`);
  assert.ok(one >= 0.05 && one <= 0.1, `age 1 footprint ${one} m`);
  assert.ok(one < three && three < five);
  // Each stem still grows from the ground.
  for (const axis of mainStems(evaluate(MODELS_21[0], 5, 218))) assert.equal(axis.points[0].y, 0);
});

test('young plants stay upright and the vase builds with age', () => {
  const lowerMedian = (age) => median(leans(age, 218).map((r) => r[0]));
  assert.ok(lowerMedian(1) < lowerMedian(3), `${lowerMedian(1)} vs ${lowerMedian(3)}`);
  assert.ok(lowerMedian(1) < 5);
  assert.ok(lowerMedian(2) <= lowerMedian(3) && lowerMedian(2) >= lowerMedian(1));
});

test('the vase stays inside its width budget through bloom and seed set', () => {
  const spreadAt = (day) => median(MODELS_21.map((m) => evaluate(m, 5, day).dimensions.spreadM));
  const peak = spreadAt(218);
  assert.ok(peak >= 1.05 && peak <= 1.26, `day 218 spread ${peak}`);
  for (const day of [195, 205, 225, 260]) assert.ok(spreadAt(day) <= 1.28, `day ${day} spread ${spreadAt(day)}`);
  const height = median(MODELS_21.map((m) => evaluate(m, 5, 218).dimensions.heightM));
  assert.ok(height > 1.745 * 0.96 && height < 1.745 * 1.04, `height ${height}`);
});
