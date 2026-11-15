import * as THREE from 'three';

import {
  createLeafMaterialSet,
  keepAuthoredNormalsOnBackFaces,
} from '../../leaf-material.js';
import { createLeafCardGeometry } from '../../leaf-geometry.js';
import { PlantRenderer } from '../../plant-renderer.js';
import {
  composeSegmentMatrix,
  makeBasisQuaternion,
  vector,
} from '../../plant-transforms.js';
import { sharedTexture } from '../../shared-resources.js';
import {
  createFloretClusterTexture,
  createJoePyeArrayGeometry,
  createLanceolateLeafTexture,
} from './geometry.js';
import { MACULATUM_PROFILE } from './maculatum.js';
import { createMaculatumModel, evaluateMaculatumModel } from './model.js';

const UP = new THREE.Vector3(0, 1, 0);
const INSTANCE_KINDS = Object.freeze(['stems', 'leaves', 'heads']);

/**
 * The array keeps its full footprint at every band and thins its clusters
 * instead, each surviving card growing to keep the flat top closed (rule 9:
 * heads cannot be thinned, they are the plant, so the geometry thins).
 */
const ARRAY_LADDER = Object.freeze([
  Object.freeze({ clusters: 24, topCards: true, dome: 0.12 }),
  Object.freeze({ clusters: 14, topCards: false, dome: 0.12 }),
  Object.freeze({ clusters: 7, topCards: false, dome: 0.12 }),
]);

const DEFAULT_LOD_LEVELS = Object.freeze([
  Object.freeze({ distance: 0, detail: Object.freeze({ organLevel: 0 }) }),
  Object.freeze({
    distance: 7,
    hysteresis: 0.1,
    detail: Object.freeze({ leafStride: 2, leafScale: 1.14, organLevel: 1 }),
  }),
  Object.freeze({
    distance: 13,
    hysteresis: 0.12,
    detail: Object.freeze({ leafStride: 3, leafScale: 1.27, organLevel: 2 }),
  }),
]);

/** One segment of stem per section, at every band; see Echinacea. */
const STEM_SECTION_STRIDE = 1;

// Colours are instance tints multiplied over neutral generated plates, so they
// sit brighter than the target appearance. All are estimates (see profile).
const STEM_GREEN = new THREE.Color(0x7d9a48);
const STEM_PURPLE = new THREE.Color(0x6a3456);
// Owner's November photograph: frost-killed stems go dark purple-brown,
// close to black, not straw.
const STEM_DRY = new THREE.Color(0x4a3433);
const STEM_WEATHERED = new THREE.Color(0x3f302d);

const LEAF_SPRING = new THREE.Color(0x8fb85a);
const LEAF_SUMMER = new THREE.Color(0x6a9140);
const LEAF_YELLOW = new THREE.Color(0xc0ad55);
const LEAF_BROWN = new THREE.Color(0x8a6a45);
const LEAF_EMERGING_PURPLE = new THREE.Color(0x8a6a6a);
// Frost-blackened leaf hanging on the stem, and the same leaf on the ground.
const LEAF_DEAD = new THREE.Color(0x3a2b25);
const LEAF_FALLEN = new THREE.Color(0x46352b);
const LEAF_FALLEN_SUMMER = new THREE.Color(0x9a7a4a);

const ARRAY_BUD = new THREE.Color(0xa77590);
const ARRAY_OPEN = new THREE.Color(0xd486ae);
const ARRAY_FADED = new THREE.Color(0xb7939f);
const ARRAY_SEED = new THREE.Color(0xb39f80);
const ARRAY_WINTER = new THREE.Color(0x4a3a30);

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);

/**
 * Eutrochium maculatum, spotted Joe Pye weed.
 *
 * Herbaceous like Echinacea: the crown persists and everything above it is
 * rebuilt each year, so EZ-Tree's seeded axis grower authors the stem
 * centrelines and the stems are drawn as instanced tubes rather than bark.
 * Leaves are cards in whorls of four or five; each flat-topped array is one
 * instance of a card-built corymb whose florets live in a generated plate.
 */
export class Eutrochium extends PlantRenderer {
  #model;

  constructor(options = {}) {
    const cultivar = options.cultivar ?? MACULATUM_PROFILE.cultivar;
    if (cultivar !== MACULATUM_PROFILE.cultivar) {
      throw new RangeError(
        'This renderer currently supports only the straight species profile.',
      );
    }
    const leafPlate = sharedTexture(
      'eutrochium/lanceolate-leaf',
      {},
      createLanceolateLeafTexture,
    );

    super({
      profile: MACULATUM_PROFILE,
      organKinds: INSTANCE_KINDS,
      namePrefix: 'Eutrochium',
      detailStrideSalt: 'eutrochium-maculatum-detail',
      plantId: options.plantId ?? `eutrochium:${options.seed ?? 1818}`,
      seed: options.seed ?? 1818,
      maxYears: options.maxYears ?? MACULATUM_PROFILE.architecture.modelHorizonYears,
      ageYears: options.ageYears ?? 5,
      dayOfYear: options.dayOfYear ?? 212,
      assets: options.assets ?? {},
      defaultLeafPlate: leafPlate,
      extraStateKeys: ['seasonProfile', 'offsetDays'],
      lodLevels: options.lodLevels ?? DEFAULT_LOD_LEVELS,
      leafWind: {
        // Tall stems, broad leaves: a slow, larger sway than a coneflower.
        strength: new THREE.Vector3(0.05, 0, 0.05),
        frequency: 0.36,
        scale: 0.62,
        ...options.leafWind,
      },
    });

    this.seasonProfile = options.seasonProfile ?? 'typical';
    this.offsetDays = options.offsetDays ?? 0;
    this.#model = createMaculatumModel({ seed: this.seed, maxYears: this.maxYears });
    this._initialiseEvents(options.events ?? []);
    this._runtime.identities = new Map();

    this.#createMaterials();
    this.#buildStableGraph();
    // Required by the shared accounting contract; herbaceous stems are the
    // `stems` instance kind, so the woody mesh stays empty.
    this._createWoodMesh(this._materials.stem);
    this.#createInstances();
    this.setTime({ ageYears: this.ageYears, dayOfYear: this.dayOfYear });
  }

  #createMaterials() {
    const leaf = createLeafMaterialSet({
      name: 'Eutrochium_Maculatum_Leaves',
      map: this._assets.leaf.map,
      tint: this._assets.leaf.tint,
      alphaTest: this._assets.leaf.alphaTest,
      roundedNormals: true,
      wind: this._leafWind,
      windVariant: 'eutrochium-maculatum-leaves',
    });
    this._resources.trackMaterial(leaf.surface);
    this._resources.trackMaterial(leaf.depth);
    this._resources.trackMaterial(leaf.distance);

    this._protect('_floretTexture');
    this._floretTexture = sharedTexture(
      'eutrochium/floret-clusters',
      {},
      createFloretClusterTexture,
    );
    // Cards are seen from both sides; keep their soft upward normals on the
    // back face too, or every card seen from behind shades as if facing down.
    const head = keepAuthoredNormalsOnBackFaces(
      this._material({
        color: 0xffffff,
        map: this._floretTexture,
        vertexColors: true,
        alphaTest: 0.32,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0,
      }),
    );
    // Softens the fuzzy style edges under MSAA, as Pennisetum does.
    head.alphaToCoverage = true;

    this._materials = {
      stem: this._material({ color: 0xffffff, roughness: 0.85 }),
      leaf: leaf.surface,
      leafDepth: leaf.depth,
      leafDistance: leaf.distance,
      head,
      headDepth: this._resources.trackMaterial(
        new THREE.MeshDepthMaterial({
          name: 'Eutrochium_Array_Depth',
          map: this._floretTexture,
          alphaTest: 0.32,
          side: THREE.DoubleSide,
          depthPacking: THREE.RGBADepthPacking,
        }),
      ),
      headDistance: this._resources.trackMaterial(
        new THREE.MeshDistanceMaterial({
          name: 'Eutrochium_Array_Distance',
          map: this._floretTexture,
          alphaTest: 0.32,
          side: THREE.DoubleSide,
        }),
      ),
    };
  }

  #buildStableGraph() {
    const historicalCounts = this._emptyInstanceCounts();
    const unknownYearCounts = this._emptyInstanceCounts();
    const add = (kind, amount) => {
      historicalCounts[kind] += amount;
      unknownYearCounts[kind] += amount;
    };
    for (const shoot of this.#model.shoots) {
      for (const axis of shoot.axes) add('stems', axis.points.length - 1);
      add('leaves', shoot.leaves.length);
      add('heads', shoot.arrays.length);
    }
    this._sizeInstancePool({
      historicalCounts,
      annualOrganCounts: new Map(),
      unknownYearCounts,
    });
  }

  #createInstances() {
    this._addInstancedOrgan('stems', {
      name: 'Eutrochium_HerbaceousStems',
      geometries: [
        this._stemGeometry(5, { openEnded: true }),
        this._stemCardGeometry(),
      ],
      material: this._materials.stem,
      group: this._woodyGroup,
    });
    this._addInstancedOrgan('leaves', {
      name: 'Eutrochium_WhorledLeaves',
      geometry: this._sharedGeometry(
        'shared/leaf-card',
        { roundedNormals: this._assets.leaf.roundedNormals },
        createLeafCardGeometry,
      ),
      material: this._materials.leaf,
      group: this._leafGroup,
    });
    const leaves = this._instancePool.mesh('leaves');
    leaves.customDepthMaterial = this._materials.leafDepth;
    leaves.customDistanceMaterial = this._materials.leafDistance;

    this._addInstancedOrgan('heads', {
      name: 'Eutrochium_Maculatum_Arrays',
      geometries: ARRAY_LADDER.map((rung, level) =>
        this._sharedGeometry(
          `eutrochium/array-${level}`,
          rung,
          createJoePyeArrayGeometry,
        ),
      ),
      material: this._materials.head,
      group: this._flowerGroup,
      receivesShadow: false,
    });
    const heads = this._instancePool.mesh('heads');
    heads.customDepthMaterial = this._materials.headDepth;
    heads.customDistanceMaterial = this._materials.headDistance;
  }

  #identity(organId, kind) {
    let identity = this._runtime.identities.get(organId);
    if (!identity) {
      identity = this._renderIdentity(organId, kind);
      this._runtime.identities.set(organId, identity);
    }
    return identity;
  }

  #stemColour(axis, phenology, index) {
    if (axis.cohort === 'dry') {
      return STEM_DRY.clone().lerp(STEM_WEATHERED, clamp01(axis.weathering));
    }
    // Spots are densest low on the stem and merge to purple on old stems;
    // a per-segment blend stands in for them (see render assumptions).
    const height = index / Math.max(1, axis.points.length - 2);
    // Flower stalks are the youngest, greenest wood on the plant.
    const lowSpots =
      axis.kind === 'lateral'
        ? 0.15 * axis.spotting
        : THREE.MathUtils.lerp(0.62, 0.22, height) * axis.spotting;
    // A little segment-to-segment variation so the blend reads as patchy.
    const patch = 0.12 * axis.spotting * Math.sin(index * 2.3 + axis.spotting * 9);
    return STEM_GREEN.clone()
      .lerp(STEM_PURPLE, clamp01(lowSpots + patch + 0.2 * phenology.autumnProgress))
      .lerp(STEM_DRY, clamp01(phenology.dryProgress * 0.9));
  }

  #leafColour(leaf, phenology) {
    if (leaf.fallen) {
      // Leaves shed in late summer land tan, then darken like the rest once
      // the frost has been through.
      return leaf.fellInSummer
        ? LEAF_FALLEN_SUMMER.clone().lerp(LEAF_FALLEN, clamp01(phenology.wiltProgress))
        : LEAF_FALLEN.clone();
    }
    const summer = clamp01(phenology.leafProgress * 1.5);
    const colour = LEAF_EMERGING_PURPLE.clone()
      .lerp(LEAF_SPRING, clamp01(phenology.leafProgress * 4))
      .lerp(LEAF_SUMMER, summer);
    const yellow = Math.max(leaf.autumnProgress, leaf.lowerYellowing * 0.7);
    colour.lerp(LEAF_YELLOW, clamp01(yellow * 1.6));
    colour.lerp(LEAF_BROWN, clamp01((leaf.autumnProgress - 0.5) * 2));
    colour.lerp(LEAF_DEAD, clamp01(leaf.wilt * 1.3));
    return colour;
  }

  #arrayColour(array) {
    switch (array.stage) {
      case 'bud':
        return ARRAY_BUD.clone().lerp(ARRAY_OPEN, array.budProgress * 0.25);
      case 'opening':
        return ARRAY_BUD.clone().lerp(ARRAY_OPEN, 0.25 + 0.75 * array.openProgress);
      case 'open':
        return ARRAY_OPEN.clone().lerp(ARRAY_FADED, array.fadeProgress * 0.5);
      case 'fading':
        return ARRAY_FADED.clone().lerp(ARRAY_SEED, array.seedProgress);
      case 'seed':
        return ARRAY_FADED.clone()
          .lerp(ARRAY_SEED, array.seedProgress)
          .lerp(ARRAY_WINTER, clamp01(array.weathering * 0.6));
      default:
        return ARRAY_WINTER.clone().lerp(
          ARRAY_WINTER.clone().multiplyScalar(0.8),
          array.weathering,
        );
    }
  }

  #setAxis(axis, phenology) {
    const segment = new THREE.Object3D();
    let written = 0;
    for (let index = 0; index < axis.points.length - 1; index += STEM_SECTION_STRIDE) {
      const endIndex = Math.min(index + STEM_SECTION_STRIDE, axis.points.length - 1);
      const start = vector(axis.points[index]);
      const end = vector(axis.points[endIndex]);
      if (start.distanceToSquared(end) <= 1e-12) continue;
      const sourceRadius = axis.radii[Math.min(index, axis.radii.length - 1)];
      const radius = Math.max(0.0007, sourceRadius * axis.radiusScale);
      composeSegmentMatrix(segment, start, end, radius);
      this._writeInstance(
        'stems',
        this.#identity(`${axis.id}:segment:${index}`, 'stem-segment'),
        segment.matrix,
        this.#stemColour(axis, phenology, index),
      );
      written += 1;
    }
    return written;
  }

  #setLeaf(leaf, phenology, detailScale) {
    const direction = vector(leaf.direction, UP).normalize();
    const normal = vector(leaf.normal, new THREE.Vector3(0, 0, 1)).normalize();
    const quaternion = makeBasisQuaternion(direction, normal);
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, leaf.roll));
    this._writeInstance(
      'leaves',
      this.#identity(leaf.id, 'leaf'),
      new THREE.Matrix4().compose(
        vector(leaf.position),
        quaternion,
        new THREE.Vector3(
          leaf.widthM * detailScale,
          leaf.lengthM * detailScale,
          leaf.widthM * detailScale,
        ),
      ),
      this.#leafColour(leaf, phenology),
    );
  }

  #setArray(array, detailScale) {
    const direction = vector(array.direction, UP).normalize();
    const quaternion = makeBasisQuaternion(direction, UP);
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, array.spin));
    const diameter = array.diameterM * detailScale;
    this._writeInstance(
      'heads',
      this.#identity(array.id, 'flower-head'),
      new THREE.Matrix4().compose(
        vector(array.position),
        quaternion,
        new THREE.Vector3(diameter, diameter, diameter),
      ),
      this.#arrayColour(array),
    );
  }

  _applySnapshot(snapshot) {
    this._instancePool.beginFrame();
    const phenology = snapshot.phenology;
    let visibleStems = 0;
    let visibleAxes = 0;
    let stemSegments = 0;
    let visibleLeaves = 0;
    let visibleHeads = 0;
    let visibleFlowers = 0;
    let visibleFlowerBuds = 0;
    let visibleSeedHeads = 0;
    this._instancePool.suppress(this._detail.dropKinds);

    for (const axis of snapshot.axes) {
      if (!axis.visible) continue;
      visibleAxes += 1;
      if (axis.kind === 'main') visibleStems += 1;
      stemSegments += this.#setAxis(axis, phenology);
    }
    for (const leaf of snapshot.leaves) {
      const detailScale = this._organDetailScale(leaf.id);
      if (detailScale <= 0) continue;
      this.#setLeaf(leaf, phenology, detailScale);
      visibleLeaves += 1;
    }
    // Every array survives every band: it is the plant's signature.
    for (const array of snapshot.heads) {
      const detailScale = this._organDetailScale(array.id, 1, 1);
      if (detailScale <= 0) continue;
      this.#setArray(array, detailScale);
      visibleHeads += 1;
      if (array.stage === 'bud') visibleFlowerBuds += 1;
      else if (array.stage === 'open' || array.stage === 'opening') visibleFlowers += 1;
      else if (array.stage === 'seed' || array.stage === 'winter') visibleSeedHeads += 1;
    }

    this._instancePool.commitFrame();
    this._renderStats = {
      visibleCanes: visibleStems,
      visibleShoots: visibleStems,
      visibleStems,
      visibleAxes,
      stemSegments,
      visibleLeaves,
      visibleHeads,
      visibleFlowers,
      visibleFlowerBuds,
      visibleSeedHeads,
      ...this._drawCallStats(),
    };
  }

  _evaluate() {
    return evaluateMaculatumModel(this.#model, {
      ageYears: this.ageYears,
      dayOfYear: this.dayOfYear,
      events: this._events,
      seasonProfile: this.seasonProfile,
      offsetDays: this.offsetDays,
    });
  }

  setPhenologyProfile({ seasonProfile = this.seasonProfile, offsetDays = this.offsetDays } = {}) {
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
      crown: this._snapshot.crown,
      dimensions: this._snapshot.dimensions,
      phenology: this._snapshot.phenology,
      careHints: this._snapshot.careHints,
    };
  }

  serialize() {
    return {
      schemaVersion: 1,
      type: 'Eutrochium',
      plantId: this._plantId,
      species: MACULATUM_PROFILE.species,
      cultivar: this.cultivar,
      seed: this.seed,
      maxYears: this.maxYears,
      ageYears: this.ageYears,
      dayOfYear: this.dayOfYear,
      seasonProfile: this.seasonProfile,
      offsetDays: this.offsetDays,
      events: [],
    };
  }
}

export default Eutrochium;
