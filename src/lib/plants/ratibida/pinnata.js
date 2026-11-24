/**
 * Published evidence behind gray-headed coneflower. One scene unit is one metre.
 *
 * This is the straight species as it would grow in a central-Ohio garden, not
 * a named cultivar. Every number below is either traceable to a source here or
 * listed in `PINNATA_RENDER_ASSUMPTIONS` (library rule 3).
 *
 * Pages marked "read" were fetched and their extracted text read while the
 * plant was modelled. Photographs informed the silhouette (rule 4); their
 * moving URLs are deliberately not kept here, only what looking taught.
 */
export const PINNATA_SOURCES = Object.freeze({
  illinoisWildflowers: Object.freeze({
    title: 'Yellow Coneflower (Ratibida pinnata), Illinois Wildflowers',
    url: 'https://www.illinoiswildflowers.info/prairie/plantx/yl_coneflowerx.htm',
    supports:
      'Up to about 4 ft in flower; stems tend to flop in wet or over-fertile soil; up to 13 drooping yellow rays; disk head light green or gray, turning dark brown; basal leaves up to about 8 x 5 in, pinnately divided into 3-7 lobes, rough; spreads by rhizomes into tight clumps; blooms 1-2 months.',
  }),
  minnesotaWildflowers: Object.freeze({
    title: 'Gray-headed Coneflower, Minnesota Wildflowers',
    url: 'https://www.minnesotawildflowers.info/flower/gray-headed-coneflower',
    supports:
      'Stems unbranched except where they fork to carry flower stalks; alternate rough leaves, long-stalked low down and shrinking up the stem, the uppermost unlobed and stalkless; cone about 0.5-0.75 in tall, up to 15 rays about 2 in long that spread to droop; 1-12 heads on long bare stalks.',
  }),
  minnesotaSeasons: Object.freeze({
    title: 'Gray-headed Coneflower, Minnesota Seasons',
    url: 'https://minnesotaseasons.com/Plants/gray-headed_coneflower.html',
    supports:
      'Height 16-48 in; one to a dozen or more stems from the base, branching only near the top; ridged rough-hairy stems; cone 0.4-1 in long; 6-15 drooping yellow rays 1.2-2.4 in long; each head on its own bare stalk 1.25-10.5 in long.',
  }),
  wildflowerCenter: Object.freeze({
    title: 'Ratibida pinnata, Lady Bird Johnson Wildflower Center',
    url: 'https://www.wildflower.org/plants/result.php?id_plant=RAPI',
    supports:
      'Native range includes Ohio; height to about 5 ft and stems may need support; yellow bloom May-September; full sun or part shade; dry to moist soil; moist stratification improves germination.',
  }),
  ozarkEdge: Object.freeze({
    title: 'Gray-headed coneflower, Ozark Edge Wildflowers',
    url: 'https://ozarkedgewildflowers.com/native-plants/gray-headed-coneflower-ratibida-pinnata',
    supports:
      'Rough alternate leaves with 3-7 lobes; 10-16 rays; heads gray before opening and open from the bottom of the cone upward, going gray to brown; fall foliage yellow-gold, brown and burgundy; basal rosette stays green through winter; fuzzy stems emerge from the rosette in spring; goldfinches strip the seed.',
  }),
  growItBuildIt: Object.freeze({
    title: 'Grayhead coneflower, Grow It Build It',
    url: 'https://growitbuildit.com/ratibida-pinnata-grayhead-coneflower/',
    supports:
      'Height 3-5 ft; basal leaves about 6 x 4 in, stem leaves 1-2 in; cone 0.5-1 in tall; width up to about 2 ft; spacing 18-24 in.',
  }),
  prairieMoon: Object.freeze({
    title: 'Ratibida pinnata, Prairie Moon Nursery',
    url: 'https://www.prairiemoon.com/ratibida-pinnata-yellow-coneflower',
    supports:
      'Most plants flower in their second and later years, the first season going mostly to roots; bloom July-September; cone green darkening to purple or brown; soft drooping rays.',
  }),
  eastIllinoisPrairie: Object.freeze({
    title: 'Ratibida pinnata, Eastern Illinois University prairie plants',
    url: 'https://castle.eiu.edu/prairie/ratipinn.htm',
    supports:
      'Seedling leaves are basal, simple, oval and pointed with three veins, on round seed leaves; fruit October-November; 30 days of cold stratification.',
  }),
  epaGreatLakes: Object.freeze({
    title: 'Yellow coneflower, EPA Great Lakes Green Acres',
    url: 'https://archive.epa.gov/greenacres/web/html/ylwcoflwr.html',
    supports:
      'Lower leaves alternate on long stalks with 3-7 narrow coarsely toothed leaflets that droop slightly; one flower per stem; seed ripe October-November.',
  }),
  friendsOfEloiseButler: Object.freeze({
    title: 'Grayhead coneflower, Friends of Eloise Butler',
    url: 'https://www.friendsofeloisebutler.org/pages/plants/grayheadedconeflower.html',
    supports:
      'Large lower leaves with 3-7 stalked leaflets, smaller narrower leaves up the stem; disk taller than wide; rays 1-2.5 in; one to several heads on long stalks above the leaves.',
  }),
  ohioNativePlantsChart: Object.freeze({
    title: 'Native Plants of Ohio chart (supplied by the owner)',
    supports:
      'Bloom July to October; habitat woods edges, prairie and prairie remnants, roadsides; alkaline soil. The only Ohio-specific timing found.',
  }),
  referencePhotographs: Object.freeze({
    title: 'Photographic observations made during modelling',
    supports:
      'Side view of a head: an egg-shaped tan cone with a dark maroon band of opened florets at its base, and about three to nine yellow rays hanging almost straight down, narrow and slightly curved, roughly twice as long as the cone is tall. From above: a round cone about a quarter of the head width with rays radiating flat with gaps between them and a few small green bracts at the base. Whole plant: a leafy column of slender stems with leaves up the whole stem and small heads in the top fifth. Stem leaves: long and narrow, deeply cut into three to seven narrow lobes low down, plain lance shapes at the top, rough and gray-green rather than dark. Seed heads: black ovals on thin wiry bare tan stems, standing through winter. Winter rosette: a low green spray of narrow cut leaves. Spring crown: several short stems from one crown with simple elliptic, hairy-edged leaves and tiny divided new leaves at the centre.',
  }),
  ownerSeedlingPhotograph: Object.freeze({
    title: 'Owner-supplied photograph of a potted first-year plant',
    supports:
      'A small plant of about five simple, broad, rounded to heart-shaped leaves on long stalks: no lobed leaves yet.',
  }),
});

/** Numbers the renderer needs that no source above states. */
export const PINNATA_RENDER_ASSUMPTIONS = Object.freeze([
  'mature height 3-5 ft is sourced, modelled at the 4 ft (1.22 m) average the owner asked for, with stems varying 0.9-1.5 m by seed',
  'stems lean outward only slightly (about 2-7 degrees at the base, a little more for outer stems): sources say it can flop in rich soil, but there is no soil input, so the lean is fixed and small',
  'stem base diameter 5.5-8.5 mm is assumed; sources say only "slender"',
  'stems per plant by age (3, 4, 6, 8) and the share that fork are assumed so a mature plant carries about 10-12 heads; sources give only the 1-12 range',
  'about one stem in eight forks near the top to carry a second head, as the sources say stems branch only near the top',
  'the first season is a rosette of leaves with no tall stems or heads; the second season and later flower (Prairie Moon: most plants flower from year two). Years 1-3 growth proportions are assumed',
  'leaf posture along the stem is matched by eye to photographs; lower leaves spread wider than upper ones. The lower four nodes also carry a second, smaller leaf (about 60% size) in the axil; this is an assumption, since sources describe few leaves higher up',
  'head size: the horizontal span of a head is drawn 9.5-12.5 cm. Cone about 2.5 cm tall and 1.9 cm wide, rays about 4.2 cm long and about 1 cm wide, all within the cited ranges but fixed by eye to photographs',
  'ray droop is not stated in degrees anywhere: rays are drawn leaving the cone nearly flat and bending to about 78 degrees below horizontal by the tip, matched to photographs. Nine rays at the finest band (sources say 6-16)',
  'leaf colour is tuned by measurement, not chosen by eye: under the planner\'s sun-and-sky lighting the rendered leaf pixels sit at hue 67, saturation 0.42 and brightness 0.42, against about hue 68-70, saturation 0.54 and brightness 0.42-0.48 in the reference leaf photographs; saturation is left lower because tints near full saturation barely raise it in the render. No source gives a colour value',
  'each head stays open about four weeks (no source gives a per-head duration; to be replaced by a measurement from the owner\'s garden), opens in a staggered order across the plant, and the plant as a whole flowers July to October (owner chart); all other phase dates are assumed',
  'central-Ohio phase dates other than the July-October bloom window and the October-November seed ripening are assumed, anchored to the Joe Pye weed calendar for the same garden',
  'the winter rosette stays green but is about 40% of its summer size and a dull dark green; its sizes and the lower leaves dying back in late summer are assumed from the Ozark Edge description. Foliage is weighted to the base (sources: basal leaves 5-8 in, upper leaves few and small): a fuller rosette of up to 22 leaves and smaller upper stem leaves',
  'frost-killed stem leaves brown, shrivel and fall over about two months, with about one in thirty staying until the spring cutback; the stems and black cones stand until then. This follows the Joe Pye weed behaviour recorded for the same garden and is assumed for this species',
  'year-0 leaves use the same lobed leaf plate as older leaves, drawn small and broad; a separate simple-leaf plate is not drawn',
  'the order heads open in is assumed: terminal heads open from the first flowering date out to about ten weeks later, weighted toward the earlier dates, and side heads open six to twelve weeks after it, so that one plant carries bloom from July into October as the owner chart says',
  'a head is a small gray-green bud for at least two weeks before it opens, filling out from under half to full size as it opens',
  'the cone darkens from tan to near black over about a month after the rays begin to drop, and about half the cones have broken away from their stems by the April cutback',
  'heads tilt 5-30 degrees off the stem axis; each ray varies a little in length, bend and twist; six small green bracts ring the base of every head',
  'basal rosette leaves arch up out of the crown at about 20-40 degrees above horizontal, and a first-season plant carries five of them at 40% of full leaf size, matched to the owner photograph of a first-year plant',
  'old stems are removed whole at the April cutback: the model draws no stubble, although the owner leaves 8-15 in of it for stem-nesting bees (the care hint says so)',
  'leaf wind strength and frequency are borrowed from Echinacea (slender stems, rough narrow leaves, a modest flutter)',
  'all colours are estimates from description and photographs, not measurements',
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
      'clump of slender leafy stems from a persistent crown, each ending in one drooping-rayed head on a long bare stalk',
    hasTrunk: false,
    woody: false,
    deciduous: true,
    crownOrigin: 'persistent rhizomatous basal crown with an overwintering rosette',
    matureHeightM: 1.22,
    matureRadiusM: 0.32,
    matureCrownRadiusM: 0.1,
    modelHorizonYears: 20,
    maximumPrimaryShoots: 8,
    // No tall stems in the planting season; flowering stems from year one.
    shootCountAnchors: Object.freeze([
      Object.freeze([1, 3]),
      Object.freeze([2, 4]),
      Object.freeze([3, 6]),
      Object.freeze([5, 8]),
    ]),
    rosetteLeafAnchors: Object.freeze([
      Object.freeze([0, 5]),
      Object.freeze([1, 10]),
      Object.freeze([2, 16]),
      Object.freeze([3, 20]),
      Object.freeze([5, 22]),
    ]),
    maximumRosetteLeaves: 22,
    crownRadiusAnchorsM: Object.freeze([
      Object.freeze([0, 0.03]),
      Object.freeze([1, 0.06]),
      Object.freeze([2, 0.08]),
      Object.freeze([3, 0.095]),
      Object.freeze([5, 0.1]),
    ]),
  }),
  growth: Object.freeze({
    rate: 'moderate; flowers from the second year',
    plantAgeScaleAnchors: Object.freeze([
      Object.freeze([0, 0.3]),
      Object.freeze([1, 0.7]),
      Object.freeze([2, 0.9]),
      Object.freeze([3, 1]),
    ]),
    rosetteAgeScaleAnchors: Object.freeze([
      Object.freeze([0, 0.4]),
      Object.freeze([1, 0.75]),
      Object.freeze([2, 1]),
    ]),
    topGrowthAnnual: true,
  }),
  stem: Object.freeze({
    kind: 'annual herbaceous flowering stem, ridged and rough-hairy',
    targetHeightM: Object.freeze([0.9, 1.5]),
    baseRadiusM: Object.freeze([0.0028, 0.0042]),
    mainAxisSections: 14,
    lateralAxisSections: 3,
    leafyNodes: 10,
    surface: 'green, finely hairy; tan and wiry when dry',
  }),
  leaf: Object.freeze({
    arrangement: 'alternate, spiralling up the stem',
    shape:
      'rough, cut into three to seven narrow pointed lobes low down; plain narrow lance shapes at the top',
    texture: 'matte, rough, finely hairy',
    stemLengthM: Object.freeze([0.15, 0.22]),
    stemWidthM: Object.freeze([0.09, 0.13]),
    upperScale: 0.35,
    lowerScale: 0.85,
    rosetteLengthM: Object.freeze([0.18, 0.3]),
    rosetteWidthM: Object.freeze([0.09, 0.14]),
    autumnColours: Object.freeze(['yellow-gold', 'brown', 'burgundy']),
    persistentThroughWinter: false,
    rosetteEvergreenInWinter: true,
  }),
  flowerHead: Object.freeze({
    position: 'terminal on a bare stalk, tilting slightly outward',
    horizontalSpanM: Object.freeze([0.095, 0.125]),
    rayCount: Object.freeze([6, 16]),
    rayColour: 'clear yellow',
    rayPosture: 'hanging almost straight down, narrow and slightly curved',
    coneHeightM: Object.freeze([0.016, 0.026]),
    coneColour: 'tan, with a dark maroon band where florets have opened',
    stalkLengthM: Object.freeze([0.03, 0.27]),
    progression:
      'gray-green bud, yellow rays opening and drooping, rays dropping, then a dark brown to black cone standing on a bare stem',
  }),
  flowering: Object.freeze({
    observedDisplay: 'July to October (owner chart); one to two months per plant',
    bloomWeeksPerHead: Object.freeze([4, 4]),
    stemsFlowerInCurrentSeason: true,
  }),
  management: Object.freeze({
    maintained: true,
    standsThroughWinter: true,
    cutbackWindow: 'April, once daytime temperatures stay in the 50s',
    cutbackHeightM: 0.29,
  }),
});
