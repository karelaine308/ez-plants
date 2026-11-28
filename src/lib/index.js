export { Tree } from './tree.js';
export { Trellis } from './trellis.js';
export { TreePreset } from './presets/index.js';
export { Billboard, ShadowCast, TreeType } from './enums.js';
export { PlantRenderer } from './plant-renderer.js';
// Optional, caller-driven. Nothing in the library constructs one: a plant's
// level is set by `setLevel`, never by a camera.
export {
  normalizePlantLODLevels,
  PlantLODController,
  selectPlantLODLevel,
} from './plant-lod.js';

export { Blackcurrant } from './plants/blackcurrant/blackcurrant.js';
export {
  dayOfYear,
  calendarLabel,
  monthDayToDay,
  isLeapYear,
} from './calendar.js';
export { TISEL_PROFILE, TISEL_SOURCES } from './plants/blackcurrant/tisel.js';
export {
  getTiselPhenology,
  getTiselCareHints,
  TISEL_CALENDAR,
  TISEL_CALENDAR_PROVENANCE,
} from './plants/blackcurrant/phenology.js';

export { Forsythia } from './plants/forsythia/forsythia.js';
export {
  LYNWOOD_PROFILE,
  LYNWOOD_SOURCES,
} from './plants/forsythia/lynwood.js';
export {
  getLynwoodPhenology,
  getLynwoodCareHints,
  LYNWOOD_CALENDAR,
  LYNWOOD_CALENDAR_PROVENANCE,
  LYNWOOD_REGION_OBSERVATIONS,
} from './plants/forsythia/phenology.js';
export {
  createLynwoodModel,
  evaluateLynwoodModel,
} from './plants/forsythia/model.js';

export { Hydrangea } from './plants/hydrangea/hydrangea.js';
export {
  LIMELIGHT_PROFILE,
  LIMELIGHT_SOURCES,
} from './plants/hydrangea/limelight.js';
export {
  getLimelightPhenology,
  getLimelightCareHints,
  getLimelightCalendar,
  LIMELIGHT_CALENDAR,
  LIMELIGHT_CALENDAR_PROVENANCE,
  LIMELIGHT_PHASE_ASSUMPTIONS,
  LIMELIGHT_SEASON_PROFILES,
} from './plants/hydrangea/phenology.js';
export {
  createLimelightModel,
  evaluateLimelightModel,
} from './plants/hydrangea/model.js';

export { Miscanthus } from './plants/miscanthus/miscanthus.js';
export {
  MALEPARTUS_PROFILE,
  MALEPARTUS_SOURCES,
} from './plants/miscanthus/malepartus.js';
export {
  getMalepartusPhenology,
  getMalepartusCareHints,
  getMalepartusCalendar,
  MALEPARTUS_CALENDAR,
  MALEPARTUS_CALENDAR_PROVENANCE,
  MALEPARTUS_PHASE_ASSUMPTIONS,
  MALEPARTUS_SEASON_PROFILES,
} from './plants/miscanthus/phenology.js';
export {
  createMalepartusModel,
  evaluateMalepartusModel,
} from './plants/miscanthus/model.js';

export { Pennisetum } from './plants/pennisetum/pennisetum.js';
export { HAMELN_PROFILE, HAMELN_SOURCES } from './plants/pennisetum/hameln.js';
export {
  getHamelnPhenology,
  getHamelnCareHints,
  getHamelnCalendar,
  HAMELN_CALENDAR,
  HAMELN_CALENDAR_PROVENANCE,
  HAMELN_PHASE_ASSUMPTIONS,
  HAMELN_SEASON_PROFILES,
} from './plants/pennisetum/phenology.js';
export {
  createHamelnModel,
  evaluateHamelnModel,
} from './plants/pennisetum/model.js';
export { Lavender } from './plants/lavender/lavender.js';
export {
  HIDCOTE_PROFILE,
  HIDCOTE_RENDER_PRIORS,
  HIDCOTE_SOURCES,
} from './plants/lavender/hidcote.js';
export {
  getHidcotePhenology,
  getHidcoteCareHints,
  getHidcoteCalendar,
  HIDCOTE_CALENDAR,
  HIDCOTE_CALENDAR_PROVENANCE,
  HIDCOTE_PHASE_ASSUMPTIONS,
  HIDCOTE_REGION_OBSERVATIONS,
} from './plants/lavender/phenology.js';
export {
  createHidcoteModel,
  evaluateHidcoteModel,
} from './plants/lavender/model.js';

export { Echinacea } from './plants/echinacea/echinacea.js';
export { MAGNUS_PROFILE, MAGNUS_SOURCES } from './plants/echinacea/magnus.js';
export {
  getMagnusPhenology,
  getMagnusCareHints,
  getMagnusCalendar,
  MAGNUS_CALENDAR,
  MAGNUS_CALENDAR_PROVENANCE,
  MAGNUS_PHASE_ASSUMPTIONS,
  MAGNUS_SEASON_PROFILES,
} from './plants/echinacea/phenology.js';
export {
  createMagnusModel,
  evaluateMagnusModel,
} from './plants/echinacea/model.js';

export { Eutrochium } from './plants/eutrochium/eutrochium.js';
export {
  MACULATUM_PROFILE,
  MACULATUM_RENDER_ASSUMPTIONS,
  MACULATUM_SOURCES,
} from './plants/eutrochium/maculatum.js';
export {
  getMaculatumPhenology,
  getMaculatumCareHints,
  getMaculatumCalendar,
  MACULATUM_CALENDAR,
  MACULATUM_CALENDAR_PROVENANCE,
  MACULATUM_PHASE_ASSUMPTIONS,
  MACULATUM_SEASON_PROFILES,
} from './plants/eutrochium/phenology.js';
export {
  createMaculatumModel,
  evaluateMaculatumModel,
} from './plants/eutrochium/model.js';

export { Ratibida } from './plants/ratibida/ratibida.js';
export {
  PINNATA_PROFILE,
  PINNATA_RENDER_ASSUMPTIONS,
  PINNATA_SOURCES,
} from './plants/ratibida/pinnata.js';
export {
  getPinnataPhenology,
  getPinnataCareHints,
  getPinnataCalendar,
  PINNATA_CALENDAR,
  PINNATA_CALENDAR_PROVENANCE,
  PINNATA_PHASE_ASSUMPTIONS,
  PINNATA_SEASON_PROFILES,
} from './plants/ratibida/phenology.js';
export {
  createPinnataModel,
  evaluatePinnataModel,
} from './plants/ratibida/model.js';

export { Symphyotrichum } from './plants/symphyotrichum/symphyotrichum.js';
export {
  NOVAE_ANGLIAE_PROFILE,
  NOVAE_ANGLIAE_RENDER_ASSUMPTIONS,
  NOVAE_ANGLIAE_SOURCES,
} from './plants/symphyotrichum/novaeangliae.js';
export {
  getNovaeAngliaePhenology,
  getNovaeAngliaeCareHints,
  getNovaeAngliaeCalendar,
  NOVAE_ANGLIAE_CALENDAR,
  NOVAE_ANGLIAE_CALENDAR_PROVENANCE,
  NOVAE_ANGLIAE_PHASE_ASSUMPTIONS,
  NOVAE_ANGLIAE_SEASON_PROFILES,
} from './plants/symphyotrichum/phenology.js';
export {
  createNovaeAngliaeModel,
  evaluateNovaeAngliaeModel,
} from './plants/symphyotrichum/model.js';

export { Schizachyrium } from './plants/schizachyrium/schizachyrium.js';
export {
  SCOPARIUM_PROFILE,
  SCOPARIUM_RENDER_ASSUMPTIONS,
  SCOPARIUM_SOURCES,
} from './plants/schizachyrium/scoparium.js';
export {
  getScopariumPhenology,
  getScopariumCareHints,
  getScopariumCalendar,
  SCOPARIUM_CALENDAR,
  SCOPARIUM_CALENDAR_PROVENANCE,
  SCOPARIUM_PHASE_ASSUMPTIONS,
  SCOPARIUM_SEASON_PROFILES,
} from './plants/schizachyrium/phenology.js';
export {
  createScopariumModel,
  evaluateScopariumModel,
} from './plants/schizachyrium/model.js';

export { Cherrylaurel } from './plants/cherrylaurel/cherrylaurel.js';
export {
  ROTUNDIFOLIA_PROFILE,
  ROTUNDIFOLIA_SOURCES,
} from './plants/cherrylaurel/rotundifolia.js';
export {
  getRotundifoliaPhenology,
  getRotundifoliaCareHints,
  getRotundifoliaCalendar,
  ROTUNDIFOLIA_CALENDAR,
  ROTUNDIFOLIA_CALENDAR_PROVENANCE,
  ROTUNDIFOLIA_PHASE_ASSUMPTIONS,
  ROTUNDIFOLIA_SEASON_PROFILES,
} from './plants/cherrylaurel/phenology.js';
export {
  createRotundifoliaModel,
  evaluateRotundifoliaModel,
} from './plants/cherrylaurel/model.js';

export { Thuja } from './plants/thuja/thuja.js';
export {
  SMARAGD_PROFILE,
  SMARAGD_RENDER_PRIORS,
  SMARAGD_SOURCES,
} from './plants/thuja/smaragd.js';
export {
  getSmaragdCalendar,
  getSmaragdPhenology,
  getSmaragdCareHints,
  SMARAGD_CALENDAR,
  SMARAGD_CALENDAR_PROVENANCE,
  SMARAGD_PHASE_ASSUMPTIONS,
  SMARAGD_SEASON_PROFILES,
} from './plants/thuja/phenology.js';
export {
  createSmaragdModel,
  evaluateSmaragdModel,
} from './plants/thuja/model.js';
