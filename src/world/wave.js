import { CONFIG } from '../config.js';

function buildQueue(wave, random) {
  if (wave % CONFIG.boss.everyNWaves === 0) return ['boss'];

  const count = Math.min(
    CONFIG.wave.baseCount + (wave - 1) * CONFIG.wave.perWave,
    CONFIG.wave.maxCount,
  );
  const queue = [];
  for (let i = 0; i < count; i += 1) {
    const roll = random();
    if (wave === 1) {
      // 第一波不安排射手，让玩家先熟悉操作
      queue.push(roll < 0.5 ? 'normal' : 'fast');
    } else if (roll < 0.22) {
      queue.push('shooter');
    } else if (roll < 0.52) {
      queue.push('fast');
    } else {
      queue.push('normal');
    }
  }
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

/**
 * 波次管理：每波敌人数量递增；
 * 队列清空且场上敌人全部消灭后，短暂停顿进入下一波。
 */
export class WaveManager {
  constructor(random = Math.random) {
    this.random = random;
    this.wave = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.bannerTimer = 0;
    this.betweenTimer = 0;
    this.totalThisWave = 0;
  }

  start() {
    this._startNextWave();
  }

  /** 重置回第 1 波（用于 R 换图重开） */
  reset() {
    this.wave = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.bannerTimer = 0;
    this.betweenTimer = 0;
    this.totalThisWave = 0;
    this.start();
  }

  get remainingToSpawn() {
    return this.queue.length;
  }

  /** 当前波次是否已清空（无待生成、无存活敌人） */
  isCleared(world) {
    return this.queue.length === 0 && world.enemiesAlive() === 0;
  }

  /** 进入下一波（由主循环在三选一升级选择后调用） */
  advance() {
    this._startNextWave();
  }

  _startNextWave() {
    this.wave += 1;
    this.queue = buildQueue(this.wave, this.random);
    this.totalThisWave = this.queue.length;
    this.spawnTimer = CONFIG.wave.firstSpawnDelay;
    this.bannerTimer = 2.2;
    this.betweenTimer = 0;
  }

  update(dt, world) {
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);

    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const isBoss = this.queue[this.queue.length - 1] === 'boss';
        const point = isBoss ? world.pickSpawnPoint(13, 100) : world.pickSpawnPoint();
        if (point) {
          world.spawnEnemy(point);
          this.queue.pop();
          this.spawnTimer = Math.max(
            CONFIG.wave.spawnIntervalMin,
            CONFIG.wave.spawnIntervalStart - (this.wave - 1) * 0.05,
          );
        } else {
          this.spawnTimer = 0.25; // 出生点被占，稍后重试
        }
      }
    }
  }
}
