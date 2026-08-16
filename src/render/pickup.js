/** 经验宝石：菱形像素块，轻微闪烁 */
export function drawPickup(ctx, pickup) {
  const pulse = Math.floor(pickup.age * 4) % 2 === 0 ? 0 : 1;
  const x = Math.round(pickup.x) - 4;
  const y = Math.round(pickup.y) - 4 + pulse;

  ctx.fillStyle = '#e8c93f';
  ctx.fillRect(x + 3, y, 2, 2);
  ctx.fillRect(x + 2, y + 2, 4, 2);
  ctx.fillRect(x + 3, y + 4, 2, 2);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(x + 2, y + 2, 2, 2);
}
