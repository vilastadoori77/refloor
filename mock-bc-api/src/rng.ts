/**
 * Deterministic PRNG (MOCK-004 / TEST-021).
 *
 * `cyrb128` hashes an arbitrary seed string into a 128-bit state; the first
 * 32-bit word feeds `mulberry32`, a fast, well-distributed 32-bit generator.
 * No `Math.random`, no `Date.now` — the same seed always yields the same stream,
 * so the whole dataset is byte-identical across restarts and machines.
 */

/** Hash a string into four uint32 words (cyrb128). */
function cyrb128(str: string): number {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  return h1 >>> 0;
}

/** mulberry32 — deterministic float generator in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Raw float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** Deterministically pick one element. */
  pick<T>(arr: readonly T[]): T;
  /** True with probability p (default 0.5). */
  bool(p?: number): boolean;
}

export function makeRng(seed: string): Rng {
  const next = mulberry32(cyrb128(seed));
  return {
    next,
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    float(min: number, max: number): number {
      return next() * (max - min) + min;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(next() * arr.length)] as T;
    },
    bool(p = 0.5): boolean {
      return next() < p;
    },
  };
}
