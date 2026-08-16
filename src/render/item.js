/** Boss 掉落道具：彩色菱形 + 白色中心，区别于经验宝石 */
export function drawItem(ctx, item) {
  const pulse = Math.floor(item.age * 3) % 2 === 0 ? 0 : 1;
  const x = Math.round(item.x) - 5;
  const y = Math.round(item.y) - 5 + pulse;

  ctx.fillStyle = item.type.color;
  ctx.fillRect(x + 4, y, 2, 2);
  ctx.fillRect(x + 2, y + 2, 6, 2);
  ctx.fillRect(x + 4, y + 4, 2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 3, y + 2, 4, 2);
  ctx.fillStyle = '#10130f';
  ctx.fillRect(x + 4, y + 2, 2, 2);
}
