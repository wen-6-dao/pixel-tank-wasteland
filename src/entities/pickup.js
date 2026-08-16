import { CONFIG } from '../config.js';

/** 敌人死亡掉落的经验宝石，玩家碰到即拾取 */
export class Pickup {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.ttl = CONFIG.pickup.ttl;
    this.age = 0;
    this.alive = true;
  }

  update(dt, player, world, onCollect = null) {
    this.age += dt;
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.alive = false;
      return;
    }
    const half = (CONFIG.player.spriteSize * player.pixelSize) / 2;
    if (Math.hypot(player.x - this.x, player.y - this.y) < CONFIG.pickup.collectRadius + half) {
      player.xp += this.value;
      this.alive = false;
      if (onCollect) onCollect(this);
    }
  }
}
