/**
 * 像素块坦克：
 * TANK_BODY 是一张 13×13 的字符画，每个字符对应一个像素块，
 * 按 player.pixelSize 放大后用 fillRect 逐块绘制。
 *
 * 渲染分两层：
 * - 车身：朝向锁定 0/90/180/270 度，严格对齐像素网格；
 * - 炮塔 + 炮管：随瞄准角任意旋转（鼠标瞄准），炮塔座压在车身上。
 */

const PALETTES = {
  player: { t: '#2f3438', T: '#454c52', h: '#3f4a35', H: '#56654b', b: '#2b3327', y: '#c9a227' },
  normal: { t: '#3a3730', T: '#504c40', h: '#6b6135', H: '#7f7442', b: '#4a4428', y: '#d8c55a' },
  fast: { t: '#2f3638', T: '#465054', h: '#2f5568', H: '#3f6f86', b: '#223f4d', y: '#7fd4e8' },
  shooter: { t: '#3a3030', T: '#504040', h: '#6b3434', H: '#7f4343', b: '#4a2323', y: '#f0d28c' },
  boss: { t: '#3a2f2f', T: '#554040', h: '#5b2c2c', H: '#733838', b: '#3b1c1c', y: '#e8c93f' },
  bossEnraged: { t: '#4a2020', T: '#6b2b2b', h: '#8a1f1f', H: '#a52828', b: '#5a1212', y: '#ffd24a' },
};

export function getTankPalette(key = 'player') {
  return PALETTES[key] ?? PALETTES.player;
}

const TANK_BODY = [
  'ttttttttttttt',
  'tHHHHHHHHHHHt',
  'tHHHHHHHHHHHt',
  'tHhhbbbbhhhHt',
  'tHhhbyybhhhHt',
  'tHhhbTTbhhhHt',
  'tHhhhTThhhhHt',
  'tHhhhbbhhhHt',
  'tHhhhbbhhhHt',
  'tHhhhhhhhhhHt',
  'tHHHHHHHHHHHt',
  'tHHHHHHHHHHHt',
  'ttttttttttttt',
];

const BARREL_COLOR = '#22262b';
const BARREL_LENGTH = 6; // 炮管像素长度（超出车体部分）

export function drawTank(ctx, tank, alpha = 1, options = {}) {
  const palette = options.palette ?? getTankPalette('player');
  const bodyAngle = options.bodyAngle ?? tank.direction;
  const turretAngle = options.turretAngle ?? tank.turretAngle ?? bodyAngle;
  const pos = tank.interpolatedPosition?.(alpha) ?? { x: tank.x, y: tank.y };
  const x = Math.round(pos.x);
  const y = Math.round(pos.y);
  const ps = tank.pixelSize;
  const half = TANK_BODY.length / 2;

  // 车身（四方向旋转，像素对齐）
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bodyAngle + Math.PI / 2);
  TANK_BODY.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) {
      const color = palette[row[c]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((c - half) * ps, (r - half) * ps, ps, ps);
    }
  });
  ctx.restore();

  // 炮塔 + 炮管（任意瞄准角）
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turretAngle + Math.PI / 2);
  // 炮管：2 像素宽，从车体上缘向上延伸
  ctx.fillStyle = BARREL_COLOR;
  for (let k = 0; k < BARREL_LENGTH; k += 1) {
    const by = -(half + k) * ps;
    ctx.fillRect(-ps, by, ps, ps);
    ctx.fillRect(0, by, ps, ps);
  }
  // 炮塔座：压在炮管根部与车身上，随瞄准旋转
  ctx.fillStyle = palette.T;
  ctx.fillRect(-2 * ps, -2 * ps, 4 * ps, 4 * ps);
  ctx.fillStyle = palette.y;
  ctx.fillRect(-ps, -ps, 2 * ps, 2 * ps);
  ctx.restore();
}
