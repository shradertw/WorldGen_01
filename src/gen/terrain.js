// Starting terrain: continents, ocean basins and mountain belts from noise.
// Every field here is a continuous function of map position (u, v in 0..1),
// so any grid size samples the same underlying world.

import { fbm, ridged, smoothstep } from '../core/noise.js';
import { subSeed } from '../core/hash.js';

export function makeFields(seed, P) {
  const sWx = subSeed(seed, 'warp-x');
  const sWy = subSeed(seed, 'warp-y');
  const sCont = subSeed(seed, 'continents');
  const sMount = subSeed(seed, 'mountains');
  const sDetail = subSeed(seed, 'detail');

  // Raw continent value and mountain-belt value at (u, v).
  function rawAt(u, v, out) {
    const wx = u + P.warp * fbm(sWx, u * 2.5, v * 2.5, 4);
    const wy = v + P.warp * fbm(sWy, u * 2.5, v * 2.5, 4);
    let c = fbm(sCont, wx * P.continentFreq, wy * P.continentFreq, 7);
    // Distance from the centre, bent by the warp and wobbled by noise,
    // so the land doesn't come out as one round island.
    const dx = (wx - 0.5) * 2;
    const dy = (wy - 0.5) * 2;
    const d = Math.sqrt(dx * dx + dy * dy) + 0.3 * fbm(sCont + 99, u * 1.5, v * 1.5, 3);
    c -= smoothstep(P.edgeStart, 1.05, d) * P.edgeDrop;
    out[0] = c;
    out[1] = ridged(sMount, wx * P.mountainFreq, wy * P.mountainFreq, 5);
  }

  // Sample raw fields on an N x N grid.
  function sampleRaw(N) {
    const raw = new Float32Array(N * N);
    const belt = new Float32Array(N * N);
    const tmp = [0, 0];
    for (let y = 0; y < N; y++) {
      const v = (y + 0.5) / N;
      for (let x = 0; x < N; x++) {
        rawAt((x + 0.5) / N, v, tmp);
        raw[y * N + x] = tmp[0];
        belt[y * N + x] = tmp[1];
      }
    }
    return { raw, belt };
  }

  // Sea-level threshold so that landFraction of the map is land.
  function seaThreshold(raw) {
    const s = Float32Array.from(raw).sort();
    return s[Math.min(s.length - 1, Math.floor((1 - P.landFraction) * s.length))];
  }

  function mountainMask(raw, belt, t) {
    return smoothstep(P.beltLo, P.beltHi, belt) * smoothstep(0, P.inlandRamp, raw - t);
  }

  // Starting height (m) and uplift (m per step) on an N x N grid.
  function initial(N, t) {
    const { raw, belt } = sampleRaw(N);
    const h = new Float32Array(N * N);
    for (let i = 0; i < h.length; i++) {
      const above = raw[i] - t;
      if (above > 0) {
        h[i] = above * P.landScale + mountainMask(raw[i], belt[i], t) * P.mountainInit;
      } else {
        h[i] = Math.max(-P.maxDepth, above * P.oceanScale);
      }
    }
    return h;
  }

  function uplift(N, t) {
    const { raw, belt } = sampleRaw(N);
    const U = new Float32Array(N * N);
    for (let i = 0; i < U.length; i++) {
      if (raw[i] > t) U[i] = P.upliftBase + mountainMask(raw[i], belt[i], t) * P.upliftMountain;
    }
    return U;
  }

  // Fine noise added when moving to a finer grid, so erosion has new detail to cut.
  function detail(N, h) {
    const f = N / 24;
    for (let y = 0; y < N; y++) {
      const v = (y + 0.5) / N;
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const n = fbm(sDetail + N, ((x + 0.5) / N) * f, v * f, 3);
        // Detail never moves a cell across sea level.
        if (h[i] > 0) h[i] = Math.max(0.5, h[i] + n * P.detailAmp);
        else h[i] = Math.min(-0.5, h[i] + n * P.detailAmp * 0.3);
      }
    }
  }

  return { sampleRaw, seaThreshold, initial, uplift, detail };
}
