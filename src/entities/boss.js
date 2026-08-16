import { CONFIG } from '../config.js';
import { Enemy } from './enemy.js';
import { primaryDirection } from './directions.js';
import { drawBossBuffs } from '../world/bossBuffs.js';

/**
 * Boss：每 5 波出现，2 倍尺寸重型坦克。
 * 机制：
 * - 肉鸽 Buff（按区域随机 1~3 个）；
 * - 强化（50% 血）→ 暴走（30% 血，预警 1 秒）：攻速/伤害/冲锋大幅提升，冲锋留下燃烧轨迹；
 * - 护盾：每损失 25% 生命触发一次（DoT 穿盾）；
 * - 冲锋：0.4 秒蓄力预警，命中玩家眩晕 1.2 秒，撞墙自晕 0.6 秒。
 */
export class Boss extends Enemy {
  constructor(x, y, area = 1, random = Math.random) {
    super('normal', x, y);
    this.isBoss = true;
    this.type = 'boss';
    this.pixelSize = 2;
    this.area = area;
    this.maxHp =
      CONFIG.boss.baseHp +
      (area - 1) * CONFIG.boss.hpPerArea +
      (area - 1) ** 2 * CONFIG.boss.hpAreaQuad;
    this.hp = this.maxHp;
    this.config = { hp: this.maxHp, speed: CONFIG.boss.speed, xp: 0, shootCooldown: 0 };
    this.speed = CONFIG.boss.speed;

    // —— 肉鸽 Buff（默认值）——
    this.patternMult = 1;
    this.bulletSpeedMult = 1;
    this.lifesteal = 0;
    this.armorLayers = 0;
    this.armorTimer = 0;
    this.phaseTimer = 0;
    this.phased = false;
    this.phaseWarning = false;
    this.summoner = false;
    this.thorns = 0;
    this.haste = false;
    this.aura = false;
    this.buffs = drawBossBuffs(area, random);
    for (const buff of this.buffs) buff.apply(this);

    // —— 护盾 ——
    this.shield = 0;
    this.shieldTimer = 0;
    this.shieldCooldownTimer = 0;
    this.shieldChunksTriggered = 0;

    // —— 暴走 ——
    this.enrageTriggered = false;
    this.enraged = false;
    this.enrageWarning = 0;

    // —— 冲锋 / 眩晕 ——
    this.chargeWindup = 0;
    this.chargeHitDone = false;
    this.bossStun = 0;
    this.trailSpawnTimer = 0;

    // —— 阶段与模式 ——
    this.phase2 = false;
    this.patternTimer = 2.2;
    this.patternIndex = 2;
    this.chargeTimer = 0;
    this.nextChargeTimer = 5;
    this.phase2FireTimer = 0.9;
    this.fireTimer = Infinity;
  }

  hasBuff(id) {
    return this.buffs.some((b) => b.id === id);
  }

  update(dt, world) {
    this.prevX = this.x;
    this.prevY = this.y;

    // 燃烧 DoT（穿透护盾）
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.hp -= this.burnDps * dt;
    }
    if (this.slowTimer > 0) this.slowTimer -= dt;

    // 铁壁层数回复
    if (this.armorTimer > 0) {
      this.armorTimer -= dt;
      if (this.armorTimer <= 0) {
        this.armorLayers = 2;
        this.armorTimer = 8;
      }
    }

    // 相位：10 秒循环，最后 1.5 秒无敌（2~1.5 秒间预警）
    if (this.phaseTimer > 0) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.phaseTimer = 10;
    }
    this.phased = this.phaseTimer > 0 && this.phaseTimer <= 1.5;
    this.phaseWarning = this.phaseTimer > 1.5 && this.phaseTimer <= 2;

    // 护盾
    if (this.shield > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shield = 0;
        this.shieldCooldownTimer = CONFIG.boss.shieldCooldown;
      }
    } else if (this.shieldCooldownTimer > 0) {
      this.shieldCooldownTimer -= dt;
    }
    const chunk = Math.floor((1 - this.hp / this.maxHp) / 0.25);
    if (chunk > this.shieldChunksTriggered && this.shield <= 0 && this.shieldCooldownTimer <= 0) {
      this.shieldChunksTriggered = chunk;
      this.shield = CONFIG.boss.shieldBase + this.area * CONFIG.boss.shieldPerArea;
      this.shieldTimer = CONFIG.boss.shieldDuration;
    }

    // 暴走：30% 阈值，1 秒预警后生效
    if (!this.enrageTriggered && this.hp <= this.maxHp * CONFIG.boss.enrageThreshold) {
      this.enrageTriggered = true;
      this.enrageWarning = 1.0;
    }
    if (this.enrageWarning > 0) {
      this.enrageWarning -= dt;
      if (this.enrageWarning <= 0) this.enraged = true;
    }

    const { player } = world;
    const tx = player.x - this.x;
    const ty = player.y - this.y;
    this.turretAngle = Math.atan2(ty, tx);

    // 强化阶段（50%）
    if (!this.phase2 && this.hp <= this.maxHp * 0.5) {
      this.phase2 = true;
      this.chargeWindup = CONFIG.boss.chargeWindup; // 立即冲锋一次
    }
    if (this.phase2) {
      this.nextChargeTimer -= dt;
      if (this.nextChargeTimer <= 0 && this.chargeTimer <= 0 && this.chargeWindup <= 0) {
        this.chargeWindup = CONFIG.boss.chargeWindup;
        this.nextChargeTimer = this.enraged ? CONFIG.boss.enrageChargeInterval : 5;
      }
    }

    // Boss 自晕（撞墙）期间不行动
    if (this.bossStun > 0) {
      this.bossStun -= dt;
      return;
    }

    const half = this.halfSize;
    const size = half * 2;

    // 冲锋蓄力（白闪预警，不移动）
    if (this.chargeWindup > 0) {
      this.chargeWindup -= dt;
      if (this.chargeWindup <= 0) {
        this.chargeTimer = CONFIG.boss.chargeDuration;
        this.chargeHitDone = false;
        this.trailSpawnTimer = 0;
      }
    } else if (this.chargeTimer > 0) {
      this.chargeTimer -= dt;
      const step = CONFIG.boss.chargeSpeed * dt;
      // 冲锋可以撞进玩家判定（ignorePlayer），否则永远无法命中眩晕
      const movedX = this._moveX(Math.sign(tx) || 1, step, half, size, world, true);
      const movedY = this._moveY(Math.sign(ty) || 1, step, half, size, world, true);
      if (movedX) this.direction = tx >= 0 ? 0 : Math.PI;
      else if (movedY) this.direction = ty >= 0 ? Math.PI / 2 : -Math.PI / 2;
      if (!movedX && !movedY) {
        // 撞墙自晕
        this.chargeTimer = 0;
        this.bossStun = CONFIG.boss.chargeSelfStun;
      }
      if (!this.chargeHitDone && world.chargeHitPlayer?.(this)) this.chargeHitDone = true;
      // 暴走燃烧轨迹
      if (this.enraged) {
        this.trailSpawnTimer -= dt;
        if (this.trailSpawnTimer <= 0) {
          world.spawnBurnZone?.(this.x, this.y);
          this.trailSpawnTimer = 0.12;
        }
      }
    } else {
      // 缓慢追击
      const dir = primaryDirection(tx, ty);
      const step = this.speed * dt;
      if (dir.dx !== 0) this._moveX(dir.dx, step, half, size, world);
      else this._moveY(dir.dy, step, half, size, world);
      this.direction = dir.angle;
    }

    // 攻击模式轮换
    this.patternTimer -= dt;
    if (this.patternTimer <= 0) {
      let interval = this.phase2 ? CONFIG.boss.patternIntervalPhase2 : CONFIG.boss.patternInterval;
      if (this.haste) interval *= 0.75;
      if (this.enraged) interval = CONFIG.boss.enragePatternInterval;
      this.patternTimer = interval;
      this.patternIndex = (this.patternIndex + 1) % 3;
      if (this.patternIndex === 0) this._spread(world);
      else if (this.patternIndex === 1) this._ring(world);
      else if (this.enraged) this._ring(world); // 暴走不再召唤，改为环形弹幕
      else this._summon(world);
    }

    // 强化/暴走额外快速射击
    if (this.phase2) {
      this.phase2FireTimer -= dt;
      if (this.phase2FireTimer <= 0) {
        world.fireEnemyBullet(
          this,
          this.turretAngle,
          this.enraged ? CONFIG.boss.enrageBulletDamage : CONFIG.boss.bulletDamage,
        );
        this.phase2FireTimer = this.enraged ? CONFIG.boss.enragePhase2Fire : 0.9;
      }
    }
  }

  _spread(world) {
    const n = Math.round((this.phase2 ? 7 : 5) * this.patternMult);
    const base = this.turretAngle;
    for (let i = 0; i < n; i += 1) {
      const a = base + (i - (n - 1) / 2) * 0.16;
      world.fireEnemyBullet(this, a, CONFIG.boss.bulletDamage);
    }
  }

  _ring(world) {
    const n = Math.round(10 * this.patternMult);
    const offset = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i += 1) {
      world.fireEnemyBullet(this, offset + (i / n) * Math.PI * 2, CONFIG.boss.bulletDamage);
    }
  }

  _summon(world) {
    const count = this.phase2 ? 2 : 1;
    for (let i = 0; i < count; i += 1) world.spawnMinion(this);
  }
}
