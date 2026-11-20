// Gradient (Perlin-style) noise and fractal sums.
// No trig functions: gradients come from a fixed table, so results match across browsers.

import { hash3 } from './hash.js';

const D = 0.7071067811865476;
const GX = [1, -1, 0, 0, D, -D, D, -D];
const GY = [0, 0, 1, -1, D, D, -D, -D];

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Roughly in [-1, 1].
export function perlin(seed, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);

  let h = hash3(seed, xi, yi) & 7;
  const n00 = GX[h] * xf + GY[h] * yf;
  h = hash3(seed, xi + 1, yi) & 7;
  const n10 = GX[h] * (xf - 1) + GY[h] * yf;
  h = hash3(seed, xi, yi + 1) & 7;
  const n01 = GX[h] * xf + GY[h] * (yf - 1);
  h = hash3(seed, xi + 1, yi + 1) & 7;
  const n11 = GX[h] * (xf - 1) + GY[h] * (yf - 1);

  const a = n00 + (n10 - n00) * u;
  const b = n01 + (n11 - n01) * u;
  return (a + (b - a) * v) * 1.4142135623730951;
}

// Fractal sum of octaves, normalised to roughly [-1, 1].
export function fbm(seed, x, y, octaves, lacunarity = 2, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * perlin(seed + o * 1013, x * freq + o * 17.31, y * freq - o * 9.77);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// Ridged noise in [0, 1]: sharp crests along the zero-lines of the noise.
// Used for mountain chains.
export function ridged(seed, x, y, octaves, lacunarity = 2, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  let weight = 1;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(perlin(seed + o * 7919, x * freq + o * 5.13, y * freq + o * 3.71));
    n *= n;
    n *= weight;
    weight = Math.min(1, Math.max(0, n * 2));
    sum += amp * n;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
