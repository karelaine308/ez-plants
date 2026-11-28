import * as THREE from 'three';

import { createLeafMaterialSet, keepAuthoredNormalsOnBackFaces } from '../../leaf-material.js';
import { createLeafCardGeometry } from '../../leaf-geometry.js';
import { MAGNUS_HEAD_DEFORMATION, setInstanceDeformation } from '../../instance-deformation.js';
import { PlantRenderer } from '../../plant-renderer.js';
import { composeSegmentMatrix, makeBasisQuaternion, vector } from '../../plant-transforms.js';
import { sharedTexture } from '../../shared-resources.js';
import {
  createAsterHeadGeometry,
  createAsterHeadTexture,
  createClaspingLeafTexture,
} from './geometry.js';
import { NOVAE_ANGLIAE_PROFILE } from './novaeangliae.js';
import { createNovaeAngliaeModel, evaluateNovaeAngliaeModel } from './model.js';

const UP = new THREE.Vector3(0, 1, 0);
const INSTANCE_KINDS = Object.freeze(['stems', 'leaves', 'heads']);
/** Spare leaf slots: last year's litter and this year's leaves overlap for a week or two in April. */
const LEAF_POOL_HEADROOM = 1.4;

/**
 * A head is a dish of ray plate and a small disc: 11 triangles at band 0 (a
 * six-sided star, a three-sided disc and an upright puff card for the spent
 * head), then 5 and 2. 650 heads cannot be modelled ray
 * by ray, and the 55 rays are a texture (rule 9).
 */
const HEAD_LADDER = Object.freeze([
  Object.freeze({ sides: 6, discSides: 3, puff: 1 }),
  Object.freeze({ sides: 0, discSides: 1, puff: 1 }),
  Object.freeze({ sides: 0, discSides: 0, puff: 0 }),
]);

const DEFAULT_LOD_LEVELS = Object.freeze([
  Object.freeze({ distance: 0, detail: Object.freeze({ organLevel: 0 }) }),
  Object.freeze({
    distance: 6,
    hysteresis: 0.1,
    detail: Object.freeze({ leafStride: 3, leafScale: 1.27, organLevel: 1 }),
  }),
  Object.freeze({
    distance: 11,
    hysteresis: 0.12,
    detail: Object.freeze({ leafStride: 5, leafScale: 1.5, organLevel: 2 }),
  }),
]);

/** One segment of stem per section, at every band; see Echinacea. */
const STEM_SECTION_STRIDE = 1;

const STEM_GREEN = new THREE.Color(0x7b9250);
const STEM_RED = new THREE.Color(0x8a6a50);
const STEM_DRY = new THREE.Color(0x76624c);
const STEM_WEATHERED = new THREE.Color(0x66564a);

const LEAF_GREEN = new THREE.Color(0x7aa550);
const LEAF_TUFT_PURPLE = new THREE.Color(0x7d6a7a);
const LEAF_YELLOW = new THREE.Color(0xa8a050);
const LEAF_DEAD = new THREE.Color(0x4a3727);
const LEAF_LITTER_SUMMER = new THREE.Color(0x8c7448);

// Head tints multiply the vertex colours (violet rays, yellow disc). The blue
// channel carries the ray-visibility step above 2, so every tint stays below 2.
const HEAD_BUD = new THREE.Color(0.45, 1, 1);
const HEAD_OPEN = new THREE.Color(1, 1, 1);
const HEAD_OPEN_OLD = new THREE.Color(0.85, 0.62, 1);
// Seed and winter heads show the pappus puff (grey-tan in the plate); the
// tint only dims it. Every channel stays at or below 1.
const HEAD_SEED = new THREE.Color(1, 0.96, 0.88);
const HEAD_WINTER = new THREE.Color(0.8, 0.75, 0.68);

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);

const RAY_MORPH_VERSION = 'symphyotrichum-head-ray-morph-v1';

/**
 * Collapse ray vertices as a head buds or sheds its rays. Ray visibility is
 * packed into instance blue (two units per quantised step) and a head flag
 * into red; each channel's remainder modulo two is the real tint. One head
 * kind, one draw, through every phenological mixture. Copied from the
 * coneflower's ray morph (rule 7 forbids importing it); the attribute names
 * `magnusRay` and `magnusHead` are the shared contract.
 */
function installHeadMorph(material, { shadowPass = false } = {}) {
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
    if (shadowPass) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <batching_pars_vertex>',
        '#include <batching_pars_vertex>\n#include <color_pars_vertex>',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\n#include <color_pars_fragment>',
      );
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float magnusRay;
attribute float magnusHead;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#if defined(USE_INSTANCING_COLOR)
  vec3 magnusInstanceTint = instanceColor;
#elif defined(USE_INSTANCING_COLOR_INDIRECT)
  vec3 magnusInstanceTint = getColorTexture().rgb;
#else
  vec3 magnusInstanceTint = vec3(3.0, 1.0, 511.0);
#endif
  float magnusHeadVisibility = clamp(floor(magnusInstanceTint.r * 0.5), 0.0, 1.0);
  float magnusRayVisibility = clamp(floor(magnusInstanceTint.b * 0.5) / 255.0, 0.0, 1.0);
  transformed.xz *= mix(1.0, magnusHeadVisibility, magnusHead);
  transformed.y = mix(transformed.y, 1.0, magnusHead * (1.0 - magnusHeadVisibility));
  transformed.xz *= mix(1.0, magnusRayVisibility, magnusRay);
#if ${shadowPass ? '0' : '1'}
  float magnusTintRed = mod(magnusInstanceTint.r, 2.0);
  float magnusTintBlue = mod(magnusInstanceTint.b, 2.0);
  vColor.r *= magnusTintRed / max(magnusInstanceTint.r, 0.000001);
  vColor.b *= magnusTintBlue / max(magnusInstanceTint.b, 0.000001);
#endif`,
      );
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey()}|${RAY_MORPH_VERSION}|${shadowPass ? 'shadow' : 'surface'}`;
  material.needsUpdate = true;
  return setInstanceDeformation(material, MAGNUS_HEAD_DEFORMATION);
}

/**
 * Symphyotrichum novae-angliae, New England aster.
 *
 * Herbaceous like Echinacea and Eutrochium: the crown persists and everything
 * above it is rebuilt each year. EZ-Tree's seeded axis grower authors the stem
 * centrelines; side branches and twigs are short straight runs. All are drawn
 * as one instanced tube kind. Leaves are clasping lance cards (stem leaves,
 * a basal tuft and fallen litter share one pool); each of up to about 900
 * heads is one instance of a small dish of ray plate and a yellow disc.
 */
export class Symphyotrichum extends PlantRenderer {
  #model;

  constructor(options = {}) {
    const cultivar = options.cultivar ?? NOVAE_ANGLIAE_PROFILE.cultivar;
    if (cultivar !== NOVAE_ANGLIAE_PROFILE.cultivar) {
      throw new RangeError('This renderer currently supports only the straight species profile.');
    }
    const leafPlate = sharedTexture('symphyotrichum/clasping-leaf', {}, createClaspingLeafTexture);
    super({
      profile: NOVAE_ANGLIAE_PROFILE,
      organKinds: INSTANCE_KINDS,
      namePrefix: 'Symphyotrichum',
      detailStrideSalt: 'symphyotrichum-novae-angliae-detail',
      plantId: options.plantId ?? `symphyotrichum:${options.seed ?? 1790}`,
      seed: options.seed ?? 1790,
      maxYears: options.maxYears ?? NOVAE_ANGLIAE_PROFILE.architecture.modelHorizonYears,
      ageYears: options.ageYears ?? 5,
      dayOfYear: options.dayOfYear ?? 266,
      assets: options.assets ?? {},
      defaultLeafPlate: leafPlate,
      extraStateKeys: ['seasonProfile', 'offsetDays'],
      lodLevels: options.lodLevels ?? DEFAULT_LOD_LEVELS,
      leafWind: {
        strength: new THREE.Vector3(0.04, 0, 0.04),
        frequency: 0.38,
        scale: 0.6,
        ...options.leafWind,
      },
    });
    this.seasonProfile = options.seasonProfile ?? 'typical';
    this.offsetDays = options.offsetDays ?? 0;
    this.#model = createNovaeAngliaeModel({ seed: this.seed, maxYears: this.maxYears });
    this._initialiseEvents(options.events ?? []);
    this._runtime.identities = new Map();

    this.#createMaterials();
    this.#buildStableGraph();
    // Required by the shared accounting contract; stems are the `stems`
    // instance kind, so the woody mesh stays empty.
    this._createWoodMesh(this._materials.stem);
    this.#createInstances();
    this.setTime({ ageYears: this.ageYears, dayOfYear: this.dayOfYear });
  }

  #createMaterials() {
    const leaf = createLeafMaterialSet({
      name: 'Symphyotrichum_NovaeAngliae_Leaves',
      map: this._assets.leaf.map,
      tint: this._assets.leaf.tint,
      alphaTest: this._assets.leaf.alphaTest,
      roundedNormals: true,
      wind: this._leafWind,
      windVariant: 'symphyotrichum-novae-angliae-leaves',
    });
    this._resources.trackMaterial(leaf.surface);
    this._resources.trackMaterial(leaf.depth);
    this._resources.trackMaterial(leaf.distance);
    this._protect('_headTexture');
    this._headTexture = sharedTexture('symphyotrichum/head-rays', {}, createAsterHeadTexture);
    const head = installHeadMorph(
      keepAuthoredNormalsOnBackFaces(
        this._material({
          color: 0xffffff,
          map: this._headTexture,
          alphaTest: 0.4,
          vertexColors: true,
          side: THREE.DoubleSide,
          roughness: 0.85,
          metalness: 0,
        }),
      ),
    );
    head.alphaToCoverage = true;
    this._materials = {
      stem: this._material({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }),
      leaf: leaf.surface,
      leafDepth: leaf.depth,
      leafDistance: leaf.distance,
      head,
      headDepth: this._resources.trackMaterial(
        installHeadMorph(
          new THREE.MeshDepthMaterial({
            name: 'Symphyotrichum_Head_Depth',
            side: THREE.DoubleSide,
            depthPacking: THREE.RGBADepthPacking,
          }),
          { shadowPass: true },
        ),
      ),
      headDistance: this._resources.trackMaterial(
        installHeadMorph(
          new THREE.MeshDistanceMaterial({ name: 'Symphyotrichum_Head_Distance', side: THREE.DoubleSide }),
          { shadowPass: true },
        ),
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
      add('leaves', Math.ceil(shoot.leaves.length * LEAF_POOL_HEADROOM));
      add('heads', shoot.heads.length);
    }
    add('leaves', this.#model.basalLeaves.length);
    this._sizeInstancePool({ historicalCounts, annualOrganCounts: new Map(), unknownYearCounts });
  }

  #createInstances() {
    this._addInstancedOrgan('stems', {
      name: 'Symphyotrichum_HerbaceousStems',
      geometries: [this._stemGeometry(3, { openEnded: true }), this._stemCardGeometry()],
      material: this._materials.stem,
      group: this._woodyGroup,
    });
    this._addInstancedOrgan('leaves', {
      name: 'Symphyotrichum_ClaspingLeaves',
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
      name: 'Symphyotrichum_Capitula',
      geometries: HEAD_LADDER.map((rung, level) =>
        this._sharedGeometry(`symphyotrichum/head-${level}`, rung, createAsterHeadGeometry),
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

  #stemColour(axis, phenology) {
    if (axis.cohort === 'dry') {
      return STEM_DRY.clone().lerp(STEM_WEATHERED, clamp01(axis.weathering * 0.8));
    }
    const reddish = axis.kind === 'main' ? 0.25 : 0.1;
    return STEM_GREEN.clone().lerp(STEM_RED, reddish).lerp(STEM_DRY, clamp01(phenology.dryProgress * 0.9));
  }

  #leafColour(leaf) {
    const colour = LEAF_GREEN.clone();
    if (leaf.kind === 'basal') {
      return colour.lerp(LEAF_TUFT_PURPLE, 0.3 * leaf.tuft);
    }
    colour.lerp(LEAF_YELLOW, clamp01(leaf.senescence));
    colour.lerp(LEAF_DEAD, clamp01((leaf.autumnProgress - 0.1) * 1.3));
    if (leaf.litter && leaf.autumnProgress < 0.99) colour.lerp(LEAF_LITTER_SUMMER, 0.7);
    return colour;
  }

  #headColour(head) {
    switch (head.stage) {
      case 'bud':
        return HEAD_BUD.clone();
      case 'opening':
      case 'open':
        return HEAD_OPEN.clone().lerp(HEAD_OPEN_OLD, clamp01(head.maturity * 1.6));
      case 'seed':
        return HEAD_SEED.clone();
      default:
        return HEAD_SEED.clone().lerp(HEAD_WINTER, head.weathering);
    }
  }

  #setAxis(axis, phenology) {
    // At the coarsest band only half the short side branches are drawn (the same
    // stable subset every time); their heads and leaves carry on.
    if (axis.kind === 'branch' && this._detail.leafStride >= 5 && this._organDetailScale(axis.id, 2, 1) <= 0) {
      return 0;
    }
    const segment = new THREE.Object3D();
    let written = 0;
    for (let index = 0; index < axis.points.length - 1; index += STEM_SECTION_STRIDE) {
      const endIndex = Math.min(index + STEM_SECTION_STRIDE, axis.points.length - 1);
      const start = vector(axis.points[index]);
      const end = vector(axis.points[endIndex]);
      if (start.distanceToSquared(end) <= 1e-12) continue;
      const sourceRadius = axis.radii[Math.min(index, axis.radii.length - 1)];
      const radius = Math.max(0.0005, sourceRadius * axis.radiusScale);
      composeSegmentMatrix(segment, start, end, radius);
      this._writeInstance(
        'stems',
        this.#identity(`${axis.id}:segment:${index}`, 'stem-segment'),
        segment.matrix,
        this.#stemColour(axis, phenology),
      );
      written += 1;
    }
    return written;
  }

  #setLeaf(leaf, detailScale) {
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
        new THREE.Vector3(leaf.widthM * detailScale, leaf.lengthM * detailScale, leaf.widthM * detailScale),
      ),
      this.#leafColour(leaf),
    );
  }

  #setHead(head, detailScale) {
    const direction = vector(head.direction, UP).normalize();
    const quaternion = makeBasisQuaternion(direction, UP);
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, head.spin));
    const size = head.visualScale * head.headScale * detailScale;
    const colour = this.#headColour(head);
    // Two red units flag a spent head, showing its puff; two blue units per quantised step
    // carry ray visibility. The shader restores the seasonal remainders.
    if (head.stage === 'seed' || head.stage === 'winter') colour.r += 2;
    colour.b += Math.round(clamp01(head.rayVisibility) * 255) * 2;
    this._writeInstance(
      'heads',
      this.#identity(head.id, 'flower-head'),
      new THREE.Matrix4().compose(vector(head.position), quaternion, new THREE.Vector3(size, size, size)),
      colour,
    );
  }

  _applySnapshot(snapshot) {
    this._instancePool.beginFrame();
    const phenology = snapshot.phenology;
    let visibleStems = 0;
    let visibleAxes = 0;
    let stemSegments = 0;
    let visibleLeaves = 0;
    let visibleLitterLeaves = 0;
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
      this.#setLeaf(leaf, detailScale);
      visibleLeaves += 1;
      if (leaf.litter) visibleLitterLeaves += 1;
    }
    // Every head survives every band: it is the plant's signature.
    for (const head of snapshot.heads) {
      const detailScale = this._organDetailScale(head.id, 1, 1);
      if (detailScale <= 0) continue;
      this.#setHead(head, detailScale);
      visibleHeads += 1;
      if (head.stage === 'bud') visibleFlowerBuds += 1;
      else if (head.stage === 'open' || head.stage === 'opening') visibleFlowers += 1;
      else visibleSeedHeads += 1;
    }
    this._instancePool.commitFrame();
    this._renderStats = {
      visibleCanes: visibleStems,
      visibleShoots: visibleStems,
      visibleStems,
      visibleAxes,
      stemSegments,
      visibleLeaves,
      visibleLitterLeaves,
      visibleHeads,
      visibleFlowers,
      visibleFlowerBuds,
      visibleSeedHeads,
      ...this._drawCallStats(),
    };
  }

  _evaluate() {
    return evaluateNovaeAngliaeModel(this.#model, {
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
      lean: this._snapshot.lean,
      crown: this._snapshot.crown,
      dimensions: this._snapshot.dimensions,
      phenology: this._snapshot.phenology,
      careHints: this._snapshot.careHints,
    };
  }

  serialize() {
    return {
      schemaVersion: 1,
      type: 'Symphyotrichum',
      plantId: this._plantId,
      species: NOVAE_ANGLIAE_PROFILE.species,
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

export default Symphyotrichum;
