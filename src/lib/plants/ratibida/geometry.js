import * as THREE from 'three';

import {
  finishGeometry,
  fract,
  GOLDEN_ANGLE,
  validatePositiveInteger,
} from '../../organ-geometry.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = THREE.MathUtils.smoothstep;

function hash2(x, y, salt = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function finishTexture(data, width, height, name) {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Distance from a point to a segment and the parameter along it. */
function segmentProbe(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  const qx = ax + dx * t - px;
  const qy = ay + dy * t - py;
  return { distance: Math.hypot(qx, qy), t };
}

/** Leaflets of the plate in units of the card's length: [baseY, side reach, forward rise, half-width]. */
const LEAFLET_PAIRS = Object.freeze([
  [0.28, 0.3, 0.14, 0.058],
  [0.44, 0.28, 0.13, 0.058],
  [0.6, 0.2, 0.11, 0.052],
]);
const TERMINAL = Object.freeze({ baseY: 0.66, tipY: 0.99, halfWidth: 0.064 });
const PETIOLE = 0.2;

/**
 * Procedural leaf plate: a pinnate blade, three narrow leaflet pairs and a
 * terminal leaflet on a pale rachis, with a bare petiole at the base (v = 0).
 * Neutral so instance colour sets the hue; rough-grained like the real leaf.
 * The card is 0.7 as wide as it is long, which the plate's units assume.
 */
export function createPinnateLeafTexture({ width = 128, height = 320, aspect = 0.7 } = {}) {
  validatePositiveInteger(width, 'width');
  validatePositiveInteger(height, 'height');
  const data = new Uint8Array(width * height * 4);
  const aa = 1.6 / height;
  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const px = ((x + 0.5) / width - 0.5) * aspect;
      let cover = 0;
      let rib = 0;
      let leaflet = 0;
      // Petiole and rachis.
      const rachisHalf = v < PETIOLE ? 0.011 : 0.008 * (1 - 0.5 * v);
      if (v < TERMINAL.baseY + 0.05) {
        const d = Math.abs(px);
        cover = Math.max(cover, 1 - smooth(d, rachisHalf - aa, rachisHalf + aa));
        rib = Math.max(rib, cover);
      }
      for (const side of [-1, 1]) {
        for (const [baseY, reach, rise, half] of LEAFLET_PAIRS) {
          const probe = segmentProbe(px, v, 0, baseY, side * reach, baseY + rise);
          const profile = Math.pow(Math.sin(Math.PI * Math.pow(probe.t, 0.72)), 0.85);
          const edge = half * profile * (1 - 0.3 * fract(probe.t * 4.5));
          const a = edge <= 0 ? 0 : 1 - smooth(probe.distance, edge - aa, edge + aa);
          if (a > cover) cover = a;
          if (a > 0.2) leaflet = Math.max(leaflet, 1 - smooth(probe.distance, 0, 0.004));
        }
      }
      const terminal = segmentProbe(px, v, 0, TERMINAL.baseY, 0, TERMINAL.tipY);
      const tProfile = Math.pow(Math.sin(Math.PI * Math.pow(terminal.t, 0.7)), 0.9);
      const tEdge = TERMINAL.halfWidth * tProfile * (1 - 0.3 * fract(terminal.t * 4.5));
      const tAlpha = tEdge <= 0 ? 0 : 1 - smooth(terminal.distance, tEdge - aa, tEdge + aa);
      cover = Math.max(cover, tAlpha);
      if (tAlpha > 0.2) leaflet = Math.max(leaflet, 1 - smooth(terminal.distance, 0, 0.004));

      const mottle = 0.9 + 0.06 * Math.sin(v * 31 + px * 40) + 0.04 * hash2(Math.floor(x / 5), Math.floor(y / 5), 17);
      const grain = 0.94 + 0.06 * hash2(x, y, 29);
      let shade = 0.88 * mottle * grain;
      shade = shade + (1 - shade) * 0.5 * leaflet;
      if (v < PETIOLE) shade = 0.84;
      shade = Math.max(shade, rib * 0.95);
      const index = (y * width + x) * 4;
      const value = Math.round(clamp01(shade) * 255);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = Math.round(clamp01(cover) * 255);
    }
  }
  return finishTexture(data, width, height, 'Ratibida_PinnateLeaf');
}

// Vertex colours; instance colour multiplies them. Rays stay yellow, the cone
// is a neutral brown that the stage tint turns green, brown or near black.
// Golden yellow, #e6c229 at the tip (Karen's review: the rays looked pale).
const RAY_TIP = new THREE.Color(0xe6c229);
const RAY_BASE = new THREE.Color(0xd3a81c);
const CONE_BASE = new THREE.Color(0.3, 0.19, 0.08);
const CONE_MID = new THREE.Color(0.36, 0.26, 0.12);
const CONE_TIP = new THREE.Color(0.4, 0.36, 0.2);
const BRACT = new THREE.Color(0.3, 0.34, 0.14);

function pushVertex(buffers, point, colour, rayWeight = 0) {
  buffers.positions.push(point.x, point.y, point.z);
  buffers.colors.push(colour.r, colour.g, colour.b);
  buffers.rayWeights.push(rayWeight);
  buffers.headWeights.push(0);
  return buffers.positions.length / 3 - 1;
}

const CONE_HEIGHT = 0.026;
const CONE_RADIUS = 0.0095;

function coneRadiusAt(t) {
  // A tall ellipsoid: near full width over the lower third, domed above.
  return CONE_RADIUS * Math.sqrt(Math.max(0.03, 1 - Math.pow(t, 2.6)));
}

function appendCone(buffers, { radialSegments, rings }) {
  const grid = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    const radius = coneRadiusAt(t);
    const y = 0.002 + CONE_HEIGHT * t;
    const colour = CONE_BASE.clone().lerp(CONE_MID, clamp01(t * 2)).lerp(CONE_TIP, clamp01(t * 2 - 0.6));
    const line = [];
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2;
      line.push(pushVertex(buffers, new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius), colour));
    }
    grid.push(line);
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      const a = grid[ring][side];
      const b = grid[ring][next];
      const c = grid[ring + 1][side];
      const d = grid[ring + 1][next];
      buffers.indices.push(a, c, b, b, c, d);
    }
  }
  const top = pushVertex(buffers, new THREE.Vector3(0, 0.002 + CONE_HEIGHT + 0.001, 0), CONE_TIP);
  const last = grid.at(-1);
  for (let side = 0; side < radialSegments; side += 1) {
    buffers.indices.push(last[side], top, last[(side + 1) % radialSegments]);
  }
}

function appendBracts(buffers, count) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + 0.3;
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const root = radial.clone().multiplyScalar(CONE_RADIUS * 0.8);
    root.y = 0.001;
    const tip = radial.clone().multiplyScalar(CONE_RADIUS * 1.7);
    tip.y = -0.006;
    const a = pushVertex(buffers, root.clone().addScaledVector(tangent, -0.0022), BRACT);
    const b = pushVertex(buffers, root.clone().addScaledVector(tangent, 0.0022), BRACT);
    const c = pushVertex(buffers, tip, BRACT);
    buffers.indices.push(a, c, b, a, b, c);
  }
}

function appendRay(buffers, { angle, sequence, segments }) {
  const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const length = 0.045 + 0.025 * fract((sequence + 1) * 0.754877666);
  // Strongly reflexed: heading from about 15 degrees down to 60-80 below the
  // horizontal at the tip.
  const endDrop = THREE.MathUtils.degToRad(62 + 18 * fract((sequence + 1) * 0.569840291));
  const startDrop = THREE.MathUtils.degToRad(12);
  const twist = (fract((sequence + 1) * 0.819172513) - 0.5) * 0.4;
  let r = CONE_RADIUS * 0.85;
  let y = 0.0025;
  const rows = [];
  for (let row = 0; row <= segments; row += 1) {
    const s = row / segments;
    const half = (0.0042 + 0.0034 * Math.sin(Math.PI * Math.pow(s, 0.85))) * (1 - 0.25 * s);
    const line = [];
    for (const column of [-1, 0, 1]) {
      const notch = row === segments && column === 0 ? 0.003 : 0;
      const point = radial.clone().multiplyScalar(r - notch * Math.cos(endDrop)).addScaledVector(tangent, column * half * Math.cos(twist * s));
      point.y = y - notch * Math.sin(endDrop) + column * half * Math.sin(twist * s);
      const colour = RAY_BASE.clone().lerp(RAY_TIP, 0.35 + 0.65 * s);
      line.push(pushVertex(buffers, point, colour, 1));
    }
    rows.push(line);
    const drop = THREE.MathUtils.lerp(startDrop, endDrop, Math.pow(s, 0.8));
    r += (length / segments) * Math.cos(drop);
    y -= (length / segments) * Math.sin(drop);
  }
  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const a = rows[row][column];
      const b = rows[row][column + 1];
      const c = rows[row + 1][column];
      const d = rows[row + 1][column + 1];
      buffers.indices.push(a, b, c, b, d, c);
    }
  }
}

/**
 * One whole capitulum in one draw, authored in metres with local +Y along the
 * head axis and the cone base at the origin: an ellipsoid cone taller than
 * wide, a few small bracts under it and drooping yellow ray ribbons. Rays
 * carry the `magnusRay` attribute (the renderer collapses them as a head buds
 * or sheds them for seed); `magnusHead` is present and zero, as the shared
 * ray-morph contract expects.
 */
export function createRatibidaHeadGeometry({
  rays = 8,
  raySegments = 3,
  radialSegments = 12,
  coneRings = 4,
  bracts = 6,
} = {}) {
  validatePositiveInteger(rays, 'rays');
  validatePositiveInteger(raySegments, 'raySegments');
  validatePositiveInteger(radialSegments, 'radialSegments');
  validatePositiveInteger(coneRings, 'coneRings');
  if (rays < 5 || rays > 13) throw new RangeError('rays must be an integer from 5 to 13.');
  if (raySegments > 4) throw new RangeError('raySegments must be an integer from 1 to 4.');
  if (radialSegments < 6 || radialSegments > 20) {
    throw new RangeError('radialSegments must be an integer from 6 to 20.');
  }
  const buffers = { positions: [], colors: [], indices: [], rayWeights: [], headWeights: [] };
  if (bracts > 0) appendBracts(buffers, bracts);
  for (let ray = 0; ray < rays; ray += 1) {
    appendRay(buffers, {
      angle: (ray / rays) * Math.PI * 2 + 0.12 * Math.sin(ray * 2.13) + ray * 0.01 * GOLDEN_ANGLE,
      sequence: ray,
      segments: raySegments,
    });
  }
  appendCone(buffers, { radialSegments, rings: coneRings });
  const geometry = finishGeometry({
    ...buffers,
    userData: {
      organ: 'ratibida-capitulum',
      rays,
      raySegments,
      radialSegments,
      coneRings,
      bracts,
      unitDiameter: 1,
    },
  });
  geometry.setAttribute('magnusRay', new THREE.Float32BufferAttribute(buffers.rayWeights, 1));
  geometry.setAttribute('magnusHead', new THREE.Float32BufferAttribute(buffers.headWeights, 1));
  return geometry;
}
