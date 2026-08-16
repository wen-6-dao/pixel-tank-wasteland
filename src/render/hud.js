import { CONFIG } from '../config.js';

export function drawHUD(ctx, player, fps, map, bulletPool, wave, enemiesAlive, boss, area, areaBannerTimer, muted, musicOn, score) {
  const { canvasWidth: W, canvasHeight: H } = CONFIG;
  const degrees = Math.round(((player.direction * 180) / Math.PI + 360) % 360);

  ctx.save();
  ctx.font = '10px "Courier New", ui-monospace, monospace';
  ctx.textBaseline = 'top';

  // 底部操作提示条
  ctx.fillStyle = 'rgba(8, 11, 7, 0.72)';
  ctx.fillRect(0, H - 22, W, 22);
  ctx.fillStyle = '#9fb08a';
  ctx.fillText(
    `WASD 移动   Space 射击   M ${muted ? '🔇' : '🔊'}   B 音乐 ${musicOn ? '♪' : '✕'}   R 重开`,
    10,
    H - 15,
  );

  // 顶部状态
  ctx.fillStyle = 'rgba(8, 11, 7, 0.72)';
  ctx.fillRect(0, 0, W, 20);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#c9d4b8';
  ctx.fillText('像素坦克 · 废土突围', 10, 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9fb08a';
  ctx.fillText(
    `得分:${score} 区:${area} 波:${wave.wave} 敌:${wave.remainingToSpawn + enemiesAlive} XP:${player.xp} seed:${map.seed}`,
    W - 10,
    4,
  );

  // 生命条 + 护甲 + 狂暴
  const barW = 120;
  const barH = 8;
  const bx = 10;
  const by = 24;
  ctx.fillStyle = '#1a1f16';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#3a2a22';
  ctx.fillRect(bx, by, barW, barH);
  const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
  ctx.fillStyle = hpRatio > 0.35 ? '#7fae4f' : '#c04a3a';
  ctx.fillRect(bx, by, Math.round(barW * hpRatio), barH);
  ctx.fillStyle = '#c9d4b8';
  ctx.fillText(
    `HP ${Math.ceil(player.hp)}/${player.maxHp}${player.armor > 0 ? `  甲${player.armor}` : ''}${player.damageBoostTimer > 0 ? '  狂暴!' : ''}${player.stunTimer > 0 ? `  眩晕 ${player.stunTimer.toFixed(1)}s` : ''}`,
    bx,
    by + barH + 11,
  );

  // Boss 血条
  if (boss) {
    const bw = 280;
    const bh = 10;
    const bbx = (W - bw) / 2;
    const bby = 26;

    // Boss 肉鸽 Buff 标签
    if (boss.buffs.length > 0) {
      ctx.fillStyle = '#e8c93f';
      ctx.font = '9px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`增益: ${boss.buffs.map((b) => b.name).join(' ')}`, W / 2, bby - 10);
      ctx.textAlign = 'right';
      ctx.font = '10px "Courier New", ui-monospace, monospace';
    }

    // 护盾条
    if (boss.shield > 0) {
      ctx.fillStyle = 'rgba(8, 11, 7, 0.78)';
      ctx.fillRect(bbx - 2, bby - 8, bw + 4, 6);
      ctx.fillStyle = '#14313f';
      ctx.fillRect(bbx, bby - 6, bw, 4);
      ctx.fillStyle = '#7fd4e8';
      ctx.fillRect(bbx, bby - 6, Math.round(bw * Math.min(1, boss.shield / 60)), 4);
    }

    ctx.fillStyle = 'rgba(8, 11, 7, 0.78)';
    ctx.fillRect(bbx - 2, bby - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#3a1212';
    ctx.fillRect(bbx, bby, bw, bh);
    const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    ctx.fillStyle = '#c04a3a';
    ctx.fillRect(bbx, bby, Math.round(bw * ratio), bh);
    ctx.fillStyle = '#e8c93f';
    ctx.textAlign = 'center';
    ctx.fillText(
      `BOSS ${Math.ceil(boss.hp)}/${boss.maxHp}${boss.enraged ? '  ·  暴走中' : boss.phase2 ? '  ·  强化' : ''}`,
      W / 2,
      bby + bh + 4,
    );
    ctx.textAlign = 'right';
  }

  // Boss 暴走预警
  if (boss?.enrageWarning > 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pulse = Math.floor(boss.enrageWarning * 10) % 2 === 0 ? 1 : 0.45;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#c04a3a';
    ctx.font = 'bold 16px "Courier New", ui-monospace, monospace';
    ctx.fillText('⚠ BOSS 暴走预警', W / 2, H / 2 - 2);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '10px "Courier New", ui-monospace, monospace';
  }

  // 波次横幅（Boss 波特殊文案）
  if (wave.bannerTimer > 0) {
    const isBossWave = wave.wave % CONFIG.boss.everyNWaves === 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = Math.min(1, wave.bannerTimer / 0.5);
    ctx.fillStyle = isBossWave ? '#c04a3a' : '#e8c93f';
    ctx.font = `bold ${isBossWave ? 22 : 18}px "Courier New", ui-monospace, monospace`;
    ctx.fillText(isBossWave ? `⚠ BOSS 来袭 · 第 ${wave.wave} 波` : `第 ${wave.wave} 波`, W / 2, H / 2 - 24);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '10px "Courier New", ui-monospace, monospace';
  }

  // 区域横幅
  if (areaBannerTimer > 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = Math.min(1, areaBannerTimer / 0.5);
    ctx.fillStyle = '#7fd4e8';
    ctx.font = 'bold 20px "Courier New", ui-monospace, monospace';
    ctx.fillText(`已进入区域 ${area}`, W / 2, H / 2 + 8);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '10px "Courier New", ui-monospace, monospace';
  }

  ctx.restore();
}
