import { dayOfYear, monthDayToDay } from '../../calendar.js';
import { NOVAE_ANGLIAE_SOURCES } from './novaeangliae.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const progress = (value, start, end) =>
  clamp01((value - start) / Math.max(1, end - start));

/** Weather-timing brackets around the central-Ohio baseline. */
export const NOVAE_ANGLIAE_SEASON_PROFILES = Object.freeze({
  typical: Object.freeze({
    label: 'Typical central-Ohio season',
    dayOffset: 0,
    observedAnchor: true,
  }),
  early: Object.freeze({ label: 'Early warm season', dayOffset: -10, observedAnchor: false }),
  late: Object.freeze({ label: 'Late cool season', dayOffset: 10, observedAnchor: false }),
});

/**
 * Continuous renderer calendar for central Ohio. Bloom from August to October
 * with a peak near 23 September (owner chart, agreeing with the Ohio
 * iNaturalist weekly counts), mid-April emergence and winter-standing stems
 * and seed heads are observations; every other date is a declared assumption.
 */
export const NOVAE_ANGLIAE_PHASE_ASSUMPTIONS = Object.freeze({
  baseline: Object.freeze({
    stemBreakStart: monthDayToDay(3, 25),
    stemBreakEnd: monthDayToDay(4, 10),
    emergenceStart: monthDayToDay(4, 15),
    leafExpansionStart: monthDayToDay(4, 25),
    stemElongationStart: monthDayToDay(5, 1),
    foliageFullExpansion: monthDayToDay(6, 30),
    lowerLeafDropStart: monthDayToDay(7, 15),
    basalWitherStart: monthDayToDay(7, 9),
    basalWitherEnd: monthDayToDay(8, 23),
    budStart: monthDayToDay(8, 1),
    floweringStart: monthDayToDay(8, 13),
    stemFullHeight: monthDayToDay(8, 25),
    floweringPeak: monthDayToDay(9, 23),
    tuftStart: monthDayToDay(9, 25),
    autumnStart: monthDayToDay(10, 5),
    firstFrost: monthDayToDay(10, 22),
    tuftEnd: monthDayToDay(10, 28),
    floweringEnd: monthDayToDay(10, 31),
    leafFallStart: monthDayToDay(11, 1),
    dryFull: monthDayToDay(11, 8),
  }),
  /** Days over which the leaves that do not cling let go of the stems. */
  deadLeafDropDays: 100,
  note: 'August to October bloom with a late-September peak, dry stems and seed heads standing to March, dead leaves clinging, and mid-April emergence are observations. Elongation, lower-leaf drop, frost, leaf-drop rate, the stem breakdown dates and the +/-10-day season brackets are renderer assumptions.',
});

function createCalendar(seasonProfile = 'typical', offsetDays = 0) {
  if (!Object.hasOwn(NOVAE_ANGLIAE_SEASON_PROFILES, seasonProfile)) {
    throw new RangeError("seasonProfile must be 'typical', 'early' or 'late'");
  }
  if (!Number.isFinite(offsetDays) || Math.abs(offsetDays) > 30) {
    throw new RangeError('offsetDays must be a finite number from -30 to 30');
  }
  const total = NOVAE_ANGLIAE_SEASON_PROFILES[seasonProfile].dayOffset + Math.round(offsetDays);
  const shift = (day) => Math.max(1, Math.min(365, day + total));
  return Object.freeze(
    Object.fromEntries(
      Object.entries(NOVAE_ANGLIAE_PHASE_ASSUMPTIONS.baseline).map(([key, day]) => [key, shift(day)]),
    ),
  );
}

export function getNovaeAngliaeCalendar({ seasonProfile = 'typical', offsetDays = 0 } = {}) {
  return createCalendar(seasonProfile, offsetDays);
}

export const NOVAE_ANGLIAE_CALENDAR = createCalendar();

export const NOVAE_ANGLIAE_CALENDAR_PROVENANCE = Object.freeze({
  observationProfile:
    'August to October bloom with a median in the week of 23-29 September in Ohio iNaturalist counts; dry stems and seed heads standing December to March; shoots emerging mid April',
  seasonProfiles: NOVAE_ANGLIAE_SEASON_PROFILES,
  assumptions: NOVAE_ANGLIAE_PHASE_ASSUMPTIONS,
  sources: Object.freeze(
    [
      NOVAE_ANGLIAE_SOURCES.chicagoBotanic.url,
      NOVAE_ANGLIAE_SOURCES.bwsr.url,
      NOVAE_ANGLIAE_SOURCES.mtCubaTrial.url,
    ].filter(Boolean),
  ),
});

function seasonFor(day) {
  if (day >= 60 && day <= 151) return 'spring';
  if (day >= 152 && day <= 243) return 'summer';
  if (day >= 244 && day <= 334) return 'autumn';
  return 'winter';
}

function stageFor(day, c) {
  if (day < c.stemBreakStart) return ['standing-dry', 'Dry stems and tan seed heads standing, dead brown leaves clinging', '97'];
  if (day < c.emergenceStart) return ['stem-breakdown', 'Old stems breaking down over leaf litter', '00'];
  if (day < c.stemElongationStart) return ['emergence', 'Upright leafy shoots coming up through the litter', '09'];
  if (day < c.budStart) return ['stem-elongation', 'Leafy stems climbing, lower leaves yellowing from midsummer', '31'];
  if (day < c.floweringStart) return ['flower-bud', 'Leafy panicles forming green buds', '55'];
  if (day < c.floweringPeak - 14) return ['early-flowering', 'First violet heads opening', '61'];
  if (day < c.floweringPeak + 14) return ['peak-flowering', 'Peak bloom: dense clusters of violet heads with yellow discs', '65'];
  if (day < c.floweringEnd) return ['late-flowering', 'Late heads among tan seed heads', '69'];
  if (day < c.dryFull) return ['senescence', 'Leaves browning and clinging, seed heads fluffing', '93'];
  return ['standing-dry', 'Dry stems and tan seed heads standing, dead brown leaves clinging', '97'];
}

/** Continuous state for one leap-neutral calendar day. */
export function getNovaeAngliaePhenology(value = 266, { seasonProfile = 'typical', offsetDays = 0 } = {}) {
  const day = dayOfYear(value);
  const calendar = createCalendar(seasonProfile, offsetDays);
  const [phase, label, bbch] = stageFor(day, calendar);
  const breakProgress = progress(day, calendar.stemBreakStart, calendar.stemBreakEnd);
  const beforeSpringBreak = day < calendar.stemBreakEnd;
  const lateDryStand = day >= calendar.dryFull;
  const base = NOVAE_ANGLIAE_PHASE_ASSUMPTIONS.baseline;
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
    seasonProfileLabel: NOVAE_ANGLIAE_SEASON_PROFILES[seasonProfile].label,
    offsetDays: Math.round(offsetDays),
    calendar,
    // Days this season's calendar sits from the baseline one.
    shiftDays: calendar.floweringPeak - base.floweringPeak,
    breakProgress,
    standingDryVisibility: clamp01(beforeSpringBreak ? 1 - breakProgress : lateDryStand ? 1 : 0),
    emergenceProgress: progress(day, calendar.emergenceStart, calendar.foliageFullExpansion),
    leafProgress: progress(day, calendar.leafExpansionStart, calendar.foliageFullExpansion),
    stemGrowthProgress: progress(day, calendar.stemElongationStart, calendar.stemFullHeight),
    // Leaves go brown from early October and hang limp after the first frost.
    autumnProgress: progress(day, calendar.autumnStart, calendar.dryFull),
    wiltProgress:
      day >= calendar.firstFrost
        ? progress(day, calendar.firstFrost, calendar.firstFrost + 20)
        : beforeSpringBreak
          ? 1
          : 0,
    dryProgress: progress(day, calendar.autumnStart, calendar.dryFull),
    flowersOnCurrentSeasonStems: true,
    foliageDeciduous: true,
    winterSeedHeadsRetained: true,
  });
}

const hint = (id, category, priority, title, message, source) =>
  Object.freeze({ id, category, priority, title, message, source });

/** Care guidance relevant to the selected day. */
export function getNovaeAngliaeCareHints(value = 266, { seasonProfile = 'typical', offsetDays = 0 } = {}) {
  const day = dayOfYear(value);
  const c = createCalendar(seasonProfile, offsetDays);
  const hints = [];
  if (day >= c.emergenceStart && day <= c.emergenceStart + 90) {
    hints.push(
      hint(
        'divide-crowded-clump',
        'division',
        'notice',
        'Divide a crowded clump in spring',
        'The clump fills in about three years and loses vigour when crowded; divide in spring as the shoots come up.',
        NOVAE_ANGLIAE_SOURCES.chicagoBotanic.url,
      ),
    );
  }
  if (day >= c.floweringStart && day <= c.floweringEnd) {
    hints.push(
      hint(
        'staking',
        'support',
        'notice',
        'Tall stems may lean or flop',
        'Stems start upright but may not carry their own weight once the panicles open; neighbours or a support help.',
        NOVAE_ANGLIAE_SOURCES.chicagoBotanic.url,
      ),
    );
  }
  if (day >= c.leafFallStart || day < c.stemBreakStart) {
    hints.push(
      hint(
        'leave-winter-stems',
        'winter-interest',
        'recommended',
        'Leave the stems and leaves standing for winter',
        'Seed heads stand for weeks after frost and the old stems shelter overwintering insects; the fallen leaves stay as mulch.',
        NOVAE_ANGLIAE_SOURCES.mtCubaTrial.url,
      ),
    );
  }
  return Object.freeze(hints);
}
