// Seeded integer hashing. Uses only integer ops (Math.imul, xor, shifts),
// so the same seed gives the same bits in every browser.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return finalize(h);
}

function finalize(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Hash of three integers (seed, x, y).
export function hash3(a, b, c) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((b + 0x7f4a7c15) | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f);
  h ^= Math.imul((c + 0x165667b1) | 0, 0x9e3779b1);
  return finalize(h);
}

// Derive an independent seed for a named purpose ("continents", "mountains", ...).
export function subSeed(seed, name) {
  return hash3(seed, hashString(name), 0x5bd1e995);
}
