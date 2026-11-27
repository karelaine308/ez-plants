import { growWoodyAxis } from '../../woody-axis.js';
import { keyedRandom, keyedRange as randomRange } from '../../keyed-random.js';
import {
  add,
  axisRng,
  clamp01,
  deepFreeze,
  lerp,
  normalize,
  orientationFor,
  progress,
  sampleAnchors,
  scale,
  smoothstep01,
  subtract,
  tangentAt,
  vector,
} from '../../model-math.js';
import { getPinnataCareHints, getPinnataPhenology } from './phenology.js';
import { PINNATA_PROFILE, PINNATA_RENDER_ASSUMPTIONS, PINNATA_SOURCES } from './pinnata.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UP = vector(0, 1, 0);
const MODEL_KIND = 'ratibida-pinnata-growth-model';
const ARCH = PINNATA_PROFILE.architecture;
const STEM = PINNATA_PROFILE.stem;
const LEAF = PINNATA_PROFILE.leaf;
const MATURE_AGE = 5;
const LATE_HEAD_EVERY = 11;
const LEAF_NODES = 10;

/** Days later than a mature clump that a young clump blooms (assumption). */
const bloomDelayDays = (ageYears) => (ageYears <= 1 ? 7 : ageYears === 2 ? 3 : 0);

function axisFromGrowth({ seed, id, origin, direction, length, radius, sectionCount, gnarliness }) {
  const sections = growWoodyAxis({
    origin,
    orientation: orientationFor(direction),
    length,
    radius,
    sectionCount,
    gnarliness,
    taper: 0.45,
    force: { direction: UP, strength: radius * 0.002 },
    rng: axisRng(seed, id),
  });
  return {
    points: sections.map((s) => vector(s.origin.x, s.origin.y, s.origin.z)),
    radii: sections.map((s) => s.radius),
  };
}

/** Per-age counts for stems, heads and basal leaves, varied by seed. */
function countsByAge(seed, maxYears) {
  const stemFactor = randomRange(seed, ['stem-factor'], 0.88, 1.12);
  // Two draws summed: a median of 1 with a range of 0.7 to 1.3.
  const headFactor =
    1 + 0.3 * (keyedRandom(seed, 'head-factor', 1) + keyedRandom(seed, 'head-factor', 2) - 1);
  const leafFactor = randomRange(seed, ['basal-factor'], 0.9, 1.1);
  const stems = [];
  const heads = [];
  const basal = [];
  for (let age = 0; age <= maxYears; age += 1) {
    const at = Math.min(age, MATURE_AGE);
    const s = Math.max(stems.at(-1) ?? 0, Math.round(sampleAnchors(ARCH.shootCountAnchors, at) * stemFactor));
    stems.push(Math.min(s, ARCH.maximumPrimaryShoots));
    const h = Math.round(sampleAnchors(ARCH.headCountAnchors, at) * headFactor);
    heads.push(Math.max(heads.at(-1) ?? 0, h, s));
    basal.push(Math.max(basal.at(-1) ?? 0, Math.round(sampleAnchors(ARCH.basalLeafCountAnchors, at) * leafFactor)));
  }
  return { stems, heads, basal };
}

/** Which stem carries each head, as the clump grows year by year. */
function allocateHeads(seed, counts, maxYears) {
  const stems = [];
  let total = 0;
  let headSequence = 0;
  const newHead = (stem, age) => {
    stem.heads.push({ slot: stem.heads.length, birthAgeYears: age, index: headSequence });
    headSequence += 1;
    total += 1;
  };
  for (let age = 1; age <= maxYears; age += 1) {
    while (stems.length < counts.stems[age]) {
      const stem = {
        sequence: stems.length,
        birthAgeYears: age,
        weight: randomRange(seed, ['stem-weight', stems.length], 0.5, 1.5),
        heads: [],
      };
      stems.push(stem);
      newHead(stem, age);
    }
    let guard = 0;
    while (total < counts.heads[age] && guard < 1000) {
      guard += 1;
      const open = stems.filter((s) => s.heads.length < STEM.maxHeadsPerStem);
      if (open.length === 0) break;
      const sum = open.reduce((acc, s) => acc + s.weight, 0);
      let pick = keyedRandom(seed, 'alloc', age, total) * sum;
      let chosen = open.at(-1);
      for (const stem of open) {
        pick -= stem.weight;
        if (pick <= 0) {
          chosen = stem;
          break;
        }
      }
      newHead(chosen, age);
    }
  }
  return stems;
}

function makeLeaf(seed, { id, kind, axisId = null, pointIndex = 0, azimuth, fraction, birthAgeYears, elevationYoung, elevationMature, sizeFactor, root = null }) {
  return {
    id,
    kind,
    axisId,
    pointIndex,
    azimuth,
    fraction,
    birthAgeYears,
    elevationYoung,
    elevationMature,
    sizeFactor,
    root,
    roll: randomRange(seed, [id, 'roll'], -0.3, 0.3),
    dropOrder: keyedRandom(seed, id, 'drop-order'),
  };
}

function makeHead(seed, stemId, axisId, head, leafHeadIndex) {
  const id = `${axisId}:head`;
  const late = head.index % LATE_HEAD_EVERY === 5;
  const u = keyedRandom(seed, id, 'open');
  // Opening dates (baseline day of year): most heads follow a skewed curve
  // with its median near day 203; one in eleven opens late for the October tail.
  const openDay = late ? 250 + 35 * u : 182 + 75 * Math.pow(u, 1.8);
  const durationDays = late
    ? randomRange(seed, [id, 'duration'], 14, 19)
    : randomRange(seed, [id, 'duration'], ...PINNATA_PROFILE.flowering.openDurationDays);
  const tiltAzimuth = randomRange(seed, [id, 'tilt-azimuth'], 0, Math.PI * 2);
  const tilt = randomRange(seed, [id, 'tilt'], 0.02, 0.28);
  return {
    id,
    stemId,
    axisId,
    slot: head.slot,
    birthAgeYears: head.birthAgeYears,
    openDay,
    durationDays,
    late,
    tiltX: Math.cos(tiltAzimuth) * tilt,
    tiltZ: Math.sin(tiltAzimuth) * tilt,
    spin: randomRange(seed, [id, 'spin'], 0, Math.PI * 2),
    sizeScale: randomRange(seed, [id, 'size'], 0.9, 1.1),
    winterRetention: keyedRandom(seed, id, 'winter-retention'),
    leafHeadIndex,
  };
}

function makeStem(seed, plan) {
  const id = `pinnata:stem:${String(plan.sequence).padStart(2, '0')}`;
  const radialFraction = Math.sqrt((plan.sequence + 0.35) / ARCH.maximumPrimaryShoots);
  const azimuth = plan.sequence * GOLDEN_ANGLE + randomRange(seed, [id, 'azimuth'], -0.25, 0.25);
  const rootRadius = ARCH.matureCrownRadiusM * radialFraction;
  const root = vector(Math.cos(azimuth) * rootRadius, 0, Math.sin(azimuth) * rootRadius);
  // Each stem leans outward from the crown centre in its own direction, with
  // the tilt growing along the stem so the clump flares like a vase.
  const leanAzimuth = azimuth + randomRange(seed, [id, 'lean-azimuth'], -0.35, 0.35);
  const outward = vector(Math.cos(leanAzimuth), 0, Math.sin(leanAzimuth));
  const tipTiltDegrees = Math.max(
    0.5,
    lerp(ARCH.leanTipDegreesCentre, ARCH.leanTipDegreesEdge, Math.pow(radialFraction, 1.5)) +
      randomRange(seed, [id, 'lean-jitter'], -ARCH.leanJitterDeg, ARCH.leanJitterDeg),
  );
  const height = STEM.stemMaxHeightM * randomRange(seed, [id, 'height'], ...STEM.heightShare);
  const radius = randomRange(seed, [id, 'radius'], ...STEM.baseRadiusM);
  const mainId = `${id}:axis:main`;
  const grown = axisFromGrowth({
    seed,
    id: mainId,
    origin: root,
    direction: UP,
    length: height,
    radius,
    sectionCount: STEM.mainAxisSections,
    gnarliness: 0.00012,
  });
  // Horizontal offset k * h * t^2: zero tilt at the base, tangent tan(tip) at the top.
  const flare = (Math.tan((tipTiltDegrees * Math.PI) / 180) / 2) * height;
  const lastIndex = grown.points.length - 1;
  const main = {
    id: mainId,
    shootId: id,
    shootRoot: root,
    kind: 'main',
    birthAgeYears: plan.birthAgeYears,
    parentAxisId: null,
    parentPointIndex: null,
    tipTiltDegrees,
    points: grown.points.map((p, i) => add(p, scale(outward, flare * (i / lastIndex) ** 2))),
    radii: grown.radii,
  };
  const axes = [main];
  const lastPoint = main.points.length - 1;
  const tipY = main.points[lastPoint].y;

  const leaves = [];
  const reachJitter = randomRange(seed, [id, 'reach'], -0.03, 0.03);
  for (let node = 1; node <= LEAF_NODES; node += 1) {
    const fraction = node / lastPoint;
    let birth = null;
    for (let age = 1; age <= MATURE_AGE; age += 1) {
      if (sampleAnchors(STEM.leafReachAnchors, age) + reachJitter >= fraction) {
        birth = age;
        break;
      }
    }
    if (birth === null) continue;
    // Two leaves at the lowest nodes make the lower half leafy.
    const perNode = node <= 3 ? 2 : 1;
    for (let k = 0; k < perNode; k += 1) {
      const leafId = `${id}:leaf:${node}:${k}`;
      const lift = lerp(0.35, 0.9, clamp01(fraction / 0.6));
      leaves.push(
        makeLeaf(seed, {
          id: leafId,
          kind: 'stem',
          axisId: mainId,
          pointIndex: node,
          azimuth: azimuth + node * 2.4 + k * Math.PI * 0.8 + randomRange(seed, [leafId, 'azimuth'], -0.3, 0.3),
          fraction,
          birthAgeYears: Math.max(birth, plan.birthAgeYears),
          elevationYoung: Math.atan(lift),
          elevationMature: Math.atan(lift),
          sizeFactor:
            randomRange(seed, [leafId, 'size'], 0.8, 1.1) *
            lerp(...LEAF.stemLeafScaleLowTop, clamp01(fraction / 0.6)),
        }),
      );
    }
  }

  const heads = [];
  const nodeFirst = Math.ceil(STEM.branchStartFraction * lastPoint);
  plan.heads.forEach((head, order) => {
    if (head.slot === 0) {
      heads.push(makeHead(seed, id, mainId, head, order));
      return;
    }
    const lateralId = `${id}:axis:lateral:${head.slot}`;
    // A side stalk of 10-45 cm from a node at or above 65% of the height,
    // carrying its head anywhere from 75% to 100% of the stem's height.
    const targetY = tipY * randomRange(seed, [lateralId, 'height'], ...STEM.headZoneFractions);
    const candidates = [];
    for (let node = nodeFirst; node < lastPoint; node += 1) {
      if (main.points[node].y <= targetY - 0.08) candidates.push(node);
    }
    const node = candidates.length
      ? candidates[Math.floor(keyedRandom(seed, lateralId, 'node') * candidates.length)]
      : nodeFirst;
    const origin = main.points[node];
    const side = randomRange(seed, [lateralId, 'side'], 0, Math.PI * 2);
    const out = randomRange(seed, [lateralId, 'out'], ...STEM.stalkOutward);
    const direction = normalize(add(scale(UP, 0.9), scale(vector(Math.cos(side), 0, Math.sin(side)), out)));
    const length = Math.min(
      STEM.stalkLengthM[1],
      Math.max(STEM.stalkLengthM[0], (targetY - origin.y) / direction.y),
    );
    const growth = axisFromGrowth({
      seed,
      id: lateralId,
      origin,
      direction,
      length,
      radius: STEM.pedunculeRadiusM,
      sectionCount: STEM.lateralAxisSections,
      gnarliness: 0.00008,
    });
    axes.push({
      id: lateralId,
      shootId: id,
      shootRoot: root,
      kind: 'lateral',
      birthAgeYears: head.birthAgeYears,
      parentAxisId: mainId,
      parentPointIndex: node,
      ...growth,
    });
    heads.push(makeHead(seed, id, lateralId, head, order));
  });

  return { id, sequence: plan.sequence, birthAgeYears: plan.birthAgeYears, root, axes, leaves, heads };
}

/** Build the finite all-ages clump and annual shoot sites once. */
export function createPinnataModel({ seed = 'pinnata-demo', maxYears = ARCH.modelHorizonYears } = {}) {
  if (!['string', 'number'].includes(typeof seed)) throw new TypeError('seed must be a string or number');
  if (!Number.isInteger(maxYears) || maxYears < 1 || maxYears > 50) {
    throw new RangeError('maxYears must be an integer from 1 to 50');
  }
  const counts = countsByAge(seed, maxYears);
  const plans = allocateHeads(seed, counts, maxYears);
  const shoots = plans.map((plan) => makeStem(seed, plan));

  const basalLeaves = [];
  for (let index = 0; index < counts.basal.at(-1); index += 1) {
    let birth = 0;
    while (counts.basal[birth] <= index) birth += 1;
    const id = `pinnata:basal:${String(index).padStart(2, '0')}`;
    basalLeaves.push(
      makeLeaf(seed, {
        id,
        kind: 'basal',
        azimuth: index * GOLDEN_ANGLE + randomRange(seed, [id, 'azimuth'], -0.2, 0.2),
        fraction: 0,
        birthAgeYears: birth,
        elevationYoung: randomRange(seed, [id, 'el-young'], 1.0, 1.3),
        elevationMature: randomRange(seed, [id, 'el-mature'], 0.4, 0.8),
        sizeFactor: randomRange(seed, [id, 'size'], 0.75, 1),
        root: Math.sqrt(keyedRandom(seed, id, 'root')),
      }),
    );
  }

  return deepFreeze({
    schemaVersion: 1,
    kind: MODEL_KIND,
    species: PINNATA_PROFILE.species,
    cultivar: PINNATA_PROFILE.cultivar,
    seed: String(seed),
    maxYears,
    metresPerUnit: PINNATA_PROFILE.metresPerUnit,
    counts,
    shoots,
    basalLeaves,
  });
}

function plantMode(phenology, ageYears) {
  const day = phenology.dayOfYear;
  if (day < phenology.calendar.cutbackEnd) {
    return ageYears > 0 && phenology.standingDryVisibility > 0.01 ? 'previous-dry' : 'dormant';
  }
  if (day >= phenology.calendar.dryFull) return 'current-dry';
  if (day >= phenology.calendar.emergenceStart) return 'current';
  return 'dormant';
}

function overwinterWeathering(phenology) {
  const { dayOfYear: day, calendar } = phenology;
  const elapsed = day >= calendar.dryFull ? day - calendar.dryFull : day + 365 - calendar.dryFull;
  return clamp01(elapsed / 120);
}

function transformPrimaryAxis(axis, crownScale, stemScale) {
  const root = scale(axis.shootRoot, crownScale);
  const points = axis.points.map((p) => add(root, scale(subtract(p, axis.shootRoot), stemScale)));
  return { ...axis, root, points };
}

function transformLateralAxis(axis, parent, branchScale) {
  const root = parent.points[axis.parentPointIndex];
  const sourceRoot = axis.points[0];
  const points = axis.points.map((p) => add(root, scale(subtract(p, sourceRoot), branchScale)));
  return { ...axis, root, points };
}

function localHeadState(head, phenology, cohortAgeYears, dryMode) {
  if (dryMode) {
    const weathering = overwinterWeathering(phenology);
    return {
      visible: head.winterRetention > 0.03 + weathering * 0.22,
      stage: 'winter',
      budProgress: 1,
      openProgress: 1,
      rayVisibility: 0,
      maturity: 1,
      visualScale: lerp(0.97, 0.9, weathering),
      weathering,
    };
  }
  const day = phenology.dayOfYear;
  const open = head.openDay + phenology.shiftDays + bloomDelayDays(cohortAgeYears);
  // Every bud is on the stalk, small, once the stems are up; each swells in the
  // three weeks before its own opening.
  const budStart = Math.min(open - 16, phenology.calendar.budStart + bloomDelayDays(cohortAgeYears));
  if (day < budStart) return { visible: false };
  const closes = open + head.durationDays;
  const budProgress = progress(day, open - 22, open);
  const openProgress = progress(day, open, open + 3);
  let stage;
  let rayVisibility;
  if (day < open) {
    stage = 'bud';
    rayVisibility = 0;
  } else if (day < closes) {
    stage = openProgress < 1 ? 'opening' : 'open';
    rayVisibility = openProgress;
  } else {
    stage = 'seed';
    rayVisibility = 1 - progress(day, closes, closes + 3);
  }
  return {
    visible: true,
    stage,
    budProgress,
    openProgress,
    rayVisibility,
    // 0 gray-green bud, brown by the end of bloom, dark about two months on.
    maturity: progress(day, open, closes + 60),
    visualScale: day < open ? lerp(0.4, 0.95, smoothstep01(budProgress)) : 1,
    weathering: phenology.dryProgress * 0.5,
  };
}

function leafFrame(azimuth, elevation) {
  const outward = vector(Math.cos(azimuth), 0, Math.sin(azimuth));
  const direction = normalize(add(scale(outward, Math.cos(elevation)), scale(UP, Math.sin(elevation))));
  const sideways = vector(-outward.z, 0, outward.x);
  const normal = normalize(
    vector(
      sideways.y * direction.z - sideways.z * direction.y,
      sideways.z * direction.x - sideways.x * direction.z,
      sideways.x * direction.y - sideways.y * direction.x,
    ),
  );
  return { outward, direction, normal };
}

const crownScaleAt = (age) =>
  sampleAnchors(ARCH.crownRadiusAnchorsM, Math.min(age, MATURE_AGE)) / ARCH.matureCrownRadiusM;

/** Basal rosette leaf: full in summer, a low rosette all winter, regrowing in spring. */
function evaluateBasalLeaf(leaf, ctx) {
  const { mode, phenology, rosetteAge, leafExpansion, ageYears, seed } = ctx;
  const day = phenology.dayOfYear;
  const { calendar } = phenology;
  const floor = LEAF.winterRosetteSize;
  let size = floor;
  if (mode === 'current') {
    // Leaves that already existed last year start spring at the winter size.
    const springFloor = leaf.birthAgeYears < ageYears ? floor : 0;
    const spring = springFloor + (1 - springFloor) * smoothstep01(leafExpansion);
    size = lerp(spring, floor, progress(day, calendar.leafFallStart, calendar.dryFull));
  }
  if (size <= 0.01) return null;
  const winterness = 1 - clamp01((size - floor) / (1 - floor));
  const normalElevation = lerp(leaf.elevationYoung, leaf.elevationMature, progress(rosetteAge, 0, 3));
  const winterElevation = lerp(0.09, 0.3, keyedRandom(seed, leaf.id, 'winter-elevation'));
  const elevation = lerp(normalElevation, winterElevation, winterness);
  const rootRadius = ARCH.matureCrownRadiusM * crownScaleAt(rosetteAge) * leaf.root;
  const { outward, direction, normal } = leafFrame(leaf.azimuth, elevation);
  const length = sampleAnchors(LEAF.basalLengthAnchorsM, Math.min(rosetteAge, MATURE_AGE)) * leaf.sizeFactor;
  const lengthM = length * lerp(0.15, 1, size);
  // Mixed green and bronze through winter; the autumn blend caps at 0.55.
  const autumnProgress =
    mode === 'current' && day >= calendar.autumnStart
      ? Math.min(phenology.autumnProgress, 0.55)
      : 0.55 * winterness;
  return {
    id: leaf.id,
    visible: true,
    kind: 'basal',
    litter: false,
    position: vector(outward.x * rootRadius, 0.03, outward.z * rootRadius),
    direction,
    normal,
    roll: leaf.roll,
    fraction: 0,
    lengthM,
    widthM: lengthM * LEAF.widthToLength,
    autumnProgress,
    seed,
  };
}

/** Stem leaf on the standing stem, from spring growth until its seeded drop day. */
function evaluateStemLeaf(leaf, ctx) {
  const { mode, axisMap, phenology, cohortAgeYears, stemGrowth, seed } = ctx;
  if (mode !== 'current') return null;
  const day = phenology.dayOfYear;
  const { calendar } = phenology;
  // Leaves let go through the first weeks of November, in a seeded order.
  if (day >= calendar.leafFallStart + leaf.dropOrder * (calendar.leafFallEnd - calendar.leafFallStart)) {
    return null;
  }
  const position = axisMap.get(leaf.axisId)?.points[leaf.pointIndex];
  if (!position) return null;
  const expansion = smoothstep01(clamp01((stemGrowth * 1.2 - leaf.fraction * 0.7) / 0.35));
  if (expansion <= 0.01) return null;
  const length = sampleAnchors(LEAF.basalLengthAnchorsM, Math.min(cohortAgeYears, MATURE_AGE)) * leaf.sizeFactor;
  const { direction, normal } = leafFrame(leaf.azimuth, leaf.elevationMature);
  const lengthM = length * lerp(0.15, 1, expansion);
  return {
    id: leaf.id,
    visible: true,
    kind: 'stem',
    litter: false,
    position,
    direction,
    normal,
    roll: leaf.roll,
    fraction: leaf.fraction,
    lengthM,
    widthM: lengthM * LEAF.widthToLength,
    autumnProgress: phenology.autumnProgress,
    seed,
  };
}

/**
 * A fallen stem leaf lying flat near the crown. It is never cleaned up: it
 * stays from its drop day through winter and is covered by new growth over
 * the weeks after the leaf-expansion date. A fast decomposer leaves no litter.
 */
function evaluateLitterLeaf(leaf, ctx) {
  if (LEAF.leafLitterDecomposition === 'fast') return null;
  const { phenology, litterAge, seed } = ctx;
  if (litterAge === null) return null;
  const day = phenology.dayOfYear;
  const { calendar } = phenology;
  if (day < calendar.stemElongationStart) {
    const coverDay =
      calendar.leafExpansionStart + keyedRandom(seed, leaf.id, 'litter-cover') * LEAF.litterCoverDays;
    if (day >= coverDay) return null;
  } else if (day < calendar.leafFallStart + leaf.dropOrder * (calendar.leafFallEnd - calendar.leafFallStart)) {
    return null;
  }
  const spreadRadius = sampleAnchors(ARCH.spreadByAgeM, Math.min(litterAge, MATURE_AGE)) / 2;
  const crownRadius = ARCH.matureCrownRadiusM * crownScaleAt(litterAge);
  const radius = crownRadius * Math.sqrt(keyedRandom(seed, leaf.id, 'litter-radius'));
  const around = keyedRandom(seed, leaf.id, 'litter-around') * Math.PI * 2;
  const azimuth = keyedRandom(seed, leaf.id, 'litter-azimuth') * Math.PI * 2;
  const fullLength = sampleAnchors(LEAF.basalLengthAnchorsM, Math.min(litterAge, MATURE_AGE)) * leaf.sizeFactor;
  const lengthM = Math.min(fullLength * LEAF.litterScale, Math.max(0.04, spreadRadius - radius));
  const { direction, normal } = leafFrame(azimuth, 0.03);
  return {
    id: leaf.id,
    visible: true,
    kind: 'stem',
    litter: true,
    position: vector(Math.cos(around) * radius, 0.012, Math.sin(around) * radius),
    direction,
    normal,
    roll: leaf.roll,
    fraction: 0,
    lengthM,
    widthM: lengthM * LEAF.widthToLength,
    autumnProgress: 1,
    seed,
  };
}

function dimensionsFor(axes, leaves, heads) {
  let heightM = 0;
  let radiusM = 0;
  let baseRadiusM = 0;
  const BASE_ZONE_M = 0.3;
  for (const axis of axes) {
    for (const p of axis.points) {
      heightM = Math.max(heightM, p.y);
      radiusM = Math.max(radiusM, Math.hypot(p.x, p.z));
      if (p.y <= BASE_ZONE_M) baseRadiusM = Math.max(baseRadiusM, Math.hypot(p.x, p.z));
    }
  }
  for (const leaf of leaves) {
    const tip = add(leaf.position, scale(leaf.direction, leaf.lengthM));
    heightM = Math.max(heightM, tip.y);
    radiusM = Math.max(radiusM, Math.hypot(tip.x, tip.z));
    if (leaf.position.y <= BASE_ZONE_M && tip.y <= BASE_ZONE_M + 0.1) {
      baseRadiusM = Math.max(baseRadiusM, Math.hypot(tip.x, tip.z));
    }
  }
  let headRadiusM = 0;
  let lowestHeadM = Infinity;
  for (const head of heads) {
    heightM = Math.max(heightM, head.position.y + 0.03 * head.visualScale * head.headScale * head.direction.y);
    const reach = Math.hypot(head.position.x, head.position.z) + 0.02;
    radiusM = Math.max(radiusM, reach);
    headRadiusM = Math.max(headRadiusM, reach);
    lowestHeadM = Math.min(lowestHeadM, head.position.y);
  }
  return {
    heightM,
    radiusM,
    spreadM: radiusM * 2,
    baseSpreadM: baseRadiusM * 2,
    headWidthM: headRadiusM * 2,
    lowestHeadFraction: heads.length ? lowestHeadM / heightM : null,
  };
}

/** Mean chord tilt and tip-tangent tilt of the standing stems, in degrees. */
function leanStats(axes) {
  const mains = axes.filter((a) => a.kind === 'main');
  if (mains.length === 0) return { degrees: 0, tipDegrees: 0, maxTipDegrees: 0 };
  const deg = (x, y, z) => (Math.atan2(Math.hypot(x, z), y) * 180) / Math.PI;
  const chords = mains.map((a) => {
    const t = a.points.at(-1);
    return deg(t.x - a.root.x, t.y - a.root.y, t.z - a.root.z);
  });
  const tips = mains.map((a) => {
    const n = a.points.length;
    const p = a.points[n - 1];
    const q = a.points[n - 2];
    return deg(p.x - q.x, p.y - q.y, p.z - q.z);
  });
  const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length;
  return { degrees: mean(chords), tipDegrees: mean(tips), maxTipDegrees: Math.max(...tips) };
}

/** Evaluate the immutable clump at one age and calendar day. */
export function evaluatePinnataModel(
  model,
  { ageYears = 0, dayOfYear = 205, events = [], seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  if (!model || model.kind !== MODEL_KIND) throw new TypeError('Expected a model returned by createPinnataModel');
  if (!Number.isInteger(ageYears) || ageYears < 0 || ageYears > model.maxYears) {
    throw new RangeError(`ageYears must be an integer between 0 and ${model.maxYears}`);
  }
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (events.length > 0) {
    throw new RangeError('Gray-headed coneflower exposes no care events; the winter stand and spring cutback are part of its calendar.');
  }
  const phenology = getPinnataPhenology(dayOfYear, { seasonProfile, offsetDays });
  const mode = plantMode(phenology, ageYears);
  const cohortAgeYears = mode === 'previous-dry' ? Math.max(0, ageYears - 1) : ageYears;
  const dryMode = mode === 'previous-dry' || mode === 'current-dry';
  const ageScale = sampleAnchors(ARCH.stemHeightScaleAnchors, Math.min(cohortAgeYears, MATURE_AGE));
  const crownRadius = sampleAnchors(ARCH.crownRadiusAnchorsM, Math.min(cohortAgeYears, MATURE_AGE));
  const crownScale = crownRadius / ARCH.matureCrownRadiusM;
  const stemGrowth = dryMode ? 1 : mode === 'current' ? smoothstep01(phenology.stemGrowthProgress) : 0;
  const lateralGrowth = dryMode ? 1 : smoothstep01(progress(stemGrowth, 0.7, 1));
  const weathering = dryMode ? overwinterWeathering(phenology) : 0;

  const active = model.shoots.filter((s) => s.birthAgeYears <= cohortAgeYears);
  const axes = [];
  const axisMap = new Map();
  const bolted = dryMode || stemGrowth > 0.02;
  if (mode !== 'dormant' && bolted) {
    for (const shoot of active) {
      if (
        mode === 'previous-dry' &&
        keyedRandom(model.seed, shoot.id, 'spring-cutback-order') >= phenology.standingDryVisibility
      ) {
        continue;
      }
      const main = transformPrimaryAxis(shoot.axes[0], crownScale, ageScale * stemGrowth);
      Object.assign(main, {
        visible: true,
        cohort: dryMode ? 'dry' : 'current',
        weathering,
        radiusScale: lerp(0.6, 1, ageScale) * lerp(0.6, 1, stemGrowth),
      });
      axes.push(main);
      axisMap.set(main.id, main);
      for (const lateral of shoot.axes.slice(1)) {
        if (lateral.birthAgeYears > cohortAgeYears || lateralGrowth <= 0.002) continue;
        const parent = axisMap.get(lateral.parentAxisId);
        if (!parent) continue;
        const branch = transformLateralAxis(lateral, parent, ageScale * lateralGrowth);
        Object.assign(branch, {
          visible: true,
          cohort: dryMode ? 'dry' : 'current',
          weathering,
          radiusScale: lerp(0.7, 1, ageScale),
        });
        axes.push(branch);
        axisMap.set(branch.id, branch);
      }
    }
  }

  const leaves = [];
  const day = phenology.dayOfYear;
  // Before the spring regrowth the winter rosette and litter are last year's.
  const rosetteAge = mode === 'dormant' ? ageYears - 1 : cohortAgeYears;
  // Litter is last year's through spring, this year's after the November drop.
  const litterAge =
    day < phenology.calendar.stemElongationStart
      ? ageYears - 1
      : day >= phenology.calendar.leafFallStart
        ? ageYears
        : null;
  const leafContext = {
    mode,
    axisMap,
    phenology,
    cohortAgeYears,
    rosetteAge,
    litterAge: litterAge !== null && litterAge >= 0 ? litterAge : null,
    ageYears,
    leafExpansion: Math.max(phenology.leafProgress, phenology.emergenceProgress * 0.8),
    stemGrowth,
    seed: model.seed,
  };
  if (rosetteAge >= 0) {
    for (const leaf of model.basalLeaves) {
      if (leaf.birthAgeYears > rosetteAge) continue;
      const evaluated = evaluateBasalLeaf(leaf, leafContext);
      if (evaluated) leaves.push(evaluated);
    }
  }
  for (const shoot of model.shoots) {
    for (const leaf of shoot.leaves) {
      if (shoot.birthAgeYears <= cohortAgeYears && leaf.birthAgeYears <= cohortAgeYears) {
        const evaluated = evaluateStemLeaf(leaf, leafContext);
        if (evaluated) {
          leaves.push(evaluated);
          continue;
        }
      }
      if (
        leafContext.litterAge !== null &&
        shoot.birthAgeYears <= leafContext.litterAge &&
        leaf.birthAgeYears <= leafContext.litterAge
      ) {
        const fallen = evaluateLitterLeaf(leaf, leafContext);
        if (fallen) leaves.push(fallen);
      }
    }
  }

  const heads = [];
  const headScale = lerp(0.8, 1, ageScale);
  for (const shoot of active) {
    for (const head of shoot.heads) {
      if (head.birthAgeYears > cohortAgeYears) continue;
      const axis = axisMap.get(head.axisId);
      if (!axis) continue;
      const state = localHeadState(head, phenology, cohortAgeYears, dryMode);
      if (!state.visible) continue;
      const tip = tangentAt(axis.points, axis.points.length - 1);
      heads.push({
        id: head.id,
        axisId: head.axisId,
        lateral: head.slot > 0,
        visible: true,
        position: axis.points.at(-1),
        direction: normalize(add(tip, vector(head.tiltX, 0, head.tiltZ))),
        spin: head.spin,
        headScale: headScale * head.sizeScale,
        ...state,
      });
    }
  }

  const visibleStems = axes.filter((a) => a.kind === 'main').length;
  const stats = {
    visibleShoots: visibleStems,
    visibleStems,
    visibleAxes: axes.length,
    visibleLeaves: leaves.length,
    visibleBasalLeaves: leaves.filter((l) => l.kind === 'basal').length,
    visibleLitterLeaves: leaves.filter((l) => l.litter).length,
    visibleHeads: heads.length,
    visibleFlowers: heads.filter((h) => h.stage === 'open' || h.stage === 'opening').length,
    visibleFlowerBuds: heads.filter((h) => h.stage === 'bud').length,
    visibleSeedHeads: heads.filter((h) => h.stage === 'seed' || h.stage === 'winter').length,
    flowersOnCurrentSeasonStems: true,
  };

  return {
    species: model.species,
    cultivar: model.cultivar,
    seed: model.seed,
    ageYears,
    dayOfYear: phenology.dayOfYear,
    mode,
    lean: leanStats(axes),
    crown: { radiusM: crownRadius, shootSites: active.length },
    dimensions: dimensionsFor(axes, leaves, heads),
    phenology,
    careHints: getPinnataCareHints(phenology.dayOfYear, { seasonProfile, offsetDays }),
    provenance: {
      observedDisplay: PINNATA_PROFILE.flowering.observedDisplay,
      sources: PINNATA_SOURCES,
      rendererAssumptions: PINNATA_RENDER_ASSUMPTIONS,
    },
    shoots: active.map((s) => ({ id: s.id, sequence: s.sequence, birthAgeYears: s.birthAgeYears })),
    axes,
    leaves,
    heads,
    stats,
    appliedEvents: [],
  };
}
