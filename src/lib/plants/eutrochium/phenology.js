import { calendarLabel, dayOfYear, monthDayToDay } from '../../calendar.js';
import { MACULATUM_SOURCES } from './maculatum.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const progress = (value, start, end) =>
  clamp01((value - start) / Math.max(1, end - start));

/** Weather-timing brackets around the central-Ohio baseline. */
export const MACULATUM_SEASON_PROFILES = Object.freeze({
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
 * Continuous renderer calendar for central Ohio. Bloom opening in mid-July,
 * early bloom by 22 July and a three-to-four-week display are observations
 * (see `MACULATUM_SOURCES`); every other date is a declared assumption.
 */
export const MACULATUM_PHASE_ASSUMPTIONS = Object.freeze({
  baseline: Object.freeze({
    cutbackStart: monthDayToDay(3, 5),
    cutbackEnd: monthDayToDay(4, 1),
    emergenceStart: monthDayToDay(4, 10),
    leafExpansionStart: monthDayToDay(4, 15),
    stemElongationStart: monthDayToDay(4, 30),
    foliageFullExpansion: monthDayToDay(7, 1),
    budStart: monthDayToDay(6, 22),
    stemFullHeight: monthDayToDay(7, 12),
    floweringStart: monthDayToDay(7, 15),
    floweringPeak: monthDayToDay(7, 31),
    fadeStart: monthDayToDay(8, 20),
    seedHeadStart: monthDayToDay(8, 28),
    // Sept 20, up from Sept 9: reputable sources run to the end of September and iNaturalist has Ohio flowering to week 39 (Joe Pye review, 27 Nov 2026).
    floweringEnd: monthDayToDay(9, 20),
    lowerLeafDropStart: monthDayToDay(8, 10),
    autumnStart: monthDayToDay(9, 25),
    firstFrost: monthDayToDay(10, 22),
    leafFallStart: monthDayToDay(11, 1),
    leafFallEnd: monthDayToDay(11, 5),
    dryFull: monthDayToDay(11, 8),
  }),
  /**
   * Days over which frost-killed leaves let go of the stems. Many hang on,
   * blackened and drooping, well into winter (owner's photograph, 15 Nov), and
   * a share stay until the spring cutback; see `DEAD_LEAF_RETAINED`.
   */
  deadLeafDropDays: 80,
  note: 'July-September bloom, a 3-4 week display per plant, winter-standing heads, late-winter cutback and dead leaves hanging on drooping stems in mid-November (owner photograph, central Ohio) are observations. Emergence, elongation, lower-leaf drop, the first-frost date, the leaf-drop rate and the +/-10-day season brackets are renderer assumptions.',
});

function createCalendar(seasonProfile = 'typical', offsetDays = 0) {
  if (!Object.hasOwn(MACULATUM_SEASON_PROFILES, seasonProfile)) {
    throw new RangeError("seasonProfile must be 'typical', 'early' or 'late'");
  }
  if (!Number.isFinite(offsetDays) || Math.abs(offsetDays) > 30) {
    throw new RangeError('offsetDays must be a finite number from -30 to 30');
  }
  const profile = MACULATUM_SEASON_PROFILES[seasonProfile];
  const totalOffset = profile.dayOffset + Math.round(offsetDays);
  const shift = (day) => Math.max(1, Math.min(365, day + totalOffset));
  return Object.freeze(
    Object.fromEntries(
      Object.entries(MACULATUM_PHASE_ASSUMPTIONS.baseline).map(([key, day]) => [
        key,
        shift(day),
      ]),
    ),
  );
}

export function getMaculatumCalendar({
  seasonProfile = 'typical',
  offsetDays = 0,
} = {}) {
  return createCalendar(seasonProfile, offsetDays);
}

export const MACULATUM_CALENDAR = createCalendar();

export const MACULATUM_CALENDAR_PROVENANCE = Object.freeze({
  observationProfile:
    'Mid-July opening near Columbus, July-September Midwest display, winter-standing seed heads and late-winter cutback',
  seasonProfiles: MACULATUM_SEASON_PROFILES,
  assumptions: MACULATUM_PHASE_ASSUMPTIONS,
  sources: Object.freeze([
    MACULATUM_SOURCES.columbusObservation.url,
    MACULATUM_SOURCES.illinoisWildflowers.url,
    MACULATUM_SOURCES.minnesotaWildflowers.url,
    MACULATUM_SOURCES.ncStateExtension.url,
    MACULATUM_SOURCES.pennStateExtension.url,
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
    return ['standing-dry', 'Dark stems standing, dead leaves hanging and falling', '97'];
  }
  if (day < calendar.cutbackEnd) {
    return ['cut-back', 'Last year’s stems being cut back', '00'];
  }
  if (day < calendar.emergenceStart) {
    return ['dormant', 'Dormant crown', '00'];
  }
  if (day < calendar.stemElongationStart) {
    return ['emergence', 'Purple-tinged shoots emerging in whorls', '09'];
  }
  if (day < calendar.budStart) {
    return ['stem-elongation', 'Leafy stems climbing, whorl by whorl', '31'];
  }
  if (day < calendar.floweringStart) {
    return ['flower-bud', 'Mauve bud clusters forming flat tops', '55'];
  }
  if (day < calendar.floweringPeak) {
    return ['early-flowering', 'First dusky-pink heads opening', '61'];
  }
  if (day < calendar.fadeStart) {
    return ['peak-flowering', 'Peak bloom: broad flat dusky-pink arrays', '65'];
  }
  if (day < calendar.floweringEnd) {
    return ['late-flowering', 'Fading arrays turning to seed', '69'];
  }
  if (day < calendar.leafFallStart) {
    return ['seed-ripening', 'Fluffy tan seed heads above yellowing leaves', '89'];
  }
  if (day < calendar.firstFrost) {
    return ['senescence', 'Leaves yellowing, seed heads fluffing out', '92'];
  }
  if (day < calendar.dryFull) {
    return ['senescence', 'Frost-killed leaves blackening and drooping', '93'];
  }
  return ['standing-dry', 'Dark stems standing, dead leaves hanging and falling', '97'];
}

function deadLeafDrop(day, calendar) {
  const elapsed =
    day >= calendar.leafFallStart
      ? day - calendar.leafFallStart
      : day < calendar.cutbackEnd
        ? day + 365 - calendar.leafFallStart
        : -1;
  if (elapsed < 0) return 0;
  return clamp01(elapsed / MACULATUM_PHASE_ASSUMPTIONS.deadLeafDropDays);
}

/** Continuous state for one leap-neutral calendar day. */
export function getMaculatumPhenology(
  value = 212,
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
    seasonProfileLabel: MACULATUM_SEASON_PROFILES[seasonProfile].label,
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
    // Frost-killed leaves wilt to hang down the stem over about three weeks.
    wiltProgress:
      day >= calendar.firstFrost
        ? progress(day, calendar.firstFrost, calendar.firstFrost + 20)
        : beforeSpringCut
          ? 1
          : 0,
    // Continuous across New Year: the dead leaves of one season keep falling
    // through the winter that follows it.
    deadLeafDropProgress: deadLeafDrop(day, calendar),
    dryProgress,
    flowersOnCurrentSeasonStems: true,
    foliageDeciduous: true,
    winterSeedHeadsRetained: true,
  });
}

const hint = (id, category, priority, title, message, source) =>
  Object.freeze({ id, category, priority, title, message, source });

/** Care guidance relevant to the selected day. */
export function getMaculatumCareHints(
  value = 212,
  { seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  const day = dayOfYear(value);
  const calendar = createCalendar(seasonProfile, offsetDays);
  const hints = [];
  if (day >= calendar.cutbackStart && day <= calendar.cutbackEnd) {
    hints.push(
      hint(
        'late-winter-cutback',
        'pruning',
        'important',
        'Cut the old stems before new growth',
        `Cut last year’s stems to about 15 cm between ${calendarLabel(calendar.cutbackStart)} and ${calendarLabel(calendar.cutbackEnd)}, before the new shoots emerge.`,
        MACULATUM_SOURCES.clemsonHgic.url,
      ),
    );
  }
  if (day >= calendar.floweringStart && day <= calendar.floweringEnd) {
    hints.push(
      hint(
        'pollinator-peak',
        'wildlife',
        'notice',
        'Peak pollinator season',
        'The arrays are heavily visited by butterflies and bees. Leave them standing after bloom for the seed and winter structure.',
        MACULATUM_SOURCES.illinoisWildflowers.url,
      ),
    );
  }
  if (day >= calendar.leafFallStart || day < calendar.cutbackStart) {
    hints.push(
      hint(
        'leave-winter-heads',
        'winter-interest',
        'recommended',
        'Leave the stems standing for winter',
        'Dried heads turn dark bronze and hold their shape through winter. Clear them in late winter rather than in autumn.',
        MACULATUM_SOURCES.pennStateExtension.url,
      ),
    );
  }
  return Object.freeze(hints);
}
