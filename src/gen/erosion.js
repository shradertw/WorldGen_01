// Water and erosion on a square grid.
//
// Each step:
//   1. find the ocean (sea-level water connected to the map edge)
//   2. flood-fill basins from the coast inward (priority flood), giving every
//      land cell a downhill path to the sea and a processing order
//   3. sum how much land drains through each cell (drainage area)
//   4. erode: cells with more water flowing through cut down faster
//      (stream power law, solved implicitly so it stays stable)
//   5. smooth hillslopes a little and cap slopes steeper than the talus angle

import { MinHeap } from '../core/heap.js';

const DX = [1, -1, 0, 0, 1, -1, 1, -1];
const DY = [0, 0, 1, -1, 1, 1, -1, -1];
const DIST = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

export class Hydro {
  constructor(N, cellKm) {
    this.N = N;
    this.cellKm = cellKm;
    const n = N * N;
    this.ocean = new Uint8Array(n);
    this.z = new Float32Array(n);      // water surface: terrain with basins filled
    this.recv = new Int32Array(n);     // downhill neighbour, -1 for ocean
    this.recvDist = new Float32Array(n);
    this.order = new Int32Array(n);    // cells from the sea upward
    this.count = 0;
    this.area = new Float32Array(n);   // km2 draining through each cell
    this.closed = new Uint8Array(n);
    this.heap = new MinHeap(n);
    this.queue = new Int32Array(n);
    this.tmp = new Float32Array(n);
  }

  // Ocean = below sea level. Land never erodes below sea level, so this only
  // catches the starting basins: open ocean, plus inland seas where the
  // continent noise dips under the water.
  findOcean(h) {
    const { ocean } = this;
    for (let i = 0; i < ocean.length; i++) ocean[i] = h[i] < 0 ? 1 : 0;
  }

  // Unused alternative: only sea connected to the map edge counts as ocean.
  findOceanConnected(h) {
    const { N, ocean, queue } = this;
    ocean.fill(0);
    let head = 0;
    let tail = 0;
    const seed = (i) => {
      if (!ocean[i] && h[i] < 0) {
        ocean[i] = 1;
        queue[tail++] = i;
      }
    };
    for (let k = 0; k < N; k++) {
      seed(k);
      seed((N - 1) * N + k);
      seed(k * N);
      seed(k * N + N - 1);
    }
    while (head < tail) {
      const i = queue[head++];
      const x = i % N;
      const y = (i - x) / N;
      if (x > 0) seed(i - 1);
      if (x < N - 1) seed(i + 1);
      if (y > 0) seed(i - N);
      if (y < N - 1) seed(i + N);
    }
  }

  // Priority flood from the coast. Fills z, order, recv.
  route(h, eps) {
    const { N, ocean, z, recv, recvDist, order, closed, heap } = this;
    closed.fill(0);
    heap.clear();
    let count = 0;

    // Seed with ocean cells that touch land. Their water level is sea level (0).
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        recv[i] = -1;
        if (!ocean[i]) continue;
        z[i] = 0;
        for (let d = 0; d < 8; d++) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          if (!ocean[ny * N + nx]) {
            closed[i] = 1;
            heap.push(0, i);
            break;
          }
        }
      }
    }

    while (heap.size > 0) {
      const i = heap.pop();
      const zi = heap.lastKey;
      order[count++] = i;
      const x = i % N;
      const y = (i - x) / N;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        if (closed[j] || ocean[j]) continue;
        closed[j] = 1;
        const zj = Math.max(h[j], zi + eps);
        z[j] = zj;
        heap.push(zj, j);
      }
    }
    this.count = count;

    // Each land cell drains to its steepest lower neighbour on the filled surface.
    const cell = this.cellKm;
    for (let k = 0; k < count; k++) {
      const i = order[k];
      if (ocean[i]) continue;
      const x = i % N;
      const y = (i - x) / N;
      const zi = z[i];
      let best = -1;
      let bestSlope = 0;
      let bestDist = 1;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        const zj = z[j];
        if (zj >= zi) continue;
        const s = (zi - zj) / DIST[d];
        if (s > bestSlope) {
          bestSlope = s;
          best = j;
          bestDist = DIST[d];
        }
      }
      recv[i] = best;
      recvDist[i] = bestDist * cell;
    }
  }

  // Drainage area (km2) through every cell.
  accumulate() {
    const { order, count, recv, area, ocean } = this;
    const a = this.cellKm * this.cellKm;
    area.fill(0);
    for (let k = 0; k < count; k++) {
      const i = order[k];
      if (!ocean[i]) area[i] = a;
    }
    for (let k = count - 1; k >= 0; k--) {
      const i = order[k];
      const r = recv[i];
      if (r >= 0) area[r] += area[i];
    }
  }

  // One erosion step (stream power, n = 1, m = 0.5), lowest cells first.
  erode(h, U, K) {
    const { order, count, recv, recvDist, area, ocean } = this;
    for (let k = 0; k < count; k++) {
      const i = order[k];
      const r = recv[i];
      if (r < 0) continue;
      const hr = ocean[r] ? 0 : h[r];
      const F = (K * Math.sqrt(area[i])) / recvDist[i];
      h[i] = (h[i] + U[i] + F * hr) / (1 + F);
    }
  }

  // Hillslope smoothing on land, then a slope cap.
  relax(h, diffusion, talus) {
    const { N, ocean, tmp } = this;
    // Sea cells count as sea level here, so the coast isn't dragged into deep water.
    for (let i = 0; i < tmp.length; i++) tmp[i] = ocean[i] ? Math.max(0, h[i]) : h[i];
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        const i = y * N + x;
        if (ocean[i]) continue;
        const mean = (tmp[i - 1] + tmp[i + 1] + tmp[i - N] + tmp[i + N]) * 0.25;
        h[i] = tmp[i] + diffusion * (mean - tmp[i]);
      }
    }
    // Talus: a cell may not stand more than maxDrop above a neighbour.
    const maxDrop = talus * this.cellKm;
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        const i = y * N + x;
        if (ocean[i]) continue;
        for (let d = 0; d < 4; d++) {
          const j = i + DX[d] + DY[d] * N;
          const hj = ocean[j] ? Math.max(0, h[j]) : h[j];
          const excess = h[i] - hj - maxDrop;
          if (excess > 0) {
            h[i] -= excess * 0.5;
            if (!ocean[j]) h[j] += excess * 0.5;
          }
        }
      }
    }
  }
}

// Bilinear upsample from an M x M grid to N x N.
export function upsample(src, M, N) {
  const out = new Float32Array(N * N);
  const s = M / N;
  for (let y = 0; y < N; y++) {
    let fy = (y + 0.5) * s - 0.5;
    if (fy < 0) fy = 0;
    if (fy > M - 1) fy = M - 1;
    const y0 = Math.floor(fy);
    const y1 = Math.min(M - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < N; x++) {
      let fx = (x + 0.5) * s - 0.5;
      if (fx < 0) fx = 0;
      if (fx > M - 1) fx = M - 1;
      const x0 = Math.floor(fx);
      const x1 = Math.min(M - 1, x0 + 1);
      const tx = fx - x0;
      const a = src[y0 * M + x0] + (src[y0 * M + x1] - src[y0 * M + x0]) * tx;
      const b = src[y1 * M + x0] + (src[y1 * M + x1] - src[y1 * M + x0]) * tx;
      out[y * N + x] = a + (b - a) * ty;
    }
  }
  return out;
}
