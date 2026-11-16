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
  getPinnataCareHints,
  getPinnataPhenology,
  PINNATA_PHASE_ASSUMPTIONS,
} from './phenology.js';
import {
  PINNATA_PROFILE,
  PINNATA_RENDER_ASSUMPTIONS,
  PINNATA_SOURCES,
} from './pinnata.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UP = vector(0, 1, 0);
const MODEL_KIND = 'ratibida-pinnata-growth-model';

/** Share of frost-killed stem leaves that stay on until the spring cutback. */
const DEAD_LEAF_RETAINED = 0.03;

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
    taper: 0.5,
    force: { direction: UP, strength: radius * 0.012 },
    rng: axisRng(seed, id),
  });
  return {
    points: sections.map((section) =>
      vector(section.origin.x, section.origin.y, section.origin.z),
    ),
    radii: sections.map((section) => section.radius),
  };
}

/** Stem leaves are largest low on the stem and shrink toward the head. */
function leafSizeFactor(fraction) {
  const leaf = PINNATA_PROFILE.leaf;
  if (fraction < 0.3) return lerp(leaf.lowerScale, 1, fraction / 0.3);
  return lerp(1, leaf.upperScale, (fraction - 0.3) / 0.7);
}

function makeStemLeaf(
  seed,
  { id, axisId, pointIndex, azimuth, fraction, birthAgeYears, sizeScale = 1 },
) {
  const leaf = PINNATA_PROFILE.leaf;
  const outward = vector(Math.cos(azimuth), 0, Math.sin(azimuth));
  const sideways = vector(-outward.z, 0, outward.x);
  // Leaves climb the stem: spread wide low down, held closer to it above.
  const lift = lerp(0.3, 0.85, fraction) + randomRange(seed, [id, 'lift'], -0.12, 0.12);
  const direction = normalize(
    add(
      add(outward, scale(UP, lift)),
      scale(sideways, randomRange(seed, [id, 'side'], -0.1, 0.1)),
    ),
  );
  const normal = normalize(
    add(
      cross(sideways, direction),
      scale(sideways, randomRange(seed, [id, 'roll-normal'], -0.12, 0.12)),
    ),
  );
  const size = leafSizeFactor(fraction) * sizeScale;
  return {
    id,
    axisId,
    pointIndex,
    direction,
    normal,
    lengthM: randomRange(seed, [id, 'length'], ...leaf.stemLengthM) * size,
    // Upper leaves narrow faster than they shorten, reading as plain lances.
    widthM: randomRange(seed, [id, 'width'], ...leaf.stemWidthM) * size * (0.5 + 0.5 * size),
    roll: randomRange(seed, [id, 'roll'], -0.25, 0.25),
    fraction,
    birthAgeYears,
    rosette: false,
  };
}

function makeRosetteLeaf(seed, { id, sequence, birthAgeYears }) {
  const leaf = PINNATA_PROFILE.leaf;
  const architecture = PINNATA_PROFILE.architecture;
  const azimuth =
    sequence * GOLDEN_ANGLE + randomRange(seed, [id, 'azimuth'], -0.2, 0.2);
  const rootRadius =
    architecture.matureCrownRadiusM *
    Math.sqrt((sequence + 0.4) / architecture.maximumRosetteLeaves);
  const root = vector(Math.cos(azimuth) * rootRadius, 0.012, Math.sin(azimuth) * rootRadius);
  const outward = vector(Math.cos(azimuth), 0, Math.sin(azimuth));
  const sideways = vector(-outward.z, 0, outward.x);
  // Long-stalked leaves arch out of the crown at about 25-55 degrees up.
  const lift = randomRange(seed, [id, 'lift'], 0.35, 0.85);
  const direction = normalize(add(outward, scale(UP, lift)));
  const normal = normalize(cross(sideways, direction));
  return {
    id,
    sequence,
    birthAgeYears,
    root,
    direction,
    normal,
    lengthM: randomRange(seed, [id, 'length'], ...leaf.rosetteLengthM),
    widthM: randomRange(seed, [id, 'width'], ...leaf.rosetteWidthM),
    roll: randomRange(seed, [id, 'roll'], -0.3, 0.3),
    weathering: keyedRandom(seed, id, 'rosette-age'),
  };
}

function makeHead(
  seed,
  { id, axisId, birthAgeYears, firstFloweringAgeYears, lateral = false, depth = 0 },
) {
  const head = PINNATA_PROFILE.flowerHead;
  const tiltAzimuth = randomRange(seed, [id, 'tilt-azimuth'], 0, Math.PI * 2);
  // Heads tilt a little outward from the stem rather than facing straight up.
  const tilt = randomRange(seed, [id, 'tilt'], 0.08, 0.5);
  return {
    id,
    axisId,
    birthAgeYears,
    firstFloweringAgeYears,
    lateral,
    spanM: randomRange(seed, [id, 'span'], ...head.horizontalSpanM),
    direction: normalize(
      vector(Math.cos(tiltAzimuth) * tilt, 1, Math.sin(tiltAzimuth) * tilt),
    ),
    spin: randomRange(seed, [id, 'spin'], 0, Math.PI * 2),
    // The terminal heads open first; side heads follow over the next weeks,
    // which is what stretches one plant's bloom from July to October.
    bloomOffsetDays: lateral
      ? 28 + depth * 14 + randomRange(seed, [id, 'bloom-offset'], 0, 18)
      : 72 * Math.pow(keyedRandom(seed, id, 'bloom-order'), 1.5),
    winterRetention: keyedRandom(seed, id, 'winter-retention'),
  };
}

function makeShoot(seed, sequence, birthAgeYears) {
  const architecture = PINNATA_PROFILE.architecture;
  const stem = PINNATA_PROFILE.stem;
  const id = `pinnata:shoot:${String(sequence).padStart(2, '0')}`;
  const radialFraction = Math.sqrt(
    (sequence + 0.35) / architecture.maximumPrimaryShoots,
  );
  const azimuth =
    sequence * GOLDEN_ANGLE + randomRange(seed, [id, 'azimuth'], -0.25, 0.25);
  const rootRadius = architecture.matureCrownRadiusM * radialFraction;
  const root = vector(Math.cos(azimuth) * rootRadius, 0, Math.sin(azimuth) * rootRadius);
  const outward = vector(Math.cos(azimuth), 0, Math.sin(azimuth));
  // Mostly upright: a small outward lean, a little more for the outer stems.
  const lean =
    randomRange(seed, [id, 'lean'], 0.03, 0.07) + 0.18 * radialFraction * radialFraction;
  const direction = normalize(add(UP, scale(outward, lean)));
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
    ...axisFromGrowth({
      seed,
      id: mainId,
      origin: root,
      direction,
      length: height,
      radius,
      sectionCount: stem.mainAxisSections,
      gnarliness: 0.0002,
    }),
  };

  const leaves = [];
  const lastPoint = mainAxis.points.length - 1;
  const leafyNodes = Math.min(stem.leafyNodes, lastPoint - 1);
  for (let node = 1; node <= leafyNodes; node += 1) {
    leaves.push(
      makeStemLeaf(seed, {
        id: `${id}:leaf:${node}`,
        axisId: mainId,
        pointIndex: node,
        // Alternate: one leaf a node, each turned a golden angle from the last.
        azimuth:
          azimuth +
          node * GOLDEN_ANGLE +
          randomRange(seed, [id, 'leaf-jitter', node], -0.2, 0.2),
        fraction: node / lastPoint,
        birthAgeYears,
      }),
    );
    // A smaller leaf tuft in the axil of the lower nodes thickens the foliage
    // where sources put it; higher up the leaves are few and small.
    if (node <= 4) {
      leaves.push(
        makeStemLeaf(seed, {
          id: `${id}:leaf:${node}:axil`,
          axisId: mainId,
          pointIndex: node,
          azimuth:
            azimuth +
            node * GOLDEN_ANGLE +
            2.3 +
            randomRange(seed, [id, 'axil-jitter', node], -0.3, 0.3),
          fraction: node / lastPoint,
          birthAgeYears,
          sizeScale: 0.62,
        }),
      );
    }
  }

  const firstFloweringAgeYears = Math.max(1, birthAgeYears);
  const axes = [mainAxis];
  const heads = [
    makeHead(seed, {
      id: `${mainId}:head`,
      axisId: mainId,
      birthAgeYears,
      firstFloweringAgeYears,
    }),
  ];

  // Stems branch only near the top: about one in eight forks to carry a second
  // head on a long bare stalk, a little lower than the terminal one.
  const mainTop = mainAxis.points[lastPoint];
  for (let depth = 1; depth <= 2; depth += 1) {
    if (keyedRandom(seed, id, 'fork', depth) >= 0.12) continue;
    const parentPointIndex = lastPoint - depth - 1;
    const parent = mainAxis.points[parentPointIndex];
    const lateralId = `${id}:axis:lateral:${depth}`;
    const side =
      azimuth +
      Math.PI * (0.4 + depth * 0.7) +
      randomRange(seed, [lateralId, 'side'], -0.3, 0.3);
    const sideOut = vector(Math.cos(side), 0, Math.sin(side));
    const reach =
      Math.max(0.05, (mainTop.y - parent.y) * randomRange(seed, [lateralId, 'reach'], 0.78, 0.97)) /
      0.9;
    const lateralBirth = Math.max(1, birthAgeYears);
    const growth = axisFromGrowth({
      seed,
      id: lateralId,
      origin: parent,
      direction: normalize(
        add(scale(UP, 0.9), scale(sideOut, randomRange(seed, [lateralId, 'out'], 0.25, 0.5))),
      ),
      length: reach,
      radius: radius * 0.55,
      sectionCount: stem.lateralAxisSections,
      gnarliness: 0.00018,
    });
    axes.push({
      id: lateralId,
      shootId: id,
      shootRoot: root,
      kind: 'lateral',
      birthAgeYears: lateralBirth,
      parentAxisId: mainId,
      parentPointIndex,
      ...growth,
    });
    heads.push(
      makeHead(seed, {
        id: `${lateralId}:head`,
        axisId: lateralId,
        birthAgeYears: lateralBirth,
        firstFloweringAgeYears: Math.max(firstFloweringAgeYears, lateralBirth),
        lateral: true,
        depth,
      }),
    );
  }

  return { id, sequence, birthAgeYears, root, axes, leaves, heads };
}

/** Build the finite all-ages crown, rosette and annual stem sites once. */
export function createPinnataModel({
  seed = 'pinnata-demo',
  maxYears = PINNATA_PROFILE.architecture.modelHorizonYears,
} = {}) {
  if (!['string', 'number'].includes(typeof seed)) {
    throw new TypeError('seed must be a string or number');
  }
  if (!Number.isInteger(maxYears) || maxYears < 1 || maxYears > 50) {
    throw new RangeError('maxYears must be an integer from 1 to 50');
  }
  const architecture = PINNATA_PROFILE.architecture;
  const shoots = [];
  for (let sequence = 0; sequence < architecture.maximumPrimaryShoots; sequence += 1) {
    const birthAgeYears = ageAtCount(architecture.shootCountAnchors, sequence + 1);
    if (birthAgeYears > maxYears) continue;
    shoots.push(makeShoot(seed, sequence, birthAgeYears));
  }
  const rosette = [];
  for (let sequence = 0; sequence < architecture.maximumRosetteLeaves; sequence += 1) {
    const birthAgeYears = ageAtCount(architecture.rosetteLeafAnchors, sequence + 1);
    if (birthAgeYears > maxYears) continue;
    rosette.push(
      makeRosetteLeaf(seed, {
        id: `pinnata:rosette:${String(sequence).padStart(2, '0')}`,
        sequence,
        birthAgeYears,
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
    shoots,
    rosette,
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
 * One head's own stage. A head opens, flowers for about three weeks, drops its
 * rays, and its cone darkens to near black over the next month. Heads on one
 * plant open over weeks of each other. Over winter the cones stand on bare
 * stems and the weakest break away.
 */
function localHeadState(head, phenology, dryMode) {
  if (dryMode) {
    const weathering = overwinterWeathering(phenology);
    return {
      // Most cones stay on their stems through winter (goldfinches take the
      // seed, not the cone); a few break away.
      visible: head.winterRetention > 0.1 + weathering * 0.4,
      stage: 'winter',
      budProgress: 1,
      openProgress: 1,
      rayVisibility: 0,
      darkenProgress: 1,
      visualScale: lerp(0.98, 0.9, weathering),
      weathering,
    };
  }
  const { dayOfYear: day, calendar } = phenology;
  const timing = PINNATA_PHASE_ASSUMPTIONS.head;
  const offset = Math.round(head.bloomOffsetDays);
  const openStart = calendar.floweringStart + offset;
  const budStart = Math.min(calendar.budStart + Math.round(offset * 0.4), openStart - 14);
  const bloomEnd = openStart + timing.bloomDays;
  const dropEnd = bloomEnd + timing.dropDays;
  if (day < budStart) return { visible: false };

  const budProgress = progress(day, budStart, openStart);
  const openProgress = progress(day, openStart, openStart + timing.openDays);
  const dropProgress = progress(day, bloomEnd, dropEnd);
  const darkenProgress = progress(day, bloomEnd - 6, dropEnd + timing.darkenDays);
  const stage =
    day < openStart
      ? 'bud'
      : openProgress < 0.95
        ? 'opening'
        : day < bloomEnd
          ? 'open'
          : dropProgress < 1
            ? 'fading'
            : 'seed';
  const rayVisibility = stage === 'bud' ? 0 : smoothstep01(openProgress) * (1 - smoothstep01(dropProgress));
  // A bud is a small gray-green cone; it fills out as it opens, and the ripe
  // cone is a touch plumper than the bud.
  const visualScale =
    stage === 'bud'
      ? lerp(0.45, 0.8, smoothstep01(budProgress))
      : lerp(0.8, 1, smoothstep01(openProgress)) + 0.04 * smoothstep01(darkenProgress);
  return {
    visible: true,
    stage,
    budProgress,
    openProgress,
    rayVisibility,
    darkenProgress,
    visualScale,
    weathering: phenology.dryProgress,
  };
}

/**
 * A leaf that has dropped lies where it landed, under its own node, until the
 * spring cleanup clears it along with the old stems.
 */
function fallenLeaf(leaf, node, { ageScale, phenology, seed, fellInSummer }) {
  if (
    phenology.dayOfYear < phenology.calendar.cutbackEnd &&
    keyedRandom(seed, leaf.id, 'ground-clear') >= phenology.standingDryVisibility
  ) {
    return null;
  }
  const azimuth = randomRange(seed, [leaf.id, 'ground-azimuth'], 0, Math.PI * 2);
  const reach = leaf.lengthM * ageScale * randomRange(seed, [leaf.id, 'ground-reach'], 0.1, 0.9);
  const outwardLength = Math.hypot(leaf.direction.x, leaf.direction.z) || 1;
  const position = vector(
    node.x + (leaf.direction.x / outwardLength) * reach + randomRange(seed, [leaf.id, 'gx'], -0.05, 0.05),
    0.004 + randomRange(seed, [leaf.id, 'gy'], 0, 0.01),
    node.z + (leaf.direction.z / outwardLength) * reach + randomRange(seed, [leaf.id, 'gz'], -0.05, 0.05),
  );
  const tilt = randomRange(seed, [leaf.id, 'ground-tilt'], -0.18, 0.18);
  return {
    id: leaf.id,
    visible: true,
    fallen: true,
    rosette: false,
    position,
    direction: normalize(vector(Math.cos(azimuth), tilt * 0.4, Math.sin(azimuth))),
    normal: normalize(vector(tilt, 1, -tilt * 0.5)),
    roll: 0,
    fraction: leaf.fraction,
    lengthM: leaf.lengthM * ageScale * 0.85,
    widthM: leaf.widthM * ageScale * 0.55,
    autumnProgress: 1,
    lowerYellowing: 0,
    wilt: 1,
    fellInSummer,
  };
}

function evaluateStemLeaf(
  leaf,
  { standingAxes, groundAxes },
  { mode, ageScale, leafExpansion, stemGrowth, phenology, seed },
) {
  if (mode === 'dormant') return null;
  const dryMode = mode === 'previous-dry' || mode === 'current-dry';
  const node = groundAxes.get(leaf.axisId)?.points[leaf.pointIndex];
  if (!node) return null;

  // The lowest stem leaves yellow and drop in late summer, shaded out.
  const lowerDrop =
    leaf.fraction < 0.3 &&
    keyedRandom(seed, leaf.id, 'lower-drop') <
      phenology.lowerLeafDropProgress * (1 - leaf.fraction / 0.3) * 0.8;
  const deadDrop =
    keyedRandom(seed, leaf.id, 'dead-drop') <
    phenology.deadLeafDropProgress * (1 - DEAD_LEAF_RETAINED);
  if (lowerDrop || deadDrop) {
    return fallenLeaf(leaf, node, { ageScale, phenology, seed, fellInSummer: lowerDrop && !deadDrop });
  }

  if (!dryMode && (mode !== 'current' || leafExpansion <= 0.01)) return null;
  const position = standingAxes.get(leaf.axisId)?.points[leaf.pointIndex];
  if (!position) return null; // its stem has been cut

  // Every leaf is on the shoot from the start, folded small at the tip, and
  // unfolds from the bottom up as the stem elongates.
  const local = dryMode ? 1 : clamp01(0.2 + (stemGrowth - 0.7 * leaf.fraction) / 0.35);
  const expansion = dryMode ? 1 : smoothstep01(Math.min(leafExpansion, local));

  // After frost the blade goes limp and droops, edges curling.
  const wilt = smoothstep01(phenology.wiltProgress);
  let direction = leaf.direction;
  let normal = leaf.normal;
  if (wilt > 0) {
    const outwardLength = Math.hypot(leaf.direction.x, leaf.direction.z) || 1;
    const outward = vector(leaf.direction.x / outwardLength, 0, leaf.direction.z / outwardLength);
    const hanging = normalize(add(scale(outward, 0.5), vector(0, -1, 0)));
    direction = normalize(add(scale(leaf.direction, 1 - wilt), scale(hanging, wilt * 0.75)));
    normal = normalize(add(scale(leaf.normal, 1 - wilt), scale(outward, wilt * 0.75)));
  }
  return {
    id: leaf.id,
    visible: true,
    fallen: false,
    rosette: false,
    position,
    direction,
    normal,
    roll: leaf.roll,
    fraction: leaf.fraction,
    lengthM: leaf.lengthM * ageScale * lerp(0.15, 1, expansion) * (1 - 0.1 * wilt),
    widthM: leaf.widthM * ageScale * lerp(0.3, 1, expansion) * (1 - 0.6 * wilt),
    autumnProgress: phenology.autumnProgress,
    lowerYellowing: leaf.fraction < 0.3 ? phenology.lowerLeafDropProgress : 0,
    wilt,
    fellInSummer: false,
  };
}

/**
 * The basal rosette is on the plant all year: small and green in winter,
 * growing out of the crown in spring, dying back at the base in late summer.
 */
function evaluateRosette(model, { ageYears, phenology, crownScale }) {
  const growth = PINNATA_PROFILE.growth;
  const ageScale = sampleAnchors(growth.rosetteAgeScaleAnchors, ageYears);
  const size = ageScale * phenology.rosetteScale;
  const leaves = [];
  for (const leaf of model.rosette) {
    if (leaf.birthAgeYears > ageYears) continue;
    // Older leaves die back first as late summer comes on.
    const yellowing = phenology.rosetteYellowing * (0.35 + 0.65 * leaf.weathering);
    leaves.push({
      id: leaf.id,
      visible: true,
      fallen: false,
      rosette: true,
      position: scale(leaf.root, crownScale),
      direction: leaf.direction,
      normal: leaf.normal,
      roll: leaf.roll,
      fraction: 0,
      lengthM: leaf.lengthM * size * lerp(1, 0.8, yellowing * 0.5),
      widthM: leaf.widthM * size * lerp(1, 0.7, yellowing * 0.5),
      autumnProgress: 0,
      lowerYellowing: yellowing,
      wilt: 0,
      fellInSummer: false,
    });
  }
  return leaves;
}

function dimensionsFor(axes, leaves, heads) {
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
  for (const head of heads) {
    heightM = Math.max(heightM, head.position.y + head.spanM * 0.2);
    radiusM = Math.max(
      radiusM,
      Math.hypot(head.position.x, head.position.z) + head.spanM * 0.4,
    );
  }
  return { heightM, radiusM, spreadM: radiusM * 2 };
}

/** Evaluate the immutable crown at one age and calendar day. */
export function evaluatePinnataModel(
  model,
  { ageYears = 0, dayOfYear = 205, events = [], seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  if (!model || model.kind !== MODEL_KIND) {
    throw new TypeError('Expected a model returned by createPinnataModel');
  }
  if (!Number.isInteger(ageYears) || ageYears < 0 || ageYears > model.maxYears) {
    throw new RangeError(`ageYears must be an integer between 0 and ${model.maxYears}`);
  }
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (events.length > 0) {
    throw new RangeError(
      'Gray-headed coneflower exposes no care events; the winter stand and spring cutback are part of its calendar.',
    );
  }

  const phenology = getPinnataPhenology(dayOfYear, { seasonProfile, offsetDays });
  const mode = plantMode(phenology, ageYears);
  // Before the spring cutback the standing stems are last year's growth.
  const cohortAgeYears = mode === 'previous-dry' ? Math.max(0, ageYears - 1) : ageYears;
  const ageScale = sampleAnchors(PINNATA_PROFILE.growth.plantAgeScaleAnchors, cohortAgeYears);
  const crownRadius = sampleAnchors(
    PINNATA_PROFILE.architecture.crownRadiusAnchorsM,
    ageYears,
  );
  const crownScale = crownRadius / PINNATA_PROFILE.architecture.matureCrownRadiusM;
  const dryMode = mode === 'previous-dry' || mode === 'current-dry';
  const stemGrowth = dryMode
    ? 1
    : mode === 'current'
      ? smoothstep01(phenology.stemGrowthProgress)
      : 0;
  // A new stem is a short leafy tuft before it bolts: give it a tenth of its
  // height as soon as it emerges so the first leaves have somewhere to sit.
  const emergence = mode === 'current' ? smoothstep01(phenology.emergenceProgress * 4) : 1;
  const primaryScale = ageScale * Math.max(stemGrowth, 0.1 * emergence);
  const lateralGrowth = dryMode ? 1 : smoothstep01(progress(stemGrowth, 0.7, 1));
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
    const evaluated = transformPrimaryAxis(primary, crownScale, primaryScale);
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
        axisMap.get(primary.id) ?? transformPrimaryAxis(primary, crownScale, primaryScale),
      );
    }
  }
  const stemLeaves = [];
  const leafExpansion = Math.max(phenology.leafProgress, phenology.emergenceProgress * 0.8);
  for (const shoot of activeShoots) {
    for (const leaf of shoot.leaves) {
      const evaluated = evaluateStemLeaf(leaf, { standingAxes: axisMap, groundAxes }, {
        mode,
        ageScale,
        leafExpansion,
        stemGrowth: Math.max(stemGrowth, 0.12 * emergence),
        phenology,
        seed: model.seed,
      });
      if (evaluated) stemLeaves.push(evaluated);
    }
  }
  const rosetteLeaves = evaluateRosette(model, { ageYears, phenology, crownScale });
  const leaves = [...rosetteLeaves, ...stemLeaves];

  const heads = [];
  for (const shoot of activeShoots) {
    for (const head of shoot.heads) {
      if (head.firstFloweringAgeYears > cohortAgeYears) continue;
      const axis = axisMap.get(head.axisId);
      if (!axis) continue;
      const state = localHeadState(head, phenology, dryMode);
      if (!state.visible) continue;
      const stemDirection = tangentAt(axis.points, axis.points.length - 1);
      heads.push({
        id: head.id,
        axisId: head.axisId,
        lateral: head.lateral,
        position: axis.points.at(-1),
        direction: normalize(add(scale(head.direction, 0.75), scale(stemDirection, 0.25))),
        spin: head.spin,
        spanM: head.spanM * lerp(0.75, 1, ageScale) * state.visualScale,
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
    visibleRosetteLeaves: rosetteLeaves.length,
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
    crown: { radiusM: crownRadius, shootSites: activeShoots.length },
    dimensions: dimensionsFor(axes, leaves, heads),
    phenology,
    careHints: getPinnataCareHints(phenology.dayOfYear, { seasonProfile, offsetDays }),
    provenance: {
      observedDisplay: PINNATA_PROFILE.flowering.observedDisplay,
      sources: PINNATA_SOURCES,
      rendererAssumptions: PINNATA_RENDER_ASSUMPTIONS,
    },
    shoots: activeShoots.map((shoot) => ({
      id: shoot.id,
      sequence: shoot.sequence,
      birthAgeYears: shoot.birthAgeYears,
    })),
    axes,
    leaves,
    heads,
    stats,
    appliedEvents: [],
  };
}
