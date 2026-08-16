import { CONFIG } from '../config.js';
import { TILE } from '../world/map.js';
import { getTileSprites } from './tileSprites.js';

/**
 * 分两层绘制地图：
 * - 'terrain'：砖墙、钢墙、水、基地（绘制在坦克与子弹之下）
 * - 'grass'：草丛（绘制在坦克与子弹之上，实现经典“隐蔽”效果）
 */
export function drawMap(ctx, map, layer = 'terrain') {
  const sprites = getTileSprites();
  const { tileSize, cols, rows } = CONFIG.map;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const t = map.get(c, r);
      if ((t === TILE.GRASS) !== (layer === 'grass')) continue;
      const sprite = sprites[t];
      if (!sprite) continue;
      ctx.drawImage(sprite, c * tileSize, r * tileSize);
    }
  }
}
