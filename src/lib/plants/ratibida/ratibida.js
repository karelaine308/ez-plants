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
  createPinnataHeadGeometry,
  createPinnateLeafTexture,
} from './geometry.js';
import { PINNATA_PROFILE } from './pinnata.js';
import { createPinnataModel, evaluatePinnataModel } from './model.js';

const UP = new THREE.Vector3(0, 1, 0);
const INSTANCE_KINDS = Object.freeze(['stems', 'leaves', 'heads']);

/**
 * A head keeps its full footprint at every band and thins its geometry instead:
 * fewer rays, fewer segments in each ray, fewer sides to the cone (rule 9:
 * heads cannot be thinned, they are the plant).
 */
const HEAD_LADDER = Object.freeze([
  Object.freeze({ rays: 9, raySegments: 3, radialSegments: 10, coneRings: 4 }),
  Object.freeze({ rays: 8, raySegments: 2, radialSegments: 8, coneRings: 3 }),
  Object.freeze({ rays: 6, raySegments: 2, radialSegments: 6, coneRings: 2 }),
]);

const DEFAULT_LOD_LEVELS = Object.freeze([
  Object.freeze({ distance: 0, detail: Object.freeze({ organLevel: 0 }) }),
  Object.freeze({
    distance: 5,
    hysteresis: 0.1,
    detail: Object.freeze({ leafStride: 2, leafScale: 1.14, organLevel: 1 }),
  }),
  Object.freeze({
    distance: 9,
    hysteresis: 0.12,
    detail: Object.freeze({ leafStride: 3, leafScale: 1.27, organLevel: 2 }),
  }),
]);

/** One segment of stem per section, at every band; see Echinacea. */
const STEM_SECTION_STRIDE = 1;

// Colours are instance tints multiplied over neutral generated plates, so they
// sit brighter than the target appearance. All are estimates (see profile).
const STEM_GREEN = new THREE.Color(0x7d9a52);
const STEM_DRY = new THREE.Color(0x8c7650);
const STEM_WEATHERED = new THREE.Color(0x7d6c55);

const LEAF_EMERGING = new THREE.Color(0xb0bb52);
const LEAF_SPRING = new THREE.Color(0xa1b436);
const LEAF_SUMMER = new THREE.Color(0x8c9c26);
const LEAF_YELLOW = new THREE.Color(0xc2b05a);
const LEAF_BROWN = new THREE.Color(0x8a6a45);
const LEAF_DEAD = new THREE.Color(0x8c7350);
const LEAF_FALLEN = new THREE.Color(0x7a6244);
const LEAF_FALLEN_SUMMER = new THREE.Color(0x9a8450);
const ROSETTE_SUMMER = new THREE.Color(0x90a02e);
const ROSETTE_WINTER = new THREE.Color(0x536b2c);

// Head tints multiply the authored vertex colours: white leaves the yellow rays
// and the tan cone as drawn, green turns the cone into a gray-green bud, and
// dark brown turns the tan cone near black.
const HEAD_OPEN = new THREE.Color().setRGB(1, 1, 1);
const HEAD_BUD = new THREE.Color().setRGB(0.78, 1.5, 0.95);
const HEAD_SEED = new THREE.Color().setRGB(0.3, 0.24, 0.2);
const HEAD_WINTER = new THREE.Color().setRGB(0.2, 0.17, 0.15);

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);

const HEAD_MORPH_VERSION = 'ratibida-head-ray-morph-v1';

/**
 * Fold a head's ray vertices in under its cone as the head buds or drops its
 * rays. Ray visibility is packed into the instance colour's blue channel: two
 * units per quantised step, so the low [0, 1] remainder stays the real tint.
 * That keeps one head kind, and one draw, through every stage of the head.
 */
function installHeadMorph(material, { shadowPass = false } = {}) {
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
    if (shadowPass) {
      // Depth and distance shaders omit the colour chunks by default, but the
      // packed ray visibility must shape shadows as well.
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
attribute float ratibidaRay;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#if defined(USE_INSTANCING_COLOR)
  vec3 ratibidaTint = instanceColor;
#elif defined(USE_INSTANCING_COLOR_INDIRECT)
  vec3 ratibidaTint = getColorTexture().rgb;
#else
  vec3 ratibidaTint = vec3(1.0, 1.0, 511.0);
#endif
  float ratibidaRayVisibility = clamp(floor(ratibidaTint.b * 0.5) / 255.0, 0.0, 1.0);
  float ratibidaRayScale = mix(0.08, 1.0, ratibidaRayVisibility);
  transformed.xz *= mix(1.0, ratibidaRayScale, ratibidaRay);
  transformed.y *= mix(1.0, ratibidaRayScale, ratibidaRay);
#if ${shadowPass ? '0' : '1'}
  float ratibidaTintBlue = mod(ratibidaTint.b, 2.0);
  vColor.b *= ratibidaTintBlue / max(ratibidaTint.b, 0.000001);
#endif`,
      );
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey()}|${HEAD_MORPH_VERSION}|${shadowPass ? 'shadow' : 'surface'}`;
  material.needsUpdate = true;
  return material;
}

/**
 * Ratibida pinnata, gray-headed coneflower.
 *
 * Herbaceous like Echinacea and Joe Pye weed: the crown persists and everything
 * above it is rebuilt each year, so EZ-Tree's seeded axis grower authors the
 * stem centrelines and the stems are drawn as instanced tubes rather than bark.
 * It differs in what it keeps: a basal rosette of cut leaves that stays green
 * all year, alternate cut leaves up each stem, and one drooping-rayed head per
 * stem on a long bare stalk.
 */
export class Ratibida extends PlantRenderer {
  #model;

  constructor(options = {}) {
    const cultivar = options.cultivar ?? PINNATA_PROFILE.cultivar;
    if (cultivar !== PINNATA_PROFILE.cultivar) {
      throw new RangeError(
        'This renderer currently supports only the straight species profile.',
      );
    }
    const leafPlate = sharedTexture(
      'ratibida/pinnate-leaf',
      {},
      createPinnateLeafTexture,
    );

    super({
      profile: PINNATA_PROFILE,
      organKinds: INSTANCE_KINDS,
      namePrefix: 'Ratibida',
      detailStrideSalt: 'ratibida-pinnata-detail',
      plantId: options.plantId ?? `ratibida:${options.seed ?? 1822}`,
      seed: options.seed ?? 1822,
      maxYears: options.maxYears ?? PINNATA_PROFILE.architecture.modelHorizonYears,
      ageYears: options.ageYears ?? 5,
      dayOfYear: options.dayOfYear ?? 205,
      assets: options.assets ?? {},
      defaultLeafPlate: leafPlate,
      extraStateKeys: ['seasonProfile', 'offsetDays'],
      lodLevels: options.lodLevels ?? DEFAULT_LOD_LEVELS,
      leafWind: {
        // Slender stems and rough narrow leaves: a modest flutter.
        strength: new THREE.Vector3(0.05, 0, 0.05),
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
    // Required by the shared accounting contract; herbaceous stems are the
    // `stems` instance kind, so the woody mesh stays empty.
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
      stem: this._material({ color: 0xffffff, roughness: 0.88 }),
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
          new THREE.MeshDistanceMaterial({
            name: 'Ratibida_Head_Distance',
            side: THREE.DoubleSide,
          }),
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
    add('leaves', this.#model.rosette.length);
    this._sizeInstancePool({
      historicalCounts,
      annualOrganCounts: new Map(),
      unknownYearCounts,
    });
  }

  #createInstances() {
    this._addInstancedOrgan('stems', {
      name: 'Ratibida_HerbaceousStems',
      geometries: [
        this._stemGeometry(5, { openEnded: true }),
        this._stemCardGeometry(),
      ],
      material: this._materials.stem,
      group: this._woodyGroup,
    });
    this._addInstancedOrgan('leaves', {
      name: 'Ratibida_CutLeaves',
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
      name: 'Ratibida_Pinnata_Heads',
      geometries: HEAD_LADDER.map((rung, level) =>
        this._sharedGeometry(
          `ratibida/head-${level}`,
          rung,
          createPinnataHeadGeometry,
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

  #stemColour(axis, phenology) {
    if (axis.cohort === 'dry') {
      return STEM_DRY.clone().lerp(STEM_WEATHERED, clamp01(axis.weathering));
    }
    return STEM_GREEN.clone().lerp(STEM_DRY, clamp01(phenology.dryProgress * 0.85));
  }

  #leafColour(leaf, phenology) {
    if (leaf.rosette) {
      // The rosette is small and a cool dull green in winter, fuller and
      // brighter in summer, and its older leaves yellow as late summer comes on.
      const winter = clamp01((1 - phenology.rosetteScale) / 0.6);
      return ROSETTE_SUMMER.clone()
        .lerp(ROSETTE_WINTER, winter)
        .lerp(LEAF_YELLOW, clamp01(leaf.lowerYellowing * 0.55));
    }
    if (leaf.fallen) {
      return leaf.fellInSummer
        ? LEAF_FALLEN_SUMMER.clone().lerp(LEAF_FALLEN, clamp01(phenology.wiltProgress))
        : LEAF_FALLEN.clone();
    }
    const summer = clamp01(phenology.leafProgress * 1.5);
    const colour = LEAF_EMERGING.clone()
      .lerp(LEAF_SPRING, clamp01(phenology.leafProgress * 4))
      .lerp(LEAF_SUMMER, summer);
    const yellow = Math.max(leaf.autumnProgress, leaf.lowerYellowing * 0.7);
    colour.lerp(LEAF_YELLOW, clamp01(yellow * 1.6));
    colour.lerp(LEAF_BROWN, clamp01((leaf.autumnProgress - 0.5) * 2));
    colour.lerp(LEAF_DEAD, clamp01(leaf.wilt * 1.3));
    return colour;
  }

  #headColour(head) {
    switch (head.stage) {
      case 'bud':
        return HEAD_BUD.clone().lerp(HEAD_OPEN, clamp01(head.budProgress * 0.4));
      case 'opening':
        return HEAD_BUD.clone()
          .lerp(HEAD_OPEN, 0.4 + 0.6 * head.openProgress);
      case 'open':
        return HEAD_OPEN.clone().lerp(HEAD_SEED, head.darkenProgress * 0.25);
      case 'fading':
        return HEAD_OPEN.clone().lerp(HEAD_SEED, head.darkenProgress);
      case 'seed':
        return HEAD_OPEN.clone().lerp(HEAD_SEED, head.darkenProgress);
      default:
        return HEAD_SEED.clone().lerp(HEAD_WINTER, clamp01(head.weathering));
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
        this.#stemColour(axis, phenology),
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

  #setHead(head, detailScale) {
    const direction = vector(head.direction, UP).normalize();
    const quaternion = makeBasisQuaternion(direction, UP);
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, head.spin));
    const span = head.spanM * detailScale;
    const colour = this.#headColour(head);
    // Two blue units per quantised visibility step encode ray expansion; the
    // shader restores the seasonal channel remainder after decoding it.
    colour.b += Math.round(clamp01(head.rayVisibility) * 255) * 2;
    this._writeInstance(
      'heads',
      this.#identity(head.id, 'flower-head'),
      new THREE.Matrix4().compose(
        vector(head.position),
        quaternion,
        new THREE.Vector3(span, span, span),
      ),
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
      this.#setLeaf(leaf, phenology, detailScale);
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
      else if (head.stage === 'seed' || head.stage === 'winter') visibleSeedHeads += 1;
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
