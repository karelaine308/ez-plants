import { calendarLabel, dayOfYear } from '../../calendar.js';
import { sampleAnchors } from '../../model-math.js';
import { SCOPARIUM_PROFILE, SCOPARIUM_SOURCES } from './scoparium.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const progress = (value, start, end) =>
  clamp01((value - start) / Math.max(1, end - start));

/**
 * Relative seasons for exploring weather timing around the central-Ohio
 * baseline. A C4 grass waits for warm soil, so a cold spring delays the whole
 * season. The +/-10-day scenarios are animation brackets, not station means.
 */
export const SCOPARIUM_SEASON_PROFILES = Object.freeze({
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
 * The calendar. Culm emergence (200 to 245), silvery seed heads from
 * September, copper to burgundy from day 265, the 60 to 100 cutback and the
 * 100 to 125 regrowth are the owner's decisions (27 Nov 2026) built on the
 * research report's Timing section. The other dates are declared assumptions.
 */
export const SCOPARIUM_PHASE_ASSUMPTIONS = Object.freeze({
  baseline: Object.freeze({
    cutbackStart: SCOPARIUM_PROFILE.management.cutbackDayRange[0],
    cutbackEnd: SCOPARIUM_PROFILE.management.cutbackDayRange[1],
    regrowthStart: 100,
    bladeFull: 180,
    culmEmergenceStart: SCOPARIUM_PROFILE.cane.emergenceDayRange[0],
    culmEmergenceEnd: SCOPARIUM_PROFILE.cane.emergenceDayRange[1],
    fluffStart: 244,
    fluffHoldEnd: 330,
    autumnStart: 265,
    burgundyFull: 295,
    copperFull: 320,
    weatheringStart: 300,
  }),
  note: 'Culm emergence, silvery seed heads from September, fall colour from day 265, cutback 60 to 100 and regrowth from day 100 are the owner decisions built on the research report; the fluff hold, anthesis offsets, colour transition dates and the +/-10-day season profiles are renderer assumptions.',
});

function createCalendar(seasonProfile = 'typical', offsetDays = 0) {
  if (!Object.hasOwn(SCOPARIUM_SEASON_PROFILES, seasonProfile)) {
    throw new RangeError("seasonProfile must be 'typical', 'early' or 'late'");
  }
  if (!Number.isFinite(offsetDays) || Math.abs(offsetDays) > 30) {
    throw new RangeError('offsetDays must be a finite number from -30 to 30');
  }
  const profile = SCOPARIUM_SEASON_PROFILES[seasonProfile];
  const totalOffset = profile.dayOffset + Math.round(offsetDays);
  const shift = (day) => Math.max(1, Math.min(365, day + totalOffset));
  return Object.freeze(
    Object.fromEntries(
      Object.entries(SCOPARIUM_PHASE_ASSUMPTIONS.baseline).map(([key, day]) => [
        key,
        shift(day),
      ]),
    ),
  );
}

export function getScopariumCalendar({
  seasonProfile = 'typical',
  offsetDays = 0,
} = {}) {
  return createCalendar(seasonProfile, offsetDays);
}

export const SCOPARIUM_CALENDAR = createCalendar();

export const SCOPARIUM_CALENDAR_PROVENANCE = Object.freeze({
  observationProfile:
    'August culms, silvery seed heads from September standing to about December, copper to burgundy fall colour, a 60 to 100 cutback to 2 to 4 in',
  seasonProfiles: SCOPARIUM_SEASON_PROFILES,
  assumptions: SCOPARIUM_PHASE_ASSUMPTIONS,
  sources: Object.freeze([
    SCOPARIUM_SOURCES.uwex.url,
    SCOPARIUM_SOURCES.mdc.url,
    SCOPARIUM_SOURCES.ncsu.url,
    SCOPARIUM_SOURCES.nrcsPlantGuide.url,
  ]),
});

function seasonFor(day) {
  if (day >= 60 && day <= 151) return 'spring';
  if (day >= 152 && day <= 243) return 'summer';
  if (day >= 244 && day <= 334) return 'autumn';
  return 'winter';
}

/** Growth stages on the BBCH monocotyledon scale, as the other grasses do. */
function stageFor(day, calendar) {
  if (day < calendar.cutbackStart) {
    return ['standing-dry', 'Copper blades and tan culms standing over the crown', '97'];
  }
  if (day < calendar.cutbackEnd) {
    return ['cut-back', 'Being cut back to a 2 to 4 in stubble', '00'];
  }
  if (day < calendar.regrowthStart + 10) {
    return ['dormant', 'Short stubble before the first new blades', '00'];
  }
  if (day < calendar.bladeFull) {
    return ['tillering', 'Flat bluish blades building the leaf mound', '21'];
  }
  if (day < calendar.culmEmergenceStart) {
    return ['leaf-mound', 'Full blue-green leaf mound, no culms yet', '29'];
  }
  if (day < calendar.culmEmergenceEnd) {
    return ['culm-elongation', 'Culms rising through and above the leaf mound', '39'];
  }
  if (day < calendar.autumnStart) {
    return ['flowering', 'Pink-purple flowers then silvery seed heads along the culms', '65'];
  }
  if (day < calendar.copperFull) {
    return ['senescence', 'Blades and culms turning burgundy to copper', '93'];
  }
  return ['standing-dry', 'Copper clump with silvery fluff thinning to tan', '97'];
}

/**
 * Continuous state for one leap-neutral calendar day. Per-culm timing (each
 * culm emerges on its own day in the emergence window) is decided in the model
 * from the calendar this returns.
 */
export function getScopariumPhenology(
  value = 270,
  { seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  const day = dayOfYear(value);
  const calendar = createCalendar(seasonProfile, offsetDays);
  const [phase, label, bbch] = stageFor(day, calendar);

  const cutProgress = progress(day, calendar.cutbackStart, calendar.cutbackEnd);
  const r = calendar.regrowthStart;
  // Fraction of full blade length through the regrowth: about 6 in at day 125
  // against a 12 in blade, about 60 percent of the mound by day 150, full by
  // day 180 (owner decision; slow C4 start).
  const bladeFraction = clamp01(
    sampleAnchors(
      [
        [r - 40, 0],
        [r, 0],
        [r + 25, 0.45],
        [r + 50, 0.62],
        [calendar.bladeFull, 0.95],
        [calendar.bladeFull + 20, 1],
      ],
      day,
    ),
  );
  const emergenceProgress = progress(day, r, calendar.bladeFull);
  const autumnProgress = progress(day, calendar.autumnStart, calendar.burgundyFull);
  const copperProgress = progress(day, calendar.burgundyFull, calendar.copperFull);
  const weatheringDays = 140;
  const weatheringProgress = clamp01(
    Math.max(0, day - calendar.weatheringStart) / weatheringDays,
  );
  const previousWeatheringProgress = clamp01(
    (day + 365 - calendar.weatheringStart) / weatheringDays,
  );

  // Silvery fluff visibility for a culm that finished flowering: it rises over
  // 12 days from `fluffStart`, holds to `fluffHoldEnd`, then thins through
  // December so the clump reads copper by January. Past New Year the previous
  // cohort carries on from the same curve.
  const fluffDecay = (d) => {
    if (d >= calendar.fluffHoldEnd) {
      return 1 - 0.75 * progress(d, calendar.fluffHoldEnd, 365);
    }
    return 1;
  };
  const previousFluffVisibility = clamp01(0.25 - 0.21 * progress(day, 1, 60));

  return Object.freeze({
    dayOfYear: day,
    season: seasonFor(day),
    phase,
    stage: label,
    label,
    bbch,
    bbchCode: bbch,
    bbchScale: 'cereal',
    seasonProfile,
    seasonProfileLabel: SCOPARIUM_SEASON_PROFILES[seasonProfile].label,
    offsetDays: Math.round(offsetDays),
    calendar,
    cutProgress,
    standingDryVisibility: clamp01(1 - cutProgress),
    emergenceProgress,
    bladeFraction,
    bladeProgress: bladeFraction,
    autumnProgress,
    copperProgress,
    strawProgress: copperProgress,
    weatheringProgress,
    previousWeatheringProgress,
    fluffVisibility: fluffDecay(day),
    previousFluffVisibility,
    flowersOnCurrentSeasonCulms: true,
    foliageIsDeciduousButPersistent: true,
  });
}

const hint = (id, category, priority, title, message, source) =>
  Object.freeze({ id, category, priority, title, message, source });

/** Care guidance relevant to the selected day and age. */
export function getScopariumCareHints(
  value = 270,
  { plantAgeYears = 0, seasonProfile = 'typical', offsetDays = 0 } = {},
) {
  const day = dayOfYear(value);
  const calendar = createCalendar(seasonProfile, offsetDays);
  if (!Number.isFinite(plantAgeYears) || plantAgeYears < 0) {
    throw new RangeError('plantAgeYears must be a non-negative finite number');
  }
  const hints = [];

  if (day >= calendar.cutbackStart && day <= calendar.cutbackEnd) {
    hints.push(
      hint(
        'spring-cutback',
        'pruning',
        'important',
        'Cut the clump to 2 to 4 inches',
        `The cut falls now, from ${calendarLabel(calendar.cutbackStart)}: take last year's copper clump down to 2 to 4 inches before growth starts.`,
        SCOPARIUM_SOURCES.uwex.url,
      ),
    );
  }
  if (day > calendar.cutbackEnd && day < calendar.regrowthStart + 25) {
    hints.push(
      hint(
        'wait-for-warm-soil',
        'phenology',
        'notice',
        'Slow to wake up',
        `Little bluestem is a warm-season grass and starts growth late; expect the first new blades about ${calendarLabel(calendar.regrowthStart)}.`,
        SCOPARIUM_SOURCES.nrcsPlantGuide.url,
      ),
    );
  }
  if (day >= calendar.autumnStart || day < calendar.cutbackStart) {
    hints.push(
      hint(
        'leave-standing-for-winter',
        'seasonal-care',
        'recommended',
        'Leave the clump standing over winter',
        'The copper blades and silvery seed heads carry the winter display and shelter the crown; tidy at the late-winter cut.',
        SCOPARIUM_SOURCES.uwex.url,
      ),
    );
  }
  if (plantAgeYears < 1 && day >= calendar.culmEmergenceStart) {
    hints.push(
      hint(
        'first-season-vegetative',
        'phenology',
        'notice',
        'A first-year plug stays leafy',
        'Seed-grown plants invest in roots before shoots; expect blades only in the first year, and a full clump after two or three.',
        SCOPARIUM_SOURCES.nrcsPlantGuide.url,
      ),
    );
  }
  return Object.freeze(hints);
}

export { dayOfYear };
