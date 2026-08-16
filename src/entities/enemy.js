import { CONFIG } from '../config.js';
import { ALL_DIRECTIONS, primaryDirection, secondaryDirection } from './directions.js';

const TYPES = CONFIG.enemy.types;

export function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x2 < x1 + w1 && y1 < y2 + h2 && y2 < y1 + h1;
}

/**
 * 敌人坦克。
 * - normal / fast：四方向追击玩家（fast 更快、不射击）；
 * - shooter：与玩家保持距离，进入射程后朝玩家开火。
 * 卡住时随机换向，避免永远卡在墙角。
 */
export class Enemy {
  constructor(type, x, y) {
    const t = TYPES[type];
    this.type = type;
    this.config = t;
    this.x = x;
    this.y = y;
    this.direction = Math.PI / 2; // 出生朝下
    this.turretAngle = Math.PI / 2;
    this.hp = t.hp;
    this.speed = t.speed;
    this.pixelSize = CONFIG.player.pixelSize;
    this.alive = true;
    this.fireTimer = t.shootCooldown > 0 ? t.shootCooldown * (0.4 + Math.random() * 0.6) : Infinity;
    this.stuckTimer = 0.6;
    this.rerouteTimer = 0;
    this.rerouteDir = null;
    this.slowTimer = 0;
    this.burnTimer = 0;
    this.burnDps = 0;
    this.auraBoost = false; // Boss 狂暴光环
    this.prevX = this.x;
    this.prevY = this.y;
  }

  get halfSize() {
    return (CONFIG.player.spriteSize * this.pixelSize) / 2;
  }

  interpolatedPosition(alpha) {
    return {
      x: Math.round(this.prevX + (this.x - this.prevX) * alpha),
      y: Math.round(this.prevY + (this.y - this.prevY) * alpha),
    };
  }

  update(dt, world) {
    this.prevX = this.x;
    this.prevY = this.y;

    // 燃烧：每秒灼烧伤害（死亡由主循环统一处理）
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.hp -= this.burnDps * dt;
    }
    if (this.slowTimer > 0) this.slowTimer -= dt;
    let effectiveSpeed = this.slowTimer > 0 ? this.speed * 0.5 : this.speed;
    if (this.auraBoost) effectiveSpeed *= 1.5;

    const { player } = world;
    const tx = player.x - this.x;
    const ty = player.y - this.y;
    const dist = Math.hypot(tx, ty);
    this.turretAngle = Math.atan2(ty, tx);
    this.fireTimer -= dt;

    // 射手坦克：过近则拉开，过远则接近，中间保持距离
    let targetX = tx;
    let targetY = ty;
    if (this.type === 'shooter') {
      if (dist < this.config.minRange) {
        targetX = -tx;
        targetY = -ty;
      } else if (dist <= this.config.range) {
        targetX = 0;
        targetY = 0;
      }
    }

    let moved = false;
    if (targetX !== 0 || targetY !== 0) {
      let dir = this.rerouteTimer > 0 ? this.rerouteDir : primaryDirection(targetX, targetY);
      const step = effectiveSpeed * dt;
      const half = this.halfSize;
      const size = half * 2;

      if (dir.dx !== 0) moved = this._moveX(dir.dx, step, half, size, world);
      else moved = this._moveY(dir.dy, step, half, size, world);

      if (!moved) {
        const alt = secondaryDirection(targetX, targetY);
        if (alt !== dir) {
          moved = alt.dx !== 0
            ? this._moveX(alt.dx, step, half, size, world)
            : this._moveY(alt.dy, step, half, size, world);
        }
      }

      if (moved) {
        this.direction = dir.angle;
        this.stuckTimer = 0.5;
      } else {
        this.stuckTimer -= dt;
        if (this.stuckTimer <= 0) {
          this.stuckTimer = 0.7;
          this.rerouteTimer = 0.6;
          this.rerouteDir = ALL_DIRECTIONS[Math.floor(Math.random() * ALL_DIRECTIONS.length)];
        }
      }
    }
    this.rerouteTimer = Math.max(0, this.rerouteTimer - dt);

    // 射手坦克开火
    if (
      this.type === 'shooter' &&
      dist <= this.config.range + 30 &&
      this.fireTimer <= 0
    ) {
      world.fireEnemyBullet(this);
      this.fireTimer = this.config.shootCooldown;
    }
  }

  _moveX(dirX, step, half, size, world, ignorePlayer = false) {
    const nx = this.x + dirX * step;
    if (world.isBlocked(nx - half, this.y - half, size, size, this, ignorePlayer)) return false;
    this.x = nx;
    return true;
  }

  _moveY(dirY, step, half, size, world, ignorePlayer = false) {
    const ny = this.y + dirY * step;
    if (world.isBlocked(this.x - half, ny - half, size, size, this, ignorePlayer)) return false;
    this.y = ny;
    return true;
  }

  applySlow(duration) {
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  ignite(dps, duration) {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTimer = Math.max(this.burnTimer, duration);
  }
}
