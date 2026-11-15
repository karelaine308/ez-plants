import * as THREE from 'three';

import {
  finishGeometry,
  fract,
  GOLDEN_ANGLE,
  validatePositiveInteger,
} from '../../organ-geometry.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = THREE.MathUtils.smoothstep;

/** Deterministic hash in [0, 1) for texture grain. */
function hash2(x, y, salt = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Squared distance from a point to a segment, in texture units. */
function segmentDistanceSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  const qx = ax + dx * t - px;
  const qy = ay + dy * t - py;
  return qx * qx + qy * qy;
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
 * Procedural alpha plate for a patch of Joe Pye flower heads.
 *
 * A Eutrochium array is hundreds of small cylindrical heads, each a bundle of
 * five to twenty-two tubular florets whose long styles stick out past the
 * corolla. That is the library's worst case for geometry and best case for
 * alpha (rule 9: fuzz is a texture), so the plate draws several heads as fans
 * of short strokes. It is neutral and slightly shaded so instance colour can
 * carry the season from green-mauve bud through dusty pink to tan seed.
 */
export function createFloretClusterTexture({ size = 128 } = {}) {
  validatePositiveInteger(size, 'size');
  const width = size;
  const height = size;
  const data = new Uint8Array(width * height * 4);

  // A packed mass of upright heads: each an involucre cylinder taller than
  // wide, topped by a tuft of styles that point mostly up and fray outward.
  // Heads overlap, back rows sit higher, and the mass thins at the plate edge
  // so neighbouring cards blend into one frothy array.
  const heads = [];
  const headCount = 34;
  for (let index = 0; index < headCount; index += 1) {
    const radius = 0.42 * Math.sqrt((index + 0.5) / headCount);
    const angle = index * GOLDEN_ANGLE;
    const x = 0.5 + Math.cos(angle) * radius;
    const y = 0.42 + Math.sin(angle) * radius * 0.7;
    heads.push({
      x,
      y,
      bodyHalfWidth: 0.017 + 0.006 * hash2(index, 1, 5),
      bodyHeight: 0.06 + 0.02 * hash2(index, 2, 5),
      reach: 0.09 + 0.045 * hash2(index, 3, 5),
      strokes: 20 + (index % 6),
      // Per-head tone, so the mass is not one flat colour.
      tone: 0.9 + 0.1 * hash2(index, 4, 5),
      seed: index,
    });
  }

  const strokes = [];
  for (const head of heads) {
    const top = head.y + head.bodyHeight * 0.5;
    for (let stroke = 0; stroke < head.strokes; stroke += 1) {
      // A tuft: mostly upward, fraying to about 70 degrees either side.
      const t = stroke / (head.strokes - 1) - 0.5;
      const jitter = (hash2(head.seed, stroke, 3) - 0.5) * 0.3;
      const angle = Math.PI / 2 + t * 2.4 + jitter;
      const length = head.reach * (0.55 + 0.45 * hash2(head.seed, stroke, 7));
      const baseX = head.x + t * head.bodyHalfWidth * 1.6;
      // Styles curl: the far end bends a little further outward.
      const curl = t * 0.35;
      strokes.push({
        ax: baseX,
        ay: top - 0.004,
        bx: baseX + Math.cos(angle + curl) * length,
        by: top + Math.sin(angle + curl) * length,
        width: 0.0055 + 0.003 * hash2(head.seed, stroke, 11),
        head,
      });
    }
  }

  for (let y = 0; y < height; y += 1) {
    // Texture row 0 is the bottom of the card (v = 0).
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      let alpha = 0;
      let shade = 0;
      for (const head of heads) {
        // The involucre: a rounded cylinder of overlapping bracts, darker at
        // its base where the next head's shadow falls.
        const dx = Math.abs(u - head.x) / head.bodyHalfWidth;
        const dy = (v - (head.y - head.bodyHeight * 0.5)) / head.bodyHeight;
        if (dy < 0 || dy > 1.05) continue;
        const bracts = 0.92 + 0.08 * Math.sin(dy * 34 + dx * 3);
        const body = (1 - smooth(dx, 0.7, 1)) * smooth(dy, 0, 0.08);
        if (body > alpha * 0.9) {
          alpha = Math.max(alpha, body);
          shade = head.tone * (0.8 + 0.16 * dy) * bracts;
        }
      }
      for (const stroke of strokes) {
        const distanceSq = segmentDistanceSq(
          u,
          v,
          stroke.ax,
          stroke.ay,
          stroke.bx,
          stroke.by,
        );
        const w = stroke.width;
        if (distanceSq > w * w) continue;
        const coverage = 1 - smooth(Math.sqrt(distanceSq), w * 0.45, w);
        if (coverage > alpha * 0.95) {
          // Style tips are paler than the corolla throats they come out of.
          const along = clamp01(
            ((u - stroke.ax) * (stroke.bx - stroke.ax) +
              (v - stroke.ay) * (stroke.by - stroke.ay)) /
              ((stroke.bx - stroke.ax) ** 2 + (stroke.by - stroke.ay) ** 2),
          );
          shade = stroke.head.tone * (0.88 + 0.12 * along);
          alpha = Math.max(alpha, coverage);
        }
      }
      const grain = 0.94 + 0.06 * hash2(x, y, 19);
      const index = (y * width + x) * 4;
      const value = Math.round(clamp01(shade * grain) * 255);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = Math.round(clamp01(alpha) * 255);
    }
  }

  return finishTexture(data, width, height, 'Eutrochium_FloretClusters');
}

/**
 * Procedural leaf plate: a lanceolate, sharply toothed blade with a pale
 * midrib and pinnate veins, narrowing to a short petiole at the base (v = 0)
 * and a long acuminate tip (v = 1). Neutral so instance colour sets the hue.
 */
export function createLanceolateLeafTexture({ width = 128, height = 384 } = {}) {
  validatePositiveInteger(width, 'width');
  validatePositiveInteger(height, 'height');
  const data = new Uint8Array(width * height * 4);
  const petiole = 0.07;
  const teeth = 26;

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    // Blade half-width as a fraction of the card half-width.
    const blade = v < petiole ? 0 : (v - petiole) / (1 - petiole);
    const profile =
      blade <= 0 ? 0 : Math.pow(Math.sin(Math.PI * Math.pow(blade, 0.78)), 1.15);
    // Teeth point toward the tip: a sawtooth on the margin.
    const tooth = blade > 0.06 && blade < 0.95 ? fract(blade * teeth) : 0;
    const halfWidth = 0.47 * profile * (1 - 0.075 * tooth);
    const petioleHalf = v < petiole ? 0.035 * (1 - v / petiole) + 0.02 : 0;

    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const across = Math.abs(u - 0.5) * 2;
      const edge = Math.max(halfWidth * 2, petioleHalf * 2);
      const aa = 1.5 / width;
      const alpha = edge <= 0 ? 0 : 1 - smooth(across, edge - aa, edge + aa);

      // Midrib, then secondary veins leaving it at about 40 degrees. Both are
      // soft: on a real blade they read as faint creases, not drawn lines.
      const midrib = 1 - smooth(across, 0.01, 0.028);
      const veinPhase = fract(blade * 13 - across * 1.5 + 0.08 * Math.sin(v * 40));
      const vein =
        blade > 0.04
          ? (1 - smooth(Math.abs(veinPhase - 0.5), 0.015, 0.05)) *
            (1 - smooth(across / Math.max(0.001, edge), 0.7, 0.92)) *
            0.55
          : 0;
      // Darker toward the margin; broad low-frequency mottling so no two
      // regions of the blade are the same flat value.
      const marginShade = 1 - 0.16 * smooth(across / Math.max(0.001, edge), 0.5, 1);
      const mottle =
        0.92 +
        0.05 * Math.sin(v * 23 + u * 9) * Math.sin(v * 7 - u * 13) +
        0.03 * hash2(Math.floor(x / 6), Math.floor(y / 6), 43);
      const grain = 0.95 + 0.05 * hash2(x, y, 41);
      let shade = 0.92 * marginShade * mottle * grain;
      shade = shade + (1 - shade) * vein;
      shade = Math.max(shade, midrib * 1);
      if (v < petiole) shade = 0.86;

      const index = (y * width + x) * 4;
      const value = Math.round(clamp01(shade) * 255);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = Math.round(clamp01(alpha) * 255);
    }
  }

  return finishTexture(data, width, height, 'Eutrochium_LanceolateLeaf');
}

function appendCard(buffers, { centre, xAxis, yAxis, halfWidth, height, shade }) {
  const base = buffers.positions.length / 3;
  const corners = [
    [-halfWidth, 0, 0, 0],
    [halfWidth, 0, 1, 0],
    [halfWidth, height, 1, 1],
    [-halfWidth, height, 0, 1],
  ];
  for (const [x, y, u, v] of corners) {
    buffers.positions.push(
      centre.x + xAxis.x * x + yAxis.x * y,
      centre.y + xAxis.y * x + yAxis.y * y,
      centre.z + xAxis.z * x + yAxis.z * y,
    );
    const lift = 0.86 + 0.14 * v;
    buffers.colors.push(shade * lift, shade * lift, shade * lift);
    buffers.uvs.push(u, v);
  }
  buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * One flowering cluster in one draw, at unit diameter with local +Y up.
 *
 * Not a smooth disc. A Joe Pye cluster is a panicle of small bunches on
 * branchlets of different lengths, so its top is lumpy: a raised central
 * bunch with lower ones around it, gaps between them, and a ragged edge
 * (botanic-garden photograph of 'Phantom'). Each flower patch is a pair of
 * crossed upright cards, so it reads from the side, plus optionally one card
 * lying on the bunch, so it reads from above.
 */
export function createJoePyeArrayGeometry({
  clusters = 30,
  topCards = true,
  dome = 0.12,
  clusterScale = 1,
} = {}) {
  validatePositiveInteger(clusters, 'clusters');
  if (clusters < 6 || clusters > 120) {
    throw new RangeError('clusters must be an integer from 6 to 120.');
  }
  if (!Number.isFinite(dome) || dome < 0 || dome > 0.6) {
    throw new RangeError('dome must be a number from 0 to 0.6.');
  }

  const buffers = { positions: [], colors: [], indices: [], uvs: [] };
  // Card size grows as the count falls, so a coarse rung keeps the top full.
  const cardSize = 0.3 * Math.pow(30 / clusters, 0.42) * clusterScale;

  // Bunch centres: one raised in the middle, the rest scattered around it at
  // uneven radii and heights. Fixed by index so every rung shares the layout.
  const bunchCount = Math.max(3, Math.min(7, Math.round(clusters / 5)));
  const bunches = [];
  for (let b = 0; b < bunchCount; b += 1) {
    if (b === 0) {
      bunches.push({ x: 0, z: 0, y: dome + 0.05, spread: 0.14 });
      continue;
    }
    const angle = b * GOLDEN_ANGLE * 1.0 + 0.4 * Math.sin(b * 2.1);
    const radius = 0.2 + 0.13 * fract(b * 0.618033989);
    bunches.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: dome * (1 - (radius / 0.36) ** 2) + 0.06 * (fract(b * 0.754877666) - 0.5),
      spread: 0.1 + 0.05 * fract(b * 0.569840291),
    });
  }

  for (let index = 0; index < clusters; index += 1) {
    const bunch = bunches[index % bunchCount];
    const within = Math.floor(index / bunchCount);
    const perBunch = Math.ceil(clusters / bunchCount);
    const local = bunch.spread * Math.sqrt((within + 0.5) / perBunch);
    const localAngle = within * GOLDEN_ANGLE + index * 0.7;
    const x = bunch.x + Math.cos(localAngle) * local;
    const z = bunch.z + Math.sin(localAngle) * local;
    const reach = Math.hypot(x, z);
    // Each bunch is a small dome of its own.
    const y =
      bunch.y -
      0.5 * (local / bunch.spread) ** 2 * bunch.spread +
      0.02 * (fract(index * 0.754877666) - 0.5);
    const outwardAngle = reach > 1e-4 ? Math.atan2(z, x) : localAngle;
    const outward = new THREE.Vector3(Math.cos(outwardAngle), 0, Math.sin(outwardAngle));
    const side = new THREE.Vector3(-outward.z, 0, outward.x);
    const rim = Math.min(1, reach / 0.45);
    // Outer patches lean out, as the outer branchlets of a cluster do.
    const up = new THREE.Vector3(0, 1, 0)
      .addScaledVector(outward, 0.12 + 0.6 * rim * rim)
      .normalize();
    const size = cardSize * (0.8 + 0.4 * fract(index * 0.569840291));
    const centre = new THREE.Vector3(x, y - size * 0.4, z);
    // Patches deep inside the cluster and low in it are shaded by the rest.
    const shade = 0.84 + 0.1 * rim + 0.06 * (y / Math.max(0.05, dome + 0.05));

    appendCard(buffers, {
      centre,
      xAxis: side,
      yAxis: up,
      halfWidth: size * 0.5,
      height: size,
      shade,
    });
    appendCard(buffers, {
      centre,
      xAxis: outward.clone().addScaledVector(up, -outward.dot(up)).normalize(),
      yAxis: up,
      halfWidth: size * 0.5,
      height: size,
      shade: shade * 0.94,
    });

    if (topCards) {
      const slope = new THREE.Vector3(0, -0.35 * rim, 0)
        .addScaledVector(outward, 1)
        .normalize();
      const lying = new THREE.Vector3(x, y - size * 0.05, z).addScaledVector(
        slope,
        -size * 0.45,
      );
      appendCard(buffers, {
        centre: lying,
        xAxis: side,
        yAxis: slope,
        halfWidth: size * 0.55,
        height: size * 0.95,
        shade: shade * 1.02,
      });
    }
  }

  return finishGeometry({
    ...buffers,
    // Every card faces both ways; give them a soft upward normal so the dome
    // shades as one mass rather than as hundreds of flipping planes.
    normals: buffers.positions.flatMap((_, index, all) => {
      if (index % 3 !== 0) return [];
      const n = new THREE.Vector3(all[index] * 1.4, 1, all[index + 2] * 1.4)
        .normalize();
      return [n.x, n.y, n.z];
    }),
    userData: {
      organ: 'eutrochium-compound-corymb',
      clusters,
      topCards,
      dome,
      unitDiameter: 1,
    },
  });
}
