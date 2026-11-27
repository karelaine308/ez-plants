/**
 * Published evidence behind spotted Joe Pye weed. One scene unit is one metre.
 *
 * This is the straight species as grown in a central-Ohio garden, not a named
 * cultivar: the plant this profile was built for was not bought as one. Every
 * number below is either traceable to a source here or listed in
 * `MACULATUM_RENDER_ASSUMPTIONS` (library rule 3).
 */
export const MACULATUM_SOURCES = Object.freeze({
  illinoisWildflowers: Object.freeze({
    title: 'Spotted Joe Pye Weed, Illinois Wildflowers',
    url: 'https://www.illinoiswildflowers.info/wetland/plants/sp_joepye.htm',
    supports:
      'Stout stems unbranched except in the inflorescence, often purple-spotted with fine upper hairs; leaves in whorls, up to 9 in long; flat-topped panicle 3-6 in across with smaller clusters on lower stalks; heads about 8 mm long with 8-20 florets and long exserted styles; bloom lasts about 3-4 weeks; wind-dispersed seed; rhizomatous clonal habit.',
  }),
  wildflowerCenter: Object.freeze({
    title: 'Eutrochium maculatum, Lady Bird Johnson Wildflower Center',
    url: 'https://www.wildflower.org/plants/result.php?id_plant=EUMA9',
    supports:
      'Height 2-6 ft; leaves whorled, usually in fours or fives, coarsely toothed; August-October bloom across the species range.',
  }),
  ncStateExtension: Object.freeze({
    title: 'Eutrochium maculatum, NC State Extension Plant Toolbox',
    url: 'https://plants.ces.ncsu.edu/plants/eutrochium-maculatum/',
    supports:
      'Height 4-7 ft, spread 3-4 ft, rapid growth; solid stem; flat-topped dusky-pink inflorescence; July-October bloom; seed held August-November.',
  }),
  minnesotaWildflowers: Object.freeze({
    title: 'Spotted Joe Pye Weed, Minnesota Wildflowers',
    url: 'https://www.minnesotawildflowers.info/flower/spotted-joe-pye-weed',
    supports:
      'Light-green stems with purple spots or evenly purple; 3-6 leaves per whorl, lance-elliptic and sharply toothed; flat-topped array of dozens to hundreds of heads with purplish two-layered bracts; July-September bloom; brown seed with light-brown pappus.',
  }),
  goBotany: Object.freeze({
    title: 'Eutrochium maculatum, Go Botany (Native Plant Trust)',
    url: 'https://gobotany.nativeplanttrust.org/species/eutrochium/maculatum/',
    supports:
      'Leaf blades 15-250 x 2-90 mm on 5-20 mm petioles, tapering at both ends; flat-topped array, unlike the round-topped E. dubium; involucres 6.5-9 mm tall; 9-22 florets per head.',
  }),
  pennStateExtension: Object.freeze({
    title: 'Cutting Down Perennials in the Fall, Penn State Extension',
    url: 'https://extension.psu.edu/cutting-down-perennials-in-the-fall',
    supports:
      'Joe Pye weed seed heads are left standing through winter and turn dark bronze.',
  }),
  clemsonHgic: Object.freeze({
    title: 'Joe Pye Weed, Clemson Home & Garden Information Center',
    url: 'https://hgic.clemson.edu/factsheet/joe-pye-weed',
    supports:
      'Garden plants reach 7-9 ft; old stems are cut back near the ground before spring growth.',
  }),
  ownerPhotograph: Object.freeze({
    title: 'Owner photograph of the modelled clump, central Ohio, 15 November',
    supports:
      'After frost: dark purple-brown, nearly black stems splaying from a tight crown; shrivelled blackened leaves hanging straight down the stems; a layer of fallen leaves underneath.',
  }),
  phantomPhotograph: Object.freeze({
    title: "Eutrochium maculatum 'Phantom', botanic-garden newsletter photograph",
    supports:
      'Summer habit: stems curving out of a tight base into a broad dome, outer stems leaning about 25-30 degrees; red-purple stems; leaves held near horizontal; loose compound clusters from the upper nodes.',
  }),
  columbusObservation: Object.freeze({
    title: 'Joe Pye weed, Hiking with Doc (Columbus, Ohio)',
    url: 'https://docscape.net/2024/07/31/joe-pye-weed-eutrochium-flower-of-the-hour/',
    supports:
      'Anecdotal: E. maculatum early in its bloom near Columbus on 22 July 2024. The only Ohio-specific timing point found; the calendar is anchored on it.',
  }),
});

/** Numbers the renderer needs that no source above states. */
export const MACULATUM_RENDER_ASSUMPTIONS = Object.freeze([
  'flowering stems per clump by age (2, 5, 9, 13, 16) are assumed; no source counts them',
  'stem base diameter 10-15 mm is assumed; sources say only "stout"',
  'stem colour is approximated per segment: no texture carries individual spots, so purple is blended in more strongly low on the stem where spots are densest',
  'internodes of 12-16 cm and a bare peduncle above the top whorl are assumed',
  'leaf posture 20-40 degrees above horizontal is assumed: sources describe 30-60 degrees with a drooping outer half, and a flat card approximates the arch with a lower angle',
  'the array is drawn 14-24 cm across: above the cited 3-6 in for wild plants, toward the 6-10 in reported for vigorous garden plants',
  'side clusters on stalks from the top three nodes (two per node, one or two at the third), stopping at staggered heights below the terminal cluster, are matched by eye to the Phantom photograph',
  'all colours are estimates from description and the owner and botanic-garden photographs, not measurements',
  'stems splay from a tight crown, outer ones about 20 degrees from vertical, matched by eye to the photographs',
  'frost-killed leaves hang straight down and shrivel to half width (owner photograph); 15% stay on the stems until cutback and the rest fall over about 80 days',
  'fallen leaves lie under their own node and are never cleaned up: they stay through winter and the cutback (leaves still on a cut stem fall with it) and are simply no longer drawn once the new shoots emerge, on 10 April; leaf litter is assumed to decompose slowly (leafLitterDecomposition: slow)',
  'central-Ohio phase dates other than the late-July early-bloom point are assumed',
]);

/** Species profile for one maintained plant in a central-Ohio garden. */
export const MACULATUM_PROFILE = Object.freeze({
  species: 'Eutrochium maculatum',
  cultivar: 'Species',
  commonName: 'spotted Joe Pye weed',
  locale: 'central Ohio (USDA zone 6a/6b)',
  unit: 'metre',
  metresPerUnit: 1,
  architecture: Object.freeze({
    habit:
      'upright clump of tall unbranched leafy stems from a rhizomatous crown, each ending in a flat-topped compound array',
    hasTrunk: false,
    woody: false,
    deciduous: true,
    crownOrigin: 'persistent rhizomatous basal crown',
    // 5.7 ft, the owner's decision (27 Nov 2026): inside the sourced overlap of 4.9 to 6 ft and her chart's 4 to 6 ft.
    matureHeightM: 1.74,
    matureRadiusM: 0.55,
    // A tight crown: the clump's width comes from stems splaying out of it.
    matureCrownRadiusM: 0.17,
    modelHorizonYears: 20,
    maximumPrimaryShoots: 16,
    shootCountAnchors: Object.freeze([
      Object.freeze([0, 2]),
      Object.freeze([1, 5]),
      Object.freeze([2, 9]),
      Object.freeze([3, 13]),
      Object.freeze([5, 16]),
    ]),
    crownRadiusAnchorsM: Object.freeze([
      Object.freeze([0, 0.04]),
      Object.freeze([1, 0.08]),
      Object.freeze([2, 0.12]),
      Object.freeze([3, 0.15]),
      Object.freeze([5, 0.17]),
    ]),
  }),
  growth: Object.freeze({
    rate: 'rapid',
    // Year one about half height, year two most of it, full from year three.
    plantAgeScaleAnchors: Object.freeze([
      Object.freeze([0, 0.5]),
      Object.freeze([1, 0.84]),
      Object.freeze([2, 1]),
    ]),
    topGrowthAnnual: true,
  }),
  stem: Object.freeze({
    kind: 'annual herbaceous flowering stem, solid',
    // Stem targets set so the age 5 clump averages about 5.7 ft at its tallest point (owner's decision, 27 Nov 2026).
    targetHeightM: Object.freeze([1.3, 1.75]),
    baseRadiusM: Object.freeze([0.005, 0.0075]),
    mainAxisSections: 12,
    lateralAxisSections: 3,
    surface: 'light green, purple-spotted, densest low; fine hairs above',
  }),
  leaf: Object.freeze({
    arrangement: 'whorled, usually four or five per node',
    whorlSize: Object.freeze([4, 5]),
    shape: 'lanceolate, tapering at both ends, coarsely and sharply serrate',
    midLengthM: Object.freeze([0.13, 0.2]),
    // Toward the cited 2-2.5 in maximum: garden plants carry broad blades.
    midWidthM: Object.freeze([0.045, 0.062]),
    upperScale: 0.5,
    lowerScale: 0.8,
    petioleM: Object.freeze([0.005, 0.02]),
    leafyNodes: 10,
    autumnColours: Object.freeze(['yellow green', 'tan', 'brown']),
    persistentThroughWinter: false,
    // ASSUMPTION: fallen leaves decompose slowly, so litter lies on the ground
    // until the plant emerges in spring. 'fast' drops the litter in autumn.
    leafLitterDecomposition: 'slow',
  }),
  inflorescence: Object.freeze({
    kind: 'flat-topped compound corymb of small discoid heads',
    diameterM: Object.freeze([0.14, 0.24]),
    lateralScale: Object.freeze([0.62, 0.85]),
    axillaryNodes: 3,
    headsPerArray: 'dozens to hundreds',
    floretsPerHead: Object.freeze([8, 22]),
    colour: 'dusky pink-purple; no ray florets; long styles give a fuzzy look',
    progression:
      'mauve buds, dusky pink bloom, fading pink, tan fluffy pappus, then dark bronze winter heads',
  }),
  flowering: Object.freeze({
    observedDisplay: 'July to September in the Midwest; early bloom seen near Columbus on 22 July',
    bloomWeeksPerPlant: Object.freeze([3, 4]),
    stemsFlowerInCurrentSeason: true,
  }),
  management: Object.freeze({
    maintained: true,
    standsThroughWinter: true,
    cutbackWindow: 'late winter to early spring before new growth',
    cutbackHeightM: 0.15,
  }),
});
