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
import { getNovaeAngliaeCareHints, getNovaeAngliaePhenology } from './phenology.js';
import {
  NOVAE_ANGLIAE_PROFILE,
  NOVAE_ANGLIAE_RENDER_ASSUMPTIONS,
  NOVAE_ANGLIAE_SOURCES,
} from './novaeangliae.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UP = vector(0, 1, 0);
const DEG = Math.PI / 180;
const MODEL_KIND = 'symphyotrichum-novae-angliae-growth-model';
const ARCH = NOVAE_ANGLIAE_PROFILE.architecture;
const STEM = NOVAE_ANGLIAE_PROFILE.stem;
const LEAF = NOVAE_ANGLIAE_PROFILE.leaf;
const HEAD = NOVAE_ANGLIAE_PROFILE.head;
const MATURE_AGE = 5;
/** Where along its branch the 1st, 2nd, 3rd and 4th head of a branch sit. */
const HEAD_POSITIONS = [1, 0.7, 0.45, 0.2];
const LEAF_CARD_ASPECT = 1.3;
/** Days a head's open date moves with the age of the plant (assumed). */
const BLOOM_SHIFT_ANCHORS = [[0, 8], [1, 8], [2, 3], [3, 0], [50, 0]];
const BLOOM_SPREAD_ANCHORS = [[0, 5], [1, 5], [2, 8], [3, 9], [50, 9]];
/** Mean day a mature head opens: the owner peak of open heads (266) less half the open period. */
const OPEN_MEAN_DAY = 256;
const OPEN_MIN_DAY = 228;
const OPEN_MAX_DAY = 272;

const ageIndex = (age) => Math.min(age, MATURE_AGE);

function axisFromGrowth({ seed, id, origin, direction, length, radius, sectionCount, gnarliness }) {
  const sections = growWoodyAxis({
    origin,
    orientation: orientationFor(direction),
    length,
    radius,
    sectionCount,
    gnarliness,
    taper: 0.5,
    force: { direction: UP, strength: radius * 0.002 },
    rng: axisRng(seed, id),
  });
  return {
    points: sections.map((s) => vector(s.origin.x, s.origin.y, s.origin.z)),
    radii: sections.map((s) => s.radius),
  };
}

/** A point a fraction `u` of the way along a polyline's length of points. */
function pointAlong(points, u) {
  const last = points.length - 1;
  const f = clamp01(u) * last;
  const i = Math.min(last - 1, Math.floor(f));
  const t = f - i;
  return add(scale(points[i], 1 - t), scale(points[i + 1], t));
}

/** Per-age stem counts, varied by seed and never falling with age. */
function countsByAge(seed, maxYears) {
  const stemFactor = randomRange(seed, ['stem-factor'], 0.94, 1.08);
  const headFactor =
    0.9 + 0.2 * ((keyedRandom(seed, 'head-factor', 1) + keyedRandom(seed, 'head-factor', 2)) / 2);
  const basalFactor = randomRange(seed, ['basal-factor'], 0.9, 1.1);
  const stems = [];
  const basal = [];
  for (let age = 0; age <= maxYears; age += 1) {
    const at = ageIndex(age);
    const s = Math.round(sampleAnchors(ARCH.shootCountAnchors, at) * stemFactor);
    stems.push(Math.min(ARCH.maximumPrimaryShoots, Math.max(stems.at(-1) ?? 0, s)));
    const b = Math.round(sampleAnchors(ARCH.basalLeafCountAnchors, at) * basalFactor);
    basal.push(Math.max(basal.at(-1) ?? 0, b));
  }
  return { stems, basal, headFactor };
}

/** Heads on one stem at each age, never falling: age 0 has none. */
function headCountsForStem(seed, stemId, birthAgeYears, weight, headFactor, maxYears) {
  const out = [];
  for (let age = 0; age <= maxYears; age += 1) {
    let count = 0;
    if (age >= Math.max(1, birthAgeYears)) {
      const target = sampleAnchors(ARCH.headsPerStemAnchors, ageIndex(age)) * weight * headFactor;
      count = Math.min(STEM.maxHeadsPerStem, Math.max(1, Math.round(target)));
    }
    out.push(Math.max(out.at(-1) ?? 0, count));
  }
  return out;
}

const birthOfSlot = (counts, slot) => {
  const age = counts.findIndex((n) => n > slot);
  return age < 0 ? Infinity : age;
};

function makeLeaf(seed, { id, axisId, parentU, fraction, birthAgeYears, azimuth, lengthM, elevation, branchLeaf, bareShare = STEM.bareShare }) {
  return {
    id,
    kind: 'stem',
    axisId,
    parentU,
    fraction,
    birthAgeYears,
    azimuth,
    elevation,
    lengthM,
    branchLeaf,
    bareShare,
    roll: randomRange(seed, [id, 'roll'], -0.3, 0.3),
    dropOrder: keyedRandom(seed, id, 'drop-order'),
    dropJitter: randomRange(seed, [id, 'drop-jitter'], 0.85, 1.15),
    retained: keyedRandom(seed, id, 'retained') < LEAF.retainedShare,
  };
}

function makeStem(seed, sequence, birthAgeYears, ctx) {
  const id = `novae:stem:${String(sequence).padStart(2, '0')}`;
  const radialFraction = Math.sqrt((sequence + 0.35) / ARCH.maximumPrimaryShoots);
  const azimuth = sequence * GOLDEN_ANGLE + randomRange(seed, [id, 'azimuth'], -0.25, 0.25);
  const rootRadius = ARCH.matureCrownRadiusM * radialFraction;
  const root = vector(Math.cos(azimuth) * rootRadius, 0, Math.sin(azimuth) * rootRadius);
  // Flare outward from the crown, edge stems most, in the stem's own direction
  // (not all the same), plus an individual lean in any direction.
  const leanAzimuth = azimuth + randomRange(seed, [id, 'lean-azimuth'], -0.5, 0.5);
  const outward = vector(Math.cos(leanAzimuth), 0, Math.sin(leanAzimuth));
  // Outer stems keep leaves lower down; a typical inner stem is bare in its lower third.
  const bareShare = lerp(STEM.bareShare, STEM.outerBareShare, clamp01((radialFraction - 0.4) / 0.4));
  const tipTilt = Math.max(
    0.5,
    lerp(ARCH.leanTipDegreesCentre, ARCH.leanTipDegreesEdge, Math.pow(radialFraction, 1.5)) +
      randomRange(seed, [id, 'lean-jitter'], -ARCH.leanJitterDeg, ARCH.leanJitterDeg),
  );
  const randomTilt = randomRange(seed, [id, 'random-lean'], 0, ARCH.randomLeanMaxDeg);
  const randomAzimuth = randomRange(seed, [id, 'random-lean-azimuth'], 0, Math.PI * 2);
  const randomDir = vector(Math.cos(randomAzimuth), 0, Math.sin(randomAzimuth));
  // Centre stems stand a little taller than the edge ones, so the top is a dome.
  const height =
    STEM.stemMaxHeightM *
    randomRange(seed, [id, 'height'], ...STEM.heightShare) *
    (1 - 0.1 * radialFraction * radialFraction);
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
    gnarliness: 0.00014,
  });
  // A vase: the stem leaves the crown at its base lean and eases toward the
  // top lean, so the offset is a*t - b*t^2 of the height.
  const baseSlope = Math.tan(tipTilt * DEG);
  const topSlope = Math.tan(ARCH.leanTopDegrees * DEG);
  const a = baseSlope * height;
  const b = ((baseSlope - topSlope) / 2) * height;
  const kr = Math.tan(randomTilt * DEG) * height;
  const last = grown.points.length - 1;
  const main = {
    id: mainId,
    shootId: id,
    shootRoot: root,
    kind: 'main',
    birthAgeYears,
    parentAxisId: null,
    parentU: null,
    tipTiltDegrees: tipTilt,
    points: grown.points.map((p, i) =>
      add(p, add(scale(outward, a * (i / last) - b * (i / last) ** 2), scale(randomDir, kr * (i / last) ** 1.5))),
    ),
    radii: grown.radii,
  };
  const axes = [main];

  const weight = randomRange(seed, [id, 'vigour'], 0.75, 1.25);
  const counts = headCountsForStem(seed, id, birthAgeYears, weight, ctx.headFactor, ctx.maxYears);
  const slots = counts.at(-1);
  const B = STEM.branchesPerStem;

  const leaves = [];
  const heads = [];

  // Stem leaves: alternate, a node every 1/44 of the stem, each kept by its
  // rank so a young plant has fewer.
  const nodes = LEAF.nodesPerStem;
  for (let node = 0; node < nodes; node += 1) {
    const f = 0.02 + 0.97 * ((node + 0.5) / nodes);
    const rank = (node * 0.6180339887) % 1;
    let birth = null;
    for (let age = 0; age <= ctx.maxYears; age += 1) {
      if (sampleAnchors(LEAF.densityAnchors, ageIndex(age)) > rank) {
        birth = age;
        break;
      }
    }
    if (birth === null) continue;
    const leafId = `${id}:leaf:${node}`;
    leaves.push(
      makeLeaf(seed, {
        id: leafId,
        axisId: mainId,
        parentU: f,
        fraction: f,
        birthAgeYears: Math.max(birth, birthAgeYears),
        azimuth: azimuth + node * GOLDEN_ANGLE + randomRange(seed, [leafId, 'azimuth'], -0.25, 0.25),
        lengthM:
          lerp(LEAF.lowerLengthM, LEAF.upperLengthM, Math.pow(f, 0.9)) *
          randomRange(seed, [leafId, 'size'], 0.85, 1.1),
        elevation: lerp(0.4, 1.15, Math.pow(f, 0.8)) + randomRange(seed, [leafId, 'elevation'], -0.12, 0.12),
        branchLeaf: false,
        bareShare,
      }),
    );
  }

  // Side branches, top first; a branch exists once it has a head.
  for (let b = 0; b < B && b < slots; b += 1) {
    const branchId = `${id}:axis:branch:${b}`;
    const branchBirth = birthOfSlot(counts, b);
    const t = b / (B - 1);
    const u = STEM.branchZone[1] - (STEM.branchZone[1] - STEM.branchZone[0]) * Math.pow(t, 0.9) +
      randomRange(seed, [branchId, 'u'], -0.012, 0.012);
    const origin = pointAlong(main.points, u);
    const az = azimuth + b * GOLDEN_ANGLE + randomRange(seed, [branchId, 'azimuth'], -0.3, 0.3);
    const phi = (lerp(22, 58, t) + randomRange(seed, [branchId, 'phi'], -6, 6)) * DEG;
    const length =
      lerp(STEM.branchLengthM[0], STEM.branchLengthM[1], Math.pow(t, 0.9)) *
      randomRange(seed, [branchId, 'length'], 0.85, 1.15);
    const dir0 = vector(Math.sin(phi) * Math.cos(az), Math.cos(phi), Math.sin(phi) * Math.sin(az));
    const p1 = add(origin, scale(dir0, length));
    const rb = STEM.branchRadiusM;
    axes.push({
      id: branchId,
      shootId: id,
      shootRoot: root,
      kind: 'branch',
      birthAgeYears: branchBirth,
      parentAxisId: mainId,
      parentU: u,
      points: [origin, p1],
      radii: [rb, rb * 0.6],
    });
    heads.push(makeHead(seed, id, branchId, b, 0, branchBirth));
    // Three leaves along the branch, so the cluster is leafy.
    for (let l = 0; l < 3; l += 1) {
      const leafId = `${branchId}:leaf:${l}`;
      leaves.push(
        makeLeaf(seed, {
          id: leafId,
          axisId: branchId,
          parentU: [0.15, 0.45, 0.8][l],
          fraction: u,
          birthAgeYears: branchBirth,
          azimuth: az + [-Math.PI * 0.5, Math.PI * 0.6, Math.PI * 0.05][l],
          lengthM: randomRange(seed, [leafId, 'size'], ...LEAF.branchLeafLengthM),
          elevation: randomRange(seed, [leafId, 'elevation'], 0.6, 1.1),
          branchLeaf: true,
        }),
      );
    }
  }
  // Heads beyond the first on a branch sit along it on short offsets (no twig
  // axes: a 2-4 cm stalk is hidden in the leafy cluster and cost a segment).
  for (let slot = B; slot < slots; slot += 1) {
    const b = slot % B;
    const j = Math.floor(slot / B);
    const branch = axes.find((a) => a.id === `${id}:axis:branch:${b}`);
    if (!branch) continue;
    heads.push(makeHead(seed, id, branch.id, b, j, birthOfSlot(counts, slot), slot));
  }
  heads.forEach((head, order) => {
    head.slot = head.slot ?? order;
  });
  return { id, sequence, birthAgeYears, root, axes, leaves, heads };
}

function makeHead(seed, stemId, axisId, branchIndex, twigIndex, birthAgeYears, slot = branchIndex) {
  const id = `${axisId}:head:${twigIndex}`;
  const z =
    (keyedRandom(seed, 'open-a', id) + keyedRandom(seed, 'open-b', id) + keyedRandom(seed, 'open-c', id) - 1.5) * 2;
  const tiltAzimuth = randomRange(seed, [id, 'tilt-azimuth'], 0, Math.PI * 2);
  const tilt = randomRange(seed, [id, 'tilt'], 0.05, 0.4);
  return {
    id,
    stemId,
    axisId,
    slot,
    branchIndex,
    twigIndex,
    birthAgeYears,
    along: HEAD_POSITIONS[Math.min(twigIndex, HEAD_POSITIONS.length - 1)],
    offset: vector(
      randomRange(seed, [id, 'ox'], -0.018, 0.018),
      twigIndex > 0 ? randomRange(seed, [id, 'oy'], 0.004, 0.02) : 0,
      randomRange(seed, [id, 'oz'], -0.018, 0.018),
    ),
    openZ: z,
    durationDays: randomRange(seed, [id, 'duration'], ...NOVAE_ANGLIAE_PROFILE.flowering.openDurationDays),
    tiltX: Math.cos(tiltAzimuth) * tilt,
    tiltZ: Math.sin(tiltAzimuth) * tilt,
    spin: randomRange(seed, [id, 'spin'], 0, Math.PI * 2),
    sizeScale: randomRange(seed, [id, 'size'], ...HEAD.diameterM) / 0.038,
    winterRetention: keyedRandom(seed, id, 'winter-retention'),
  };
}

/** Build the finite all-ages clump and annual shoot sites once. */
export function createNovaeAngliaeModel({
  seed = 'novae-angliae-demo',
  maxYears = ARCH.modelHorizonYears,
} = {}) {
  if (!['string', 'number'].includes(typeof seed)) throw new TypeError('seed must be a string or number');
  if (!Number.isInteger(maxYears) || maxYears < 1 || maxYears > 50) {
    throw new RangeError('maxYears must be an integer from 1 to 50');
  }
  const counts = countsByAge(seed, maxYears);
  const ctx = { headFactor: counts.headFactor, maxYears };
  const shoots = [];
  for (let sequence = 0; sequence < counts.stems.at(-1); sequence += 1) {
    const birth = counts.stems.findIndex((n) => n > sequence);
    shoots.push(makeStem(seed, sequence, birth, ctx));
  }
  const basalLeaves = [];
  for (let index = 0; index < counts.basal.at(-1); index += 1) {
    const birth = counts.basal.findIndex((n) => n > index);
    const id = `novae:basal:${String(index).padStart(2, '0')}`;
    basalLeaves.push({
      id,
      kind: 'basal',
      birthAgeYears: birth,
      azimuth: index * GOLDEN_ANGLE + randomRange(seed, [id, 'azimuth'], -0.2, 0.2),
      root: Math.sqrt(keyedRandom(seed, id, 'root')),
      sizeFactor: randomRange(seed, [id, 'size'], 0.75, 1),
      elevationSpring: randomRange(seed, [id, 'el-spring'], 0.7, 1.2),
      elevationWinter: randomRange(seed, [id, 'el-winter'], 0.15, 0.5),
      roll: randomRange(seed, [id, 'roll'], -0.3, 0.3),
      witherJitter: randomRange(seed, [id, 'wither'], -7, 7),
      tuftJitter: randomRange(seed, [id, 'tuft'], -5, 5),
    });
  }
  return deepFreeze({
    schemaVersion: 1,
    kind: MODEL_KIND,
    species: NOVAE_ANGLIAE_PROFILE.species,
    cultivar: NOVAE_ANGLIAE_PROFILE.cultivar,
    seed: String(seed),
    maxYears,
    metresPerUnit: NOVAE_ANGLIAE_PROFILE.metresPerUnit,
    counts,
    shoots,
    basalLeaves,
  });
}

function plantMode(phenology, ageYears) {
  const day = phenology.dayOfYear;
  if (day < phenology.calendar.stemBreakEnd) {
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
  const root = pointAlong(parent.points, axis.parentU);
  const sourceRoot = axis.points[0];
  const points = axis.points.map((p) => add(root, scale(subtract(p, sourceRoot), branchScale)));
  return { ...axis, root, points };
}

function localHeadState(head, phenology, cohortAgeYears, dryMode) {
  if (dryMode) {
    const weathering = overwinterWeathering(phenology);
    return {
      visible: head.winterRetention > 0.45 * weathering,
      stage: 'winter',
      budProgress: 1,
      openProgress: 1,
      rayVisibility: 0,
      maturity: 1,
      visualScale: lerp(0.95, 0.85, weathering),
      weathering,
    };
  }
  const day = phenology.dayOfYear;
  const baseOpen =
    OPEN_MEAN_DAY +
    sampleAnchors(BLOOM_SHIFT_ANCHORS, cohortAgeYears) +
    sampleAnchors(BLOOM_SPREAD_ANCHORS, cohortAgeYears) * head.openZ +
    0.4 * head.branchIndex +
    (head.twigIndex > 0 ? 1 : 0);
  const open = Math.max(OPEN_MIN_DAY, Math.min(OPEN_MAX_DAY, baseOpen)) + phenology.shiftDays;
  const budStart = Math.min(open - 16, phenology.calendar.budStart);
  if (day < budStart) return { visible: false };
  const closes = open + head.durationDays;
  const budProgress = progress(day, budStart, open);
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
    rayVisibility = 1 - progress(day, closes, closes + 7);
  }
  return {
    visible: true,
    stage,
    budProgress,
    openProgress,
    rayVisibility,
    maturity: progress(day, open, closes + 40),
    visualScale: day < open ? lerp(0.65, 0.95, smoothstep01(budProgress)) : 1,
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

const crownScaleAt = (age) => sampleAnchors(ARCH.crownRadiusAnchorsM, ageIndex(age)) / ARCH.matureCrownRadiusM;

/** Day (in the cohort's own year, past 365 for the winter after) a leaf lets go. */
function leafDropDay(leaf, calendar, calendarFallDays) {
  if (!leaf.branchLeaf && leaf.fraction < leaf.bareShare) {
    return calendar.lowerLeafDropStart + (leaf.fraction / leaf.bareShare) * 50 * leaf.dropJitter;
  }
  if (leaf.retained) return Infinity;
  return calendar.leafFallStart + leaf.dropOrder * calendarFallDays;
}

function fullLeafLength(leaf, cohortAge) {
  return leaf.lengthM * sampleAnchors(LEAF.ageScaleAnchors, ageIndex(cohortAge));
}

/** A leaf on a standing stem, or null if it has fallen or not yet grown. */
function evaluateStandingLeaf(leaf, ctx) {
  const { mode, axisMap, phenology, cohortAge, stemGrowth, leafExpansion, seed, dropDay, sd } = ctx;
  const position = axisMap.get(leaf.axisId) && pointAlong(axisMap.get(leaf.axisId).points, leaf.parentU);
  if (!position || sd >= dropDay) return null;
  const dead = mode === 'previous-dry' || mode === 'current-dry';
  const local = dead ? 1 : clamp01(0.2 + (stemGrowth - 0.7 * leaf.fraction) / 0.35);
  const expansion = dead ? 1 : smoothstep01(Math.min(leafExpansion, local));
  if (expansion <= 0.01) return null;
  const { direction, normal, outward } = leafFrame(leaf.azimuth, leaf.elevation);
  const wilt = mode === 'previous-dry' ? 1 : smoothstep01(phenology.wiltProgress);
  const hanging = normalize(add(scale(outward, 0.35), vector(0, -0.9, 0)));
  const length = fullLeafLength(leaf, cohortAge) * lerp(0.15, 1, expansion) * (1 - 0.12 * wilt);
  const lowerDrop = !leaf.branchLeaf && leaf.fraction < leaf.bareShare;
  return {
    id: leaf.id,
    visible: true,
    kind: 'stem',
    litter: false,
    position,
    direction: normalize(add(scale(direction, 1 - wilt), scale(hanging, wilt))),
    normal: normalize(add(scale(normal, 1 - wilt), scale(outward, wilt))),
    roll: leaf.roll,
    fraction: leaf.fraction,
    lengthM: length,
    widthM: length * LEAF.widthToLength * LEAF_CARD_ASPECT * (1 - 0.4 * wilt),
    autumnProgress: mode === 'previous-dry' ? 1 : lowerDrop ? 0 : phenology.autumnProgress,
    senescence: lowerDrop ? progress(sd, dropDay - 20, dropDay) : 0,
    wilt,
    tuft: 0,
    seed,
  };
}

/**
 * A fallen leaf lying flat inside the plant spread. It is never cleaned up:
 * it stays from its drop through winter and is covered by new growth after
 * the April emergence. A fast decomposer leaves no litter.
 */
function evaluateLitterLeaf(leaf, ctx) {
  if (LEAF.leafLitterDecomposition === 'fast') return null;
  const { litterAge, seed, summerDrop } = ctx;
  const spreadRadius = sampleAnchors(ARCH.spreadByAgeM, ageIndex(litterAge)) / 2;
  const radius = Math.max(0.02, spreadRadius - 0.05) * Math.sqrt(keyedRandom(seed, leaf.id, 'litter-radius'));
  const around = keyedRandom(seed, leaf.id, 'litter-around') * Math.PI * 2;
  const azimuth = keyedRandom(seed, leaf.id, 'litter-azimuth') * Math.PI * 2;
  const full = fullLeafLength(leaf, litterAge) * LEAF.litterScale;
  const lengthM = Math.min(full, Math.max(0.03, spreadRadius - radius - 0.02));
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
    widthM: lengthM * LEAF.widthToLength * LEAF_CARD_ASPECT * 0.7,
    autumnProgress: summerDrop ? 0.7 : 1,
    senescence: summerDrop ? 1 : 0,
    wilt: 1,
    tuft: 0,
    seed,
  };
}

/** Basal leaf: spring rosette, withered by flowering, a small green tuft from late September. */
function evaluateBasalLeaf(leaf, ctx) {
  const { mode, phenology, rosetteAge, leafExpansion, ageYears, seed } = ctx;
  const day = phenology.dayOfYear;
  const { calendar } = phenology;
  const tuftSize = LEAF.winterTuftSize;
  let size;
  let tuft;
  if (day < calendar.emergenceStart) {
    size = tuftSize;
    tuft = 1;
  } else {
    const floor = leaf.birthAgeYears < ageYears ? tuftSize : ageYears === 0 ? 0.35 : 0;
    const spring = floor + (1 - floor) * smoothstep01(leafExpansion);
    const tuftT = smoothstep01(progress(day, calendar.tuftStart + leaf.tuftJitter, calendar.tuftEnd + leaf.tuftJitter));
    if (ageYears === 0) {
      size = lerp(spring, tuftSize, tuftT);
    } else {
      const wither = smoothstep01(
        progress(day, calendar.basalWitherStart + leaf.witherJitter, calendar.basalWitherEnd + leaf.witherJitter),
      );
      size = Math.max(spring * (1 - wither), tuftSize * tuftT);
    }
    tuft = tuftT;
  }
  if (size <= 0.01) return null;
  const winterness = tuft;
  const elevation = lerp(leaf.elevationSpring, leaf.elevationWinter, winterness);
  const rootRadius = ARCH.matureCrownRadiusM * crownScaleAt(rosetteAge) * leaf.root;
  const { outward, direction, normal } = leafFrame(leaf.azimuth, elevation);
  const lengthM = LEAF.basalLengthM * leaf.sizeFactor * size * sampleAnchors(LEAF.ageScaleAnchors, ageIndex(rosetteAge));
  return {
    id: leaf.id,
    visible: true,
    kind: 'basal',
    litter: false,
    position: vector(outward.x * rootRadius, 0.02, outward.z * rootRadius),
    direction,
    normal,
    roll: leaf.roll,
    fraction: 0,
    lengthM,
    widthM: lengthM * 0.22 * LEAF_CARD_ASPECT,
    autumnProgress: 0,
    senescence: 0,
    wilt: 0,
    tuft,
    seed,
    mode,
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
  let highestHeadM = 0;
  for (const head of heads) {
    heightM = Math.max(heightM, head.position.y + 0.012);
    const reach = Math.hypot(head.position.x, head.position.z) + 0.02;
    radiusM = Math.max(radiusM, reach);
    headRadiusM = Math.max(headRadiusM, reach);
    lowestHeadM = Math.min(lowestHeadM, head.position.y);
    highestHeadM = Math.max(highestHeadM, head.position.y);
  }
  return {
    heightM,
    radiusM,
    spreadM: radiusM * 2,
    baseSpreadM: baseRadiusM * 2,
    headWidthM: headRadiusM * 2,
    lowestHeadFraction: heads.length ? lowestHeadM / heightM : null,
    headZoneFraction: heads.length ? (highestHeadM - lowestHeadM) / heightM : null,
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
export function evaluateNovaeAngliaeModel(
  model,
  { ageYears = 0, dayOfYear = 266, events = [], seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  if (!model || model.kind !== MODEL_KIND) {
    throw new TypeError('Expected a model returned by createNovaeAngliaeModel');
  }
  if (!Number.isInteger(ageYears) || ageYears < 0 || ageYears > model.maxYears) {
    throw new RangeError(`ageYears must be an integer between 0 and ${model.maxYears}`);
  }
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (events.length > 0) {
    throw new RangeError('New England aster exposes no care events; the winter stand and spring breakdown are part of its calendar.');
  }
  const phenology = getNovaeAngliaePhenology(dayOfYear, { seasonProfile, offsetDays });
  const { calendar } = phenology;
  const day = phenology.dayOfYear;
  const mode = plantMode(phenology, ageYears);
  const cohortAge = mode === 'previous-dry' ? Math.max(0, ageYears - 1) : ageYears;
  const dryMode = mode === 'previous-dry' || mode === 'current-dry';
  const ageScale = sampleAnchors(ARCH.stemHeightScaleAnchors, ageIndex(cohortAge));
  const crownRadius = sampleAnchors(ARCH.crownRadiusAnchorsM, ageIndex(cohortAge));
  const crownScale = crownRadius / ARCH.matureCrownRadiusM;
  const stemGrowth = dryMode ? 1 : mode === 'current' ? smoothstep01(phenology.stemGrowthProgress) : 0;
  const emergence = mode === 'current' ? smoothstep01(phenology.emergenceProgress * 4) : 1;
  const primaryGrowth = dryMode ? 1 : Math.max(stemGrowth, 0.1 * emergence);
  const lateralGrowth = dryMode ? 1 : smoothstep01(progress(stemGrowth, 0.7, 1));

  const active = model.shoots.filter((s) => s.birthAgeYears <= cohortAge);
  const axes = [];
  const axisMap = new Map();
  if (mode !== 'dormant') {
    for (const shoot of active) {
      if (
        mode === 'previous-dry' &&
        keyedRandom(model.seed, shoot.id, 'stem-break-order') >= phenology.standingDryVisibility
      ) {
        continue;
      }
      const main = transformPrimaryAxis(shoot.axes[0], crownScale, ageScale * primaryGrowth);
      Object.assign(main, {
        visible: true,
        cohort: dryMode ? 'dry' : 'current',
        weathering: dryMode ? overwinterWeathering(phenology) : 0,
        radiusScale: lerp(0.6, 1, ageScale) * lerp(0.6, 1, primaryGrowth),
      });
      axes.push(main);
      axisMap.set(main.id, main);
      for (const lateral of shoot.axes.slice(1)) {
        if (lateral.birthAgeYears > cohortAge || lateralGrowth <= 0.002) continue;
        const parent = axisMap.get(lateral.parentAxisId);
        if (!parent) continue;
        const branch = transformLateralAxis(lateral, parent, ageScale * lateralGrowth);
        Object.assign(branch, {
          visible: true,
          cohort: dryMode ? 'dry' : 'current',
          weathering: dryMode ? overwinterWeathering(phenology) : 0,
          radiusScale: lerp(0.7, 1, ageScale),
        });
        axes.push(branch);
        axisMap.set(branch.id, branch);
      }
    }
  }

  const leaves = [];
  const leafExpansion = Math.max(phenology.leafProgress, phenology.emergenceProgress * 0.8);
  const fallDays = 100;
  // Last year's cohort lies as litter (or still stands, dead) until covered
  // by growth after the April emergence; this year's fallen leaves from July.
  const previousAge = ageYears - 1;
  const previousLitterAllowed = previousAge >= 0 && day < calendar.emergenceStart + 14;
  for (const shoot of model.shoots) {
    for (const leaf of shoot.leaves) {
      // This year's cohort.
      if (mode !== 'previous-dry' && mode !== 'dormant') {
        if (shoot.birthAgeYears <= ageYears && leaf.birthAgeYears <= ageYears) {
          const dropDay = leafDropDay(leaf, calendar, fallDays);
          const standing = evaluateStandingLeaf(leaf, {
            mode,
            axisMap,
            phenology,
            cohortAge: ageYears,
            stemGrowth: Math.max(stemGrowth, 0.12 * emergence),
            leafExpansion,
            seed: model.seed,
            dropDay,
            sd: day,
          });
          if (standing) {
            leaves.push(standing);
          } else if (day >= dropDay && day >= calendar.lowerLeafDropStart) {
            const fallen = evaluateLitterLeaf(leaf, {
              litterAge: ageYears,
              seed: model.seed,
              summerDrop: !leaf.branchLeaf && leaf.fraction < leaf.bareShare,
            });
            if (fallen) leaves.push(fallen);
          }
        }
      }
      // Last year's cohort.
      if (
        previousLitterAllowed &&
        shoot.birthAgeYears <= previousAge &&
        leaf.birthAgeYears <= previousAge &&
        (day < calendar.emergenceStart ||
          keyedRandom(model.seed, leaf.id, 'litter-cover') * 14 + calendar.emergenceStart > day)
      ) {
        const dropDay = leafDropDay(leaf, calendar, fallDays);
        if (mode === 'previous-dry') {
          const standing = evaluateStandingLeaf(leaf, {
            mode,
            axisMap,
            phenology,
            cohortAge: previousAge,
            stemGrowth: 1,
            leafExpansion: 1,
            seed: model.seed,
            dropDay,
            sd: day + 365,
          });
          if (standing) {
            leaves.push(standing);
            continue;
          }
        }
        const fallen = evaluateLitterLeaf(leaf, {
          litterAge: previousAge,
          seed: model.seed,
          summerDrop: !leaf.branchLeaf && leaf.fraction < leaf.bareShare,
        });
        if (fallen) leaves.push(fallen);
      }
    }
  }
  const rosetteAge = day < calendar.emergenceStart ? ageYears - 1 : ageYears;
  if (rosetteAge >= 0) {
    for (const leaf of model.basalLeaves) {
      if (leaf.birthAgeYears > rosetteAge) continue;
      const evaluated = evaluateBasalLeaf(leaf, {
        mode,
        phenology,
        rosetteAge,
        leafExpansion,
        ageYears,
        seed: model.seed,
      });
      if (evaluated) leaves.push(evaluated);
    }
  }

  const heads = [];
  const headScale = lerp(0.85, 1, ageScale);
  for (const shoot of active) {
    for (const head of shoot.heads) {
      if (head.birthAgeYears > cohortAge) continue;
      const axis = axisMap.get(head.axisId);
      if (!axis) continue;
      const state = localHeadState(head, phenology, cohortAge, dryMode);
      if (!state.visible) continue;
      const tip = tangentAt(axis.points, axis.points.length - 1);
      const position = add(pointAlong(axis.points, head.along), scale(head.offset, ageScale * lateralGrowth));
      const out = normalize(vector(position.x, 0.0001, position.z));
      heads.push({
        id: head.id,
        axisId: head.axisId,
        lateral: head.slot > 0,
        visible: true,
        position,
        // Heads in a panicle face up and outward at all angles, not all skyward.
        direction: normalize(
          add(add(scale(UP, 0.5), scale(out, 0.6)), add(scale(tip, 0.2), vector(head.tiltX * 2, 0, head.tiltZ * 2))),
        ),
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
    dayOfYear: day,
    mode,
    lean: leanStats(axes),
    crown: { radiusM: crownRadius, shootSites: active.length },
    dimensions: dimensionsFor(axes, leaves, heads),
    phenology,
    careHints: getNovaeAngliaeCareHints(day, { seasonProfile, offsetDays }),
    provenance: {
      observedDisplay: NOVAE_ANGLIAE_PROFILE.flowering.observedDisplay,
      sources: NOVAE_ANGLIAE_SOURCES,
      rendererAssumptions: NOVAE_ANGLIAE_RENDER_ASSUMPTIONS,
    },
    shoots: active.map((s) => ({ id: s.id, sequence: s.sequence, birthAgeYears: s.birthAgeYears })),
    axes,
    leaves,
    heads,
    stats,
    appliedEvents: [],
  };
}
