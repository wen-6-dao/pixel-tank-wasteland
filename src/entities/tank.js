import { CONFIG } from '../config.js';
import { DIRECTIONS } from './directions.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * 玩家坦克实体。
 * 操控：W/A/S/D（或方向键）直接控制移动方向，坦克朝向跟随。
 * 炮塔：鼠标瞄准（pointer 未激活时跟随车身朝向）。
 * 碰撞：逐轴尝试移动，移动后的包围盒若与实体瓦片/其他坦克重叠则取消该轴位移。
 */
export class Tank {
  constructor(config = {}) {
    const p = CONFIG.player;
    this.x = config.x ?? p.startX;
    this.y = config.y ?? p.startY;
    this.direction = config.direction ?? p.startDirection;
    this.turretAngle = this.direction;
    this.speed = p.speed;
    this.pixelSize = p.pixelSize;
    this.xp = 0;

    // —— 肉鸽属性（三选一升级可叠加）——
    this.upgrades = {};
    this.maxHp = p.maxHp;
    this.hp = p.maxHp;
    this.armor = p.armor;
    this.regen = p.regen;
    this.damage = p.damage;
    this.cooldown = p.cooldown;
    this.multishot = p.multishot;
    this.pierce = p.pierce;
    this.explosion = p.explosion;
    this.critChance = p.critChance;
    this.critMult = p.critMult;
    this.freezeChance = p.freezeChance;
    this.burnDps = p.burnDps;
    this.bulletSpeedMult = p.bulletSpeedMult;
    this.invulnTimer = 0;
    this.damageBoostTimer = 0; // 狂暴道具：期间伤害 ×2
    this.stunTimer = 0; // Boss 冲撞眩晕：期间无法移动与射击

    // 上一次逻辑更新的位置，用于渲染插值
    this.prevX = this.x;
    this.prevY = this.y;
  }

  get halfSize() {
    return (CONFIG.player.spriteSize * this.pixelSize) / 2;
  }

  update(dt, input, world) {
    this.prevX = this.x;
    this.prevY = this.y;
    if (this.stunTimer > 0) this.stunTimer -= dt;

    // 炮塔瞄准鼠标（逻辑坐标），未移动过鼠标则跟随车身
    if (input.pointer.active) {
      this.turretAngle = Math.atan2(input.pointer.y - this.y, input.pointer.x - this.x);
    } else if (input.joy.active) {
      // 触摸模式：自动瞄准最近敌人（无敌人则跟随车身）
      let nearest = null;
      let best = Infinity;
      for (const e of world.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < best) {
          best = d;
          nearest = e;
        }
      }
      this.turretAngle = nearest
        ? Math.atan2(nearest.y - this.y, nearest.x - this.x)
        : this.direction;
    } else {
      this.turretAngle = this.direction;
    }

    // 眩晕期间无法移动
    if (this.stunTimer <= 0) {
      const move = input.getMove();

      if (move) {
        const dir = move.dx !== 0
          ? (move.dx > 0 ? DIRECTIONS.right : DIRECTIONS.left)
          : (move.dy > 0 ? DIRECTIONS.down : DIRECTIONS.up);
        this.direction = dir.angle;
        const half = this.halfSize;
        const size = half * 2;
        const step = this.speed * dt;

        // 先尝试 X 轴，再尝试 Y 轴：贴墙时仍可沿另一轴滑动
        const nextX = this.x + dir.dx * step;
        if (!world.isBlocked(nextX - half, this.y - half, size, size, this)) {
          this.x = nextX;
        }

        const nextY = this.y + dir.dy * step;
        if (!world.isBlocked(this.x - half, nextY - half, size, size, this)) {
          this.y = nextY;
        }
      }
    }

    // 兜底：限制在画布范围内（地图外圈钢墙正常情况下已经阻止越界）
    const half = this.halfSize;
    this.x = clamp(this.x, half, CONFIG.canvasWidth - half);
    this.y = clamp(this.y, half, CONFIG.canvasHeight - half);
  }

  /**
   * alpha 为插值系数：返回两次逻辑更新之间的平滑位置，
   * 并取整到像素格，确保像素块边缘锐利。
   */
  interpolatedPosition(alpha) {
    return {
      x: Math.round(this.prevX + (this.x - this.prevX) * alpha),
      y: Math.round(this.prevY + (this.y - this.prevY) * alpha),
    };
  }

  /** 应用一项升级（记录层数并修改属性，可叠加） */
  applyUpgrade(upgrade) {
    this.upgrades[upgrade.id] = (this.upgrades[upgrade.id] ?? 0) + 1;
    upgrade.apply(this);
  }
}
