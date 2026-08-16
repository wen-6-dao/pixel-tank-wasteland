/**
 * mulberry32：可复现的伪随机数生成器。
 * 同一种子产生完全相同的序列，用于地图/波次/Boss 构成等结构性随机。
 */
export function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 生成一个新的随机种子（用于新开局） */
export function randomSeed() {
  return (Math.random() * 0x7fffffff) | 0;
}
