// Binary min-heap of (key, cell index) pairs, backed by typed arrays.
// Ties break on the cell index so the pop order is fully deterministic.

export class MinHeap {
  constructor(capacity) {
    this.keys = new Float64Array(capacity);
    this.vals = new Int32Array(capacity);
    this.size = 0;
  }

  clear() {
    this.size = 0;
  }

  less(a, b) {
    const ka = this.keys[a];
    const kb = this.keys[b];
    return ka < kb || (ka === kb && this.vals[a] < this.vals[b]);
  }

  swap(a, b) {
    const k = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = k;
    const v = this.vals[a];
    this.vals[a] = this.vals[b];
    this.vals[b] = v;
  }

  push(key, val) {
    let i = this.size++;
    this.keys[i] = key;
    this.vals[i] = val;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  // Returns the cell index; the key is left in this.lastKey.
  pop() {
    const val = this.vals[0];
    this.lastKey = this.keys[0];
    const n = --this.size;
    if (n > 0) {
      this.keys[0] = this.keys[n];
      this.vals[0] = this.vals[n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && this.less(r, l) ? r : l;
        if (!this.less(c, i)) break;
        this.swap(c, i);
        i = c;
      }
    }
    return val;
  }
}
