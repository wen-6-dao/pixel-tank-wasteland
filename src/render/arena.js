import { CONFIG } from '../config.js';

export function drawArena(ctx) {
  const { canvasWidth: W, canvasHeight: H } = CONFIG;

  // 背景
  ctx.fillStyle = '#0d110b';
  ctx.fillRect(0, 0, W, H);

  // 辅助网格（32px 一格，非常淡）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 32; x < W; x += 32) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 32; y < H; y += 32) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();
}
