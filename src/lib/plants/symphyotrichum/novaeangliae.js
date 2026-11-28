/**
 * Published evidence behind New England aster, Symphyotrichum novae-angliae.
 * One scene unit is one metre.
 *
 * This is the straight species as grown in a central-Ohio garden, not a named
 * cultivar. Every number below is either traceable to a source here, an owner
 * decision (27 Nov 2026) or listed in `NOVAE_ANGLIAE_RENDER_ASSUMPTIONS`
 * (library rule 3). Sources are the ones named in the research report for
 * this plant; entries without an address are named there without one.
 */
export const NOVAE_ANGLIAE_SOURCES = Object.freeze({
  chicagoBotanic: Object.freeze({
    title: 'A Comparative Study of Cultivated Asters, Chicago Botanic Garden Plant Evaluation Notes 36 (2013)',
    url: 'https://ChicagoBotanic.org/downloads/planteval_notes/no36_asters.pdf',
    supports:
      'Species plant, trial 2003-2009: purple heads 1 3/4 in, bloom late September to mid November, height 69 in and width 60 in measured before flopping, no winter injury; fast-growing, divide every few years; lower leaves of many asters desiccate leaving bare stems.',
  }),
  mtCubaTrial: Object.freeze({
    title: 'Aster trial, Mt Cuba Center',
    url: 'https://mtcubacenter.org/trials/aster/',
    supports:
      'Cultivars only, nothing for the species (cultivars 36-72 in wide by year 3, 2009; asters frequently splay from the weight of the flowers); the species page it sits with says to pinch before mid-July for a shorter, fuller plant and to leave stems standing for insects.',
  }),
  bwsr: Object.freeze({
    title: 'Featured plant, New England aster, Minnesota Board of Water and Soil Resources (September 2024)',
    url: 'https://bwsr.state.mn.us/sites/default/files/2024-08/featured_plant_september_2024_new_england_aster_0.pdf',
    supports:
      '40-100 rays per head; leaves clasp the stem and grow abundantly along the branches; height up to 5 ft; 66,000-80,000 seeds per ounce; fall sowing.',
  }),
  msuSheet: Object.freeze({
    title: 'New England aster, Michigan State University native plant facts',
    url: 'https://canr.msu.edu/nativeplants/plant_facts/new_england_aster',
    supports:
      'UNCONFIRMED (page empty to the fetch tool, search snippet only): plugs flower in year 1-2, seed-grown plants in year 2-3. Used only for the age-0 plug having no flowers.',
  }),
  ncState: Object.freeze({
    title: 'Symphyotrichum novae-angliae, NC State Extension Plant Toolbox',
    url: 'https://plants.ces.ncsu.edu/plants/symphyotrichum-novae-angliae/',
    supports:
      'Large bushy clumps 3-6 ft tall and 1-3 ft wide; leaves up to 4 x 1 in, clasping, coarse above and soft below; up to 100 rays; seed display fall to winter; tall plants may need staking.',
  }),
  ladyBird: Object.freeze({
    title: 'Symphyotrichum novae-angliae, Lady Bird Johnson Wildflower Center',
    url: 'https://www.wildflower.org/plants/result.php?id_plant=SYNO2',
    supports: 'Up to about 6 ft; bloom August to October; seed heads intact weeks after first frost.',
  }),
  missouriConservation: Object.freeze({
    title: 'New England aster, Missouri Department of Conservation field guide',
    url: 'https://mdc.mo.gov/discover-nature/field-guide/new-england-aster',
    supports:
      'Leaves clasping the stem and auriculate; branching toward the top of the stems; more than 40 rays.',
  }),
  pennState: Object.freeze({
    title: 'New England aster, Penn State Extension',
    url: 'https://extension.psu.edu/rain-garden-plants-new-england-aster',
    supports: 'Height 3-6 ft; leaves 4-5 in; lower leaves lost before bloom; tall plants may need staking.',
  }),
  morton: Object.freeze({
    title: 'New England aster, Morton Arboretum',
    url: 'https://mortonarb.org/?p=2880',
    supports: 'Height 3-6 ft, width 2-3 ft; leaves up to 4 in; pinching early makes it shorter and bushier.',
  }),
  sdsu: Object.freeze({
    title: 'Symphyotrichum novae-angliae, South Dakota State University repository profile',
    url: 'https://openprairie.sdstate.edu/nativeplant/403',
    supports:
      'Short stout rhizomes forming upright clumps; hairy, often reddish stems; leaves 2-6 in by 0.4-1.2 in; flower panicles up to 1 ft wide; basal leaves withered by flowering.',
  }),
  usda: Object.freeze({
    title: 'Plant guide, New England aster, USDA NRCS (2002)',
    url: 'https://plants.sc.egov.usda.gov/DocumentLibrary/plantguide/pdf/pg_syno2.pdf',
    supports: 'Several erect stems in clumps; leaves 0.8-3.5 in by 0.4-0.8 in; divide every 3 years.',
  }),
  uvm: Object.freeze({
    title: 'New England aster, UVM Extension',
    url: 'https://www.uvm.edu/extension/news/late-blooming-beauty-new-england-aster',
    supports: 'Many of the lower leaves turn brown and fall off; height 3-5 ft.',
  }),
  usfs: Object.freeze({
    title: 'New England aster, USDA Forest Service',
    url: 'https://www.fs.usda.gov/wildflowers/plant-of-the-week/symphyotrichum_novae-angliae.shtml',
    supports:
      'Many lower leaves have fallen off, leaving a bare brown stem; leaves somewhat firm and stiff; usually 3-4 ft, up to 6.',
  }),
  uconn: Object.freeze({
    title: 'Seedling identification, UConn (2023)',
    url: 'https://ipm.cahnr.uconn.edu/ct-native-meadow-seedlings',
    supports: 'Seedling leaves are simple, oval, sessile and hairy.',
  }),
  inatOhioBloom: Object.freeze({
    title: 'iNaturalist, Ohio, New England aster, flowering weekly counts (574 observations, 2005-2026)',
    url: 'https://api.inaturalist.org/v1/observations/histogram?taxon_id=117443&place_id=31&term_id=12&term_value_id=13&date_field=observed&interval=week_of_year',
    supports:
      'About 80 percent of flowering observations fall in weeks 36-41 (3 Sep to 14 Oct), median week 39 (23-29 Sep), about 6 percent in August; no shift in 2021-2025.',
  }),
  inatWinterPhotographs: Object.freeze({
    title: 'iNaturalist photographs: Sharonville OH 2024-12-28 (obs 261028746), Doylestown OH 2025-02-08 (obs 261008928), Delaware OH 2026-02-04 (obs 337357836), Troy Twp 2024-03-16 (obs 202706262), Coshocton 2024-03-30 (obs 204614325)',
    url: 'https://www.inaturalist.org/observations?id=261028746,261008928,337357836,202706262,204614325',
    supports:
      'Dry stems with tan seed heads standing from December to late March; stems densely hung with dark brown dead leaves; a green, purple-tinged ground tuft under dry stems on 28 Dec 2024.',
  }),
  inatSpringPhotographs: Object.freeze({
    title: 'iNaturalist photographs: Cincinnati 2025-04-25 (obs 273055888), Finneytown 2026-04-24 (obs 352641989), Keene Twp 2025-05-04 (obs 278544364), Columbus 2026-05-11 (obs 360737435)',
    url: 'https://www.inaturalist.org/observations?id=273055888,352641989,278544364,360737435',
    supports: 'Upright leafy lance-leaved shoots coming up through brown leaf litter from mid April.',
  }),
  inatClumpCounts: Object.freeze({
    title: 'iNaturalist obs 135117064 (Cincinnati, 2022-09-15) and obs 244169658 (Grafton OH, 2024-09-20)',
    url: 'https://www.inaturalist.org/observations?id=135117064,244169658',
    supports:
      'About 70 and about 25 open heads visible on two clumps of unknown age (neither a usable count; the owner figures below supersede them).',
  }),
  ownerPhotographs: Object.freeze({
    title: 'Owner photographs: 303 AC bed, 14 Nov 2026, and flowering clumps (stated 27 Nov 2026)',
    supports:
      'A low still-green tuft in mid-November on a browsed young plant; heads in dense clusters on many short, much-branched side branches.',
  }),
  ownerDecisions: Object.freeze({
    title: 'Owner modelling decisions, 27 Nov 2026 (modeling-decisions.md)',
    supports:
      'Height 4 ft 6 in and width 3 ft 6 in (1.07 m) at head height at age 5 (changed from 2 ft 6 in on 28 Nov 2026); stems flare and lean each in its own direction; age 0 plug has no flowers; peak day 266, bloom August to October; stems by age 2 / 4 / 8 / 17 / 35 at ages 0 to 3 and 5 (fullness pass, 28 Nov 2026); about 25 to 40 heads per flowering stem; heads about 1.5 in across; leaves about twice the head width near the clusters; lower third bare at bloom; winter stand, clinging dead leaves, base tuft and slow litter.',
  }),
});

/** Numbers the renderer needs that no source above states. */
export const NOVAE_ANGLIAE_RENDER_ASSUMPTIONS = Object.freeze([
  'stems per clump by age (2, 4, 8, 17, 26, 35 at ages 0 to 5) are an owner decision (28 Nov 2026, unsourced; age 5 was 20, 15 to 25, before the fullness pass; age 3 about 15 to 20), seed varied by x0.94-1.08; ages 1 and 2 and the age 4 value are interpolated or carried; ages above 5 hold the age-5 clump (the owner divides before it crowds)',
  'heads per stem are about 7.5, 15, 24, 25 and 26 at ages 1 to 5 (owner decision: about 25 to 40 per flowering stem, taken at the low end to fit rule 9), so a plant carries about 30, 120, 400, 640 and 900 heads at ages 1 to 5 (up to about 1,080); heads are counted as buds, open and spent; stems vary x0.75-1.25 in vigour and the plant x0.9-1.1; at most 45 heads on a stem',
  'height by age (0.30, 0.65, 1.00, 1.25, about 1.33, 1.37 m) is assumed except the mature 1.37 m, the owner decision; spread by age (0.28, 0.49, 0.70, 0.92, 1.07 m at ages 0 to 5) is scaled in proportion from the owner mature 1.07 m (3 ft 6 in at head height, owner decision 28 Nov 2026) and assumed below it; Mt Cuba cultivars reach 36-72 in by year 3 and asters frequently splay under the weight of the flowers, and the Chicago trial species was 5 ft undivided',
  'stems leave a crown about 0.36 m across (stems emerge across it, not from one point) and flare outward as a vase: each stem leaves the crown leaning about 14 degrees off vertical at the centre and 23 degrees at the clump edge, easing only to about 9 degrees at the top so the outer stems keep arching outward under their flower clusters (a dome about 1.07 m across at head height), plus an individual random lean of up to 2 degrees in any direction; the sources say only that stems start straight and flop unsupported',
  'each stem carries 12 short straight side branches from 70% to 98% of its height (3 cm at the top, 10 cm at the bottom), each with three leaves of 6-8 cm and up to four heads sitting along it on offsets of 1-2 cm, so heads pack into dense leafy clusters at the top of each stem; there are no twig stems; the sources give only branching toward the top and heads on short leafy branchlets, and the owner photographs show dense clusters',
  'branches take their first head before any other, top branch first, so a young plant flowers from the top of fewer stems with one head per branch and fills in as it ages',
  'the head zone is the top 35-40% of the stem',
  'heads are 3.6-4.2 cm across including rays (owner decision, 28 Nov 2026, research Flowers: about 1.5 in), a yellow disc 1.3 cm across with a ring of violet rays drawn as a generated plate of 55 narrow rays (the sources say 40-100); each head holds its rays open 22-27 days; open dates are spread around day 256 (plus a few days for lower branches) with a standard deviation of 9 days, clipped between 16 August and 29 September, so about 75% of heads are open at the owner peak of day 266 and the last close in late October; young plants bloom later and more tightly (age 1: 8 days later, spread 5; age 2: 3 days later, spread 8)',
  'buds are visible from 1 August; rays collapse over 7 days after a head closes and a small soft puff of grey-tan pappus (one upright textured card at band 0) covers the disc; about 55% of seed heads still stand in March',
  'the plug (age 0) is 2 stems, about 0.30 m, leafy from the base with no branches or heads, keeping its basal leaves through summer; older plants lose basal leaves by flowering (SDSU) and grow a small green, purple-tinged tuft from late September',
  'stem leaves are alternate, sessile, clasping and lance-shaped, 11 cm by 2.9 cm (card width, blade about 2.2 cm) low on the stem and 7.5 cm near the top, 48 nodes on a full stem (fewer on young plants), plus 6-8 cm leaves on the flowering branches (owner decision 28 Nov 2026: leaves near the clusters are about 2 times the head width, from two owner photographs measured on screen without a scale object; research Leaves gives 2-4 in on flowering stems and up to 5 in lower), held 23 degrees above horizontal low on the stem, arching out into a skirt, and 66 degrees near the top; leaf plate is generated in code with ear-like clasping lobes',
  'leaves below 38% of the stem (down to 8% on the outer stems from 40% of the way out, so the clump carries a leafy skirt) yellow-brown and drop from 15 July in order from the bottom, so the lower third is bare by about 1 September; the lower third is the owner decision, the dates are assumed',
  'upper leaves go from mid-green to dark brown between 5 October and 8 November (no yellow or red), hang limp down the stem after frost on 22 October, and about 45% cling to the stems until the stems break; the rest drop in a seeded order between 1 November and mid-February',
  'dry stems stand through winter, lean a little more under the weight of old heads, and break down between 25 March and 10 April in a seeded order as new shoots come up; this is breakdown, not a cleanup, and leaves still hanging on a broken stem land as litter; the breakdown date is assumed, no source gives it',
  'fallen leaves lie flat within the plant spread, shrivelled to 60% of their length, never cleaned up, and stay until new growth covers them over the two weeks after the 15 April emergence; leaf litter decomposition is assumed slow (leafLitterDecomposition: slow), so a fast value would drop it in autumn',
  'emergence on 15 April (April photographs), stem elongation from 1 May to full height on 25 August (assumed: the Chicago trial and Mt Cuba pinching date suggest elongation runs through July)',
  'colours are estimates from photographs described in the research report, not measurements: mid-green leaves, dark brown dead leaves, violet-purple rays, yellow disc ageing to brown, grey-tan seed heads',
]);

/** Species profile for one maintained plant in a central-Ohio garden. */
export const NOVAE_ANGLIAE_PROFILE = Object.freeze({
  species: 'Symphyotrichum novae-angliae',
  cultivar: 'Species',
  commonName: 'New England aster',
  locale: 'central Ohio (USDA zone 6a/6b)',
  unit: 'metre',
  metresPerUnit: 1,
  architecture: Object.freeze({
    habit:
      'upright clump of leafy stems from a short rhizomatous crown, flaring outward and branching in the top two fifths into a leafy panicle of many small daisy heads',
    hasTrunk: false,
    woody: false,
    deciduous: true,
    crownOrigin: 'persistent short-rhizome basal crown',
    // 4 ft 6 in (owner decision, 27 Nov 2026); sources 3-6 ft.
    matureHeightM: 1.37,
    // 3 ft 6 in (1.07 m) wide at head height: owner decision, 28 Nov 2026 (was
    // 2 ft 6 in). Mt Cuba cultivars reach 36-72 in by year 3 (2009) and say
    // asters frequently splay under the weight of the flowers; the Chicago
    // trial species was 5 ft undivided.
    matureRadiusM: 0.535,
    matureCrownRadiusM: 0.18,
    modelHorizonYears: 20,
    maximumPrimaryShoots: 45,
    // Each stem flares outward from the crown, tip tangent off vertical.
    leanTipDegreesCentre: 14,
    leanTopDegrees: 9,
    leanTipDegreesEdge: 23,
    leanJitterDeg: 2,
    randomLeanMaxDeg: 2,
    shootCountAnchors: Object.freeze([
      Object.freeze([0, 2]),
      Object.freeze([1, 4]),
      Object.freeze([2, 8]),
      Object.freeze([3, 17]),
      Object.freeze([4, 26]),
      Object.freeze([5, 35]),
    ]),
    // Heads per stem; times the stem count gives the plant figure.
    headsPerStemAnchors: Object.freeze([
      Object.freeze([0, 0]),
      Object.freeze([1, 7.5]),
      Object.freeze([2, 15]),
      Object.freeze([3, 24]),
      Object.freeze([4, 25]),
      Object.freeze([5, 26]),
    ]),
    basalLeafCountAnchors: Object.freeze([
      Object.freeze([0, 8]),
      Object.freeze([1, 10]),
      Object.freeze([2, 12]),
      Object.freeze([3, 14]),
      Object.freeze([5, 16]),
    ]),
    crownRadiusAnchorsM: Object.freeze([
      Object.freeze([0, 0.07]),
      Object.freeze([1, 0.1]),
      Object.freeze([2, 0.13]),
      Object.freeze([3, 0.16]),
      Object.freeze([5, 0.18]),
    ]),
    // Share of the mature stem height reached, by age.
    stemHeightScaleAnchors: Object.freeze([
      Object.freeze([0, 0.22]),
      Object.freeze([1, 0.47]),
      Object.freeze([2, 0.73]),
      Object.freeze([3, 0.91]),
      Object.freeze([4, 0.96]),
      Object.freeze([5, 1]),
    ]),
    heightByAgeM: Object.freeze([
      Object.freeze([0, 0.3]),
      Object.freeze([1, 0.65]),
      Object.freeze([2, 1.0]),
      Object.freeze([3, 1.25]),
      Object.freeze([5, 1.37]),
    ]),
    spreadByAgeM: Object.freeze([
      Object.freeze([0, 0.28]),
      Object.freeze([1, 0.49]),
      Object.freeze([2, 0.7]),
      Object.freeze([3, 0.92]),
      Object.freeze([5, 1.07]),
    ]),
  }),
  growth: Object.freeze({
    rate: 'fast; clumps fill in about three years',
    topGrowthAnnual: true,
    firstYearFlowers: false,
  }),
  stem: Object.freeze({
    kind: 'annual herbaceous flowering stem, hairy, often reddish',
    // Longest stem before lean and branch rise; per-stem share below.
    stemMaxHeightM: 1.36,
    heightShare: Object.freeze([0.82, 1]),
    baseRadiusM: Object.freeze([0.0035, 0.0055]),
    twigRadiusM: 0.0011,
    branchRadiusM: 0.0017,
    mainAxisSections: 11,
    branchesPerStem: 12,
    headsPerBranch: 4,
    maxHeadsPerStem: 45,
    // Branches leave the stem between these shares of its height, top first.
    branchZone: Object.freeze([0.7, 0.98]),
    branchLengthM: Object.freeze([0.03, 0.1]),
        // Lower third bare at bloom (owner decision): leaves below this share drop.
    bareShare: 0.38,
    outerBareShare: 0.08,
  }),
  leaf: Object.freeze({
    arrangement: 'alternate, sessile, clasping with ear-like lobes',
    shape: 'lance-shaped, hairy, entire to finely toothed',
    nodesPerStem: 48,
    lowerLengthM: 0.11,
    upperLengthM: 0.075,
    widthToLength: 0.2,
    branchLeafLengthM: Object.freeze([0.06, 0.08]),
    ageScaleAnchors: Object.freeze([
      Object.freeze([0, 0.62]),
      Object.freeze([1, 0.78]),
      Object.freeze([2, 0.9]),
      Object.freeze([3, 1]),
      Object.freeze([5, 1]),
    ]),
    densityAnchors: Object.freeze([
      Object.freeze([0, 0.4]),
      Object.freeze([1, 0.55]),
      Object.freeze([2, 0.7]),
      Object.freeze([3, 0.85]),
      Object.freeze([5, 1]),
    ]),
    basalLengthM: 0.08,
    winterTuftSize: 0.45,
    retainedShare: 0.45,
    litterScale: 0.6,
    colour: 'mid to light green; autumn leaves go dark brown and cling',
    persistentThroughWinter: true,
    // ASSUMPTION: fallen leaves decompose slowly, so litter lies on the ground
    // until new growth covers it. 'fast' drops the litter in autumn.
    leafLitterDecomposition: 'slow',
  }),
  head: Object.freeze({
    kind: 'daisy-like capitulum, violet rays around a yellow disc',
    diameterM: Object.freeze([0.036, 0.042]),
    discDiameterM: 0.013,
    rays: Object.freeze([40, 100]),
    rayColour: 'violet-purple to dark pink',
    discColour: 'yellow turning orange to brown',
    progression:
      'green bud, violet rays opening around a yellow disc, rays shrivelling, tan fluffy seed head, grey-tan winter head',
  }),
  flowering: Object.freeze({
    observedDisplay:
      'August to October, peak late September (owner chart; Ohio iNaturalist median 23-29 September, 80 percent from 3 September to 14 October)',
    openDurationDays: Object.freeze([22, 27]),
    stemsFlowerInCurrentSeason: true,
    flowersFirstYear: true,
    flowersAtAgeZero: false,
  }),
  management: Object.freeze({
    maintained: true,
    standsThroughWinter: true,
    // Owner never tidies; stems break down as spring growth comes up.
    cutbackWindow: 'none; stems break down in spring',
  }),
});
