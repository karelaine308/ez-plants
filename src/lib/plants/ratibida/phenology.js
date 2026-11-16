import { calendarLabel, dayOfYear, monthDayToDay } from '../../calendar.js';
import { PINNATA_SOURCES } from './pinnata.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const progress = (value, start, end) =>
  clamp01((value - start) / Math.max(1, end - start));
const lerp = (a, b, t) => a + (b - a) * t;

/** Weather-timing brackets around the central-Ohio baseline. */
export const PINNATA_SEASON_PROFILES = Object.freeze({
  typical: Object.freeze({
    label: 'Typical central-Ohio season',
    dayOffset: 0,
    observedAnchor: true,
  }),
  early: Object.freeze({
    label: 'Early warm season',
    dayOffset: -10,
    observedAnchor: false,
  }),
  late: Object.freeze({
    label: 'Late cool season',
    dayOffset: 10,
    observedAnchor: false,
  }),
});

/**
 * Continuous renderer calendar for central Ohio. The July-to-October bloom
 * window (owner's Ohio chart) and the October-November seed ripening (EPA,
 * EIU) are the observations; every other date is a declared assumption.
 */
export const PINNATA_PHASE_ASSUMPTIONS = Object.freeze({
  baseline: Object.freeze({
    cutbackStart: monthDayToDay(4, 8),
    cutbackEnd: monthDayToDay(4, 22),
    emergenceStart: monthDayToDay(4, 24),
    leafExpansionStart: monthDayToDay(4, 28),
    stemElongationStart: monthDayToDay(5, 10),
    foliageFullExpansion: monthDayToDay(6, 20),
    stemFullHeight: monthDayToDay(7, 1),
    budStart: monthDayToDay(6, 18),
    floweringStart: monthDayToDay(7, 5),
    floweringPeak: monthDayToDay(7, 25),
    fadeStart: monthDayToDay(9, 10),
    floweringEnd: monthDayToDay(10, 14),
    seedHeadStart: monthDayToDay(8, 5),
    seedRipe: monthDayToDay(10, 20),
    lowerLeafDropStart: monthDayToDay(8, 5),
    autumnStart: monthDayToDay(10, 1),
    firstFrost: monthDayToDay(10, 22),
    leafFallStart: monthDayToDay(11, 1),
    leafFallEnd: monthDayToDay(11, 12),
    dryFull: monthDayToDay(11, 10),
    // The basal rosette: leaves grow out of the crown in spring, die back at
    // the base in late summer and winter as a smaller green spray.
    rosetteGrowStart: monthDayToDay(3, 25),
    rosetteFull: monthDayToDay(6, 15),
    rosetteDieBackStart: monthDayToDay(8, 10),
    rosetteDieBackEnd: monthDayToDay(10, 10),
    rosetteWinterStart: monthDayToDay(12, 1),
  }),
  /** Per-head timing, in days: opening, flowering, ray drop, cone darkening. */
  head: Object.freeze({
    openDays: 6,
    bloomDays: 28,
    dropDays: 7,
    darkenDays: 28,
  }),
  /** Days over which frost-killed stem leaves let go. */
  deadLeafDropDays: 60,
  /** Share of the rosette's size kept through late summer and winter. */
  rosetteSummerDieBack: 0.7,
  rosetteWinterScale: 0.4,
  note: 'July-to-October bloom (owner chart), October-November seed ripening, an overwintering green rosette and stems standing through winter are observations. Emergence, elongation, the staggered per-head timing, lower-leaf drop, the first-frost date, the leaf-drop rate, the April cutback dates and the +/-10-day season brackets are renderer assumptions.',
});

function createCalendar(seasonProfile = 'typical', offsetDays = 0) {
  if (!Object.hasOwn(PINNATA_SEASON_PROFILES, seasonProfile)) {
    throw new RangeError("seasonProfile must be 'typical', 'early' or 'late'");
  }
  if (!Number.isFinite(offsetDays) || Math.abs(offsetDays) > 30) {
    throw new RangeError('offsetDays must be a finite number from -30 to 30');
  }
  const profile = PINNATA_SEASON_PROFILES[seasonProfile];
  const totalOffset = profile.dayOffset + Math.round(offsetDays);
  const shift = (day) => Math.max(1, Math.min(365, day + totalOffset));
  return Object.freeze(
    Object.fromEntries(
      Object.entries(PINNATA_PHASE_ASSUMPTIONS.baseline).map(([key, day]) => [
        key,
        shift(day),
      ]),
    ),
  );
}

export function getPinnataCalendar({
  seasonProfile = 'typical',
  offsetDays = 0,
} = {}) {
  return createCalendar(seasonProfile, offsetDays);
}

export const PINNATA_CALENDAR = createCalendar();

export const PINNATA_CALENDAR_PROVENANCE = Object.freeze({
  observationProfile:
    'July-to-October bloom (owner chart), October-November seed ripening, a green overwintering rosette and winter-standing stems',
  seasonProfiles: PINNATA_SEASON_PROFILES,
  assumptions: PINNATA_PHASE_ASSUMPTIONS,
  sources: Object.freeze([
    PINNATA_SOURCES.epaGreatLakes.url,
    PINNATA_SOURCES.eastIllinoisPrairie.url,
    PINNATA_SOURCES.ozarkEdge.url,
    PINNATA_SOURCES.prairieMoon.url,
  ]),
});

function seasonFor(day) {
  if (day >= 60 && day <= 151) return 'spring';
  if (day >= 152 && day <= 243) return 'summer';
  if (day >= 244 && day <= 334) return 'autumn';
  return 'winter';
}

function stageFor(day, calendar) {
  if (day < calendar.cutbackStart) {
    return ['standing-dry', 'Dry stems with black cones standing over a green rosette', '97'];
  }
  if (day < calendar.cutbackEnd) {
    return ['cut-back', 'Last year’s stems being cut back', '00'];
  }
  if (day < calendar.emergenceStart) {
    return ['dormant', 'Green rosette, new stems not yet up', '00'];
  }
  if (day < calendar.stemElongationStart) {
    return ['emergence', 'Short new stems rising from the crown', '09'];
  }
  if (day < calendar.budStart) {
    return ['stem-elongation', 'Leafy stems climbing', '31'];
  }
  if (day < calendar.floweringStart) {
    return ['flower-bud', 'Gray-green buds on bare stalks', '55'];
  }
  if (day < calendar.floweringPeak) {
    return ['early-flowering', 'First yellow rays opening and drooping', '61'];
  }
  if (day < calendar.fadeStart) {
    return ['peak-flowering', 'Peak bloom: drooping yellow rays around brown cones', '65'];
  }
  if (day < calendar.floweringEnd) {
    return ['late-flowering', 'Fewer heads open; many cones now brown', '69'];
  }
  if (day < calendar.firstFrost) {
    return ['seed-ripening', 'Dark cones ripening above yellowing leaves', '89'];
  }
  if (day < calendar.dryFull) {
    return ['senescence', 'Frost-killed leaves browning', '93'];
  }
  return ['standing-dry', 'Dry stems with black cones standing over a green rosette', '97'];
}

function deadLeafDrop(day, calendar) {
  const elapsed =
    day >= calendar.leafFallStart
      ? day - calendar.leafFallStart
      : day < calendar.cutbackEnd
        ? day + 365 - calendar.leafFallStart
        : -1;
  if (elapsed < 0) return 0;
  return clamp01(elapsed / PINNATA_PHASE_ASSUMPTIONS.deadLeafDropDays);
}

/**
 * Size of the basal rosette relative to its summer fullness: a small winter
 * spray, growing out through spring, dying back at the base in late summer.
 * Continuous across New Year.
 */
function rosetteScaleFor(day, calendar) {
  const winter = PINNATA_PHASE_ASSUMPTIONS.rosetteWinterScale;
  const dieBack = PINNATA_PHASE_ASSUMPTIONS.rosetteSummerDieBack;
  if (day >= calendar.rosetteWinterStart || day < calendar.rosetteGrowStart) {
    return winter;
  }
  if (day < calendar.rosetteFull) {
    return lerp(winter, 1, progress(day, calendar.rosetteGrowStart, calendar.rosetteFull));
  }
  if (day < calendar.rosetteDieBackStart) return 1;
  if (day < calendar.rosetteDieBackEnd) {
    return lerp(1, dieBack, progress(day, calendar.rosetteDieBackStart, calendar.rosetteDieBackEnd));
  }
  return lerp(dieBack, winter, progress(day, calendar.rosetteDieBackEnd, calendar.rosetteWinterStart));
}

/** Continuous state for one leap-neutral calendar day. */
export function getPinnataPhenology(
  value = 205,
  { seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  const day = dayOfYear(value);
  const calendar = createCalendar(seasonProfile, offsetDays);
  const [phase, label, bbch] = stageFor(day, calendar);

  const cutProgress = progress(day, calendar.cutbackStart, calendar.cutbackEnd);
  const dryProgress = progress(day, calendar.autumnStart, calendar.dryFull);
  const beforeSpringCut = day < calendar.cutbackEnd;
  const lateDryStand = day >= calendar.dryFull;

  return Object.freeze({
    dayOfYear: day,
    season: seasonFor(day),
    phase,
    stage: label,
    label,
    bbch,
    bbchCode: bbch,
    bbchScale: 'general',
    seasonProfile,
    seasonProfileLabel: PINNATA_SEASON_PROFILES[seasonProfile].label,
    offsetDays: Math.round(offsetDays),
    calendar,
    cutProgress,
    standingDryVisibility: clamp01(
      beforeSpringCut ? 1 - cutProgress : lateDryStand ? 1 : 0,
    ),
    emergenceProgress: progress(
      day,
      calendar.emergenceStart,
      calendar.foliageFullExpansion,
    ),
    leafProgress: progress(
      day,
      calendar.leafExpansionStart,
      calendar.foliageFullExpansion,
    ),
    stemGrowthProgress: progress(
      day,
      calendar.stemElongationStart,
      calendar.stemFullHeight,
    ),
    lowerLeafDropProgress: progress(
      day,
      calendar.lowerLeafDropStart,
      calendar.autumnStart,
    ),
    autumnProgress: progress(day, calendar.autumnStart, calendar.leafFallEnd),
    // Frost-killed leaves go limp over about three weeks.
    wiltProgress:
      day >= calendar.firstFrost
        ? progress(day, calendar.firstFrost, calendar.firstFrost + 20)
        : beforeSpringCut
          ? 1
          : 0,
    // Continuous across New Year: one season's dead leaves keep falling
    // through the winter that follows it.
    deadLeafDropProgress: deadLeafDrop(day, calendar),
    dryProgress,
    rosetteScale: rosetteScaleFor(day, calendar),
    rosetteYellowing: progress(
      day,
      calendar.rosetteDieBackStart,
      calendar.rosetteDieBackEnd,
    ),
    flowersOnCurrentSeasonStems: true,
    foliageDeciduous: true,
    rosetteEvergreen: true,
    winterSeedHeadsRetained: true,
  });
}

const hint = (id, category, priority, title, message, source) =>
  Object.freeze({ id, category, priority, title, message, source });

/** Care guidance relevant to the selected day. */
export function getPinnataCareHints(
  value = 205,
  { seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  const day = dayOfYear(value);
  const calendar = createCalendar(seasonProfile, offsetDays);
  const hints = [];
  if (day >= calendar.cutbackStart && day <= calendar.cutbackEnd) {
    hints.push(
      hint(
        'spring-cutback',
        'pruning',
        'important',
        'Cut last year’s stems once it stays warm',
        `Cut the old stems between ${calendarLabel(calendar.cutbackStart)} and ${calendarLabel(calendar.cutbackEnd)}, once daytime temperatures stay in the 50s so stem-nesting bees can leave, and leave 8-15 in of stubble for next year's nesters. The green rosette stays.`,
        PINNATA_SOURCES.ozarkEdge.url,
      ),
    );
  }
  if (day >= calendar.floweringStart && day <= calendar.floweringEnd) {
    hints.push(
      hint(
        'pollinator-bloom',
        'wildlife',
        'notice',
        'Long bloom for native bees',
        'Heads open in turn from July to October and are visited by native bees, including cuckoo, leaf-cutting and green metallic bees.',
        PINNATA_SOURCES.ohioNativePlantsChart.title,
      ),
    );
  }
  if (day >= calendar.seedRipe || day < calendar.cutbackStart) {
    hints.push(
      hint(
        'leave-seed-heads',
        'winter-interest',
        'recommended',
        'Leave the cones for goldfinches',
        'Dark cones hold their seed into winter and feed goldfinches. Clear them in spring rather than in autumn.',
        PINNATA_SOURCES.ozarkEdge.url,
      ),
    );
  }
  return Object.freeze(hints);
}
