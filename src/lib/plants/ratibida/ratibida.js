import * as THREE from 'three';

import { createLeafMaterialSet, keepAuthoredNormalsOnBackFaces } from '../../leaf-material.js';
import { createLeafCardGeometry } from '../../leaf-geometry.js';
import { MAGNUS_HEAD_DEFORMATION, setInstanceDeformation } from '../../instance-deformation.js';
import { PlantRenderer } from '../../plant-renderer.js';
import { composeSegmentMatrix, makeBasisQuaternion, vector } from '../../plant-transforms.js';
import { sharedTexture } from '../../shared-resources.js';
import { createPinnateLeafTexture, createRatibidaHeadGeometry } from './geometry.js';
import { PINNATA_PROFILE } from './pinnata.js';
import { createPinnataModel, evaluatePinnataModel } from './model.js';

const UP = new THREE.Vector3(0, 1, 0);
const INSTANCE_KINDS = Object.freeze(['stems', 'leaves', 'heads']);

const HEAD_LADDER = Object.freeze([
  Object.freeze({ rays: 8, raySegments: 3, radialSegments: 12, coneRings: 4, bracts: 6 }),
  Object.freeze({ rays: 8, raySegments: 2, radialSegments: 8, coneRings: 3, bracts: 4 }),
  Object.freeze({ rays: 5, raySegments: 1, radialSegments: 6, coneRings: 2, bracts: 0 }),
]);

const DEFAULT_LOD_LEVELS = Object.freeze([
  Object.freeze({ distance: 0, detail: Object.freeze({ organLevel: 0 }) }),
  Object.freeze({
    distance: 6,
    hysteresis: 0.1,
    detail: Object.freeze({ leafStride: 2, leafScale: 1.14, organLevel: 1 }),
  }),
  Object.freeze({
    distance: 11,
    hysteresis: 0.12,
    detail: Object.freeze({ leafStride: 3, leafScale: 1.27, organLevel: 2 }),
  }),
]);

/** One segment of stem per section, at every band; see Echinacea. */
const STEM_SECTION_STRIDE = 1;

const STEM_GREEN = new THREE.Color(0x7c9a50);
const STEM_TAN = new THREE.Color(0xa8946a);
const STEM_DRY = new THREE.Color(0x9a8660);
const STEM_WEATHERED = new THREE.Color(0x857460);

const LEAF_SPRING = new THREE.Color(0x86a85a);
const LEAF_SUMMER = new THREE.Color(0x6c8f4c);
const LEAF_AUTUMN = new THREE.Color(0x9a8a4a);
const LEAF_BROWN = new THREE.Color(0x7a5f3c);

// Head tints multiply the vertex colours: the cone is brown in the plate.
const CONE_BUD = new THREE.Color(0.95, 1.45, 1.0);
// Neutral, so the ray colour is exactly the plate's golden yellow.
const CONE_OPEN = new THREE.Color(1, 1, 1);
const CONE_BROWN = new THREE.Color(1.0, 1.0, 1.0);
const CONE_SEED = new THREE.Color(0.62, 0.58, 0.58);
const CONE_WINTER = new THREE.Color(0.5, 0.46, 0.48);

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);

const RAY_MORPH_VERSION = 'ratibida-head-ray-morph-v1';

/**
 * Collapse ray vertices as a head buds or sheds its rays. Ray visibility is
 * packed into instance blue (two units per quantised step) and a head flag
 * into red; each channel's remainder modulo two is the real tint. One head
 * kind, one draw, through every phenological mixture. Copied from the
 * coneflower's ray morph (rule 7 forbids importing it); the attribute names
 * `magnusRay` and `magnusHead` are the shared contract. Unlike the purple
 * coneflower, rays collapse to nothing, because drooping rays under a seed head
 * would read as a skirt.
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
 * Ratibida pinnata, gray-headed coneflower.
 *
 * Herbaceous like Echinacea and Eutrochium: the crown persists and everything
 * above it is rebuilt each year. EZ-Tree's seeded axis grower authors the
 * stem and flower-stalk centrelines, drawn together as one instanced tube
 * kind; leaves are pinnate cards, a basal rosette plus a few stem leaves; each
 * head is one instance with a tall cone and drooping yellow rays.
 */
export class Ratibida extends PlantRenderer {
  #model;

  constructor(options = {}) {
    const cultivar = options.cultivar ?? PINNATA_PROFILE.cultivar;
    if (cultivar !== PINNATA_PROFILE.cultivar) {
      throw new RangeError('This renderer currently supports only the straight species profile.');
    }
    const leafPlate = sharedTexture('ratibida/pinnate-leaf', {}, createPinnateLeafTexture);
    super({
      profile: PINNATA_PROFILE,
      organKinds: INSTANCE_KINDS,
      namePrefix: 'Ratibida',
      detailStrideSalt: 'ratibida-pinnata-detail',
      plantId: options.plantId ?? `ratibida:${options.seed ?? 1913}`,
      seed: options.seed ?? 1913,
      maxYears: options.maxYears ?? PINNATA_PROFILE.architecture.modelHorizonYears,
      ageYears: options.ageYears ?? 5,
      dayOfYear: options.dayOfYear ?? 205,
      assets: options.assets ?? {},
      defaultLeafPlate: leafPlate,
      extraStateKeys: ['seasonProfile', 'offsetDays'],
      lodLevels: options.lodLevels ?? DEFAULT_LOD_LEVELS,
      leafWind: {
        strength: new THREE.Vector3(0.04, 0, 0.04),
        frequency: 0.4,
        scale: 0.6,
        ...options.leafWind,
      },
    });
    this.seasonProfile = options.seasonProfile ?? 'typical';
    this.offsetDays = options.offsetDays ?? 0;
    this.#model = createPinnataModel({ seed: this.seed, maxYears: this.maxYears });
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
      name: 'Ratibida_Pinnata_Leaves',
      map: this._assets.leaf.map,
      tint: this._assets.leaf.tint,
      alphaTest: this._assets.leaf.alphaTest,
      roundedNormals: true,
      wind: this._leafWind,
      windVariant: 'ratibida-pinnata-leaves',
    });
    this._resources.trackMaterial(leaf.surface);
    this._resources.trackMaterial(leaf.depth);
    this._resources.trackMaterial(leaf.distance);
    this._materials = {
      stem: this._material({ color: 0xffffff, roughness: 0.9 }),
      leaf: leaf.surface,
      leafDepth: leaf.depth,
      leafDistance: leaf.distance,
      head: installHeadMorph(
        keepAuthoredNormalsOnBackFaces(
          this._material({
            color: 0xffffff,
            vertexColors: true,
            side: THREE.DoubleSide,
            roughness: 0.85,
            metalness: 0,
          }),
        ),
      ),
      headDepth: this._resources.trackMaterial(
        installHeadMorph(
          new THREE.MeshDepthMaterial({
            name: 'Ratibida_Head_Depth',
            side: THREE.DoubleSide,
            depthPacking: THREE.RGBADepthPacking,
          }),
          { shadowPass: true },
        ),
      ),
      headDistance: this._resources.trackMaterial(
        installHeadMorph(
          new THREE.MeshDistanceMaterial({ name: 'Ratibida_Head_Distance', side: THREE.DoubleSide }),
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
      add('leaves', shoot.leaves.length);
      add('heads', shoot.heads.length);
    }
    add('leaves', this.#model.basalLeaves.length);
    this._sizeInstancePool({ historicalCounts, annualOrganCounts: new Map(), unknownYearCounts });
  }

  #createInstances() {
    this._addInstancedOrgan('stems', {
      name: 'Ratibida_HerbaceousStems',
      geometries: [this._stemGeometry(5, { openEnded: true }), this._stemCardGeometry()],
      material: this._materials.stem,
      group: this._woodyGroup,
    });
    this._addInstancedOrgan('leaves', {
      name: 'Ratibida_PinnateLeaves',
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
      name: 'Ratibida_Capitula',
      geometries: HEAD_LADDER.map((rung, level) =>
        this._sharedGeometry(`ratibida/head-${level}`, rung, createRatibidaHeadGeometry),
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
    return STEM_GREEN.clone().lerp(STEM_TAN, clamp01(phenology.dryProgress * 0.9));
  }

  #leafColour(leaf) {
    const colour = LEAF_SPRING.clone().lerp(LEAF_SUMMER, clamp01(1.5 * (1 - leaf.autumnProgress) + 0.2));
    colour.lerp(LEAF_AUTUMN, clamp01(leaf.autumnProgress * 1.6));
    colour.lerp(LEAF_BROWN, clamp01((leaf.autumnProgress - 0.5) * 2));
    return colour;
  }

  #headColour(head) {
    switch (head.stage) {
      case 'bud':
        return CONE_BUD.clone();
      case 'opening':
      case 'open':
        return CONE_OPEN.clone().lerp(CONE_BROWN, clamp01(head.maturity * 2.2));
      case 'seed':
        return CONE_BROWN.clone().lerp(CONE_SEED, clamp01((head.maturity - 0.25) * 1.5));
      default:
        return CONE_SEED.clone().lerp(CONE_WINTER, head.weathering);
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
      const radius = Math.max(0.0006, sourceRadius * axis.radiusScale);
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
    // Two red units flag the capitulum; two blue units per quantised step
    // carry ray visibility. The shader restores the seasonal remainders.
    colour.r += 2;
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
      visibleHeads,
      visibleFlowers,
      visibleFlowerBuds,
      visibleSeedHeads,
      ...this._drawCallStats(),
    };
  }

  _evaluate() {
    return evaluatePinnataModel(this.#model, {
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
      type: 'Ratibida',
      plantId: this._plantId,
      species: PINNATA_PROFILE.species,
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

export default Ratibida;
