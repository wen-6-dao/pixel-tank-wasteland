import { CONFIG } from '../config.js';
import { Bullet } from '../entities/bullet.js';

/**
 * 子弹对象池：预分配 capacity 颗子弹，环形游标查找空闲对象，
 * 避免频繁创建/销毁对象造成的 GC 抖动。
 */
export class BulletPool {
  constructor(capacity = CONFIG.bullet.poolCapacity) {
    this.capacity = capacity;
    this.pool = Array.from({ length: capacity }, () => new Bullet());
    this.active = new Set();
    this.cursor = 0;
  }

  fire(props) {
    for (let i = 0; i < this.capacity; i += 1) {
      const bullet = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.capacity;
      if (!bullet.active) {
        bullet.reset(props);
        bullet.active = true;
        this.active.add(bullet);
        return bullet;
      }
    }
    return null; // 池已满
  }

  /** 移动所有激活子弹并回收因撞墙/出界而死亡的子弹 */
  update(dt, map, onBrick = null) {
    for (const bullet of [...this.active]) {
      bullet.update(dt, map, onBrick);
      if (!bullet.alive) this.release(bullet);
    }
  }

  release(bullet) {
    bullet.active = false;
    bullet.alive = false;
    this.active.delete(bullet);
  }

  draw(ctx) {
    for (const bullet of this.active) bullet.draw(ctx);
  }
}
