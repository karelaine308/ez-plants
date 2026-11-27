import * as THREE from 'three';

import { createLeafMaterialSet } from '../../leaf-material.js';
import { keyedRange } from '../../keyed-random.js';
import { PlantRenderer } from '../../plant-renderer.js';
import { sharedTexture } from '../../shared-resources.js';
import {
  composeSegmentMatrix,
  makeBasisQuaternion,
  vector,
} from '../../plant-transforms.js';
import {
  BLADE_BAKED_ARCH,
  BLADE_TWIST_VARIANTS,
  BLADE_WIDTH_RATIOS,
  bladeArchTilt,
  createBladeGeometry,
  createRacemeGeometry,
  createRacemeTexture,
} from './geometry.js';
import { SCOPARIUM_PROFILE } from './scoparium.js';
import { createScopariumModel, evaluateScopariumModel } from './model.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The blade's own width axis, which its arch plane turns about. Negative Z
 * because the geometry arches toward local +X: a positive rotation about -Z
 * carries the tip from the emergence axis out into the arch.
 */
const BLADE_TILT_AXIS = new THREE.Vector3(0, 0, -1);
const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);

// Culms: green with a purple tint at the base in summer, red-purple from
// early September, copper to tan through winter (research: photographs).
const CULM_BASE = new THREE.Color(0x6f6a58);
const CULM_GREEN = new THREE.Color(0x8a9a6a);
const CULM_PURPLE = new THREE.Color(0x8a5a62);
const CULM_COPPER = new THREE.Color(0xa86a3c);
const CULM_TAN = new THREE.Color(0xb59a72);
const CULM_WEATHERED = new THREE.Color(0xbaa684);

// Blades: bright yellow-green flat new growth, blue-green summer mound,
// burgundy after the first cool nights, copper through winter, fading to tan.
const BLADE_STUB = new THREE.Color(0xa88e62);
const BLADE_SPRING = new THREE.Color(0x9fb26b);
const BLADE_SUMMER = new THREE.Color(0x7f9d8a);
const BLADE_BURGUNDY = new THREE.Color(0x8a4a4a);
const BLADE_COPPER = new THREE.Color(0xb8612f);
const BLADE_TAN = new THREE.Color(0xb59a6e);

// Racemes: small pale pink-purple at bloom, silvery fluff, then tan-grey wisps.
const HEAD_BLOOM = new THREE.Color(0xc9a2b4);
const HEAD_GREEN = new THREE.Color(0xb7b88e);
const HEAD_SILVER = new THREE.Color(0xf2f0ea);
const HEAD_WISP = new THREE.Color(0xb9a98f);

/**
 * A grass carries no wood mesh, so library rule 9 gives it three draws at its
 * near band: blades, racemes and culms.
 */
const INSTANCE_KINDS = Object.freeze(['culms', 'blades', 'racemes']);

/**
 * The blade's detail ladder, indexed by `organLevel`.
 *
 * Two vertex columns at every rung; what changes is how finely the arch is
 * sampled.
 */
const BLADE_LADDER = Object.freeze([
  Object.freeze({ segments: 9, columns: 2 }),
  Object.freeze({ segments: 5, columns: 2 }),
  Object.freeze({ segments: 4, columns: 2 }),
]);

/**
 * The raceme's detail ladder, indexed by `organLevel`.
 *
 * Each raceme stays crossed so the feathery spike has volume from every view.
 */
const RACEME_LADDER = Object.freeze([
  Object.freeze({ planes: 3, segments: 2 }),
  Object.freeze({ planes: 2, segments: 2 }),
  Object.freeze({ planes: 2, segments: 1 }),
]);

// A clump carries far more instances than this library's shrubs, so it drops
// detail sooner and harder.
/**
 * Points of a culm's curve spanned by one drawn segment, at every band.
 *
 * Not a band lever, deliberately. A culm is drawn as a stack of segments, and
 * walking it with a wider stride re-places every survivor on a new, longer
 * chord -- so a coarse band would be a different set of organs rather than the
 * fine set with some culled, and a field could not allocate the kind once.
 * Two spends about five and a half segments on a cane, which is what an arch
 * needs to read as an arch at the near band.
 */
const CULM_SECTION_STRIDE = 2;

const DEFAULT_LOD_LEVELS = Object.freeze([
  // `organLevel` is the culm lever now: the segments stay put at every band
  // and drop from a six-triangle tube to a two-triangle card. A mature clump
  // draws 930 culm segments, and at two triangles a side that is a fifth of
  // the plant's entire budget spent on stems that the blades bury.
  Object.freeze({
    distance: 0,
    detail: Object.freeze({ organLevel: 0 }),
  }),
  Object.freeze({
    distance: 6,
    hysteresis: 0.1,
    detail: Object.freeze({
      segmentFactor: 0.7,
      leafStride: 2,
      leafScale: 1.2,
      organLevel: 1,
    }),
  }),
  // Three levels, like every other plant in the library. This one used to
  // carry a fourth; its middle two were close enough that collapsing them
  // costs almost nothing, so the coarse level keeps the furthest settings
  // rather than the intermediate ones.
  Object.freeze({
    distance: 11,
    hysteresis: 0.12,
    detail: Object.freeze({
      segmentFactor: 0.42,
      // Thinned less hard than the old far band, which was tuned when a blade
      // cost 176 triangles. At 8 it can afford to keep more of the clump, and
      // a clump's silhouette at eleven metres is the only thing left of it.
      leafStride: 3,
      leafScale: 1.4,
      organLevel: 2,
    }),
  }),
]);

/**
 * Persistent renderer for little bluestem, Schizachyrium scoparium.
 *
 * The shared base supplies groups, tracked resources,
 * stable-capacity instance pools, LOD, leaf wind and the validated state
 * cycle — but its welded bark-tube pass is deliberately unused: a grass culm
 * is a thin, smooth, one-season cane that needs per-culm colour far more than
 * it needs bark UVs, so culms are instanced segments like every other organ.
 *
 * Age shapes the crown; day of year builds and then weathers one annual crop
 * of culms and silvery racemes over blue-green basal blades.
 */
export class Schizachyrium extends PlantRenderer {
  #model;

  constructor(options = {}) {
    const cultivar = options.cultivar ?? SCOPARIUM_PROFILE.cultivar;
    if (cultivar !== SCOPARIUM_PROFILE.cultivar) {
      throw new RangeError(
        `This renderer models the ${SCOPARIUM_PROFILE.species} species only.`,
      );
    }

    super({
      profile: SCOPARIUM_PROFILE,
      organKinds: INSTANCE_KINDS,
      namePrefix: 'Schizachyrium',
      detailStrideSalt: 'schizachyrium-scoparium-detail',
      plantId: options.plantId ?? `schizachyrium:${options.seed ?? 1927}`,
      seed: options.seed ?? 1927,
      maxYears: options.maxYears ?? 20,
      ageYears: options.ageYears ?? 5,
      dayOfYear: options.dayOfYear ?? 230,
      assets: options.assets ?? {},
      extraStateKeys: ['seasonProfile', 'offsetDays'],
      // A caller may state its own bands; the cultivar's are the default,
      // not a ceiling. The distances that suit a garden close-up are not the
      // ones that suit a landscape, and only the application knows which it
      // is looking at.
      lodLevels: options.lodLevels ?? DEFAULT_LOD_LEVELS,
      leafWind: {
        // Thin blades and feathery racemes are among the most mobile foliage
        // in this library; a still bunchgrass reads as plastic.
        strength: new THREE.Vector3(0.09, 0, 0.09),
        frequency: 0.68,
        scale: 0.72,
        // The caller may override any of this, including switching the
        // wind off entirely -- it is the most expensive per-vertex work in
        // the scene.
        ...options.leafWind,
      },
    });

    this.seasonProfile = options.seasonProfile ?? 'typical';
    this.offsetDays = options.offsetDays ?? 0;

    this.#model = createScopariumModel({
      seed: this.seed,
      maxYears: this.maxYears,
    });
    this._initialiseEvents(options.events ?? []);

    this._runtime.identities = new Map();

    this.#createMaterials();
    this.#buildStableGraph();
    // The base's welded woody mesh is created but never written to, so its
    // draw-call accounting stays correct and reports zero for this species.
    this._createWoodMesh(this._materials.culm);
    this.#createInstances();
    this.setTime({ ageYears: this.ageYears, dayOfYear: this.dayOfYear });
  }

  #createMaterials() {
    // Blades and heads share the leaf-wind contract. The shared shader bends
    // by uv.y, supplied from base to tip by both geometries.
    const foliage = createLeafMaterialSet({
      name: 'Schizachyrium_Scoparium_Blades',
      map: this._assets.leaf.map,
      tint: this._assets.leaf.tint,
      alphaTest: this._assets.leaf.alphaTest ?? 0,
      // A blade is a solid two-sided ribbon, not a card cut out of a plate,
      // so it wants true face-direction shading rather than EZ-Tree's
      // rounded-canopy normals.
      roundedNormals: false,
      vertexColors: true,
      wind: this._leafWind,
      windVariant: 'schizachyrium-scoparium-blades',
    });
    this._resources.trackMaterial(foliage.surface);
    this._resources.trackMaterial(foliage.depth);
    this._resources.trackMaterial(foliage.distance);

    this._protect('_racemeTexture');
    this._racemeTexture = sharedTexture(
      'schizachyrium/scoparium-raceme',
      {},
      createRacemeTexture,
    );

    // The generated plate keeps sub-pixel awns in texture alpha instead of
    // geometry. Crossed ribbons give each raceme volume.
    const panicle = createLeafMaterialSet({
      name: 'Schizachyrium_Scoparium_Racemes',
      map: this._racemeTexture,
      alphaTest: 0.13,
      roundedNormals: true,
      vertexColors: true,
      wind: this._leafWind,
      windVariant: 'schizachyrium-scoparium-racemes',
    });
    // Alpha-to-coverage softens the fine awn edge under MSAA.
    panicle.surface.alphaToCoverage = true;
    this._resources.trackMaterial(panicle.surface);
    this._resources.trackMaterial(panicle.depth);
    this._resources.trackMaterial(panicle.distance);

    this._materials = {
      // Culms carry their season in an instance colour, so the material is
      // left neutral. They are also the one organ kept out of the wind: each
      // culm is drawn as a stack of short segments, and bending each segment
      // by its own local height would pull them apart.
      // Double-sided because the coarse rung is a flat card: a culm is a
      // millimetre or two of silhouette and must not vanish when it happens
      // to be seen from behind.
      culm: this._material({
        color: 0xffffff,
        roughness: 0.82,
        side: THREE.DoubleSide,
      }),
      blade: foliage.surface,
      bladeDepth: foliage.depth,
      bladeDistance: foliage.distance,
      panicle: panicle.surface,
      panicleDepth: panicle.depth,
      panicleDistance: panicle.distance,
    };
  }

  #createInstances() {
    this._addInstancedOrgan('culms', {
      name: 'Schizachyrium_Culms',
      // A culm's segments stay where they are at every band, so a coarse
      // band is this kind with nothing moved -- which is what lets a field
      // allocate the culms once instead of once per band. The cost comes out
      // of the segment instead of out of the count: six triangles of open
      // tube near, two of card beyond. See `#setCulm`.
      geometries: [
        this._stemGeometry(3, { openEnded: true }),
        this._stemCardGeometry(),
      ],
      material: this._materials.culm,
      group: this._woodyGroup,
    });

    this._addInstancedOrgan('blades', {
      name: 'Schizachyrium_Blades',
      geometries: BLADE_LADDER.map((rung) =>
        this._sharedGeometry(
          'schizachyrium/blade',
          {
            arch: BLADE_BAKED_ARCH,
            twist: BLADE_TWIST_VARIANTS[1],
            widthRatio: BLADE_WIDTH_RATIOS[1],
            ...rung,
          },
          createBladeGeometry,
        ),
      ),
      material: this._materials.blade,
      group: this._leafGroup,
    });
    const blades = this._instancePool.mesh('blades');
    blades.customDepthMaterial = this._materials.bladeDepth;
    blades.customDistanceMaterial = this._materials.bladeDistance;

    this._addInstancedOrgan('racemes', {
      name: 'Schizachyrium_Racemes',
      geometries: RACEME_LADDER.map((rung) =>
        this._sharedGeometry('schizachyrium/raceme', rung, createRacemeGeometry),
      ),
      material: this._materials.panicle,
      group: this._flowerGroup,
      // Crossed alpha cards should not receive their own faceted shadows.
      receivesShadow: false,
    });
    const panicles = this._instancePool.mesh('racemes');
    panicles.customDepthMaterial = this._materials.panicleDepth;
    panicles.customDistanceMaterial = this._materials.panicleDistance;
  }

  #buildStableGraph() {
    const historicalCounts = this._emptyInstanceCounts();
    const unknownYearCounts = this._emptyInstanceCounts();
    const annualOrganCounts = new Map();

    const count = (additions) => {
      for (const [kind, amount] of Object.entries(additions)) {
        historicalCounts[kind] += amount;
        // Every tiller site can be showing its organs at once, so the whole
        // graph is one concurrent bucket rather than a per-year cohort.
        unknownYearCounts[kind] += amount;
      }
    };

    for (const tiller of this.#model.tillers) {
      count({ blades: tiller.blades.length });
      if (tiller.culm) {
        // One culm at a time per site, drawn as stride-two segments.
        count({
          culms: tiller.culm.points.length - 1,
          racemes: tiller.culm.racemes.length,
        });
      }
    }

    this._sizeInstancePool({
      historicalCounts,
      annualOrganCounts,
      unknownYearCounts,
    });
  }

  /** Stable render identity for one model organ id. */
  #identity(organId, kind) {
    const identities = this._runtime.identities;
    let identity = identities.get(organId);
    if (!identity) {
      identity = this._renderIdentity(organId, kind);
      identities.set(organId, identity);
    }
    return identity;
  }

  /* ---------------------------------------------------------------- *
   * Seasonal colour
   * ---------------------------------------------------------------- */

  /**
   * Colour of one culm segment at height `fraction` along the culm.
   *
   * Summer culms are green with a purple-tinted base; they turn red-purple
   * from early September and copper to tan through winter.
   */
  #culmColour(culm, phenology, fraction) {
    if (culm.cohort !== 'current') {
      return CULM_COPPER.clone()
        .lerp(CULM_TAN, clamp01(culm.weathering * 1.2))
        .lerp(CULM_WEATHERED, clamp01(culm.weathering - 0.4));
    }
    const base = 1 - THREE.MathUtils.smoothstep(fraction, 0, 0.4);
    return CULM_GREEN.clone()
      .lerp(CULM_BASE, base * 0.45)
      .lerp(CULM_PURPLE, clamp01(phenology.autumnProgress * 0.8 + base * 0.15))
      .lerp(CULM_COPPER, clamp01(phenology.copperProgress))
      .lerp(CULM_TAN, clamp01(culm.weathering * 1.2));
  }

  /**
   * One blade's journey from green through burgundy to copper. Each blade
   * shifts its window by a few days so green and burgundy blades coexist in
   * early October, as the photographs show, and every blade still finishes.
   */
  #bladeColour(blade, phenology) {
    if (blade.cohort !== 'current') {
      return BLADE_COPPER.clone().lerp(BLADE_TAN, clamp01(blade.weathering * 1.1));
    }
    const shift = keyedRange(this.seed, [blade.id, 'senescence-shift'], -8, 8);
    const day = phenology.dayOfYear - shift;
    const calendar = phenology.calendar;
    const burgundy = clamp01(
      (day - calendar.autumnStart) /
        Math.max(1, calendar.burgundyFull - calendar.autumnStart),
    );
    const copper = clamp01(
      (day - calendar.burgundyFull) /
        Math.max(1, calendar.copperFull - calendar.burgundyFull),
    );
    // A freshly cut stub is tan, then new growth is yellow-green and flat.
    const greening = clamp01(blade.expansion * 4);
    return BLADE_STUB.clone()
      .lerp(BLADE_SPRING, greening)
      .lerp(BLADE_SUMMER, clamp01(phenology.emergenceProgress * 1.3))
      .lerp(BLADE_BURGUNDY, burgundy)
      .lerp(BLADE_COPPER, copper)
      .lerp(BLADE_TAN, clamp01(blade.weathering * 1.1));
  }

  #headColour(raceme) {
    const silver = clamp01(raceme.fluffVisibility * 1.4);
    const wisp = clamp01(raceme.weathering * 0.9);
    const pre = HEAD_GREEN.clone().lerp(HEAD_BLOOM, raceme.anthesis ? 1 : 0.35);
    return pre
      .lerp(HEAD_SILVER, silver)
      .lerp(HEAD_WISP, raceme.pastBloom ? clamp01(1 - raceme.fluffVisibility) * 0.8 + wisp * 0.2 : 0);
  }

  /* ---------------------------------------------------------------- *
   * Organ writing
   * ---------------------------------------------------------------- */

  #setCulm(culm, phenology) {
    const points = culm.points;
    const stride = CULM_SECTION_STRIDE;
    const segment = new THREE.Object3D();
    const lastIndex = points.length - 1;
    let written = 0;

    // Walk the culm at a fixed stride, always closing on the tip so no culm is
    // shortened. The stride is not a band lever: `organLevel` carries the
    // coarse band instead (see the grasses' `CULM_SECTION_STRIDE`).
    for (let index = 0; index < points.length - 1; index += stride) {
      const end = Math.min(index + stride, points.length - 1);
      const start = vector(points[index]);
      const finish = vector(points[end]);
      if (start.distanceToSquared(finish) <= 1e-12) continue;
      const fraction = index / Math.max(1, lastIndex);
      const radius = culm.radii[index] * culm.radiusScale;
      composeSegmentMatrix(segment, start, finish, Math.max(radius, 0.0005));
      this._writeInstance(
        'culms',
        this.#identity(`${culm.id}:${index}`, 'culm-segment'),
        segment.matrix,
        this.#culmColour(culm, phenology, fraction),
      );
      written += 1;
    }
    return written;
  }

  #setBlade(blade, phenology, detailScale) {
    const emerge = vector(blade.emerge, UP).normalize();
    const arch = vector(blade.archDirection).normalize();
    // The blade geometry arches along its local +X and spans its width on
    // local +Z, so the basis must put +X on the arch direction. With
    // x = y * z, the normal that achieves it is arch x emerge.
    const quaternion = makeBasisQuaternion(emerge, arch.clone().cross(emerge));
    quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(UP, blade.roll),
    );
    // One blade is meshed for the whole plant, so its posture arrives as a
    // rotation in its own arch plane. See `bladeArchTilt`.
    quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        BLADE_TILT_AXIS,
        bladeArchTilt(blade.arch),
      ),
    );

    const lengthM = blade.lengthM * detailScale;
    this._writeInstance(
      'blades',
      this.#identity(blade.id, 'blade'),
      new THREE.Matrix4().compose(
        vector(blade.position),
        quaternion,
        new THREE.Vector3(lengthM, lengthM, lengthM),
      ),
      this.#bladeColour(blade, phenology),
    );
  }

  #setRaceme(raceme, detailScale) {
    const direction = vector(raceme.direction, UP);
    if (direction.lengthSq() < 1e-8) direction.copy(UP);
    direction.normalize();
    const quaternion = makeBasisQuaternion(direction, UP);
    quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(UP, raceme.spin),
    );
    const widthM =
      raceme.widthM *
      THREE.MathUtils.lerp(0.85, 1.05, Math.sqrt(raceme.fluffVisibility)) *
      detailScale;
    this._writeInstance(
      'racemes',
      this.#identity(raceme.id, 'raceme'),
      new THREE.Matrix4().compose(
        vector(raceme.position),
        quaternion,
        new THREE.Vector3(widthM, raceme.lengthM, widthM),
      ),
      this.#headColour(raceme),
    );
  }

  _applySnapshot(snapshot) {
    this._instancePool.beginFrame();
    const phenology = snapshot.phenology;

    let visibleCulms = 0;
    let livingCulms = 0;
    let standingDeadCulms = 0;
    let visibleBlades = 0;
    let visiblePanicles = 0;
    let visiblePlumes = 0;
    let visibleFlowers = 0;
    let visibleSeedHeads = 0;
    let culmSegments = 0;

    for (const tiller of snapshot.tillers) {
      if (tiller.removed) continue;
      for (const blade of tiller.blades) {
        if (!blade.visible || !blade.retained) continue;
        const detailScale = this._organDetailScale(blade.id);
        if (detailScale <= 0) continue;
        this.#setBlade(blade, phenology, detailScale);
        visibleBlades += 1;
      }

      const culm = tiller.culm;
      if (!culm?.visible) continue;
      visibleCulms += 1;
      if (culm.cohort === 'current') livingCulms += 1;
      else standingDeadCulms += 1;
      culmSegments += this.#setCulm(culm, phenology);

      for (const raceme of culm.racemes) {
        if (!raceme.visible) continue;
        // Racemes are the silhouette of the standing clump, so LOD thins them
        // a level more gently than blades.
        const stride = Math.max(1, Math.ceil(this._detail.leafStride / 2));
        const detailScale = this._organDetailScale(
          raceme.sourceId,
          stride,
          THREE.MathUtils.lerp(1, 1.1, clamp01(this._detail.leafScale - 1)),
        );
        if (detailScale <= 0) continue;
        this.#setRaceme(raceme, detailScale);
        visiblePanicles += 1;
        if (raceme.anthesis) visibleFlowers += 1;
        if (raceme.pastBloom) visibleSeedHeads += 1;
        if (raceme.plume) visiblePlumes += 1;
      }
    }

    this._instancePool.commitFrame();
    this._renderStats = {
      visibleTillers: snapshot.tillers.length,
      // The shared UI and the base class both speak in canes; for a grass
      // one cane is one culm.
      visibleCanes: visibleCulms,
      visibleAxes: visibleCulms,
      visibleCulms,
      livingCulms,
      standingDeadCulms,
      culmSegments,
      visibleLeaves: visibleBlades,
      visibleBlades,
      visiblePanicles,
      visiblePlumes,
      visibleFlowers,
      visibleSeedHeads,
      ...this._drawCallStats(),
    };
  }

  _evaluate() {
    return evaluateScopariumModel(this.#model, {
      ageYears: this.ageYears,
      dayOfYear: this.dayOfYear,
      events: this._events,
      seasonProfile: this.seasonProfile,
      offsetDays: this.offsetDays,
    });
  }

  setPhenologyProfile({
    seasonProfile = this.seasonProfile,
    offsetDays = this.offsetDays,
  } = {}) {
    return this.setState({ seasonProfile, offsetDays });
  }

  stats() {
    return {
      ...this._snapshot.stats,
      ...this._renderStats,
      species: this._snapshot.species,
      cultivar: this.cultivar,
      ageYears: this.ageYears,
      dayOfYear: this.dayOfYear,
      seasonProfile: this.seasonProfile,
      clump: this._snapshot.clump,
      dimensions: this._snapshot.dimensions,
      phenology: this._snapshot.phenology,
      careHints: this._snapshot.careHints,
    };
  }

  serialize() {
    return {
      schemaVersion: 1,
      type: 'Schizachyrium',
      plantId: this._plantId,
      species: SCOPARIUM_PROFILE.species,
      cultivar: this.cultivar,
      seed: this.seed,
      maxYears: this.maxYears,
      ageYears: this.ageYears,
      dayOfYear: this.dayOfYear,
      seasonProfile: this.seasonProfile,
      offsetDays: this.offsetDays,
      events: this._events.map((event) => ({ ...event })),
    };
  }
}

export default Schizachyrium;
