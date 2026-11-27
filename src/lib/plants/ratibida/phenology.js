import { calendarLabel, dayOfYear, monthDayToDay } from '../../calendar.js';
import { PINNATA_SOURCES } from './pinnata.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const progress = (value, start, end) =>
  clamp01((value - start) / Math.max(1, end - start));

/** Weather-timing brackets around the central-Ohio baseline. */
export const PINNATA_SEASON_PROFILES = Object.freeze({
  typical: Object.freeze({
    label: 'Typical central-Ohio season',
    dayOffset: 0,
    observedAnchor: true,
  }),
  early: Object.freeze({ label: 'Early warm season', dayOffset: -10, observedAnchor: false }),
  late: Object.freeze({ label: 'Late cool season', dayOffset: 10, observedAnchor: false }),
});

/**
 * Continuous renderer calendar for central Ohio. The July start, the peak near
 * 24 July (week 30), the thin tail to the end of October (owner decision,
 * agreeing with the Ohio iNaturalist weekly histogram) and the winter-standing
 * seed heads are observations; every other date is a declared assumption.
 */
export const PINNATA_PHASE_ASSUMPTIONS = Object.freeze({
  baseline: Object.freeze({
    cutbackStart: monthDayToDay(3, 5),
    cutbackEnd: monthDayToDay(4, 1),
    emergenceStart: monthDayToDay(4, 10),
    leafExpansionStart: monthDayToDay(4, 15),
    stemElongationStart: monthDayToDay(5, 15),
    foliageFullExpansion: monthDayToDay(6, 15),
    stemFullHeight: monthDayToDay(6, 28),
    budStart: monthDayToDay(6, 15),
    floweringStart: monthDayToDay(7, 1),
    floweringPeak: monthDayToDay(7, 24),
    floweringEnd: monthDayToDay(10, 31),
    autumnStart: monthDayToDay(9, 25),
    firstFrost: monthDayToDay(10, 22),
    leafFallStart: monthDayToDay(10, 28),
    leafFallEnd: monthDayToDay(11, 14),
    dryFull: monthDayToDay(11, 15),
  }),
  note: 'Bloom from July with a peak in the third week of July and a thin tail into October, and dark heads standing through winter, are observations. Emergence, elongation, frost and leaf-fall dates, the cutback date and the +/-10-day season brackets are renderer assumptions.',
});

function createCalendar(seasonProfile = 'typical', offsetDays = 0) {
  if (!Object.hasOwn(PINNATA_SEASON_PROFILES, seasonProfile)) {
    throw new RangeError("seasonProfile must be 'typical', 'early' or 'late'");
  }
  if (!Number.isFinite(offsetDays) || Math.abs(offsetDays) > 30) {
    throw new RangeError('offsetDays must be a finite number from -30 to 30');
  }
  const total = PINNATA_SEASON_PROFILES[seasonProfile].dayOffset + Math.round(offsetDays);
  const shift = (day) => Math.max(1, Math.min(365, day + total));
  return Object.freeze(
    Object.fromEntries(
      Object.entries(PINNATA_PHASE_ASSUMPTIONS.baseline).map(([key, day]) => [key, shift(day)]),
    ),
  );
}

export function getPinnataCalendar({ seasonProfile = 'typical', offsetDays = 0 } = {}) {
  return createCalendar(seasonProfile, offsetDays);
}

export const PINNATA_CALENDAR = createCalendar();

export const PINNATA_CALENDAR_PROVENANCE = Object.freeze({
  observationProfile:
    'Ohio flowering observations: start late June, peak weeks 28-30, thin tail to week 40; dark seed heads standing in January and February',
  seasonProfiles: PINNATA_SEASON_PROFILES,
  assumptions: PINNATA_PHASE_ASSUMPTIONS,
  sources: Object.freeze([
    PINNATA_SOURCES.inatOhioBloom.url,
    PINNATA_SOURCES.inatWinterPhotographs.url,
    PINNATA_SOURCES.usdaPlantGuide.url,
    PINNATA_SOURCES.newMoonNursery.url,
  ]),
});

function seasonFor(day) {
  if (day >= 60 && day <= 151) return 'spring';
  if (day >= 152 && day <= 243) return 'summer';
  if (day >= 244 && day <= 334) return 'autumn';
  return 'winter';
}

function stageFor(day, c) {
  if (day < c.cutbackStart) return ['standing-dry', 'Bare tan stems carrying dark seed heads', '97'];
  if (day < c.cutbackEnd) return ['cut-back', 'Last year’s stems being cut back', '00'];
  if (day < c.emergenceStart) return ['dormant', 'Dormant crown', '00'];
  if (day < c.stemElongationStart) return ['emergence', 'Basal rosette of pinnate leaves growing', '19'];
  if (day < c.budStart) return ['stem-elongation', 'Slender stems climbing', '31'];
  if (day < c.floweringStart) return ['flower-bud', 'Gray-green buds forming on tall stalks', '55'];
  if (day < c.floweringPeak) return ['early-flowering', 'First yellow rays drooping from the cones', '61'];
  if (day < c.autumnStart) return ['peak-flowering', 'Heads opening in succession, others turning to seed', '65'];
  if (day < c.floweringEnd) return ['late-flowering', 'A few late heads among dark seed heads', '69'];
  if (day < c.dryFull) return ['senescence', 'Leaves browning, dark seed heads on tan stems', '93'];
  return ['standing-dry', 'Bare tan stems carrying dark seed heads', '97'];
}

/** Continuous state for one leap-neutral calendar day. */
export function getPinnataPhenology(value = 205, { seasonProfile = 'typical', offsetDays = 0 } = {}) {
  const day = dayOfYear(value);
  const calendar = createCalendar(seasonProfile, offsetDays);
  const [phase, label, bbch] = stageFor(day, calendar);
  const cutProgress = progress(day, calendar.cutbackStart, calendar.cutbackEnd);
  const beforeSpringCut = day < calendar.cutbackEnd;
  const lateDryStand = day >= calendar.dryFull;
  const base = PINNATA_PHASE_ASSUMPTIONS.baseline;
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
    // Days this season's calendar sits from the baseline one.
    shiftDays: calendar.floweringStart - base.floweringStart,
    cutProgress,
    standingDryVisibility: clamp01(beforeSpringCut ? 1 - cutProgress : lateDryStand ? 1 : 0),
    emergenceProgress: progress(day, calendar.emergenceStart, calendar.foliageFullExpansion),
    leafProgress: progress(day, calendar.leafExpansionStart, calendar.foliageFullExpansion),
    stemGrowthProgress: progress(day, calendar.stemElongationStart, calendar.stemFullHeight),
    autumnProgress: progress(day, calendar.autumnStart, calendar.leafFallEnd),
    dryProgress: progress(day, calendar.autumnStart, calendar.dryFull),
    flowersOnCurrentSeasonStems: true,
    foliageDeciduous: true,
    winterSeedHeadsRetained: true,
  });
}

const hint = (id, category, priority, title, message, source) =>
  Object.freeze({ id, category, priority, title, message, source });

/** Care guidance relevant to the selected day. */
export function getPinnataCareHints(value = 205, { seasonProfile = 'typical', offsetDays = 0 } = {}) {
  const day = dayOfYear(value);
  const c = createCalendar(seasonProfile, offsetDays);
  const hints = [];
  if (day >= c.cutbackStart && day <= c.cutbackEnd) {
    hints.push(
      hint(
        'late-winter-cutback',
        'pruning',
        'important',
        'Cut the old stems before new growth',
        `Cut last year’s stems to the crown between ${calendarLabel(c.cutbackStart)} and ${calendarLabel(c.cutbackEnd)}, before the rosette grows.`,
        PINNATA_SOURCES.inatWinterPhotographs.url,
      ),
    );
  }
  if (day >= c.floweringStart && day <= c.floweringEnd) {
    hints.push(
      hint(
        'staking',
        'support',
        'notice',
        'Tall stems may flop',
        'Plants are narrow and may need staking; tight clumps of several stems hold each other up.',
        PINNATA_SOURCES.missouriBotanical.url,
      ),
    );
  }
  if (day >= c.leafFallStart || day < c.cutbackStart) {
    hints.push(
      hint(
        'leave-winter-heads',
        'winter-interest',
        'recommended',
        'Leave the stems standing for winter',
        'The dark cones stand through winter and feed birds; clear them in late winter.',
        PINNATA_SOURCES.usdaPlantGuide.url,
      ),
    );
  }
  return Object.freeze(hints);
}
