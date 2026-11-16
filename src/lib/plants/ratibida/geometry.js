import * as THREE from 'three';

import {
  finishGeometry,
  fract,
  validatePositiveInteger,
} from '../../organ-geometry.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = THREE.MathUtils.smoothstep;

// Vertex colours are linear. Ray yellow reads as a clear lemon-gold; the cone
// is tan with a dark maroon band where the florets have opened (photographs).
const RAY_BASE = new THREE.Color(0.8, 0.46, 0.01);
const RAY_TIP = new THREE.Color(0.93, 0.64, 0.02);
const CONE_BASE = new THREE.Color(0.2, 0.14, 0.07);
const CONE_BAND = new THREE.Color(0.07, 0.014, 0.008);
const CONE_TAN = new THREE.Color(0.4, 0.29, 0.14);
const CONE_TIP = new THREE.Color(0.46, 0.35, 0.18);
const BRACT_BASE = new THREE.Color(0.1, 0.2, 0.05);
const BRACT_TIP = new THREE.Color(0.2, 0.34, 0.1);

/** Cone: the egg-shaped disk, base at y = 0, in unit-span head coordinates. */
const CONE_HEIGHT = 0.23;
const CONE_BASE_RADIUS = 0.085;
/** Where the rays leave the cone, and how far they reach along their length. */
const RAY_START_RADIUS = 0.075;
const RAY_START_HEIGHT = 0.022;
const RAY_LENGTH = 0.38;
/** Ray bend: nearly flat at the cone, about 78 degrees down at the tip. */
const RAY_ANGLE_START = 0.17;
const RAY_ANGLE_END = 1.36;

function pushVertex(buffers, point, colour, rayWeight = 0) {
  buffers.positions.push(point.x, point.y, point.z);
  buffers.colors.push(colour.r, colour.g, colour.b);
  buffers.rayWeights.push(rayWeight);
  return buffers.positions.length / 3 - 1;
}

function appendBracts(buffers, count) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + 0.3;
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const root = radial.clone().multiplyScalar(0.07);
    root.y = 0.004;
    const tip = radial.clone().multiplyScalar(0.13);
    tip.y = -0.045 - 0.015 * fract(index * 0.618);
    const half = 0.016;
    const base = buffers.positions.length / 3;
    pushVertex(buffers, root.clone().addScaledVector(tangent, -half), BRACT_BASE);
    pushVertex(buffers, root.clone().addScaledVector(tangent, half), BRACT_BASE);
    pushVertex(buffers, tip, BRACT_TIP);
    buffers.indices.push(base, base + 1, base + 2);
  }
}

/**
 * One ray floret: a narrow, slightly curved strap that leaves the cone nearly
 * flat and bends to hang almost straight down, so that from the side the rays
 * make a drooping fringe and from above they radiate with gaps between them.
 */
function appendRay(buffers, { angle, sequence, segments }) {
  const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const lengthScale = 0.86 + 0.24 * fract((sequence + 1) * 0.754877666);
  const jitter = (fract((sequence + 1) * 0.569840291) - 0.5) * 0.24;
  const twist = (fract((sequence + 1) * 0.819172513) - 0.5) * 0.5;
  const length = RAY_LENGTH * lengthScale;

  // Centreline in the (radial, vertical) plane of this ray.
  const centre = [{ r: RAY_START_RADIUS, y: RAY_START_HEIGHT }];
  for (let step = 0; step < segments; step += 1) {
    const s = (step + 0.5) / segments;
    const bend = THREE.MathUtils.lerp(RAY_ANGLE_START, RAY_ANGLE_END, s) + jitter;
    const last = centre.at(-1);
    centre.push({
      r: last.r + (Math.cos(bend) * length) / segments,
      y: last.y - (Math.sin(bend) * length) / segments,
    });
  }

  const rows = [];
  for (let row = 0; row <= segments; row += 1) {
    const s = row / segments;
    const halfWidth =
      0.046 * Math.pow(Math.sin(Math.PI * (0.12 + 0.8 * s)), 0.8);
    const point = centre[row];
    // Rays are slightly cupped and twist a little along their length.
    const rolled = twist * s;
    const line = [];
    for (const column of [-1, 0, 1]) {
      const cup = column === 0 ? 0 : -0.006 * s;
      const position = radial
        .clone()
        .multiplyScalar(point.r + cup)
        .addScaledVector(tangent, column * halfWidth * Math.cos(rolled));
      position.y = point.y + column * halfWidth * Math.sin(rolled);
      const colour = RAY_BASE.clone().lerp(RAY_TIP, 0.2 + 0.7 * s);
      colour.multiplyScalar(0.92 + 0.08 * fract(sequence * 0.37));
      line.push(pushVertex(buffers, position, colour, 1));
    }
    rows.push(line);
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

function coneRadiusAt(t) {
  // An egg: broad shoulder near the base, rounded top.
  return CONE_BASE_RADIUS * Math.sqrt(Math.max(0.05, 1 - t * t));
}

function coneColourAt(t) {
  // Dark florets that have opened ring the lower third; the upper cone is the
  // paler tan of the florets still to open.
  const band = smooth(t, 0.08, 0.22) * (1 - smooth(t, 0.4, 0.58));
  const upper = smooth(t, 0.4, 0.62);
  return CONE_BASE.clone()
    .lerp(CONE_BAND, band)
    .lerp(CONE_TAN, upper)
    .lerp(CONE_TIP, Math.pow(t, 3));
}

function appendCone(buffers, { radialSegments, rings }) {
  const ringVertices = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    const radius = coneRadiusAt(t);
    const y = CONE_HEIGHT * t;
    const colour = coneColourAt(t);
    const line = [];
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2;
      line.push(
        pushVertex(
          buffers,
          new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius),
          colour,
        ),
      );
    }
    ringVertices.push(line);
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      const a = ringVertices[ring][side];
      const b = ringVertices[ring][next];
      const c = ringVertices[ring + 1][side];
      const d = ringVertices[ring + 1][next];
      buffers.indices.push(a, c, b, b, c, d);
    }
  }
  const top = pushVertex(
    buffers,
    new THREE.Vector3(0, CONE_HEIGHT + 0.006, 0),
    CONE_TIP,
  );
  const last = ringVertices.at(-1);
  for (let side = 0; side < radialSegments; side += 1) {
    buffers.indices.push(last[side], top, last[(side + 1) % radialSegments]);
  }
  // Close the underside so the cone is solid seen from below.
  const bottom = pushVertex(buffers, new THREE.Vector3(0, 0, 0), CONE_BASE);
  const first = ringVertices[0];
  for (let side = 0; side < radialSegments; side += 1) {
    buffers.indices.push(first[(side + 1) % radialSegments], bottom, first[side]);
  }
}

/**
 * One whole gray-headed coneflower head in one draw. Unit horizontal span is
 * one (the cone's axis is local +Y), so a head instance is scaled by its real
 * span. Rays carry a weight the renderer's shader uses to fold them in under
 * the cone as a head buds and after its rays drop, leaving the cone alone.
 */
export function createPinnataHeadGeometry({
  rays = 9,
  raySegments = 3,
  radialSegments = 10,
  coneRings = 4,
} = {}) {
  validatePositiveInteger(rays, 'rays');
  validatePositiveInteger(raySegments, 'raySegments');
  validatePositiveInteger(radialSegments, 'radialSegments');
  validatePositiveInteger(coneRings, 'coneRings');
  if (rays < 5 || rays > 16) {
    throw new RangeError('rays must be an integer from 5 to 16.');
  }
  if (raySegments < 1 || raySegments > 4) {
    throw new RangeError('raySegments must be an integer from 1 to 4.');
  }
  if (radialSegments < 5 || radialSegments > 16) {
    throw new RangeError('radialSegments must be an integer from 5 to 16.');
  }
  if (coneRings < 2 || coneRings > 6) {
    throw new RangeError('coneRings must be an integer from 2 to 6.');
  }

  const buffers = {
    positions: [],
    colors: [],
    indices: [],
    rayWeights: [],
  };
  appendBracts(buffers, 6);
  for (let ray = 0; ray < rays; ray += 1) {
    appendRay(buffers, {
      angle: (ray / rays) * Math.PI * 2 + 0.07 * Math.sin(ray * 2.13),
      sequence: ray,
      segments: raySegments,
    });
  }
  appendCone(buffers, { radialSegments, rings: coneRings });

  const geometry = finishGeometry({
    ...buffers,
    userData: {
      organ: 'ratibida-pinnata-capitulum',
      rays,
      raySegments,
      radialSegments,
      coneRings,
      unitSpan: 1,
    },
  });
  geometry.setAttribute(
    'ratibidaRay',
    new THREE.Float32BufferAttribute(buffers.rayWeights, 1),
  );
  return geometry;
}

/** Deterministic hash in [0, 1) for texture grain. */
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

/** The card is taller than it is wide; v counts about twice as far as u. */
const LEAF_ASPECT = 2;

/**
 * One tapered leaflet on the plate: from (ax, ay) to (bx, by) in plate
 * coordinates, widest near the middle and narrowing to a point.
 */
function leaflet(ax, ay, bx, by, halfWidth, shade) {
  return { ax, ay, bx, by, halfWidth, shade };
}

/**
 * The cut leaf: a long central blade with three pairs of narrow lobes spreading
 * up and out from it, on a short stalk at the base (v = 0). Seven narrow lobes
 * in all, the middle of the cited three to seven. Neutral grey so the instance
 * colour sets the hue. A small upper leaf drawn from this plate at a narrow
 * width reads as a plain lance, because the lobes narrow with the card.
 */
export function createPinnateLeafTexture({ width = 128, height = 320 } = {}) {
  validatePositiveInteger(width, 'width');
  validatePositiveInteger(height, 'height');
  const data = new Uint8Array(width * height * 4);

  const leaflets = [
    leaflet(0.5, 0.1, 0.5, 1, 0.09, 0.94),
    leaflet(0.5, 0.26, 0.05, 0.5, 0.075, 0.9),
    leaflet(0.5, 0.26, 0.95, 0.5, 0.075, 0.9),
    leaflet(0.5, 0.44, 0.07, 0.68, 0.07, 0.92),
    leaflet(0.5, 0.44, 0.93, 0.68, 0.07, 0.92),
    leaflet(0.5, 0.6, 0.15, 0.82, 0.062, 0.94),
    leaflet(0.5, 0.6, 0.85, 0.82, 0.062, 0.94),
  ];
  const stalk = { ax: 0.5, ay: 0, bx: 0.5, by: 0.12, halfWidth: 0.016 };

  const along = (item, px, py) => {
    const dx = (item.bx - item.ax) * 1;
    const dy = (item.by - item.ay) * LEAF_ASPECT;
    const lengthSq = dx * dx + dy * dy;
    const t = clamp01(
      (((px - item.ax) * dx) + ((py - item.ay) * LEAF_ASPECT * dy)) / lengthSq,
    );
    const qx = item.ax + dx * t - px;
    const qy = (item.ay + (item.by - item.ay) * t - py) * LEAF_ASPECT;
    return { t, distance: Math.hypot(qx, qy) };
  };

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const aa = 1.4 / width;
      let alpha = 0;
      let shade = 0.9;
      let rib = 0;

      const stalkHit = along(stalk, u, v);
      const stalkAlpha = 1 - smooth(stalkHit.distance, stalk.halfWidth - aa, stalk.halfWidth + aa);
      if (stalkAlpha > alpha) {
        alpha = stalkAlpha;
        shade = 0.84;
      }

      for (const item of leaflets) {
        const hit = along(item, u, v);
        // Widest about two fifths of the way out, pointed at the tip.
        const profile =
          Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * hit.t)), 0.75) *
          (1 - 0.15 * hit.t);
        const edge = item.halfWidth * profile;
        const coverage = 1 - smooth(hit.distance, edge - aa, edge + aa);
        if (coverage > alpha) {
          alpha = coverage;
          // Darker toward the margin; a pale midrib on every leaflet.
          const across = edge > 0 ? hit.distance / edge : 1;
          shade = item.shade * (1 - 0.14 * smooth(across, 0.5, 1));
          rib = 1 - smooth(hit.distance, 0.003, 0.009);
        }
      }

      const mottle =
        0.93 +
        0.05 * Math.sin(v * 21 + u * 9) * Math.sin(v * 8 - u * 13) +
        0.03 * hash2(Math.floor(x / 5), Math.floor(y / 5), 43);
      const grain = 0.95 + 0.05 * hash2(x, y, 41);
      let value = shade * mottle * grain;
      value += (1 - value) * 0.5 * rib;

      const index = (y * width + x) * 4;
      const byte = Math.round(clamp01(value) * 255);
      data[index] = byte;
      data[index + 1] = byte;
      data[index + 2] = byte;
      data[index + 3] = Math.round(clamp01(alpha) * 255);
    }
  }

  return finishTexture(data, width, height, 'Ratibida_PinnateLeaf');
}

