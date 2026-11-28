import * as THREE from 'three';

import { finishGeometry, validatePositiveInteger } from '../../organ-geometry.js';

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

/**
 * Procedural leaf plate: a lance-shaped blade, widest about a third of the way
 * up and tapering to a point (v = 1), on a base (v = 0) that spreads into two
 * rounded ear-like lobes that clasp the stem. Neutral so instance colour sets
 * the hue; a pale midrib and a soft hairy mottle. The card is about 0.34 as
 * wide as it is long (blade 0.26, with room for the ears).
 */
export function createClaspingLeafTexture({ width = 130, height = 384 } = {}) {
  validatePositiveInteger(width, 'width');
  validatePositiveInteger(height, 'height');
  const data = new Uint8Array(width * height * 4);
  const earCentre = 0.055;
  const earHeight = 0.075;
  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const blade = Math.pow(Math.sin(Math.PI * Math.pow(clamp01(v), 0.72)), 0.95) * 0.74;
    const earT = Math.abs(v - earCentre) / earHeight;
    const ear = earT < 1 ? 0.95 * Math.sqrt(1 - earT * earT) : 0;
    // A narrow waist where the lobes meet the blade.
    const halfWidth = Math.max(blade, ear);
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const across = Math.abs(u - 0.5) * 2;
      const aa = 1.5 / width;
      const alpha = halfWidth <= 0 ? 0 : 1 - smooth(across, halfWidth - aa, halfWidth + aa);
      const midrib = (1 - smooth(across, 0.012, 0.035)) * (v > 0.04 ? 1 : 0);
      const marginShade = 1 - 0.14 * smooth(across / Math.max(0.001, halfWidth), 0.55, 1);
      const mottle =
        0.92 +
        0.05 * Math.sin(v * 27 + u * 11) * Math.sin(v * 9 - u * 15) +
        0.03 * hash2(Math.floor(x / 5), Math.floor(y / 5), 31);
      const grain = 0.95 + 0.05 * hash2(x, y, 43);
      let shade = 0.9 * marginShade * mottle * grain;
      shade = Math.max(shade, midrib * 0.97);
      const index = (y * width + x) * 4;
      const value = Math.round(clamp01(shade) * 255);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = Math.round(clamp01(alpha) * 255);
    }
  }
  return finishTexture(data, width, height, 'Symphyotrichum_ClaspingLeaf');
}

const RAYS = 55;
/** The ray star fills this share of its half of the plate, leaving room for a hexagonal fan. */
const STAR_FILL = 0.8;

/**
 * Procedural plate for an aster head, two cells side by side (256 x 128).
 *
 * Left cell: a ring of narrow rays around a solid central disc, seen from
 * above. Right cell: the soft puff of pappus a spent head carries, a round
 * tuft with a fuzzy, hairy edge. Both neutral grey so vertex and instance
 * colour set violet, yellow and grey-tan. Fuzz is a texture, not geometry
 * (rule 9): the 55 rays (the sources say 40-100) and the puff's hairs cost
 * no triangles.
 */
export function createAsterHeadTexture({ size = 128 } = {}) {
  validatePositiveInteger(size, 'size');
  const width = size * 2;
  const data = new Uint8Array(width * size * 4);
  const step = (Math.PI * 2) / RAYS;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = x < size ? 0 : 1;
      const cx = x - cell * size;
      const px = ((cx + 0.5) / size - 0.5) * 2;
      const py = ((y + 0.5) / size - 0.5) * 2;
      let alpha = 0;
      let shade = 0.9;
      if (cell === 0) {
        const r = Math.hypot(px, py) / STAR_FILL;
        const theta = Math.atan2(py, px) + Math.PI;
        const j = Math.round(theta / step);
        const delta = theta - j * step;
        const id = ((j % RAYS) + RAYS) % RAYS;
        const length = 0.97 - 0.08 * hash2(id, 3, 7);
        const halfArc = step * 0.5 * 0.88 * (1 - 0.25 * r) * r;
        const across = Math.abs(delta) * r;
        if (r < 0.2) {
          alpha = 1;
          shade = 0.96 - 0.06 * hash2(x, y, 5);
        } else if (r < length + 0.03) {
          const along = 1 - smooth(r, length - 0.06, length + 0.03);
          const side = 1 - smooth(across, halfArc * 0.7, halfArc);
          alpha = along * side;
          shade = (0.78 + 0.22 * smooth(r, 0.2, 0.8)) * (0.9 + 0.1 * hash2(id, 9, 3));
        }
      } else {
        // A fluffy ball: the edge is a ring of hairs of uneven length, thinning outward.
        const r = Math.hypot(px, py);
        const theta = Math.atan2(py, px) + Math.PI;
        const sector = Math.floor((theta / (Math.PI * 2)) * 40);
        const reach = 0.62 + 0.3 * hash2(sector, 4, 11);
        const hair = 0.5 + 0.5 * Math.sin(theta * 90 + hash2(sector, 7, 3) * 6);
        alpha = 1 - smooth(r, reach - 0.12, reach + 0.04 * hair);
        shade = 0.74 + 0.26 * smooth(r, 0.1, 0.8) * (0.8 + 0.2 * hair);
      }
      const index = (y * width + x) * 4;
      const value = Math.round(clamp01(shade) * 255);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = Math.round(clamp01(alpha) * 255);
    }
  }
  return finishTexture(data, width, size, 'Symphyotrichum_HeadPlate');
}

// Vertex colours; the stage tint multiplies them. Rays violet, paler toward
// the disc; the disc golden yellow; the puff grey-tan.
const RAY_CENTRE = new THREE.Color(0xa583cf);
const RAY_TIP = new THREE.Color(0x8451b8);
const DISC_BASE = new THREE.Color(0xd9b43a);
const DISC_APEX = new THREE.Color(0xe4bd3c);
const PUFF_COLOUR = new THREE.Color(0xcbbd9f);

const PUFF_SIZE = 0.027;
const PUFF_CENTRE = 0.006;
const STAR_RADIUS = 0.019;
const DISC_RADIUS = 0.0065;

function pushVertex(buffers, point, colour, ray, head = 0, uv = null) {
  buffers.positions.push(point.x, point.y, point.z);
  buffers.colors.push(colour.r, colour.g, colour.b);
  buffers.rayWeights.push(ray);
  buffers.headWeights.push(head);
  buffers.normals.push(0, 1, 0);
  if (uv) buffers.uvs.push(uv[0], uv[1]);
  else {
    // Planar over the star, in the left half of the plate.
    const k = 0.5 / (2 * STAR_RADIUS * (1 / STAR_FILL));
    buffers.uvs.push(0.25 + point.x * k, 0.5 + (point.z / (2 * STAR_RADIUS)) * STAR_FILL);
  }
  return buffers.positions.length / 3 - 1;
}

/**
 * One aster capitulum in one draw, authored in metres (3.8 cm across) with
 * local +Y along the head axis: a shallow dish of ray plate and a small
 * yellow disc cone above it, plus the soft puff of a spent head. The star is
 * a fan of `sides` triangles, or a quad when `sides` is 0; the disc a pyramid
 * of `discSides` triangles, or one flat triangle when it is 1, or none at 0.
 * The puff is `puff` textured cards: 0 none, 1 an upright card, 2 two crossed
 * upright cards. Ray vertices carry the `magnusRay` attribute (the renderer
 * collapses them as a head buds or sheds its rays); puff vertices carry
 * `magnusHead`, so they show only on heads whose instance red carries the head
 * flag (the seed and winter stages).
 */
export function createAsterHeadGeometry({ sides = 6, discSides = 3, puff = 2 } = {}) {
  if (!Number.isInteger(sides) || (sides !== 0 && (sides < 5 || sides > 24))) {
    throw new RangeError('sides must be 0 (a quad) or an integer from 5 to 24.');
  }
  if (!Number.isInteger(discSides) || discSides < 0 || discSides > 8) {
    throw new RangeError('discSides must be an integer from 0 to 8.');
  }
  if (![0, 1, 2].includes(puff)) throw new RangeError('puff must be 0, 1 (an upright card) or 2 (crossed cards).');
  const buffers = { positions: [], colors: [], indices: [], rayWeights: [], headWeights: [], normals: [], uvs: [] };
  const rim = -0.0015;
  if (sides === 0) {
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sz]) =>
      pushVertex(buffers, new THREE.Vector3(sx * STAR_RADIUS, rim, sz * STAR_RADIUS), RAY_TIP, 1),
    );
    buffers.indices.push(corners[0], corners[2], corners[1], corners[0], corners[3], corners[2]);
  } else {
    const centre = pushVertex(buffers, new THREE.Vector3(0, 0.0012, 0), RAY_CENTRE, 1);
    const ring = [];
    // Circumscribe the circle of rays, so a hexagon still holds the whole star.
    const ringRadius = STAR_RADIUS / Math.cos(Math.PI / sides);
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      ring.push(
        pushVertex(buffers, new THREE.Vector3(Math.cos(angle) * ringRadius, rim, Math.sin(angle) * ringRadius), RAY_TIP, 1),
      );
    }
    for (let side = 0; side < sides; side += 1) {
      buffers.indices.push(centre, ring[(side + 1) % sides], ring[side]);
    }
  }
  if (discSides === 1) {
    const flat = [0, 1, 2].map((k) => {
      const a = (k / 3) * Math.PI * 2;
      return pushVertex(buffers, new THREE.Vector3(Math.cos(a) * DISC_RADIUS * 1.6, 0.003, Math.sin(a) * DISC_RADIUS * 1.6), DISC_BASE, 0);
    });
    buffers.indices.push(flat[0], flat[2], flat[1]);
  } else if (discSides > 1) {
    const apex = pushVertex(buffers, new THREE.Vector3(0, 0.0045, 0), DISC_APEX, 0);
    const base = [];
    for (let side = 0; side < discSides; side += 1) {
      const a = (side / discSides) * Math.PI * 2;
      base.push(pushVertex(buffers, new THREE.Vector3(Math.cos(a) * DISC_RADIUS, 0.0012, Math.sin(a) * DISC_RADIUS), DISC_BASE, 0));
    }
    for (let side = 0; side < discSides; side += 1) {
      buffers.indices.push(apex, base[(side + 1) % discSides], base[side]);
    }
  }
  if (puff > 0) {
    const h = PUFF_SIZE / 2;
    const quad = (axisX, axisZ, lift) => {
      const pts = [
        [-1, -1, 0, 0],
        [1, -1, 1, 0],
        [1, 1, 1, 1],
        [-1, 1, 0, 1],
      ].map(([sx, sy, u, v]) =>
        pushVertex(
          buffers,
          new THREE.Vector3(sx * h * axisX, PUFF_CENTRE + (lift ? sx * 0 : sy * h * 0.9) + (lift ? sy * 0 : 0), sx * h * axisZ + (lift ? sy * h : 0)),
          PUFF_COLOUR,
          0,
          1,
          [0.5 + u * 0.5, v],
        ),
      );
      buffers.indices.push(pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]);
    };
    // One upright card; heads are spun at random, so most face the eye.
    quad(1, 0, false);
    if (puff === 2) quad(0, 1, false);
  }
  const geometry = finishGeometry({
    positions: buffers.positions,
    colors: buffers.colors,
    indices: buffers.indices,
    normals: buffers.normals,
    uvs: buffers.uvs,
    userData: { organ: 'symphyotrichum-capitulum', sides, discSides, puff, unitDiameter: 0.038 },
  });
  geometry.setAttribute('magnusRay', new THREE.Float32BufferAttribute(buffers.rayWeights, 1));
  geometry.setAttribute('magnusHead', new THREE.Float32BufferAttribute(buffers.headWeights, 1));
  return geometry;
}
