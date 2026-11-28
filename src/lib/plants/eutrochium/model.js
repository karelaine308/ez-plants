import { growWoodyAxis } from '../../woody-axis.js';
import { keyedRandom, keyedRange as randomRange } from '../../keyed-random.js';
import {
  add,
  axisRng,
  clamp01,
  cross,
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
import {
  getMaculatumCareHints,
  getMaculatumPhenology,
} from './phenology.js';
import {
  MACULATUM_PROFILE,
  MACULATUM_RENDER_ASSUMPTIONS,
  MACULATUM_SOURCES,
} from './maculatum.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UP = vector(0, 1, 0);
/** Largest summer bow, the share of stems that stay straight, and winter droop (assumed). */
const BOW_MIN_RADIANS = 0.04;
const BOW_MAX_RADIANS = 0.08;
const BOW_STRAIGHT_SHARE = 0.15;
const VASE_LENGTHENING = 0.01;
/**
 * Radius of the circle holding about 90% of the stem bases, by age (assumed
 * from the owner's description of a 5-year clump: about 8-14 in across at
 * age 5, 5-10 in at age 3, 2-4 in at age 1, a plug at age 0).
 */
const FOOTPRINT_RADIUS_ANCHORS_M = [
  [0, 0.04],
  [1, 0.037],
  [2, 0.065],
  [3, 0.095],
  [5, 0.14],
  [50, 0.14],
];

/** Scale that puts the 90th-percentile stem base on the footprint radius for this age. */
function stemRootScale(shoots, age) {
  if (shoots.length === 0) return 1;
  const radii = shoots.map((s) => Math.hypot(s.axes[0].shootRoot.x, s.axes[0].shootRoot.z)).sort((a, b) => a - b);
  const p90 = radii[Math.max(0, Math.ceil(0.9 * radii.length) - 1)] || 1;
  return sampleAnchors(FOOTPRINT_RADIUS_ANCHORS_M, age) / p90;
}
const DROOP_MAX_RADIANS = 1.9;
const DROOP_UPRIGHT_SHARE = 0.15;
const MODEL_KIND = 'eutrochium-maculatum-growth-model';

function ageAtCount(anchors, target) {
  if (target <= anchors[0][1]) return anchors[0][0];
  for (let index = 1; index < anchors.length; index += 1) {
    const [startAge, startCount] = anchors[index - 1];
    const [endAge, endCount] = anchors[index];
    if (target <= endCount) {
      return Math.ceil(
        lerp(
          startAge,
          endAge,
          (target - startCount) / Math.max(1, endCount - startCount),
        ),
      );
    }
  }
  return anchors.at(-1)[0];
}

function axisFromGrowth({ seed, id, origin, direction, length, radius, sectionCount, gnarliness }) {
  const sections = growWoodyAxis({
    origin,
    orientation: orientationFor(direction),
    length,
    radius,
    sectionCount,
    gnarliness,
    taper: 0.55,
    force: { direction: UP, strength: radius * 0.01 },
    rng: axisRng(seed, id),
  });
  return {
    points: sections.map((section) =>
      vector(section.origin.x, section.origin.y, section.origin.z),
    ),
    radii: sections.map((section) => section.radius),
  };
}

/**
 * Size of a leaf at a given height on the stem: lower leaves somewhat smaller,
 * the largest at mid-stem, the top whorls about half size.
 */
function leafSizeFactor(fraction) {
  const leaf = MACULATUM_PROFILE.leaf;
  if (fraction < 0.4) return lerp(leaf.lowerScale, 1, fraction / 0.4);
  return lerp(1, leaf.upperScale, (fraction - 0.4) / 0.6);
}

function makeLeaf(seed, { id, axisId, pointIndex, azimuth, fraction, birthAgeYears }) {
  const leaf = MACULATUM_PROFILE.leaf;
  const outward = vector(Math.cos(azimuth), 0, Math.sin(azimuth));
  const sideways = vector(-outward.z, 0, outward.x);
  // About 20 degrees above horizontal low on the stem, 40 near the top.
  const lift = lerp(0.36, 0.84, fraction) + randomRange(seed, [id, 'lift'], -0.1, 0.1);
  const direction = normalize(
    add(
      add(outward, scale(UP, lift)),
      scale(sideways, randomRange(seed, [id, 'side'], -0.12, 0.12)),
    ),
  );
  // Blade face mostly upward, width across the whorl tangent.
  const normal = normalize(
    add(
      cross(sideways, direction),
      scale(sideways, randomRange(seed, [id, 'roll-normal'], -0.12, 0.12)),
    ),
  );
  const size = leafSizeFactor(fraction);
  return {
    id,
    axisId,
    pointIndex,
    direction,
    normal,
    lengthM: randomRange(seed, [id, 'length'], ...leaf.midLengthM) * size,
    widthM: randomRange(seed, [id, 'width'], ...leaf.midWidthM) * size,
    roll: randomRange(seed, [id, 'roll'], -0.25, 0.25),
    fraction,
    birthAgeYears,
  };
}

function makeArray(
  seed,
  { id, axisId, birthAgeYears, firstFloweringAgeYears, lateral = false, depth = 0 },
) {
  const array = MACULATUM_PROFILE.inflorescence;
  const diameter = randomRange(seed, [id, 'diameter'], ...array.diameterM);
  const tiltAzimuth = randomRange(seed, [id, 'tilt-azimuth'], 0, Math.PI * 2);
  const tilt = randomRange(seed, [id, 'tilt'], 0.02, lateral ? 0.35 : 0.14);
  return {
    id,
    axisId,
    birthAgeYears,
    firstFloweringAgeYears,
    lateral,
    diameterM: lateral
      ? diameter * randomRange(seed, [id, 'lateral-scale'], ...array.lateralScale)
      : diameter,
    direction: normalize(
      vector(Math.cos(tiltAzimuth) * tilt, 1, Math.sin(tiltAzimuth) * tilt),
    ),
    spin: randomRange(seed, [id, 'spin'], 0, Math.PI * 2),
    // Arrays on one clump open over about a week; side clusters follow,
    // the lower ones a few days later than those just under the tip.
    bloomOffsetDays:
      randomRange(seed, [id, 'bloom-offset'], -4, 4) + (lateral ? 2 + depth * 3 : 0),
    winterRetention: keyedRandom(seed, id, 'winter-retention'),
  };
}

function makeShoot(seed, sequence, birthAgeYears) {
  const architecture = MACULATUM_PROFILE.architecture;
  const stem = MACULATUM_PROFILE.stem;
  const leafProfile = MACULATUM_PROFILE.leaf;
  const id = `maculatum:shoot:${String(sequence).padStart(2, '0')}`;
  const radialFraction = Math.sqrt(
    (sequence + 0.35) / architecture.maximumPrimaryShoots,
  );
  const azimuth =
    sequence * GOLDEN_ANGLE + randomRange(seed, [id, 'azimuth'], -0.25, 0.25);
  const rootRadius = architecture.matureCrownRadiusM * radialFraction;
  const root = vector(
    Math.cos(azimuth) * rootRadius,
    0,
    Math.sin(azimuth) * rootRadius,
  );
  const outward = vector(Math.cos(azimuth), 0, Math.sin(azimuth));
  // A vase (owner's photographs of a mature clump and a nursery cultivar):
  // stems leave one small spot and slant out from near the ground, the outer
  // ones 20-30 degrees from vertical, then curve back toward upright so the
  // heads merge into one dome. The axis itself grows near-vertical and the
  // vase curve is applied at evaluation time, scaled by crowding (vasePoints).
  const direction = UP;
  const height = randomRange(seed, [id, 'height'], ...stem.targetHeightM);
  const radius = randomRange(seed, [id, 'radius'], ...stem.baseRadiusM);
  const mainId = `${id}:axis:main`;
  const mainAxis = {
    id: mainId,
    shootId: id,
    shootRoot: root,
    kind: 'main',
    birthAgeYears,
    parentAxisId: null,
    parentPointIndex: null,
    // Purple spotting differs from stem to stem.
    spotting: randomRange(seed, [id, 'spotting'], 0.35, 1),
    bend: {
      vase: {
        // Lean at the base: inner stems near vertical, outer stems 20-30 degrees.
        thetaBase:
          (3 + 12 * Math.pow(radialFraction, 1.3)) * (Math.PI / 180) * randomRange(seed, [id, 'vase-lean'], 0.85, 1.15),
        // The tip keeps most of the base lean: stems never bend back in.
        thetaTipShare: randomRange(seed, [id, 'vase-tip'], 0.55, 0.75),
        azimuth: azimuth + randomRange(seed, [id, 'vase-azimuth'], -0.35, 0.35),
      },
      // Summer: the upper stem bows under the weight of its flower head (see
      // headLoad), by its own amount and in its own direction.
      bowRadians:
        keyedRandom(seed, id, 'bow-straight') < BOW_STRAIGHT_SHARE
          ? randomRange(seed, [id, 'bow'], 0, 0.1)
          : BOW_MIN_RADIANS + (BOW_MAX_RADIANS - BOW_MIN_RADIANS) * Math.pow(keyedRandom(seed, id, 'bow'), 1.4),
      // Mostly outward-ish but any direction is possible.
      // Outer stems bow a little less, which keeps the vase inside its width.
      bowOuterScale: 1.1 - 0.25 * radialFraction,
      bowStart: randomRange(seed, [id, 'bow-start'], 0.4, 0.7),
      bowAzimuth: azimuth + randomRange(seed, [id, 'bow-azimuth'], -0.5, 0.5),
      // Winter: each stem droops by its own amount, mostly outward; a few stay near upright.
      droopRadians:
        keyedRandom(seed, id, 'droop-upright') < DROOP_UPRIGHT_SHARE
          ? randomRange(seed, [id, 'droop'], 0.05, 0.4)
          : randomRange(seed, [id, 'droop'], 1, DROOP_MAX_RADIANS),
      droopAzimuth: azimuth + randomRange(seed, [id, 'droop-azimuth'], -1.1, 1.1),
    },
    ...axisFromGrowth({
      seed,
      id: mainId,
      origin: root,
      direction,
      length: height,
      radius,
      sectionCount: stem.mainAxisSections,
      gnarliness: 0.00022,
    }),
  };

  const leaves = [];
  const lastPoint = mainAxis.points.length - 1;
  const leafyNodes = Math.min(leafProfile.leafyNodes, lastPoint - 1);
  for (let node = 1; node <= leafyNodes; node += 1) {
    const whorlId = `${id}:whorl:${node}`;
    const count =
      keyedRandom(seed, whorlId, 'count') < 0.55
        ? leafProfile.whorlSize[0]
        : leafProfile.whorlSize[1];
    const fraction = node / lastPoint;
    // Successive whorls offset by half a step, as the leaves of one node
    // fit between those of the node below.
    const start = azimuth + (node % 2) * (Math.PI / count);
    for (let index = 0; index < count; index += 1) {
      leaves.push(
        makeLeaf(seed, {
          id: `${whorlId}:leaf:${index}`,
          axisId: mainId,
          pointIndex: node,
          azimuth:
            start +
            (index / count) * Math.PI * 2 +
            randomRange(seed, [whorlId, 'jitter', index], -0.18, 0.18),
          fraction,
          birthAgeYears,
        }),
      );
    }
  }

  const firstFloweringAgeYears = sequence === 0 ? 0 : Math.max(1, birthAgeYears);
  const axes = [mainAxis];
  const arrays = [
    makeArray(seed, {
      id: `${mainId}:array`,
      axisId: mainId,
      birthAgeYears,
      firstFloweringAgeYears,
    }),
  ];

  // The flowering top is compound: besides the terminal cluster, the upper
  // nodes send out side stalks whose clusters rise to nearly the same height,
  // so each stem ends in one broad, lumpy head and the clump in a dome
  // (botanic-garden photograph of 'Phantom'; Illinois Wildflowers).
  const internode = height / lastPoint;
  for (let depth = 1; depth <= MACULATUM_PROFILE.inflorescence.axillaryNodes; depth += 1) {
    const parentPointIndex = lastPoint - depth;
    const count = depth < 3 || keyedRandom(seed, id, 'laterals', depth) < 0.5 ? 2 : 1;
    for (let lateral = 0; lateral < count; lateral += 1) {
      const lateralId = `${id}:axis:lateral:${depth}:${lateral}`;
      const side =
        azimuth +
        Math.PI * (0.3 + lateral + depth * 0.62) +
        randomRange(seed, [lateralId, 'side'], -0.3, 0.3);
      const sideOut = vector(Math.cos(side), 0, Math.sin(side));
      const lateralBirth = Math.max(1, birthAgeYears);
      const growth = axisFromGrowth({
        seed,
        id: lateralId,
        origin: mainAxis.points[parentPointIndex],
        direction: normalize(
          add(scale(UP, 0.85), scale(sideOut, randomRange(seed, [lateralId, 'out'], 0.35, 0.6))),
        ),
        // Clusters stop at staggered heights below the terminal one, so the
        // flowering top is a deep mass in tiers rather than one flat layer.
        length:
          internode * depth * randomRange(seed, [lateralId, 'reach'], 0.45, 0.72) + 0.03,
        radius: radius * lerp(0.4, 0.5, depth / 3),
        sectionCount: stem.lateralAxisSections,
        gnarliness: 0.0002,
      });
      axes.push({
        id: lateralId,
        shootId: id,
        shootRoot: root,
        kind: 'lateral',
        birthAgeYears: lateralBirth,
        parentAxisId: mainId,
        parentPointIndex,
        spotting: mainAxis.spotting,
        ...growth,
      });
      arrays.push(
        makeArray(seed, {
          id: `${lateralId}:array`,
          axisId: lateralId,
          birthAgeYears: lateralBirth,
          firstFloweringAgeYears: Math.max(firstFloweringAgeYears, lateralBirth),
          lateral: true,
          depth,
        }),
      );
    }
  }

  return { id, sequence, birthAgeYears, root, axes, leaves, arrays };
}

/** Build the finite all-ages crown and annual shoot sites once. */
export function createMaculatumModel({
  seed = 'maculatum-demo',
  maxYears = MACULATUM_PROFILE.architecture.modelHorizonYears,
} = {}) {
  if (!['string', 'number'].includes(typeof seed)) {
    throw new TypeError('seed must be a string or number');
  }
  if (!Number.isInteger(maxYears) || maxYears < 1 || maxYears > 50) {
    throw new RangeError('maxYears must be an integer from 1 to 50');
  }
  const anchors = MACULATUM_PROFILE.architecture.shootCountAnchors;
  const shoots = [];
  for (
    let sequence = 0;
    sequence < MACULATUM_PROFILE.architecture.maximumPrimaryShoots;
    sequence += 1
  ) {
    const birthAgeYears = ageAtCount(anchors, sequence + 1);
    if (birthAgeYears > maxYears) continue;
    shoots.push(makeShoot(seed, sequence, birthAgeYears));
  }
  return deepFreeze({
    schemaVersion: 1,
    kind: MODEL_KIND,
    species: MACULATUM_PROFILE.species,
    cultivar: MACULATUM_PROFILE.cultivar,
    seed: String(seed),
    maxYears,
    metresPerUnit: MACULATUM_PROFILE.metresPerUnit,
    shoots,
  });
}

function plantMode(phenology, ageYears) {
  const day = phenology.dayOfYear;
  if (day < phenology.calendar.cutbackEnd) {
    return ageYears > 0 && phenology.standingDryVisibility > 0.01
      ? 'previous-dry'
      : 'dormant';
  }
  if (day >= phenology.calendar.dryFull) return 'current-dry';
  if (day >= phenology.calendar.emergenceStart) return 'current';
  return 'dormant';
}

/** Days since the stand went fully dry, continuous across New Year. */
function overwinterWeathering(phenology) {
  const { dayOfYear: day, calendar } = phenology;
  const elapsed =
    day >= calendar.dryFull ? day - calendar.dryFull : day + 365 - calendar.dryFull;
  return clamp01(elapsed / 120);
}

/**
 * Bend a stem by turning each segment toward a horizontal azimuth, the turn
 * growing along the stem from `start` (fraction of its length). Segment
 * lengths are kept, so a bent stem is lower, not shorter.
 */
function bendPoints(points, azimuth, radians, start, power) {
  if (radians <= 1e-4) return points;
  const toward = vector(Math.cos(azimuth), 0, Math.sin(azimuth));
  const last = points.length - 1;
  const bent = [points[0]];
  for (let i = 1; i <= last; i += 1) {
    const segment = subtract(points[i], points[i - 1]);
    const length = Math.hypot(segment.x, segment.y, segment.z);
    const t = (i - 0.5) / last;
    const theta = radians * Math.pow(clamp01((t - start) / (1 - start)), power);
    const direction = normalize(segment);
    const turned = normalize(add(scale(direction, Math.cos(theta)), scale(toward, Math.sin(theta))));
    bent.push(add(bent[i - 1], scale(turned, length)));
  }
  return bent;
}

/**
 * How heavy a stem's head is, 0 to 1. Joe Pye heads are big, dense and wet
 * when in bud and bloom, so the load rises with size and openness and peaks
 * at full bloom. Stems do not perk back up once curved (owner), so the load
 * is held at its peak through seed set and winter (assumed).
 */
function headLoad(array, phenology) {
  const state = localArrayState(array, phenology, false);
  if (!state.visible) return 0;
  const openness = 0.4 * state.budProgress + 0.6 * state.openProgress;
  return lerp(0.1, 1, openness * openness);
}

/** How crowded the clump is by age, 0 to 1: young plants stay upright (assumed). */
const crowdingAt = (age) =>
  sampleAnchors(
    [
      [0, 0],
      [1, 0.12],
      [2, 0.5],
      [3, 1],
      [50, 1],
    ],
    age,
  );

/**
 * The vase: each segment is turned from vertical by an angle that holds at the
 * stem's base lean for the first part of its length, then eases back toward
 * upright at the top. Stems are lengthened a little to make up the height an
 * arc loses. Crowding scales the whole curve.
 */
function vasePoints(points, vase, crowd) {
  if (crowd <= 0.001) return points;
  const toward = vector(Math.cos(vase.azimuth), 0, Math.sin(vase.azimuth));
  const last = points.length - 1;
  const out = [points[0]];
  for (let i = 1; i <= last; i += 1) {
    const segment = subtract(points[i], points[i - 1]);
    const length = Math.hypot(segment.x, segment.y, segment.z) * (1 + VASE_LENGTHENING * crowd);
    const t = (i - 0.5) / last;
    const theta = crowd * lerp(vase.thetaBase, vase.thetaBase * vase.thetaTipShare, smoothstep01(progress(t, 0.2, 1)));
    const wiggle = subtract(normalize(segment), UP);
    const direction = normalize(
      add(add(scale(UP, Math.cos(theta)), scale(toward, Math.sin(theta))), wiggle),
    );
    out.push(add(out[i - 1], scale(direction, length)));
  }
  return out;
}

/** Vase curve, summer bow and winter droop of one stem. */
function bendPrimary(axis, { stemGrowth, weathering, headLoad = 0, crowd = 0 }) {
  const { bend } = axis;
  const growth = smoothstep01(stemGrowth);
  const weather = smoothstep01(clamp01(weathering / 0.75));
  let points = bendPoints(vasePoints(axis.points, bend.vase, crowd), bend.bowAzimuth, bend.bowRadians * bend.bowOuterScale * headLoad * growth, 0.4, 1.3);
  points = bendPoints(points, bend.droopAzimuth, bend.droopRadians * weather, 0.4, 1.3);
  return { ...axis, points };
}

function transformPrimaryAxis(axis, crownScale, stemScale) {
  const root = scale(axis.shootRoot, crownScale);
  const points = axis.points.map((point) =>
    add(root, scale(subtract(point, axis.shootRoot), stemScale)),
  );
  return { ...axis, root, points };
}

function transformLateralAxis(axis, parent, branchScale) {
  const root = parent.points[axis.parentPointIndex];
  const sourceRoot = axis.points[0];
  const points = axis.points.map((point) =>
    add(root, scale(subtract(point, sourceRoot), branchScale)),
  );
  return { ...axis, root, points };
}

/**
 * One array's own stage. Arrays open over a few days of each other, bloom for
 * about three weeks, then go to fluffy seed; over winter they darken to bronze
 * and the weakest shatter.
 */
function localArrayState(array, phenology, dryMode) {
  if (dryMode) {
    const weathering = overwinterWeathering(phenology);
    return {
      // By mid-November most heads have shed their seed and broken up; the
      // rest stand as small dark tufts (owner's photograph, 15 November).
      visible: array.winterRetention > 0.35 + weathering * 0.55,
      stage: 'winter',
      budProgress: 1,
      openProgress: 1,
      fadeProgress: 1,
      seedProgress: 1,
      visualScale: lerp(0.7, 0.55, weathering),
      weathering,
    };
  }
  const { dayOfYear: day, calendar } = phenology;
  const offset = Math.round(array.bloomOffsetDays);
  const budStart = calendar.budStart + offset;
  const floweringStart = calendar.floweringStart + offset;
  const fadeStart = calendar.fadeStart + offset;
  const seedStart = calendar.seedHeadStart + offset;
  const floweringEnd = calendar.floweringEnd + offset;
  if (day < budStart) return { visible: false };

  const budProgress = progress(day, budStart, floweringStart);
  const openProgress = progress(day, floweringStart, floweringStart + 12);
  const fadeProgress = progress(day, fadeStart, floweringEnd);
  const seedProgress = progress(day, seedStart, floweringEnd + 20);
  // Buds start as a tight knot and broaden into the flat array as they open;
  // the pappus fluffs the seed head out slightly again.
  const visualScale =
    lerp(0.42, 0.9, smoothstep01(budProgress)) +
    0.1 * smoothstep01(openProgress) +
    0.06 * smoothstep01(seedProgress);
  const stage =
    day < floweringStart
      ? 'bud'
      : openProgress < 0.95
        ? 'opening'
        : fadeProgress < 0.2
          ? 'open'
          : seedProgress < 0.5
            ? 'fading'
            : 'seed';
  return {
    visible: true,
    stage,
    budProgress,
    openProgress,
    fadeProgress,
    seedProgress,
    visualScale,
    weathering: phenology.dryProgress,
  };
}

/** Share of frost-killed leaves that never let go before the spring cutback. */
const DEAD_LEAF_RETAINED = 0.15;

/**
 * A leaf that has dropped lies where it landed, under its own node. The beds
 * are never tidied: litter stays through winter and the cutback, and is only
 * left undrawn once the new shoots emerge over it. A fast decomposer would
 * leave bare ground instead.
 */
function fallenLeaf(leaf, node, { ageScale, phenology, seed, fellInSummer }) {
  if (MACULATUM_PROFILE.leaf.leafLitterDecomposition === 'fast') return null;
  const azimuth = randomRange(seed, [leaf.id, 'ground-azimuth'], 0, Math.PI * 2);
  const reach = leaf.lengthM * ageScale * randomRange(seed, [leaf.id, 'ground-reach'], 0.1, 0.9);
  const outwardX = leaf.direction.x;
  const outwardZ = leaf.direction.z;
  const outwardLength = Math.hypot(outwardX, outwardZ) || 1;
  const position = vector(
    node.x + (outwardX / outwardLength) * reach + randomRange(seed, [leaf.id, 'gx'], -0.06, 0.06),
    0.004 + randomRange(seed, [leaf.id, 'gy'], 0, 0.012),
    node.z + (outwardZ / outwardLength) * reach + randomRange(seed, [leaf.id, 'gz'], -0.06, 0.06),
  );
  const tilt = randomRange(seed, [leaf.id, 'ground-tilt'], -0.18, 0.18);
  return {
    id: leaf.id,
    visible: true,
    fallen: true,
    position,
    direction: normalize(vector(Math.cos(azimuth), tilt * 0.4, Math.sin(azimuth))),
    normal: normalize(vector(tilt, 1, -tilt * 0.5)),
    roll: 0,
    fraction: leaf.fraction,
    // Shrivelled: curled edges make a dead leaf narrower than it grew.
    lengthM: leaf.lengthM * ageScale * 0.85,
    widthM: leaf.widthM * ageScale * 0.5,
    autumnProgress: 1,
    lowerYellowing: 0,
    wilt: 1,
    fellInSummer,
  };
}

function evaluateLeaf(
  leaf,
  { standingAxes, groundAxes },
  { mode, ageScale, leafExpansion, stemGrowth, phenology, seed, winterLitter = false },
) {
  if (winterLitter) {
    // After the cutback, before emergence: every leaf of last year's stand is on the ground.
    const ground = groundAxes.get(leaf.axisId)?.points[leaf.pointIndex];
    return ground ? fallenLeaf(leaf, ground, { ageScale, phenology, seed, fellInSummer: false }) : null;
  }
  if (mode === 'dormant') return null;
  const dryMode = mode === 'previous-dry' || mode === 'current-dry';
  const node = groundAxes.get(leaf.axisId)?.points[leaf.pointIndex];
  if (!node) return null;

  // Lowest whorls yellow and drop in late summer, shaded out by the canopy.
  const lowerDrop =
    leaf.fraction < 0.3 &&
    keyedRandom(seed, leaf.id, 'lower-drop') <
      phenology.lowerLeafDropProgress * (1 - leaf.fraction / 0.3) * 0.85;
  // Frost-killed leaves let go through late autumn and winter; a share hang
  // on until the cutback.
  const deadDrop =
    keyedRandom(seed, leaf.id, 'dead-drop') <
    phenology.deadLeafDropProgress * (1 - DEAD_LEAF_RETAINED);
  if (lowerDrop || deadDrop) {
    return fallenLeaf(leaf, node, { ageScale, phenology, seed, fellInSummer: lowerDrop && !deadDrop });
  }

  if (!dryMode && (mode !== 'current' || leafExpansion <= 0.01)) return null;
  const position = standingAxes.get(leaf.axisId)?.points[leaf.pointIndex];
  // Its stem has been cut: a leaf still hanging on it falls to the ground.
  if (!position) return fallenLeaf(leaf, node, { ageScale, phenology, seed, fellInSummer: false });

  // Every whorl is present on the shoot from the start, folded small at the
  // tip, and unfolds from the bottom up as the stem elongates. A whorl near
  // the top is still a quarter-size tuft when the stem is half grown.
  const local = dryMode ? 1 : clamp01(0.2 + (stemGrowth - 0.7 * leaf.fraction) / 0.35);
  const expansion = dryMode ? 1 : smoothstep01(Math.min(leafExpansion, local));

  // After frost the blade goes limp and hangs straight down the stem, edges
  // curling (owner's photograph, 15 November).
  const wilt = smoothstep01(phenology.wiltProgress);
  let direction = leaf.direction;
  let normal = leaf.normal;
  if (wilt > 0) {
    const outwardLength = Math.hypot(leaf.direction.x, leaf.direction.z) || 1;
    const outward = vector(leaf.direction.x / outwardLength, 0, leaf.direction.z / outwardLength);
    const hanging = normalize(add(scale(outward, 0.16), vector(0, -1, 0)));
    direction = normalize(add(scale(leaf.direction, 1 - wilt), scale(hanging, wilt)));
    normal = normalize(add(scale(leaf.normal, 1 - wilt), scale(outward, wilt)));
  }
  return {
    id: leaf.id,
    visible: true,
    fallen: false,
    position,
    direction,
    normal,
    roll: leaf.roll,
    fraction: leaf.fraction,
    lengthM: leaf.lengthM * ageScale * lerp(0.15, 1, expansion) * (1 - 0.12 * wilt),
    widthM: leaf.widthM * ageScale * lerp(0.3, 1, expansion) * (1 - 0.5 * wilt),
    autumnProgress: phenology.autumnProgress,
    lowerYellowing: leaf.fraction < 0.3 ? phenology.lowerLeafDropProgress : 0,
    wilt,
    fellInSummer: false,
  };
}

function dimensionsFor(axes, leaves, arrays) {
  let heightM = 0;
  let radiusM = 0;
  for (const axis of axes) {
    for (const point of axis.points) {
      heightM = Math.max(heightM, point.y);
      radiusM = Math.max(radiusM, Math.hypot(point.x, point.z));
    }
  }
  for (const leaf of leaves) {
    const tip = add(leaf.position, scale(leaf.direction, leaf.lengthM));
    heightM = Math.max(heightM, tip.y);
    radiusM = Math.max(radiusM, Math.hypot(tip.x, tip.z) + leaf.widthM * 0.5);
  }
  for (const array of arrays) {
    heightM = Math.max(heightM, array.position.y + array.diameterM * 0.12);
    radiusM = Math.max(
      radiusM,
      Math.hypot(array.position.x, array.position.z) + array.diameterM * 0.5,
    );
  }
  return { heightM, radiusM, spreadM: radiusM * 2 };
}

/** Evaluate the immutable crown at one age and calendar day. */
export function evaluateMaculatumModel(
  model,
  { ageYears = 0, dayOfYear = 212, events = [], seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  if (!model || model.kind !== MODEL_KIND) {
    throw new TypeError('Expected a model returned by createMaculatumModel');
  }
  if (!Number.isInteger(ageYears) || ageYears < 0 || ageYears > model.maxYears) {
    throw new RangeError(`ageYears must be an integer between 0 and ${model.maxYears}`);
  }
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (events.length > 0) {
    throw new RangeError(
      'Joe Pye weed exposes no care events; the winter stand and spring cutback are part of its calendar.',
    );
  }

  const phenology = getMaculatumPhenology(dayOfYear, { seasonProfile, offsetDays });
  const mode = plantMode(phenology, ageYears);
  // Before spring cutback the standing stems are last year's growth.
  const cohortAgeYears = mode === 'previous-dry' ? Math.max(0, ageYears - 1) : ageYears;
  const ageScale = sampleAnchors(MACULATUM_PROFILE.growth.plantAgeScaleAnchors, cohortAgeYears);
  const crownRadius = sampleAnchors(
    MACULATUM_PROFILE.architecture.crownRadiusAnchorsM,
    cohortAgeYears,
  );
  const crowd = crowdingAt(cohortAgeYears);
  // Stem bases fill a disc of about 8-14 in across at maturity (see FOOTPRINT_RADIUS_ANCHORS_M).
  const crownScale = stemRootScale(
    model.shoots.filter((shoot) => shoot.birthAgeYears <= cohortAgeYears),
    cohortAgeYears,
  );
  const dryMode = mode === 'previous-dry' || mode === 'current-dry';
  const stemGrowth = dryMode
    ? 1
    : mode === 'current'
      ? smoothstep01(phenology.stemGrowthProgress)
      : 0;
  // A shoot is a short leafy tuft before it bolts: give it a tenth of its
  // height as soon as it emerges so the first whorls have somewhere to sit.
  const emergence = mode === 'current' ? smoothstep01(phenology.emergenceProgress * 4) : 1;
  const primaryScale = ageScale * Math.max(stemGrowth, 0.1 * emergence);
  const lateralGrowth = dryMode ? 1 : smoothstep01(progress(stemGrowth, 0.75, 1));
  const lateralScale = ageScale * lateralGrowth;
  const weathering = dryMode ? overwinterWeathering(phenology) : 0;

  const activeShoots = model.shoots.filter((shoot) => shoot.birthAgeYears <= cohortAgeYears);
  const axes = [];
  const axisMap = new Map();
  for (const shoot of activeShoots) {
    if (
      mode === 'previous-dry' &&
      keyedRandom(model.seed, shoot.id, 'spring-cutback-order') >=
        phenology.standingDryVisibility
    ) {
      continue;
    }
    if (mode === 'dormant') continue;
    const primary = shoot.axes[0];
    const terminal = shoot.arrays.find((a) => a.axisId === primary.id);
    const evaluated = bendPrimary(transformPrimaryAxis(primary, crownScale, primaryScale), {
      stemGrowth,
      weathering,
      // Once the stand is dry the curve set at bloom is kept.
      headLoad: !terminal ? 0 : dryMode ? 1 : headLoad(terminal, phenology),
      crowd,
    });
    Object.assign(evaluated, {
      visible: true,
      cohort: dryMode ? 'dry' : 'current',
      weathering,
      radiusScale: ageScale * lerp(0.55, 1, stemGrowth),
    });
    axes.push(evaluated);
    axisMap.set(evaluated.id, evaluated);
    for (const lateral of shoot.axes.slice(1)) {
      if (lateral.birthAgeYears > cohortAgeYears || lateralScale <= 0.002) continue;
      const parent = axisMap.get(lateral.parentAxisId);
      if (!parent) continue;
      const branch = transformLateralAxis(lateral, parent, lateralScale);
      Object.assign(branch, {
        visible: true,
        cohort: dryMode ? 'dry' : 'current',
        weathering,
        radiusScale: ageScale * lerp(0.5, 1, lateralGrowth),
      });
      axes.push(branch);
      axisMap.set(branch.id, branch);
    }
  }

  // Where each node is, whether or not its stem still stands: a leaf that fell
  // before the cutback stays where it landed after the stem is gone.
  const groundAxes = new Map();
  if (mode !== 'dormant') {
    for (const shoot of activeShoots) {
      const primary = shoot.axes[0];
      groundAxes.set(
        primary.id,
        axisMap.get(primary.id) ??
          bendPrimary(transformPrimaryAxis(primary, crownScale, primaryScale), {
            stemGrowth,
            weathering,
            headLoad: dryMode ? 1 : 0,
            crowd,
          }),
      );
    }
  }
  const leaves = [];
  const leafExpansion = Math.max(phenology.leafProgress, phenology.emergenceProgress * 0.8);
  for (const shoot of activeShoots) {
    for (const leaf of shoot.leaves) {
      const evaluated = evaluateLeaf(leaf, { standingAxes: axisMap, groundAxes }, {
        mode,
        ageScale,
        leafExpansion,
        stemGrowth: Math.max(stemGrowth, 0.12 * emergence),
        phenology,
        seed: model.seed,
      });
      if (evaluated) leaves.push(evaluated);
    }
  }
  // Between the cutback and emergence the stems are gone but last year's
  // leaves still lie where they fell.
  if (mode === 'dormant' && ageYears > 0 && phenology.dayOfYear < phenology.calendar.emergenceStart) {
    const litterAge = ageYears - 1;
    const litterAgeScale = sampleAnchors(MACULATUM_PROFILE.growth.plantAgeScaleAnchors, litterAge);
    const litterCrowd = crowdingAt(litterAge);
    const litterShoots = model.shoots.filter((shoot) => shoot.birthAgeYears <= litterAge);
    const litterCrownScale = stemRootScale(litterShoots, litterAge);
    const litterAxes = new Map();
    for (const shoot of litterShoots) {
      const primary = shoot.axes[0];
      litterAxes.set(
        primary.id,
        bendPrimary(transformPrimaryAxis(primary, litterCrownScale, litterAgeScale), {
          stemGrowth: 1,
          weathering: 1,
          headLoad: 1,
          crowd: litterCrowd,
        }),
      );
    }
    for (const shoot of litterShoots) {
      for (const leaf of shoot.leaves) {
        const evaluated = evaluateLeaf(leaf, { standingAxes: new Map(), groundAxes: litterAxes }, {
          mode,
          ageScale: litterAgeScale,
          leafExpansion: 0,
          stemGrowth: 0,
          phenology,
          seed: model.seed,
          winterLitter: true,
        });
        if (evaluated) leaves.push(evaluated);
      }
    }
  }

  const arrays = [];
  for (const shoot of activeShoots) {
    for (const array of shoot.arrays) {
      if (array.firstFloweringAgeYears > cohortAgeYears) continue;
      const axis = axisMap.get(array.axisId);
      if (!axis) continue;
      const state = localArrayState(array, phenology, dryMode);
      if (!state.visible) continue;
      const stemDirection = tangentAt(axis.points, axis.points.length - 1);
      arrays.push({
        id: array.id,
        axisId: array.axisId,
        lateral: array.lateral,
        visible: true,
        position: axis.points.at(-1),
        direction: normalize(add(scale(array.direction, 0.7), scale(stemDirection, 0.3))),
        spin: array.spin,
        diameterM: array.diameterM * lerp(0.7, 1, ageScale) * state.visualScale,
        ...state,
      });
    }
  }

  const visibleStems = axes.filter((axis) => axis.kind === 'main').length;
  const stats = {
    visibleShoots: visibleStems,
    visibleStems,
    visibleAxes: axes.length,
    visibleLeaves: leaves.length,
    visibleLitterLeaves: leaves.filter((l) => l.fallen).length,
    visibleHeads: arrays.length,
    visibleFlowers: arrays.filter((a) => a.stage === 'open' || a.stage === 'opening').length,
    visibleFlowerBuds: arrays.filter((a) => a.stage === 'bud').length,
    visibleSeedHeads: arrays.filter((a) => a.stage === 'seed' || a.stage === 'winter').length,
    flowersOnCurrentSeasonStems: true,
  };

  return {
    species: model.species,
    cultivar: model.cultivar,
    seed: model.seed,
    ageYears,
    dayOfYear: phenology.dayOfYear,
    mode,
    crown: { radiusM: crownRadius, shootSites: activeShoots.length },
    dimensions: dimensionsFor(axes, leaves, arrays),
    phenology,
    careHints: getMaculatumCareHints(phenology.dayOfYear, { seasonProfile, offsetDays }),
    provenance: {
      observedDisplay: MACULATUM_PROFILE.flowering.observedDisplay,
      sources: MACULATUM_SOURCES,
      rendererAssumptions: MACULATUM_RENDER_ASSUMPTIONS,
    },
    shoots: activeShoots.map((shoot) => ({
      id: shoot.id,
      sequence: shoot.sequence,
      birthAgeYears: shoot.birthAgeYears,
    })),
    axes,
    leaves,
    heads: arrays,
    stats,
    appliedEvents: [],
  };
}
