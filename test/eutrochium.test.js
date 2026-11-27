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
