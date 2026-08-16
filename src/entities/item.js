import { CONFIG } from '../config.js';

export const ITEM_TYPES = [
  { id: 'heal', name: '急救包', color: '#7fae4f', desc: '回复 40 生命', apply(p) { p.hp = Math.min(p.maxHp, p.hp + 40); } },
  { id: 'shield', name: '能量护盾', color: '#7fd4e8', desc: '3 秒无敌', apply(p) { p.invulnTimer = Math.max(p.invulnTimer, 3); } },
  { id: 'clear', name: '清屏炸弹', color: '#e8c93f', desc: '消灭所有普通敌人并清除敌方子弹', apply(p, world) { world.clearField(); } },
  { id: 'rage', name: '狂暴', color: '#c04a3a', desc: '8 秒内伤害 ×2', apply(p) { p.damageBoostTimer = Math.max(p.damageBoostTimer, 8); } },
];

/** Boss 掉落的道具，触碰拾取后立即生效 */
export class Item {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.ttl = 15;
    this.age = 0;
    this.alive = true;
    this.isItem = true;
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
      this.type.apply(player, world);
      this.alive = false;
      if (onCollect) onCollect(this);
    }
  }
}
