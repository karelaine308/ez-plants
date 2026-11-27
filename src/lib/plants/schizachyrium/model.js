import { keyedInteger as randomInt, keyedRandom, keyedRange as randomRange } from '../../keyed-random.js';
import {
  add,
  clamp,
  clamp01,
  cross,
  deepFreeze,
  lerp,
  normalize,
  rotateAboutAxis,
  sampleAnchors,
  scale,
  subtract,
  tangentAt,
  vector,
} from '../../model-math.js';
import {
  BLADE_ARCH_VARIANTS,
  BLADE_WIDTH_RATIOS,
  bladeTipOffset,
  bladeVariantFor,
} from './geometry.js';
import { getScopariumCareHints, getScopariumPhenology } from './phenology.js';
import { SCOPARIUM_PROFILE, SCOPARIUM_SOURCES } from './scoparium.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEGREES = Math.PI / 180;
const UP = vector(0, 1, 0);

/** Invert an ascending anchor table: the value at which it first reaches y. */
function ageAtAnchorValue(anchors, target) {
  if (target <= anchors[0][1]) return anchors[0][0];
  for (let index = 1; index < anchors.length; index += 1) {
    const [startAge, startValue] = anchors[index - 1];
    const [endAge, endValue] = anchors[index];
    if (target <= endValue) {
      return lerp(
        startAge,
        endAge,
        (target - startValue) / Math.max(0.0001, endValue - startValue),
      );
    }
  }
  return anchors.at(-1)[0];
}

function crownRadiusAt(ageYears) {
  return sampleAnchors(SCOPARIUM_PROFILE.architecture.crownRadiusAnchorsM, ageYears);
}

/* ==================================================================== *
 * Stable graph
 * ==================================================================== */

/**
 * One basal blade of a tuft. Inner tufts carry the longest, most upright
 * blades; outer tufts carry shorter ones that bow over, so the mound is a low
 * dome with a soft skirt rather than a fountain.
 */
function makeBlade(seed, site, order) {
  const leaf = SCOPARIUM_PROFILE.leaf;
  const id = `${site.id}:blade:${order}`;
  const radial = site.radialFraction;
  const baseLength = lerp(leaf.lengthInnerM, leaf.lengthOuterM, Math.pow(radial, 0.55));
  // The first blade of a tuft is its longest; later ones are younger.
  const lengthM =
    baseLength * (1 - 0.1 * order) * randomRange(seed, [id, 'length'], 0.82, 1.14);
  const archVariant = bladeVariantFor(
    clamp(
      0.28 + 0.62 * Math.pow(radial, 1.4) + randomRange(seed, [id, 'arch'], -0.08, 0.08),
      0.3,
      1,
    ),
  );
  const spread = randomRange(seed, [id, 'offset-radius'], 0, 0.014);
  const around = randomRange(seed, [id, 'offset-angle'], 0, Math.PI * 2);
  return {
    id,
    // Basal: every blade leaves the soil within a centimetre or so of the tuft.
    offset: vector(Math.cos(around) * spread, 0, Math.sin(around) * spread),
    azimuth: site.azimuth + randomRange(seed, [id, 'azimuth'], -1.15, 1.15),
    lengthM,
    widthM: lengthM * BLADE_WIDTH_RATIOS[archVariant],
    // How far the blade leaves vertical: about 15 degrees in the middle of the
    // clump to about 50 at its edge (the arch then bows it further).
    emergeTilt: clamp(
      0.16 + 0.32 * radial + randomRange(seed, [id, 'emerge-tilt'], -0.06, 0.06),
      0.16,
      0.66,
    ),
    archVariant,
    arch: BLADE_ARCH_VARIANTS[archVariant],
    roll: randomRange(seed, [id, 'roll'], -0.7, 0.7),
  };
}

/**
 * A culm's centreline: thin, nearly upright at the crown, tilting a little
 * outward in its own direction toward the tip. There is no lean of the whole
 * clump; every culm has its own azimuth.
 */
function culmPoints(seed, site, lengthM) {
  const cane = SCOPARIUM_PROFILE.cane;
  const id = `${site.id}:culm`;
  const radial = site.radialFraction;
  const azimuth = site.azimuth + randomRange(seed, [id, 'azimuth'], -0.55, 0.55);
  const tipTilt =
    lerp(cane.tipTiltDegrees.centre, cane.tipTiltDegrees.edge, Math.pow(radial, 0.8)) *
    randomRange(seed, [id, 'tilt'], 0.8, 1.2) *
    DEGREES;
  const baseTilt = tipTilt * 0.3;
  const count = cane.nodeCount;
  const step = lengthM / count;
  const points = [vector(site.position.x, 0, site.position.z)];
  for (let index = 0; index < count; index += 1) {
    const s = (index + 0.5) / count;
    const angle = baseTilt + (tipTilt - baseTilt) * Math.pow(s, 1.6);
    const previous = points[index];
    points.push(
      vector(
        previous.x + Math.sin(angle) * Math.cos(azimuth) * step,
        previous.y + Math.cos(angle) * step,
        previous.z + Math.sin(angle) * Math.sin(azimuth) * step,
      ),
    );
  }
  return { points, azimuth, tipTiltDegrees: tipTilt / DEGREES };
}

function makeRaceme(seed, site, culm, order, count) {
  const panicle = SCOPARIUM_PROFILE.panicle;
  const id = `${site.id}:raceme:${order}`;
  const t = count > 1 ? order / (count - 1) : 1;
  const fraction = clamp(
    lerp(panicle.zoneStartFraction, 0.98, t) + randomRange(seed, [id, 'height'], -0.015, 0.015),
    panicle.zoneStartFraction,
    0.99,
  );
  const along = fraction * (culm.points.length - 1);
  const index = Math.min(culm.points.length - 2, Math.floor(along));
  const tangent = tangentAt(culm.points, index + 1);
  let side = normalize(cross(tangent, UP));
  if (Math.hypot(side.x, side.y, side.z) < 1e-6) side = vector(1, 0, 0);
  const other = normalize(cross(tangent, side));
  const around = order * GOLDEN_ANGLE + randomRange(seed, [id, 'around'], -0.4, 0.4);
  const topRaceme = order === count - 1;
  const branch =
    (topRaceme
      ? 6
      : randomRange(
          seed,
          [id, 'branch'],
          panicle.branchAngleDegrees[0],
          panicle.branchAngleDegrees[1],
        )) * DEGREES;
  const direction = normalize(
    add(
      scale(tangent, Math.cos(branch)),
      scale(
        add(scale(side, Math.cos(around)), scale(other, Math.sin(around))),
        Math.sin(branch),
      ),
    ),
  );
  return {
    id,
    order,
    fraction,
    pointIndex: index,
    pointFraction: along - index,
    direction,
    spin: randomRange(seed, [id, 'spin'], 0, Math.PI * 2),
    lengthM:
      randomRange(seed, [id, 'length'], panicle.lengthM[0], panicle.lengthM[1]) *
      lerp(1, 0.65, t),
    widthM: randomRange(seed, [id, 'width'], panicle.widthM[0], panicle.widthM[1]),
    top: topRaceme,
  };
}

function makeSite(seed, sequence, birthAgeYears, culmCapable, hs) {
  const architecture = SCOPARIUM_PROFILE.architecture;
  const cane = SCOPARIUM_PROFILE.cane;
  const leaf = SCOPARIUM_PROFILE.leaf;
  const panicle = SCOPARIUM_PROFILE.panicle;
  const id = `scoparium:tuft:${String(sequence).padStart(3, '0')}`;
  // A tuft born in year k sits anywhere from the crown centre to that year's
  // edge, spread evenly over the disc (square root of the draw), so the
  // clump infills as well as widens and has no bare hole in the middle.
  const radialFraction = clamp(
    (crownRadiusAt(birthAgeYears) / architecture.matureCrownRadiusM) *
      Math.sqrt(randomRange(seed, [id, 'radial-jitter'], 0, 1)),
    0.04,
    1,
  );
  const azimuth = sequence * GOLDEN_ANGLE + randomRange(seed, [id, 'azimuth-jitter'], -0.3, 0.3);
  const radiusM = radialFraction * architecture.matureCrownRadiusM;
  const site = {
    id,
    sequence,
    birthAgeYears,
    azimuth,
    radialFraction,
    position: vector(Math.cos(azimuth) * radiusM, 0, Math.sin(azimuth) * radiusM),
    culmCapable,
    // Staggering the cut across the window stops the clump vanishing on one
    // slider step; a gardener works around a clump too.
    cutOrder: keyedRandom(seed, id, 'cut-order'),
    collapseAzimuth: randomRange(seed, [id, 'collapse-azimuth'], 0, Math.PI * 2),
    // Little bluestem stands up on a dry site; the lean is small.
    collapseAngle: randomRange(seed, [id, 'collapse-angle'], 0.02, 0.14),
    blades: [],
    culm: null,
  };
  const bladeCount = randomInt(seed, [id, 'blade-count'], leaf.bladesPerTuft[0], leaf.bladesPerTuft[1]);
  for (let order = 0; order < bladeCount; order += 1) {
    site.blades.push(makeBlade(seed, site, order));
  }

  if (culmCapable) {
    const lengthM =
      cane.lengthM *
      hs *
      randomRange(seed, [id, 'culm-length'], cane.lengthJitter[0], cane.lengthJitter[1]) *
      (1 - cane.edgeLengthLoss * radialFraction);
    const axis = culmPoints(seed, site, lengthM);
    const racemeCount = randomInt(seed, [id, 'raceme-count'], panicle.racemesPerCulm[0], panicle.racemesPerCulm[1]);
    const culm = {
      id: `${id}:culm`,
      lengthM,
      azimuth: axis.azimuth,
      tipTiltDegrees: axis.tipTiltDegrees,
      points: axis.points,
      radii: axis.points.map((_, index) => {
        const s = index / (axis.points.length - 1);
        return (
          randomRange(seed, [id, 'base-radius'], cane.baseRadiusM[0], cane.baseRadiusM[1]) *
          lerp(1, 0.4, s)
        );
      }),
      // Where in the emergence window this culm clears the leaf mound.
      emergenceFraction: keyedRandom(seed, id, 'emergence'),
      racemes: [],
    };
    for (let order = 0; order < racemeCount; order += 1) {
      culm.racemes.push(makeRaceme(seed, site, culm, order, racemeCount));
    }
    site.culm = culm;
  }
  return site;
}

function assertModelOptions(seed, maxYears) {
  if (!['string', 'number'].includes(typeof seed)) {
    throw new TypeError('seed must be a string or number');
  }
  if (!Number.isInteger(maxYears) || maxYears < 1 || maxYears > 50) {
    throw new RangeError('maxYears must be an integer from 1 to 50');
  }
}

/**
 * Build the finite, stable all-ages organ graph once.
 *
 * The clump is a set of tuft sites. A mature clump's culm count varies by seed
 * (median 40, range 28 to 70: research estimates from photographs), and the
 * same fraction of that count applies at every age, so ages 1, 2 and 3 show
 * about 12, 22 and 35 culms on a median clump.
 */
export function createScopariumModel({
  seed = 'scoparium-demo',
  maxYears = SCOPARIUM_PROFILE.architecture.modelHorizonYears,
} = {}) {
  assertModelOptions(seed, maxYears);
  const growth = SCOPARIUM_PROFILE.growth;
  const range = growth.matureCulmCount.range;
  const matureCulms =
    range[0] +
    (range[1] - range[0]) * Math.pow(keyedRandom(seed, 'scoparium', 'culm-count'), 1.8);
  const s = matureCulms / growth.matureCulmCount.median;
  const hs = randomRange(
    seed,
    ['scoparium', 'height-factor'],
    growth.heightFactorRange[0],
    growth.heightFactorRange[1],
  );

  const tuftTotal = Math.round(growth.tuftCountAnchors.at(-1)[1] * s);
  const births = [];
  for (let index = 0; index < tuftTotal; index += 1) {
    // The plug's own tufts do not scale with the clump it grows into.
    const target = index < 4 ? index + 1 : (index + 1) / s;
    births.push(ageAtAnchorValue(growth.tuftCountAnchors, target));
  }
  births.sort((a, b) => a - b);

  const cumulativeCulms = (ordinal) =>
    Math.round(s * sampleAnchors(growth.culmByTuftAnchors, ordinal / s));
  const sites = [];
  for (let sequence = 0; sequence < tuftTotal; sequence += 1) {
    if (births[sequence] > maxYears) continue;
    const culmCapable = cumulativeCulms(sequence + 1) > cumulativeCulms(sequence);
    sites.push(makeSite(seed, sequence, births[sequence], culmCapable, hs));
  }

  return deepFreeze({
    schemaVersion: 1,
    kind: 'schizachyrium-scoparium-growth-model',
    species: SCOPARIUM_PROFILE.species,
    cultivar: SCOPARIUM_PROFILE.cultivar,
    seed: String(seed),
    maxYears,
    metresPerUnit: SCOPARIUM_PROFILE.metresPerUnit,
    matureCulmCount: Math.round(matureCulms),
    heightFactor: hs,
    tillers: sites,
  });
}

/* ==================================================================== *
 * Evaluation
 * ==================================================================== */

function growthEase(progressValue) {
  const p = clamp01(progressValue);
  return 1 - (1 - p) * (1 - p);
}

function evaluateBlade(seed, blade, site, state) {
  const position = add(site.position, blade.offset);
  const up = UP;
  const outward = vector(Math.cos(blade.azimuth), 0, Math.sin(blade.azimuth));
  const tilt = clamp(blade.emergeTilt + 0.12 * state.plugness, 0.16, 0.85);
  const emerge = normalize(add(scale(up, 1 - tilt), scale(outward, tilt)));
  const emergeUp = dotProduct(emerge, outward);
  const perpendicular = subtract(outward, scale(emerge, emergeUp));
  const archDirection = normalize(
    Math.hypot(perpendicular.x, perpendicular.y, perpendicular.z) > 1e-6
      ? perpendicular
      : vector(-emerge.z, 0, emerge.x),
  );
  const expansion = clamp01(state.expansion);
  const archVariant = Math.min(
    blade.archVariant,
    Math.floor(expansion * BLADE_ARCH_VARIANTS.length),
    BLADE_ARCH_VARIANTS.length - 1,
  );
  const full = blade.lengthM * state.sizeScale;
  const lengthM = Math.max(state.stubM, full * expansion);
  const lengthFraction = full > 0 ? lengthM / full : 1;
  return {
    id: blade.id,
    visible: true,
    position,
    emerge,
    outward,
    archDirection,
    azimuth: blade.azimuth,
    expansion,
    arch: BLADE_ARCH_VARIANTS[archVariant],
    archVariant,
    matureArchVariant: blade.archVariant,
    roll: blade.roll,
    lengthM,
    widthM: blade.widthM * state.sizeScale * lerp(0.5, 1, clamp01(lengthFraction)),
    retained:
      state.weathering <= 0 ||
      keyedRandom(seed, blade.id, 'winter-shed') > state.weathering * 0.35,
    weathering: state.weathering,
    cohort: state.cohort,
  };
}

function dotProduct(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function bladeTip(blade) {
  const offset = bladeTipOffset(blade.arch);
  return add(
    blade.position,
    add(
      scale(blade.emerge, blade.lengthM * offset.along),
      scale(blade.archDirection, blade.lengthM * offset.across),
    ),
  );
}

function evaluateCulm(site, phenology, seed, cohort, culmAge) {
  const culm = site.culm;
  const calendar = phenology.calendar;
  const day = phenology.dayOfYear;
  const emergenceDay = lerp(calendar.culmEmergenceStart, calendar.culmEmergenceEnd, culm.emergenceFraction);
  const current = cohort === 'current';
  const t = current ? day - emergenceDay : Infinity;
  const growth = current
    ? growthEase(t / SCOPARIUM_PROFILE.cane.growthDays)
    : 1;
  if (growth <= 0.003) return null;

  const heightScale = sampleAnchors(SCOPARIUM_PROFILE.growth.culmHeightAnchors, culmAge);
  const weathering = current ? phenology.weatheringProgress : phenology.previousWeatheringProgress;
  const lean = site.collapseAngle * weathering;
  const root = culm.points[0];
  const axis = vector(Math.cos(site.collapseAzimuth), 0, Math.sin(site.collapseAzimuth));
  const factor = growth * heightScale;
  const transform = (point) => {
    const local = scale(subtract(point, root), factor);
    return add(root, lean > 1e-6 ? rotateAboutAxis(local, axis, lean) : local);
  };
  const points = culm.points.map(transform);

  const keep = Math.max(
    1,
    Math.round(
      culm.racemes.length *
        sampleAnchors(SCOPARIUM_PROFILE.growth.racemeAgeAnchors, Math.max(1, culmAge)),
    ),
  );
  const flowering = SCOPARIUM_PROFILE.flowering;
  const racemes = [];
  for (const raceme of culm.racemes.slice(culm.racemes.length - keep)) {
    const from = points[raceme.pointIndex];
    const to = points[raceme.pointIndex + 1];
    const position = add(from, scale(subtract(to, from), raceme.pointFraction));
    const direction = normalize(
      lean > 1e-6 ? rotateAboutAxis(raceme.direction, axis, lean) : raceme.direction,
    );
    const push = current ? clamp01((t - 8) / 12) : 1;
    const anthesis =
      current &&
      t >= flowering.anthesisOffsetDays[0] &&
      t <= flowering.anthesisOffsetDays[1];
    const fluffStart = Math.max(emergenceDay + flowering.anthesisOffsetDays[1], calendar.fluffStart);
    const fluffProgress = current ? clamp01((day - fluffStart) / 12) : 1;
    const fluffVisibility = current
      ? fluffProgress * phenology.fluffVisibility
      : phenology.previousFluffVisibility;
    const pastBloom = !current || t > flowering.anthesisOffsetDays[1];
    const visible = push > 0.02;
    racemes.push({
      id: `${raceme.id}:${cohort}`,
      sourceId: raceme.id,
      visible,
      position,
      direction,
      spin: raceme.spin,
      lengthM: raceme.lengthM * lerp(0.3, 1, push) * Math.max(0.35, factor),
      widthM: raceme.widthM * lerp(0.6, 1, push),
      stage: !visible ? 'hidden' : anthesis ? 'anthesis' : pastBloom ? 'seed' : 'emerging',
      anthesis,
      pastBloom: visible && pastBloom,
      fluffVisibility: clamp01(fluffVisibility),
      plume: visible && pastBloom && fluffVisibility > 0.3,
      weathering,
      cohort,
      push,
    });
  }

  return {
    id: `${culm.id}:${cohort}`,
    siteId: site.id,
    cohort,
    visible: true,
    growth,
    emergenceDay,
    radiusScale: lerp(0.6, 1, growth),
    lean,
    weathering,
    points,
    radii: culm.radii,
    tipTiltDegrees: culm.tipTiltDegrees,
    racemes,
  };
}

function evaluateSite(site, seed, phenology, ageYears, now) {
  const profile = SCOPARIUM_PROFILE;
  const sizeScale = sampleAnchors(
    profile.growth.plantAgeScaleAnchors,
    ageYears + phenology.emergenceProgress,
  );
  const plugness = clamp01(1 - (ageYears + phenology.emergenceProgress) / 1.5);
  const existedLastYear = site.birthAgeYears < ageYears;
  const cut = phenology.cutProgress > site.cutOrder;
  const previous = existedLastYear && !cut;

  const blades = [];
  let state;
  if (previous) {
    state = {
      cohort: 'previous',
      expansion: 1,
      sizeScale,
      stubM: 0,
      weathering: phenology.previousWeatheringProgress,
      plugness,
    };
  } else {
    const young = ageYears === 0;
    // A plug is never smaller than the seedling bought in spring.
    const fraction = young ? 0.5 + 0.5 * phenology.bladeFraction : phenology.bladeFraction;
    state = {
      cohort: 'current',
      expansion: fraction,
      sizeScale,
      // The cut leaves 2 to 4 in of stubble; a tuft born this year starts smaller.
      stubM: young ? 0 : existedLastYear ? profile.leaf.stubbleM : profile.leaf.stubbleM * 0.5,
      weathering: phenology.weatheringProgress,
      plugness,
    };
  }
  for (const blade of site.blades) {
    blades.push(evaluateBlade(seed, blade, site, state));
  }
  if (!previous && ageYears > 0 && state.expansion <= 0.02) {
    for (const blade of blades) {
      blade.stub = true;
    }
  }

  let culm = null;
  if (site.culmCapable && site.culm) {
    const first = profile.growth.firstCulmAgeYears;
    const season = profile.growth.culmSeasonFraction;
    if (previous && ageYears - 1 >= first && site.birthAgeYears <= ageYears - 1 + season) {
      culm = evaluateCulm(site, phenology, seed, 'previous', ageYears - 1);
    }
    // Current culms exist from the emergence window on; before it, nothing.
    if (!culm && ageYears >= first && site.birthAgeYears <= ageYears + season) {
      culm = evaluateCulm(site, phenology, seed, 'current', ageYears);
    }
  }

  return {
    id: site.id,
    sequence: site.sequence,
    birthAgeYears: site.birthAgeYears,
    position: site.position,
    radialFraction: site.radialFraction,
    culmCapable: site.culmCapable,
    removed: false,
    cohort: state.cohort,
    blades,
    culm,
  };
}

function snapshotDimensions(tillers) {
  let height = 0;
  let radius = 0;
  let foliageHeight = 0;
  let tipSum = 0;
  let tipCount = 0;
  for (const tiller of tillers) {
    for (const blade of tiller.blades) {
      if (!blade.visible || !blade.retained) continue;
      const tip = bladeTip(blade);
      foliageHeight = Math.max(foliageHeight, tip.y);
      height = Math.max(height, tip.y);
      radius = Math.max(radius, Math.hypot(tip.x, tip.z));
    }
    const culm = tiller.culm;
    if (!culm) continue;
    for (const point of culm.points) {
      height = Math.max(height, point.y);
      radius = Math.max(radius, Math.hypot(point.x, point.z));
    }
    tipSum += culm.points.at(-1).y;
    tipCount += 1;
    for (const raceme of culm.racemes) {
      if (!raceme.visible) continue;
      const tip = add(raceme.position, scale(raceme.direction, raceme.lengthM));
      height = Math.max(height, tip.y);
      radius = Math.max(radius, Math.hypot(tip.x, tip.z) + raceme.widthM / 2);
    }
  }
  return {
    heightM: height,
    foliageHeightM: foliageHeight,
    culmTipMeanM: tipCount ? tipSum / tipCount : 0,
    radiusM: radius,
    spreadM: radius * 2,
  };
}

function snapshotStats(tillers, phenology) {
  let visibleCulms = 0;
  let livingCulms = 0;
  let standingDeadCulms = 0;
  let visibleBlades = 0;
  let visiblePanicles = 0;
  let visiblePlumes = 0;
  let visibleFlowers = 0;
  let visibleSeedHeads = 0;
  for (const tiller of tillers) {
    for (const blade of tiller.blades) {
      if (blade.visible && blade.retained) visibleBlades += 1;
    }
    const culm = tiller.culm;
    if (!culm) continue;
    visibleCulms += 1;
    if (culm.cohort === 'current') livingCulms += 1;
    else standingDeadCulms += 1;
    for (const raceme of culm.racemes) {
      if (!raceme.visible) continue;
      visiblePanicles += 1;
      if (raceme.anthesis) visibleFlowers += 1;
      if (raceme.pastBloom) visibleSeedHeads += 1;
      if (raceme.plume) visiblePlumes += 1;
    }
  }
  return {
    visibleTillers: tillers.length,
    visibleCulms,
    livingCulms,
    standingDeadCulms,
    visibleBlades,
    visibleLeaves: visibleBlades,
    visiblePanicles,
    visiblePlumes,
    visibleFlowers,
    visibleSeedHeads,
    flowersOnCurrentSeasonCulms: phenology.flowersOnCurrentSeasonCulms,
  };
}

function ageAwarePhenology(phenology, stats) {
  if (stats.visibleCulms > 0) return phenology;
  if (!['culm-elongation', 'flowering'].includes(phenology.phase)) return phenology;
  const label = 'Leafy clump; no culms at this age yet';
  return Object.freeze({ ...phenology, stage: label, label });
}

function careHintsForSnapshot(phenology, stats, options) {
  const hints = getScopariumCareHints(phenology.dayOfYear, options);
  if (stats.visibleBlades > 0) return hints;
  return Object.freeze(hints.filter((hint) => hint.id !== 'spring-cutback'));
}

function validateEvents(events) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (events.length > 0) {
    throw new RangeError(
      'Little bluestem does not expose destructive care events; the single annual cut is modelled by the calendar.',
    );
  }
}

/**
 * Evaluate the immutable graph at an absolute age and day.
 *
 * Age 0 is a seed-grown plug: blades only, never culms. From age 1 the clump
 * carries last winter's standing culms until the cutback, then rebuilds its
 * blades from the stubble and sends up the year's culms from day 200.
 */
export function evaluateScopariumModel(
  model,
  { ageYears = 0, dayOfYear = 270, events = [], seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  if (!model || model.kind !== 'schizachyrium-scoparium-growth-model') {
    throw new TypeError('Expected a model returned by createScopariumModel');
  }
  if (!Number.isInteger(ageYears) || ageYears < 0 || ageYears > model.maxYears) {
    throw new RangeError(`ageYears must be an integer between 0 and ${model.maxYears}`);
  }
  validateEvents(events);

  const phenology = getScopariumPhenology(dayOfYear, { seasonProfile, offsetDays });
  const now = ageYears + phenology.dayOfYear / 365;
  const tillers = [];
  for (const site of model.tillers) {
    if (site.birthAgeYears > now) continue;
    tillers.push(evaluateSite(site, model.seed, phenology, ageYears, now));
  }

  const stats = snapshotStats(tillers, phenology);
  const careHints = careHintsForSnapshot(phenology, stats, {
    plantAgeYears: ageYears,
    seasonProfile,
    offsetDays,
  });

  const leaves = [];
  const axes = [];
  const heads = [];
  for (const tiller of tillers) {
    for (const blade of tiller.blades) {
      if (!blade.visible || !blade.retained) continue;
      leaves.push({
        id: blade.id,
        kind: 'blade',
        cohort: blade.cohort,
        position: blade.position,
        direction: blade.emerge,
        lengthM: blade.lengthM,
        tip: bladeTip(blade),
      });
    }
    const culm = tiller.culm;
    if (!culm) continue;
    axes.push({
      id: culm.id,
      kind: 'culm',
      cohort: culm.cohort,
      root: culm.points[0],
      points: culm.points,
      tipTiltDegrees: culm.tipTiltDegrees,
    });
    for (const raceme of culm.racemes) {
      if (!raceme.visible) continue;
      heads.push({
        id: raceme.id,
        stage: raceme.stage,
        position: raceme.position,
        direction: raceme.direction,
        lengthM: raceme.lengthM,
      });
    }
  }

  return {
    species: model.species,
    cultivar: model.cultivar,
    seed: model.seed,
    ageYears,
    dayOfYear: phenology.dayOfYear,
    clump: {
      radiusM: crownRadiusAt(ageYears + phenology.emergenceProgress),
      tillerSites: tillers.length,
      matureCulmCount: model.matureCulmCount,
    },
    dimensions: snapshotDimensions(tillers),
    phenology: ageAwarePhenology(phenology, stats),
    careHints,
    provenance: {
      observedDisplay: SCOPARIUM_PROFILE.flowering.observedDisplay,
      sources: SCOPARIUM_SOURCES,
      rendererAssumptions: [
        'culm count by age follows the owner decision (12, 22, 35 and 40 culms at ages 1, 2, 3 and 5 on a median clump); the report gives photo estimates only',
        'racemes per culm, culm tilt angles and tuft counts are declared assumptions',
        'staggered late-winter cut across days 60 to 100',
      ],
    },
    tillers,
    leaves,
    axes,
    heads,
    stats,
    appliedEvents: [],
  };
}
