/**
 * Published evidence behind gray-headed coneflower, Ratibida pinnata. One scene
 * unit is one metre.
 *
 * This is the straight species as grown in a central-Ohio garden, not a named
 * cultivar. Every number below is either traceable to a source here or listed
 * in `PINNATA_RENDER_ASSUMPTIONS` (library rule 3). The sources are the
 * addresses recorded in the research report for this plant.
 */
export const PINNATA_SOURCES = Object.freeze({
  wildflowerCenter: Object.freeze({
    title: 'Ratibida pinnata, Lady Bird Johnson Wildflower Center',
    url: 'https://www.wildflower.org/plants/result.php?id_plant=RAPI',
    supports:
      'Height 3-5 ft; somewhat branched stem; one or several flowers, each on its own long stalk, may top a single stem; clumps can be divided.',
  }),
  missouriDc: Object.freeze({
    title: 'Gray-headed coneflower, Missouri Department of Conservation',
    url: 'https://mdc.mo.gov/discover-nature/field-guide/gray-headed-coneflower',
    supports:
      'One to several slender hairy stems from a horizontal rootstock; 6-15 drooping rays to 3 in.',
  }),
  missouriBotanical: Object.freeze({
    title: 'Ratibida pinnata, Missouri Botanical Garden Plant Finder (archive copy)',
    url: 'https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?kempercode=l940',
    supports:
      'Height 3-5 ft, spread 1.5-2 ft; individual plants narrow and somewhat sparsely leafed; may need staking; disk an elongated cylinder 1 in long; 3-7 reflexed rays to 3 in.',
  }),
  purdueArboretum: Object.freeze({
    title: 'Ratibida pinnata, Purdue Arboretum',
    url: 'https://www.arboretum.purdue.edu/explorer/?p=5999',
    supports: 'Height 3-5 ft, spread 1.5-2 ft; clump-forming.',
  }),
  ncStateExtension: Object.freeze({
    title: 'Ratibida pinnata, NC State Extension Plant Toolbox',
    url: 'https://plants.ces.ncsu.edu/plants/ratibida-pinnata/',
    supports:
      'Basal leaves to 8 in by 5 in; stem leaves smaller and sparse; leaves with 3-7 segments; up to 13 reflexed rays 1-3 in.',
  }),
  sdsu: Object.freeze({
    title: 'Ratibida pinnata, South Dakota State University (R. N. Reese)',
    url: 'https://openprairie.sdstate.edu/nativeplant/221',
    supports:
      'Stems arising singly or in clusters from a rhizome, branched only in the flowering part; 1 to 12 flower heads at the top of the plant.',
  }),
  usdaPlantGuide: Object.freeze({
    title: 'Plant guide, gray-headed prairie coneflower, USDA NRCS',
    url: 'https://plants.usda.gov/DocumentLibrary/plantguide/pdf/pg_rapi.pdf',
    supports:
      'Disk gray then brown; drooping rays; seed harvested October-November; seed heads eaten by birds in late fall.',
  }),
  minnesotaWildflowers: Object.freeze({
    title: 'Gray-headed coneflower, Minnesota Wildflowers',
    url: 'https://www.minnesotawildflowers.info/flower/gray-headed-coneflower',
    supports:
      'Stems unbranched except in the flowers; leaves grade from lobed and stalked below to unlobed and bract-like above; garden-grown clump photograph (about 55 heads) and a late-fall photograph of bare stems each carrying one dark seed head.',
  }),
  newMoonNursery: Object.freeze({
    title: 'Ratibida pinnata, New Moon Nursery',
    url: 'https://www.newmoonnursery.com/plant/Ratibida-pinnata',
    supports: 'Usually blooms the second year from seed; 2 ft spread.',
  }),
  prairieMoonNursery: Object.freeze({
    title: 'Yellow coneflower, Prairie Moon Nursery',
    url: 'https://www.prairiemoon.com/ratibida-pinnata-yellow-coneflower',
    supports: 'First-season bloom not unheard of, second and later seasons far more common.',
  }),
  inatOhioBloom: Object.freeze({
    title: 'iNaturalist, Ohio, Ratibida pinnata, flowering weekly histogram',
    url: 'https://api.inaturalist.org/v1/observations/histogram?taxon_id=85331&place_id=31&term_id=12&term_value_id=13&date_field=observed&interval=week_of_year',
    supports:
      'Flowering observations begin in week 25, 50% by week 30, peak weeks 28-30, a thin tail to week 40 and odd weeks to 43.',
  }),
  inatWinterPhotographs: Object.freeze({
    title: 'iNaturalist winter photographs, Oregon OH 2026-01-31 (obs 336858754) and Wooster OH 2026-02-24 (obs 340096176)',
    url: 'https://www.inaturalist.org/observations/336858754',
    supports: 'Dark seed heads still standing on bare stems in snow, late January and February.',
  }),
  clumpPhotographCounts: Object.freeze({
    title: 'Research report, heads counted from three garden-clump photographs',
    supports:
      'About 35, 45 and 55 heads (median 45); about 12-15 stems visible in one photograph; none of known age.',
  }),
});

/** Numbers the renderer needs that no source above states. */
export const PINNATA_RENDER_ASSUMPTIONS = Object.freeze([
  'stems per clump by age (3, 6, 9, 13, 14 at ages 1, 2, 3, 4, 5) are assumed except the mature 12-15, which rests on one rough photograph count; age 4 is interpolated',
  'heads per clump by age (5, 15, 25, 41, 45) are assumed except the mature median of 45 (range 30-60), counted from three photographs',
  'seed-to-seed variation: stems x0.88-1.12, heads x0.7-1.3 around those figures',
  'height by age (0.20 m plug rosette, 0.80, 1.05, 1.20, 1.22 m) is assumed except the mature 3-5 ft, modelled at its middle',
  'spread by age (0.20, 0.30, 0.40, 0.48, 0.53 m) is assumed except the mature 1.5-2 ft',
  'basal leaf counts (12, 15, 21, 27, 33) and the leaf reach up the stem (45% at age 1 to 57% at age 3 and later) are assumed; the mature lower-half-to-60% reach is read from two photographs',
  'each stem leans outward from the crown centre in its own direction, the tip tangent about 2 degrees off vertical in the centre and 15 degrees at the edge, plus or minus 2; the sources say only arching and may need staking',
  'heads sit between about 66% and 100% of the plant height on stalks of 10-45 cm branching from about 65% of the height; the sources give only long bare stalks',
  'a pinnate blade of three leaflet pairs and a terminal one, coarsely toothed, 10-20 cm on the lower stem, bract-like near the top, two leaves per node on the lowest nodes; basal leaves to 20 cm, 12 to 33 per clump (Karen asked for a leafier clump)',
  'each head holds its rays open for 14-21 days; head opening dates are spread over a skewed curve fitted by eye to the Ohio weekly histogram, with about one head in eleven opening late (day 250-285) to give the thin October tail',
  'buds are visible 16 days before a head opens; young clumps bloom 7 days (age 1) and 3 days (age 2) later than mature ones',
  'eight rays per head, 4.5-7 cm long, hanging at 60-80 degrees below horizontal; sources range from 3 to 15 rays',
  'cone 2.6 cm tall and 1.9 cm wide; bare peduncles 20-40 cm above the last leaf',
  'seed heads weather from brown to dark over winter and about one in twenty-five shatters per month; old stems are cut back between 5 March and 1 April',
  'central-Ohio phase dates other than the July start, the peak near day 205 and the thin tail into October (observations in the report) are assumed',
  'all colours are estimates from described and photographed plants, not measurements',
  'the pinnate leaf plate is generated in code: 3 leaflet pairs and a terminal leaflet, where the sources give 3-7 segments',
]);

/** Species profile for one maintained plant in a central-Ohio garden. */
export const PINNATA_PROFILE = Object.freeze({
  species: 'Ratibida pinnata',
  cultivar: 'Species',
  commonName: 'gray-headed coneflower',
  locale: 'central Ohio (USDA zone 6a/6b)',
  unit: 'metre',
  metresPerUnit: 1,
  architecture: Object.freeze({
    habit:
      'narrow upright clump of slender stems from a rhizomatous crown, branching only in the top quarter, a basal rosette of pinnate leaves and heads on long bare stalks',
    hasTrunk: false,
    woody: false,
    deciduous: true,
    crownOrigin: 'persistent rhizomatous basal crown',
    matureHeightM: 1.22,
    matureRadiusM: 0.27,
    matureCrownRadiusM: 0.09,
    modelHorizonYears: 20,
    maximumPrimaryShoots: 17,
    // Each stem leans outward from the crown centre, the tilt growing along the
    // stem: the tip tangent is about 2 degrees off vertical for central stems and
    // about 15 degrees for the clump's edge stems (Karen's review of the render).
    leanTipDegreesCentre: 2,
    leanTipDegreesEdge: 15,
    leanJitterDeg: 2,
    shootCountAnchors: Object.freeze([
      Object.freeze([0, 0]),
      Object.freeze([1, 3]),
      Object.freeze([2, 6]),
      Object.freeze([3, 9]),
      Object.freeze([4, 13]),
      Object.freeze([5, 14]),
    ]),
    headCountAnchors: Object.freeze([
      Object.freeze([0, 0]),
      Object.freeze([1, 5]),
      Object.freeze([2, 15]),
      Object.freeze([3, 25]),
      Object.freeze([4, 41]),
      Object.freeze([5, 45]),
    ]),
    basalLeafCountAnchors: Object.freeze([
      Object.freeze([0, 12]),
      Object.freeze([1, 15]),
      Object.freeze([2, 21]),
      Object.freeze([3, 27]),
      Object.freeze([5, 33]),
    ]),
    crownRadiusAnchorsM: Object.freeze([
      Object.freeze([0, 0.02]),
      Object.freeze([1, 0.04]),
      Object.freeze([2, 0.06]),
      Object.freeze([3, 0.075]),
      Object.freeze([5, 0.09]),
    ]),
    // Share of the mature stem height reached, by age.
    stemHeightScaleAnchors: Object.freeze([
      Object.freeze([0, 0.5]),
      Object.freeze([1, 0.69]),
      Object.freeze([2, 0.887]),
      Object.freeze([3, 1]),
      Object.freeze([5, 1]),
    ]),
    heightByAgeM: Object.freeze([
      Object.freeze([0, 0.2]),
      Object.freeze([1, 0.8]),
      Object.freeze([2, 1.05]),
      Object.freeze([3, 1.2]),
      Object.freeze([5, 1.22]),
    ]),
    spreadByAgeM: Object.freeze([
      Object.freeze([0, 0.2]),
      Object.freeze([1, 0.3]),
      Object.freeze([2, 0.4]),
      Object.freeze([3, 0.48]),
      Object.freeze([5, 0.53]),
    ]),
  }),
  growth: Object.freeze({
    rate: 'moderate; the first season is mostly root and a rosette',
    topGrowthAnnual: true,
    firstYearFlowers: false,
  }),
  stem: Object.freeze({
    kind: 'annual herbaceous flowering stem, slender, ridged, rough-hairy',
    // Per-stem height as a share of the mature figure.
    heightShare: Object.freeze([0.88, 1]),
    stemMaxHeightM: 1.2,
    baseRadiusM: Object.freeze([0.0028, 0.0042]),
    pedunculeRadiusM: 0.0016,
    mainAxisSections: 11,
    lateralAxisSections: 4,
    maxHeadsPerStem: 9,
    // First lateral node and how many nodes from the top bear laterals.
    // Head zone: stalks 10-45 cm, branching from about 65% of the height, heads
    // between 68% and 100% of it, stalks leaving at 12-27 degrees from vertical.
    headZoneFractions: Object.freeze([0.75, 1]),
    branchStartFraction: 0.63,
    stalkLengthM: Object.freeze([0.1, 0.45]),
    stalkOutward: Object.freeze([0.2, 0.5]),
    leafReachAnchors: Object.freeze([
      Object.freeze([1, 0.45]),
      Object.freeze([2, 0.5]),
      Object.freeze([3, 0.57]),
      Object.freeze([5, 0.57]),
    ]),
  }),
  leaf: Object.freeze({
    arrangement: 'basal rosette plus alternate stem leaves, both pinnately divided',
    segments: Object.freeze([3, 7]),
    basalLengthAnchorsM: Object.freeze([
      Object.freeze([0, 0.16]),
      Object.freeze([1, 0.18]),
      Object.freeze([2, 0.195]),
      Object.freeze([3, 0.2]),
      Object.freeze([5, 0.2]),
    ]),
    widthToLength: 0.7,
    stemLeafScaleLowTop: Object.freeze([1, 0.3]),
    colour: 'medium green to slightly grey-green, rough',
    persistentThroughWinter: false,
  }),
  head: Object.freeze({
    kind: 'capitulum with a tall gray-then-brown cone and strongly reflexed yellow rays',
    coneHeightM: 0.026,
    coneRadiusM: 0.0095,
    raysPerHead: 8,
    rayLengthM: Object.freeze([0.045, 0.07]),
    rayColour: 'yellow',
    progression:
      'gray-green bud, yellow rays opening and drooping, cone browning from the base, rays dropping, dark brown winter head',
  }),
  flowering: Object.freeze({
    observedDisplay:
      'Ohio flowering observations peak weeks 28-30 and thin out by week 40; text sources end in September',
    openDurationDays: Object.freeze([14, 21]),
    stemsFlowerInCurrentSeason: true,
    flowersFirstYear: false,
  }),
  management: Object.freeze({
    maintained: true,
    standsThroughWinter: true,
    cutbackWindow: 'late winter before spring growth',
    cutbackHeightM: 0.1,
  }),
});
