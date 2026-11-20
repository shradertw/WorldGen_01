// Turns generator output into map pixels: elevation colours, hillshade, water.

const LAND = [
  [0, [92, 138, 76]],
  [150, [118, 156, 86]],
  [500, [164, 170, 104]],
  [1000, [176, 152, 104]],
  [1600, [146, 120, 92]],
  [2300, [128, 122, 118]],
  [3000, [236, 236, 240]],
];
const SEA = [
  [-5000, [10, 28, 64]],
  [-2000, [20, 52, 104]],
  [-200, [38, 90, 150]],
  [0, [74, 136, 186]],
];
const RIVER = [48, 104, 176];
const LAKE = [56, 112, 172];

function ramp(stops, v, out) {
  if (v <= stops[0][0]) return copy(stops[0][1], out);
  for (let k = 1; k < stops.length; k++) {
    if (v <= stops[k][0]) {
      const [a, ca] = stops[k - 1];
      const [b, cb] = stops[k];
      const t = (v - a) / (b - a);
      out[0] = ca[0] + (cb[0] - ca[0]) * t;
      out[1] = ca[1] + (cb[1] - ca[1]) * t;
      out[2] = ca[2] + (cb[2] - ca[2]) * t;
      return out;
    }
  }
  return copy(stops[stops.length - 1][1], out);
}

function copy(c, out) {
  out[0] = c[0];
  out[1] = c[1];
  out[2] = c[2];
  return out;
}

export function renderMap(world, opts, image) {
  const { size: N, height: h, ocean, area, lake, cellKm, riverMinKm2 } = world;
  const px = image.data;
  const c = [0, 0, 0];
  const cellM = cellKm * 1000;
  const logMin = Math.log(riverMinKm2);
  // Light from the north-west, slightly raised.
  const lx = -0.6;
  const ly = -0.6;
  const lz = 0.53;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const hv = h[i];
      const isSea = ocean[i] === 1;
      if (isSea) ramp(SEA, Math.min(hv, 0), c);
      else ramp(LAND, hv, c);

      if (opts.shade) {
        const xl = x > 0 ? i - 1 : i;
        const xr = x < N - 1 ? i + 1 : i;
        const yu = y > 0 ? i - N : i;
        const yd = y < N - 1 ? i + N : i;
        const ex = isSea ? 0.15 : 1.6; // vertical exaggeration
        const gx = ((h[xr] - h[xl]) * ex) / (2 * cellM);
        const gy = ((h[yd] - h[yu]) * ex) / (2 * cellM);
        const len = Math.sqrt(gx * gx + gy * gy + 1);
        const d = (-gx * lx - gy * ly + lz) / len;
        const s = 0.45 + 0.75 * Math.max(0, d);
        c[0] *= s;
        c[1] *= s;
        c[2] *= s;
      }

      if (!isSea && opts.water && lake[i] > 0) copy(LAKE, c);

      const p = i * 4;
      px[p] = c[0];
      px[p + 1] = c[1];
      px[p + 2] = c[2];
      px[p + 3] = 255;
    }
  }

  if (!opts.rivers) return;
  // Rivers: stronger and wider as drainage area grows.
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      if (ocean[i] || area[i] <= riverMinKm2) continue;
      const k = Math.log(area[i]) - logMin;
      const t = Math.min(1, 0.55 + k * 0.2);
      paint(px, i, RIVER, t);
      if (k > 2.3) {
        // Big rivers: one extra cell each side.
        const w = Math.min(0.8, (k - 2.3) * 0.4);
        paintLand(px, i - 1, ocean, RIVER, w);
        paintLand(px, i + 1, ocean, RIVER, w);
        paintLand(px, i - N, ocean, RIVER, w);
        paintLand(px, i + N, ocean, RIVER, w);
      }
    }
  }
}

function paint(px, i, col, t) {
  const p = i * 4;
  px[p] += (col[0] - px[p]) * t;
  px[p + 1] += (col[1] - px[p + 1]) * t;
  px[p + 2] += (col[2] - px[p + 2]) * t;
}

function paintLand(px, i, ocean, col, t) {
  if (!ocean[i]) paint(px, i, col, t);
}
