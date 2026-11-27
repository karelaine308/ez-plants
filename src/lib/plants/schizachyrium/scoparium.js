/**
 * Real-world units used by the little bluestem model. One scene unit is one
 * metre.
 */
export const METRES_PER_UNIT = 1;

/**
 * Sources behind the profile. Every URL is one the research report
 * (review/little-bluestem/research-report.md) read; nothing here was added from
 * memory. Photographs are listed by description only, never copied.
 */
export const SCOPARIUM_SOURCES = Object.freeze({
  nrcsPlantGuide: Object.freeze({
    title: 'Little bluestem Plant Guide, USDA NRCS',
    url: 'https://plants.usda.gov/DocumentLibrary/plantguide/pdf/pg_scsc.pdf',
    supports:
      'Height 1 to 3 ft; blades 2 to 12 in long and 1.5 to 6 mm wide; each culm ends in a 1 to 3 in raceme; new growth bluish maturing reddish-gold; fluffy silver-white seed; reddish tint through winter; growth begins in late spring; weak seedling vigour.',
  }),
  nrcsSeedling: Object.freeze({
    title: 'Seedling ID Guide for Native Prairie Plants, USDA NRCS Plant Materials',
    url: 'https://www.nrcs.usda.gov/Internet/FSE_PLANTMATERIALS/publications/mopmcpu6313.pdf',
    supports:
      'Seed-grown seedling: about four true leaves and 4.5 in tall at eight weeks, thin blades arching at the tip; upright clumps of green leaves with a trace of blue at the base; blooms August to September. The report records that this address is not confirmed to be this publication.',
  }),
  mdc: Object.freeze({
    title: 'Little bluestem, Missouri Department of Conservation field guide',
    url: 'https://mdc.mo.gov/discover-nature/field-guide/little-bluestem',
    supports:
      'Flowering stalks 1 to 4 ft; blades about 1/4 in wide with bluish bases; leaves turn coppery in fall; flowering stems branch toward the tip; clusters 1 to 3 in, tan or grayish-white and fluffy; heads develop August to October.',
  }),
  lbj: Object.freeze({
    title: 'Schizachyrium scoparium, Lady Bird Johnson Wildflower Center',
    url: 'https://www.wildflower.org/plants/result.php?id_plant=scsc',
    supports:
      'Dense mounds 18 to 24 in; wild stems often 5 ft by September (an outlier for a dry garden); crown up to a foot across; mahogany-red with white seed tufts in fall; colour remains nearly all winter.',
  }),
  ncsu: Object.freeze({
    title: 'Schizachyrium scoparium, NC State Extension Plant Toolbox',
    url: 'https://plants.ces.ncsu.edu/plants/Schizachyrium-scoparium',
    supports:
      'Height 2 to 4 ft, width 1.5 to 3 ft; very warm copper that does not fade through winter; racemes appear in August.',
  }),
  uwex: Object.freeze({
    title: 'Little bluestem, UW-Madison Division of Extension Horticulture',
    url: 'https://hort.extension.wisc.edu/articles/little-bluestem-schizachyrium-scoparium/',
    supports:
      'Clumps 1 to 2 ft high until late summer, then stems elongate; slow to emerge in spring with flat bluish shoots; frost turns plants reddish-coppery and they stand through winter; shorter on dry infertile sites; cut back to 2 to 4 in in late winter or early spring.',
  }),
  umd: Object.freeze({
    title: 'Little bluestem, University of Maryland Extension',
    url: 'https://extension.umd.edu/resource/little-bluestem/',
    supports:
      '1.5 to 3 ft; dry poor soil; silky seeds in fall; clumps arch over in snow and stand up again.',
  }),
  uiuc: Object.freeze({
    title: 'Little bluestem, University of Illinois Extension',
    url: 'https://extension.illinois.edu/grasses/little-bluestem',
    supports:
      'About 3 ft; stems yellow to reddish brown with red nodes, flattened; foliage turns reddish-orange.',
  }),
  kstate: Object.freeze({
    title: 'Schizachyrium scoparium, K-State ornamental grass trial',
    url: 'https://www.k-state.edu/turf/resources/ornamental-grasses/grasses/schizachyrium-scoparium.html',
    supports:
      'Measured size 28 in tall by 12 in wide in year one and 32 by 20 in in year two; much fuller in the second year; looks very good through winter. Pot plants of unstated size, so a year ahead of a seed-grown plug.',
  }),
  ttu: Object.freeze({
    title: 'Schizachyrium scoparium, Texas Tech landscape sheet',
    url: 'https://www.depts.ttu.edu/plantresources/Pages/directories/landscape-info-sheets/herbaceous-info/Schizachyrium_scoparium.php',
    supports: '2 to 3 ft by 1 to 2 ft; blades turn red, orange and purple in fall.',
  }),
  npt: Object.freeze({
    title: 'Schizachyrium scoparium, Native Plant Trust Plant Finder',
    url: 'https://plantfinder.nativeplanttrust.org/plant/Schizachyrium-scoparium',
    supports: 'Height 12 to 48 in, spread 8 to 24 in; orange to brown fall foliage.',
  }),
  bwsr: Object.freeze({
    title: 'Featured plant: little bluestem, Minnesota BWSR',
    url: 'https://www.bwsr.state.mn.us/sites/default/files/2021-06/Featured%20Plant%20July%202021%20Little%20Bluestem%20ii.pdf',
    supports:
      'Up to 3 ft in midsummer; blades up to 10 in; fluffy white seed heads follow the bloom; blue-green to copper-red after frost.',
  }),
  umces: Object.freeze({
    title: 'Little bluestem summary, UMCES',
    url: 'https://www.umces.edu/sites/default/files/Little-bluestem-summary.pdf',
    supports:
      'Slow establishment, full establishment may take more than two years; leaf height 2 to 12 in; height at seed head 1 to 4 ft.',
  }),
  eiu: Object.freeze({
    title: 'Schizachyrium scoparium, Eastern Illinois University prairie page',
    url: 'https://castle.eiu.edu/prairie/schiscop.htm',
    supports: 'Flowers August to September, fruit October; seedling flat tillers reddish at the base.',
  }),
  inatPhotographs: Object.freeze({
    title: 'iNaturalist photographs of Ohio and other clumps (look only)',
    supports:
      'Proportions measured on screen: leaf mound 30 to 46 percent of culm-tip height, culms 2.2 to 3.3 times the mound, crown 26 to 49 percent and leaf fan 49 to 78 percent of height, culm width at the upper third 45 to 64 percent of height; culm counts estimated 10 to 100 by clump; purple culms and burgundy blades in October, copper in January; fluff still on culms 10 December and mostly gone by 11 January. Individual photographs are not reputable alone.',
  }),
});

/**
 * Declared assumptions: everything with no source behind it. Karen checks
 * these against a photograph.
 */
export const SCOPARIUM_RENDER_ASSUMPTIONS = Object.freeze({
  culmTiltDegrees:
    'centre 6, edge 24 at the tip, each culm in its own outward direction; the angles are assumed, the flare is from the photographs',
  racemesPerCulm: 'five to eight, small and spaced along the upper culm, assumed: no source or photograph counted them',
  headZone:
    'racemes spaced along the upper half or a little more of each culm, starting at 0.42 of the culm height (research: "upper half", airy with culms showing through)',
  tuftCounts:
    'about 60 tillers (40 flowering and 20 leafy) in a mature clump, 4 to 6 blades per tiller; tillers by age are assumed, culms by age follow the owner decision',
  plugBladeCount: 'about 8 blades from 2 tillers in the first spring, 22 from 4 by autumn',
  anthesisDays:
    'each culm is in bloom for 10 days from 13 days after it emerges, so August and September both show flowers; the report has no weekly bloom curve',
  colours: 'hex values were chosen by eye from the report descriptions',
  bladeLengthMedian: 'inner tufts 0.36 m, outer 0.17 m so the median is about 0.26 m',
});

/** Species profile for a maintained plant in central Ohio. */
export const SCOPARIUM_PROFILE = Object.freeze({
  species: 'Schizachyrium scoparium',
  acceptedSpecies: 'Schizachyrium scoparium',
  cultivar: 'Species',
  commonName: 'little bluestem',
  locale: 'central Ohio, zone 6b',
  unit: 'metre',
  metresPerUnit: METRES_PER_UNIT,
  architecture: Object.freeze({
    habit:
      'tight clump of narrow bluish basal blades with wiry, nearly bare culms rising above it and flaring outward',
    hasTrunk: false,
    woody: false,
    crownOrigin: 'persistent basal crown; short rhizomes are minor in a garden',
    // Highest point at age 5 on the peak day (the model's median over seeds is
    // 0.78 m, 2.6 ft): owner decision 2.5 ft (2 to 3 ft) for the culm tip.
    matureHeightM: 0.78,
    heightRangeM: Object.freeze([0.61, 0.91]),
    // Leaf mound 1.1 ft: owner decision accepted 27 Nov 2026 (1 to 1.5 ft).
    matureFoliageHeightM: 0.33,
    // Spread 1.9 ft (1.5 to 2 ft, report overlap of the garden sources).
    matureRadiusM: 0.29,
    spreadRangeM: Object.freeze([0.46, 0.61]),
    // Crown at the soil: about 7 in across (photographs: 26 to 49 percent of
    // height); LBJ one foot for wild plants.
    matureCrownRadiusM: 0.085,
    crownRadiusAnchorsM: Object.freeze([
      Object.freeze([0, 0.022]),
      Object.freeze([1, 0.04]),
      Object.freeze([2, 0.055]),
      Object.freeze([3, 0.068]),
      Object.freeze([5, 0.08]),
      Object.freeze([8, 0.085]),
      Object.freeze([12, 0.085]),
    ]),
    modelHorizonYears: 20,
  }),
  growth: Object.freeze({
    photosynthesis: 'C4 warm-season',
    rate: 'slow to establish',
    // Blade size relative to a mature clump, indexed by age plus the share of
    // the season's growth done, so the value at age k is the size reached at
    // the end of year k - 1. Age 0 is a seed-grown plug, with a 0.2 m mound at
    // the end of its first season (8 in, plan table).
    plantAgeScaleAnchors: Object.freeze([
      Object.freeze([0, 0.5]),
      Object.freeze([1, 0.64]),
      Object.freeze([2, 0.78]),
      Object.freeze([3, 0.91]),
      Object.freeze([4, 0.97]),
      Object.freeze([6, 1]),
    ]),
    // Culm length relative to a mature culm (1.8, 2.2, 2.4, 2.5 ft). Assumed
    // from the owner's mature height and the K-State trial.
    culmHeightAnchors: Object.freeze([
      Object.freeze([0, 0.6]),
      Object.freeze([1, 0.72]),
      Object.freeze([2, 0.89]),
      Object.freeze([3, 0.97]),
      Object.freeze([5, 1]),
      Object.freeze([8, 1]),
    ]),
    // Racemes per culm relative to a mature culm (assumption).
    racemeAgeAnchors: Object.freeze([
      Object.freeze([1, 0.55]),
      Object.freeze([2, 0.75]),
      Object.freeze([3, 0.88]),
      Object.freeze([5, 1]),
      Object.freeze([8, 1]),
    ]),
    // Culm count: owner decision, median 40 at maturity (range 25 to 80 in the
    // report's photo estimates), 12 / 22 / 35 at ages 1, 2 and 3.
    matureCulmCount: Object.freeze({ median: 40, range: Object.freeze([28, 70]) }),
    // Tuft sites by age for a median clump (assumption; plug from the NRCS
    // seedling guide and the Stow plug photograph in the report).
    tuftCountAnchors: Object.freeze([
      Object.freeze([0, 2]),
      Object.freeze([0.75, 4]),
      Object.freeze([1.6, 18]),
      Object.freeze([2.6, 32]),
      Object.freeze([3.6, 50]),
      Object.freeze([5.6, 62]),
      Object.freeze([8, 65]),
      Object.freeze([12, 66]),
    ]),
    // Cumulative culm-bearing tufts against tuft ordinal (median clump):
    // reproduces 12, 22, 35 and 40 culms at ages 1, 2, 3 and 5.
    culmByTuftAnchors: Object.freeze([
      Object.freeze([0, 0]),
      Object.freeze([5, 0]),
      Object.freeze([18, 12]),
      Object.freeze([32, 22]),
      Object.freeze([50, 35]),
      Object.freeze([62, 40]),
      Object.freeze([66, 40]),
    ]),
    firstCulmAgeYears: 1,
    // Culms are sent up on days 200 to 245, about 0.6 of the way through the
    // year, so a tuft born by then in a year can carry one that year.
    culmSeasonFraction: 0.6,
    heightFactorRange: Object.freeze([0.85, 1.15]),
  }),
  cane: Object.freeze({
    kind: 'culm',
    // Mean tip about 2.35 ft, longest about 2.55 ft on a median clump.
    lengthM: 0.715,
    lengthJitter: Object.freeze([0.97, 1.03]),
    edgeLengthLoss: 0,
    baseRadiusM: Object.freeze([0.0009, 0.0013]),
    nodeCount: 8,
    tipTiltDegrees: Object.freeze({ centre: 6, edge: 24 }),
    emergenceDayRange: Object.freeze([200, 245]),
    growthDays: 25,
    childParentRadiusRatio: 0.6,
    axisTaperRatios: Object.freeze([1, 0.7, 0.5, 0.35]),
    wholeCanePruning: true,
    barkDescription:
      'thin wiry flattened culms, green to red-purple with red nodes, copper to tan in winter',
  }),
  leaf: Object.freeze({
    arrangement: 'basal tufts of 4 to 6 blades',
    bladesPerTuft: Object.freeze([4, 6]),
    shape: 'narrow folded blades, upright in the middle of the clump and bowing outward at the edge',
    // Inner tufts longest (0.36 m), outer shortest (0.17 m).
    lengthInnerM: 0.46,
    lengthOuterM: 0.17,
    widthM: Object.freeze([0.002, 0.005]),
    stubbleM: 0.075,
    autumnColours: Object.freeze(['burgundy', 'copper', 'tan']),
    persistentThroughWinter: true,
  }),
  panicle: Object.freeze({
    position: 'racemes on short branches along the upper half of each culm',
    form: 'silvery awned raceme',
    racemesPerCulm: Object.freeze([5, 8]),
    zoneStartFraction: 0.42,
    lengthM: Object.freeze([0.03, 0.062]),
    widthM: Object.freeze([0.012, 0.02]),
    branchAngleDegrees: Object.freeze([25, 45]),
    colourSequence: Object.freeze([
      'pale pink-purple anthers',
      'silvery white fluff',
      'tan-grey wisps',
    ]),
    note: 'A crossed alpha card carries the feathery awns; individual awns are not geometry.',
  }),
  flowering: Object.freeze({
    wood: 'current-season culms only',
    observedDisplay: 'culms from August, silvery seed heads from September standing to about December',
    anthesisOffsetDays: Object.freeze([13, 23]),
    persistence: 'culms stand through winter; fluff mostly gone by January',
  }),
  management: Object.freeze({
    cuttingWindow: 'late winter to early spring, before new growth',
    cutbackDayRange: Object.freeze([60, 100]),
    cutbackHeightM: 0.075,
    standsThroughWinter: true,
    winterInterestNote:
      'Copper blades and tan culms stand until the late-winter cut to 2 to 4 in.',
  }),
});
