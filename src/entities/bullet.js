import { CONFIG } from '../config.js';
import { TILE } from '../world/map.js';

/**
 * 子弹（由 BulletPool 管理，可复用对象）：
 * - 玩家与敌方子弹共用；
 * - 击中砖墙 → 摧毁该瓦片；击中钢墙/基地 → 消失；
 * - 水与草丛不阻挡子弹。
 */
export class Bullet {
  constructor() {
    this.active = false;
    this.reset();
  }

  reset({
    x = 0,
    y = 0,
    direction = 0,
    speed = CONFIG.bullet.playerSpeed,
    owner = 'player',
    damage = 1,
    pierce = 0,
    explosion = 0,
    freezeChance = 0,
    burnDps = 0,
    critChance = 0,
    critMult = 2,
    source = null,
  } = {}) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.speed = speed;
    this.owner = owner;
    this.damage = damage;
    this.radius = CONFIG.bullet.radius;
    this.pierce = pierce;
    this.explosion = explosion;
    this.freezeChance = freezeChance;
    this.burnDps = burnDps;
    this.critChance = critChance;
    this.critMult = critMult;
    this.source = source;
    if (!this.hitSet) this.hitSet = new Set();
    this.hitSet.clear();
    this.alive = true;
  }

  get vx() {
    return Math.cos(this.direction) * this.speed;
  }

  get vy() {
    return Math.sin(this.direction) * this.speed;
  }

  update(dt, map, onBrick = null) {
    const { tileSize } = CONFIG.map;
    // 分段检测：每段不超过 4px，高速子弹也不会穿透砖墙/钢墙
    const dist = Math.hypot(this.vx * dt, this.vy * dt);
    const steps = Math.max(1, Math.ceil(dist / 4));
    const sx = (this.vx * dt) / steps;
    const sy = (this.vy * dt) / steps;
    for (let i = 0; i < steps; i += 1) {
      this.x += sx;
      this.y += sy;
      if (this.x < 0 || this.x >= map.width || this.y < 0 || this.y >= map.height) {
        this.alive = false;
        return;
      }
      const col = Math.floor(this.x / tileSize);
      const row = Math.floor(this.y / tileSize);
      const t = map.get(col, row);
      if (t === TILE.BRICK) {
        map.destroyBrick(col, row);
        if (onBrick) onBrick(col, row);
        this.alive = false;
        return;
      }
      if (map.isBulletSolid(col, row)) {
        this.alive = false;
        return;
      }
    }
  }

  draw(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.owner === 'player') {
      ctx.fillStyle = '#e8e2c8';
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = '#f7f2d9';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    } else {
      ctx.fillStyle = '#d76a4a';
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = '#f2a184';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
}
