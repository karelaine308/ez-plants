import * as THREE from 'three';

import {
  finishGeometry,
  validatePositiveInteger,
} from '../../organ-geometry.js';

const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1);

const BLADE_LAMINA = new THREE.Color(0.92, 0.96, 0.88);
const BLADE_MARGIN = new THREE.Color(0.72, 0.78, 0.68);
const HEAD_BASE = new THREE.Color(1, 1, 1);
const HEAD_TIP = new THREE.Color(1, 1, 1);

/**
 * Erect inner blade, gently bowed blade, and the outer blade that bows over
 * to a low fountain. Little bluestem is upright in the middle of the clump and
 * bows only at the edge, so the middle variant is gentler than a fountain
 * grass's.
 */
export const BLADE_ARCH_VARIANTS = Object.freeze([0.4, 0.7, 1.0]);
export const BLADE_BAKED_ARCH = BLADE_ARCH_VARIANTS[1];
export const BLADE_TWIST_VARIANTS = Object.freeze([0.12, 0.3, 0.52]);

/** Full blade width as a fraction of arc length. */
export const BLADE_WIDTH_RATIOS = Object.freeze([0.0145, 0.0135, 0.0125]);

export function bladeVariantFor(arch) {
  let best = 0;
  for (let index = 1; index < BLADE_ARCH_VARIANTS.length; index += 1) {
    if (
      Math.abs(BLADE_ARCH_VARIANTS[index] - arch) <
      Math.abs(BLADE_ARCH_VARIANTS[best] - arch)
    ) {
      best = index;
    }
  }
  return best;
}

function integrateBladeTip(arch, segments = 24) {
  const tipAngle = arch * (Math.PI * 0.5 + 0.38);
  let across = 0;
  let along = 0;
  for (let index = 1; index <= segments; index += 1) {
    const previous = tipAngle * Math.pow((index - 1) / segments, 1.55);
    const current = tipAngle * Math.pow(index / segments, 1.55);
    const step = 1 / segments;
    across += ((Math.sin(previous) + Math.sin(current)) / 2) * step;
    along += ((Math.cos(previous) + Math.cos(current)) / 2) * step;
  }
  return { along, across };
}

function bladeTipAngle(arch) {
  const tip = integrateBladeTip(arch);
  return Math.atan2(tip.across, tip.along);
}

export function bladeTipOffset(arch) {
  const baked = integrateBladeTip(BLADE_BAKED_ARCH);
  const reach = Math.hypot(baked.along, baked.across);
  const angle = bladeTipAngle(arch);
  return { along: reach * Math.cos(angle), across: reach * Math.sin(angle) };
}

export function bladeArchTilt(arch) {
  return bladeTipAngle(arch) - bladeTipAngle(BLADE_BAKED_ARCH);
}

function bladeHalfWidth(s) {
  const opening = THREE.MathUtils.smoothstep(s, 0, 0.12);
  const taper = Math.pow(clamp01((1 - s) / 0.9), 0.55);
  return 0.5 * (0.48 + opening * 0.52) * taper;
}

/**
 * Unit-length, two-sided ribbon for little bluestem's folded blades. Its arch is
 * baked into the centreline; one instance scale gives it its real length.
 */
export function createBladeGeometry({
  arch = BLADE_BAKED_ARCH,
  twist = BLADE_TWIST_VARIANTS[1],
  widthRatio = BLADE_WIDTH_RATIOS[1],
  segments = 9,
  columns = 2,
} = {}) {
  validatePositiveInteger(segments, 'segments');
  if (segments < 4) throw new RangeError('A blade needs at least 4 segments.');
  if (![2, 3].includes(columns)) {
    throw new RangeError('A blade needs 2 or 3 columns.');
  }
  if (!Number.isFinite(arch) || arch < 0 || arch > 1.4) {
    throw new RangeError('arch must be a finite number from 0 to 1.4.');
  }
  if (!Number.isFinite(twist) || Math.abs(twist) > 3) {
    throw new RangeError('twist must be a finite number from -3 to 3.');
  }
  if (!Number.isFinite(widthRatio) || widthRatio <= 0 || widthRatio > 0.1) {
    throw new RangeError('widthRatio must be a finite number from 0 to 0.1.');
  }

  const offsets = columns === 3 ? [-0.5, 0, 0.5] : [-0.5, 0.5];
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const rows = [];
  const tipAngle = arch * (Math.PI * 0.5 + 0.38);
  let x = 0;
  let y = 0;

  for (let index = 0; index <= segments; index += 1) {
    const s = index / segments;
    const angle = tipAngle * Math.pow(s, 1.55);
    const tangent = new THREE.Vector2(Math.sin(angle), Math.cos(angle));
    if (index > 0) {
      const previous = tipAngle * Math.pow((index - 1) / segments, 1.55);
      const step = 1 / segments;
      x += ((Math.sin(previous) + tangent.x) / 2) * step;
      y += ((Math.cos(previous) + tangent.y) / 2) * step;
    }

    const halfWidth = bladeHalfWidth(s) * widthRatio;
    const roll = twist * Math.pow(s, 1.35);
    const row = [];
    for (const offset of offsets) {
      const across = offset * halfWidth * 2;
      const z = across * Math.cos(roll);
      const lift = across * Math.sin(roll);
      positions.push(x - tangent.y * lift, y + tangent.x * lift, z);
      const tone = Math.max(0.78, 0.88 + s * 0.12);
      const colour = (Math.abs(offset) > 0.45 ? BLADE_MARGIN : BLADE_LAMINA)
        .clone()
        .multiplyScalar(tone);
      colors.push(colour.r, colour.g, colour.b);
      uvs.push(offset + 0.5, s);
      row.push(positions.length / 3 - 1);
    }
    rows.push(row);
  }

  for (let index = 0; index < segments; index += 1) {
    for (let column = 0; column < offsets.length - 1; column += 1) {
      const a = rows[index][column];
      const b = rows[index][column + 1];
      const c = rows[index + 1][column];
      const d = rows[index + 1][column + 1];
      indices.push(a, c, b, b, c, d);
    }
  }

  return finishGeometry({
    positions,
    colors,
    indices,
    uvs,
    userData: {
      organ: 'bluestem-blade',
      arch,
      twist,
      widthRatio,
      unitLength: 1,
    },
  });
}

/**
 * Procedural alpha plate for one silvery raceme: a thin stalk running into a
 * rachis with feathery awns that spread outward and upward on both sides. The
 * plate is neutral so the instance colour carries the pink-purple, silver and
 * tan-grey sequence. Sub-pixel awns are texture alpha, never geometry.
 */
export function createRacemeTexture({ width = 64, height = 128 } = {}) {
  validatePositiveInteger(width, 'width');
  validatePositiveInteger(height, 'height');
  const data = new Uint8Array(width * height * 4);
  const headStart = 0.22;
  const awnStarts = [];
  for (let k = 0; k < 11; k += 1) awnStarts.push(headStart + 0.02 + k * 0.066);

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const dx = u - 0.5;
      const stalk = Math.abs(dx) < 0.022 ? 1 : 0;
      let alpha = stalk * (v < headStart ? 0.95 : 0.7);
      if (v > headStart) {
        for (const start of awnStarts) {
          const along = v - start;
          if (along < 0 || along > 0.3) continue;
          const reach = along * 0.8;
          const hash = Math.sin((start * 91.7 + Math.sign(dx) * 7.3) * 12.9898) * 43758.5453;
          const jitter = 0.85 + 0.3 * (hash - Math.floor(hash));
          const line = Math.abs(Math.abs(dx) - reach * jitter);
          const fade = 1 - along / 0.3;
          alpha = Math.max(alpha, clamp01(1 - line / 0.016) * (0.55 + 0.45 * fade));
        }
        const tipFade = 1 - THREE.MathUtils.smoothstep(v, 0.95, 1);
        alpha *= tipFade;
      }
      const index = (y * width + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 250;
      data[index + 3] = Math.round(clamp01(alpha) * 255);
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.name = 'Schizachyrium_Scoparium_Raceme';
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
 * A raceme is a slim awned spike, drawn as crossed alpha ribbons. The plate
 * carries the awns; geometry only carries the volume and a small baked bow so
 * the head continues the curve of its branch.
 */
export function createRacemeGeometry({ planes = 2, segments = 2 } = {}) {
  validatePositiveInteger(planes, 'planes');
  validatePositiveInteger(segments, 'segments');
  if (planes < 2 || planes > 4) {
    throw new RangeError('planes must be an integer from 2 to 4.');
  }
  if (segments < 1 || segments > 6) {
    throw new RangeError('segments must be an integer from 1 to 6.');
  }

  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  for (let plane = 0; plane < planes; plane += 1) {
    const angle = (plane / planes) * Math.PI;
    const across = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const base = positions.length / 3;
    for (let row = 0; row <= segments; row += 1) {
      const v = row / segments;
      const bend = 0.12 * Math.pow(v, 1.8);
      for (const side of [-1, 1]) {
        const radius = side * 0.5;
        positions.push(bend + across.x * radius, v, across.z * radius);
        const colour = HEAD_BASE.clone().lerp(HEAD_TIP, 0.3 + v * 0.4);
        colors.push(colour.r, colour.g, colour.b);
        uvs.push(side < 0 ? 0 : 1, v);
      }
    }
    for (let row = 0; row < segments; row += 1) {
      const a = base + row * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  return finishGeometry({
    positions,
    colors,
    indices,
    uvs,
    userData: {
      organ: 'bluestem-raceme',
      planes,
      segments,
      unitLength: 1,
    },
  });
}
