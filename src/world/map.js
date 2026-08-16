import { CONFIG } from '../config.js';
import { mulberry32, randomSeed } from '../core/rng.js';

export const TILE = Object.freeze({
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  GRASS: 3,
  WATER: 4,
  BASE: 5,
});

const {
  tileSize,
  cols,
  rows,
  spawn,
  spawnSafe,
  base,
  baseSafe,
} = CONFIG.map;

// 敌人出生点周围也要保持空地（避免随机地图把全部出生点盖住导致无法刷怪）
const spawnPointSafe = CONFIG.enemy.spawnPoints.map((p) => ({
  col: Math.floor(p.x / tileSize) - 1,
  row: Math.floor(p.y / tileSize) - 1,
  w: 3,
  h: 3,
}));

function pickWeighted(entries, random) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

/**
 * 瓦片地图。网格以行优先 Uint8Array 存储，瓦片 16×16。
 * 坦克实体判定：砖墙、钢墙、水、基地；
 * 子弹判定：砖墙、钢墙、基地（子弹可飞越水与草丛）。
 */
export class Map {
  constructor(grid, seed) {
    this.grid = grid;
    this.seed = seed;
    this.width = cols * tileSize;
    this.height = rows * tileSize;
  }

  static generate(seed = randomSeed()) {
    return new Map(new Uint8Array(cols * rows), seed).randomize(mulberry32(seed));
  }

  index(col, row) {
    return row * cols + col;
  }

  inBounds(col, row) {
    return col >= 0 && col < cols && row >= 0 && row < rows;
  }

  get(col, row) {
    return this.inBounds(col, row) ? this.grid[this.index(col, row)] : TILE.EMPTY;
  }

  set(col, row, type) {
    if (this.inBounds(col, row)) this.grid[this.index(col, row)] = type;
  }

  isTankSolid(col, row) {
    const t = this.get(col, row);
    return t === TILE.BRICK || t === TILE.STEEL || t === TILE.WATER || t === TILE.BASE;
  }

  isBulletSolid(col, row) {
    const t = this.get(col, row);
    return t === TILE.BRICK || t === TILE.STEEL || t === TILE.BASE;
  }

  destroyBrick(col, row) {
    if (this.get(col, row) !== TILE.BRICK) return false;
    this.set(col, row, TILE.EMPTY);
    return true;
  }

  /** 包围盒（x, y, w, h）与满足 solid 判定的瓦片是否有重叠 */
  rectCollides(x, y, w, h, solid = (c, r) => this.isTankSolid(c, r)) {
    const c0 = Math.max(0, Math.floor(x / tileSize));
    const c1 = Math.min(cols - 1, Math.floor((x + w - 0.001) / tileSize));
    const r0 = Math.max(0, Math.floor(y / tileSize));
    const r1 = Math.min(rows - 1, Math.floor((y + h - 0.001) / tileSize));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        if (solid(c, r)) return true;
      }
    }
    return false;
  }

  /** 随机生成地图：钢墙外圈 + 随机瓦片区域，出生点与基地周围保持安全区 */
  randomize(random) {
    const inSafe = (col, row) => {
      const inRect = (s) =>
        col >= s.col && col < s.col + s.w && row >= s.row && row < s.row + s.h;
      return (
        inRect(spawnSafe) ||
        inRect(baseSafe) ||
        spawnPointSafe.some((s) => inRect(s))
      );
    };

    // 钢墙外圈（不可破坏，保证地图封闭）
    for (let c = 0; c < cols; c += 1) {
      this.set(c, 0, TILE.STEEL);
      this.set(c, rows - 1, TILE.STEEL);
    }
    for (let r = 0; r < rows; r += 1) {
      this.set(0, r, TILE.STEEL);
      this.set(cols - 1, r, TILE.STEEL);
    }

    // 随机瓦片区域（大小 2~6 × 2~5，类型加权）
    const regionTypes = [
      [TILE.BRICK, 0.55],
      [TILE.WATER, 0.18],
      [TILE.GRASS, 0.17],
      [TILE.STEEL, 0.10],
    ];
    const regionCount = 24 + Math.floor(random() * 10);
    for (let i = 0; i < regionCount; i += 1) {
      const type = pickWeighted(regionTypes, random);
      let w;
      let h;
      if (type === TILE.STEEL) {
        // 钢墙只做小型掩体（1~2 格），避免大面积不可破坏区域
        w = 1 + Math.floor(random() * 2);
        h = 1 + Math.floor(random() * 2);
      } else if (type === TILE.WATER) {
        // 水做横向水道（宽 3~7、高 1~3），玩家可以绕行
        w = 3 + Math.floor(random() * 5);
        h = 1 + Math.floor(random() * 3);
      } else {
        w = 2 + Math.floor(random() * 5);
        h = 2 + Math.floor(random() * 4);
      }
      const cx = 2 + Math.floor(random() * (cols - 2 - w));
      const cy = 2 + Math.floor(random() * (rows - 2 - h));
      for (let r = cy; r < cy + h; r += 1) {
        for (let c = cx; c < cx + w; c += 1) {
          if (!inSafe(c, r) && this.get(c, r) === TILE.EMPTY) this.set(c, r, type);
        }
      }
    }

    // 草丛零星点缀
    const grassPatches = 36;
    for (let i = 0; i < grassPatches; i += 1) {
      const c = 1 + Math.floor(random() * (cols - 2));
      const r = 1 + Math.floor(random() * (rows - 2));
      if (!inSafe(c, r) && this.get(c, r) === TILE.EMPTY) this.set(c, r, TILE.GRASS);
    }

    // 基地旗帜（固定位置，安全区内）
    this.set(base.col, base.row, TILE.BASE);
    this._ensureOpen(random);
    return this;
  }

  /**
   * 连通性修复：从出生点洪泛（砖墙视为可通行，因为可被子弹破坏），
   * 任何被钢墙/水/基地密封而无法到达的区域，把构成密封边界的钢墙/水
   * 改成砖墙——保证地图中不存在“无法通过又无法破坏”的死区。
   */
  _ensureOpen() {
    const blocked = (c, r) => {
      const t = this.get(c, r);
      return t === TILE.STEEL || t === TILE.WATER || t === TILE.BASE;
    };
    const isBorder = (c, r) => c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const spawnCol = Math.floor(spawn.x / tileSize);
    const spawnRow = Math.floor(spawn.y / tileSize);

    for (let pass = 0; pass < 3; pass += 1) {
      const reachable = new Uint8Array(cols * rows);
      const queue = [{ col: spawnCol, row: spawnRow }];
      reachable[this.index(spawnCol, spawnRow)] = 1;
      while (queue.length) {
        const { col, row } = queue.pop();
        for (const [dc, dr] of neighbors) {
          const nc = col + dc;
          const nr = row + dr;
          if (!this.inBounds(nc, nr)) continue;
          const idx = this.index(nc, nr);
          if (reachable[idx]) continue;
          if (blocked(nc, nr)) continue;
          reachable[idx] = 1;
          queue.push({ col: nc, row: nr });
        }
      }

      let changed = false;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const idx = this.index(c, r);
          if (reachable[idx]) continue;
          const t = this.get(c, r);
          if (t !== TILE.STEEL && t !== TILE.WATER) continue;
          if (isBorder(c, r)) continue;
          const touchesReachable = neighbors.some(([dc, dr]) => {
            const nc = c + dc;
            const nr = r + dr;
            return this.inBounds(nc, nr) && reachable[this.index(nc, nr)];
          });
          if (touchesReachable) {
            this.set(c, r, TILE.BRICK);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
  }
}
