const MAX_PARTICLES = 320;

/**
 * 像素粒子系统：每个粒子是一个小方块（fillRect），
 * 位置取整保证像素锐利；带生命、速度、重力与拖拽。
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.pool = []; // 对象池：死亡粒子回收复用，避免频繁 GC
    this.spawnCount = 0; // 累计生成数（QA/统计用）
  }

  get count() {
    return this.particles.length;
  }

  spawn(p) {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.spawnCount += 1;
    const q = this.pool.pop() ?? {};
    q.x = p.x;
    q.y = p.y;
    q.vx = p.vx ?? 0;
    q.vy = p.vy ?? 0;
    q.life = p.life;
    q.maxLife = p.life;
    q.size = p.size ?? 2;
    q.color = p.color;
    q.gravity = p.gravity ?? 0;
    q.drag = p.drag ?? 0;
    this.particles.push(q);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        if (this.pool.length < MAX_PARTICLES) this.pool.push(p);
        continue;
      }
      if (p.drag > 0) {
        const damp = Math.max(0, 1 - p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const ratio = Math.max(0, Math.min(1, p.life / p.maxLife));
      const size = Math.max(1, Math.round(p.size * (0.5 + ratio * 0.5)));
      ctx.globalAlpha = ratio;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }
}

function burst(particles, x, y, count, colors, opts = {}) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (opts.speedMin ?? 30) + Math.random() * (opts.speedMax ?? 90);
    particles.spawn({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: (opts.lifeMin ?? 0.25) + Math.random() * (opts.lifeMax ?? 0.35),
      size: (opts.sizeMin ?? 2) + Math.random() * (opts.sizeMax ?? 2),
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: opts.gravity ?? 0,
      drag: opts.drag ?? 0,
    });
  }
}

/** 爆炸：彩色火球 + 烟尘 */
export function explosionBurst(particles, x, y, scale = 1) {
  burst(particles, x, y, Math.round(16 * scale), ['#ffd24a', '#ff9a3d', '#ff6b35', '#e8e2c8'], {
    speedMin: 40 * scale,
    speedMax: 130 * scale,
    lifeMin: 0.25,
    lifeMax: 0.5,
    sizeMin: 2,
    sizeMax: 3 + scale,
    drag: 2.5,
  });
  burst(particles, x, y, Math.round(5 * scale), ['#3a3a3a', '#555'], {
    speedMin: 10 * scale,
    speedMax: 35 * scale,
    lifeMin: 0.5,
    lifeMax: 0.9,
    sizeMin: 3,
    sizeMax: 5,
    gravity: -30,
    drag: 1.2,
  });
}

/** 砖块碎裂：棕色碎屑，带重力落地 */
export function brickDebris(particles, x, y) {
  burst(particles, x, y, 10, ['#a1583a', '#8f4c31', '#7a4028', '#5a2e1d'], {
    speedMin: 40,
    speedMax: 115,
    lifeMin: 0.35,
    lifeMax: 0.65,
    sizeMin: 2,
    sizeMax: 3,
    gravity: 220,
    drag: 1.4,
  });
}

/** 枪口火花：向后坐力方向喷射的短命亮点 */
export function muzzleFlash(particles, x, y, angle) {
  const back = angle + Math.PI;
  for (let i = 0; i < 5; i += 1) {
    const a = back + (Math.random() - 0.5) * 0.9;
    const speed = 50 + Math.random() * 80;
    particles.spawn({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.08 + Math.random() * 0.1,
      size: 2,
      color: ['#fff3b0', '#ffe9a8', '#ffd24a'][Math.floor(Math.random() * 3)],
      drag: 3,
    });
  }
  // 枪口闪点
  particles.spawn({ x, y, vx: 0, vy: 0, life: 0.06, size: 4, color: '#fff3b0' });
}

/** 命中火花（敌人/玩家受击） */
export function hitSpark(particles, x, y, color = '#ffd24a') {
  burst(particles, x, y, 6, [color, '#fff3b0'], {
    speedMin: 40,
    speedMax: 100,
    lifeMin: 0.12,
    lifeMax: 0.22,
    sizeMin: 1,
    sizeMax: 2,
    drag: 3,
  });
}

/** 燃烧余烬：橙色小点上飘 */
export function ember(particles, x, y) {
  particles.spawn({
    x: x + (Math.random() - 0.5) * 12,
    y,
    vx: (Math.random() - 0.5) * 16,
    vy: -24 - Math.random() * 30,
    life: 0.3 + Math.random() * 0.3,
    size: 2,
    color: Math.random() < 0.5 ? '#ff9a3d' : '#ff6b35',
    gravity: -20,
    drag: 1,
  });
}

/** Boss 出场：大范围爆裂 + 黑色烟柱 */
export function bossEntranceBurst(particles, x, y) {
  burst(particles, x, y, 34, ['#ffd24a', '#ff9a3d', '#ff6b35', '#c04a3a', '#e8e2c8'], {
    speedMin: 50,
    speedMax: 170,
    lifeMin: 0.35,
    lifeMax: 0.7,
    sizeMin: 2,
    sizeMax: 4,
    drag: 2,
  });
  burst(particles, x, y, 10, ['#222', '#333'], {
    speedMin: 12,
    speedMax: 40,
    lifeMin: 0.6,
    lifeMax: 1.1,
    sizeMin: 3,
    sizeMax: 6,
    gravity: -40,
    drag: 1,
  });
}
