// World generation pipeline: seed in, terrain and water out.
//
// 1. Continents, ocean basins and mountain belts from noise (terrain.js)
// 2. Erosion with uplift, coarse grid first, then finer grids (erosion.js)
// 3. Final water pass: ocean, rivers (drainage area), lakes (filled basins)

import { hashString } from '../core/hash.js';
import { DEFAULTS } from './params.js';
import { makeFields } from './terrain.js';
import { Hydro, upsample } from './erosion.js';

export function seedOf(text) {
  return hashString(String(text).trim());
}

export function generate(seedText, overrides = {}, onProgress = () => {}) {
  const P = { ...DEFAULTS, ...overrides };
  const seed = seedOf(seedText);
  const fields = makeFields(seed, P);
  const t0 = Date.now();

  // Sea-level threshold from the coarsest grid; reused at every level.
  const first = P.levels[0].size;
  const t = fields.seaThreshold(fields.sampleRaw(first).raw);

  const totalSteps = P.levels.reduce((s, l) => s + l.steps, 0);
  let done = 0;
  let h = null;
  let prevN = 0;
  let hydro = null;

  for (const level of P.levels) {
    const N = level.size;
    const cellKm = P.worldKm / N;
    if (!h) {
      h = fields.initial(N, t);
    } else {
      h = upsample(h, prevN, N);
      fields.detail(N, h);
      // Redraw the coastline and sea floor at this resolution, so coasts
      // gain the fine wiggles a coarse grid can't hold.
      const fresh = fields.initial(N, t);
      for (let i = 0; i < h.length; i++) {
        if (fresh[i] < 0) h[i] = fresh[i];
        else if (h[i] < 0) h[i] = 0.5 + fresh[i] * 0.5;
      }
    }
    sinkEdges(h, N);
    const U = fields.uplift(N, t);
    hydro = new Hydro(N, cellKm);

    for (let s = 0; s < level.steps; s++) {
      hydro.findOcean(h);
      hydro.route(h, P.fillEps);
      hydro.accumulate();
      hydro.erode(h, U, P.K);
      hydro.relax(h, P.diffusion, P.talus);
      done++;
      if (s % 3 === 0) onProgress(done / totalSteps);
    }
    prevN = N;
  }

  // Final water pass on the finished terrain.
  const N = prevN;
  hydro.findOcean(h);
  hydro.route(h, P.fillEps);
  hydro.accumulate();

  const lake = new Float32Array(N * N);
  for (let i = 0; i < lake.length; i++) {
    if (hydro.ocean[i]) continue;
    const depth = hydro.z[i] - h[i];
    if (depth > P.lakeMinDepth) lake[i] = depth;
  }

  onProgress(1);
  return {
    seedText: String(seedText),
    size: N,
    worldKm: P.worldKm,
    cellKm: P.worldKm / N,
    riverMinKm2: P.riverMinKm2,
    height: h,
    ocean: hydro.ocean,
    area: hydro.area,
    lake,
    ms: Date.now() - t0,
  };
}

// Keep a thin ring of sea around the map so every river has somewhere to go.
function sinkEdges(h, N) {
  const ring = Math.max(2, Math.round(N / 256));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (x < ring || y < ring || x >= N - ring || y >= N - ring) {
        const i = y * N + x;
        if (h[i] > -50) h[i] = -50;
      }
    }
  }
}
