import { CONFIG } from '../config.js';
import { TILE } from '../world/map.js';

const SIZE = CONFIG.map.tileSize;

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

function createSprite(pixelFn) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const [r, g, b] = pixelFn(x, y);
      const i = (y * SIZE + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// 砖墙：两排错缝红砖，深色砂浆
const MORTAR = hex('#2c1f17');
const BRICK_A = hex('#a1583a');
const BRICK_B = hex('#8f4c31');
const brickPixel = (x, y) => {
  const band = y >> 2;
  if (y % 4 === 3) return MORTAR;
  const joint = band % 2 === 0 ? 7 : 3;
  if (x === joint || x === joint + 8) return MORTAR;
  return (band + (x >> 3)) % 2 === 0 ? BRICK_A : BRICK_B;
};

// 钢墙：2×2 钢板，接缝暗、中心铆钉
const STEEL_BASE = hex('#aab3ba');
const STEEL_DARK = hex('#8f989f');
const STEEL_LIGHT = hex('#c3cbd1');
const STEEL_RIVET = hex('#5c646b');
const steelPixel = (x, y) => {
  if ((x === 4 && y === 4) || (x === 12 && y === 4) || (x === 4 && y === 12) || (x === 12 && y === 12)) {
    return STEEL_RIVET;
  }
  if (x % 8 === 0 || y % 8 === 0) return STEEL_DARK;
  if (x % 8 === 7 || y % 8 === 7) return STEEL_LIGHT;
  return STEEL_BASE;
};

// 草丛：绿色底 + 深浅草点
const GRASS_BASE = hex('#274a20');
const GRASS_LIGHT = hex('#2f5a26');
const GRASS_DARK = hex('#1d3a17');
const grassPixel = (x, y) => {
  if ((x * 7 + y * 13) % 5 === 0) return GRASS_LIGHT;
  if ((x * 11 + y * 3) % 7 === 0) return GRASS_DARK;
  return GRASS_BASE;
};

// 水：深蓝底 + 波光
const WATER_BASE = hex('#1d4d6e');
const WATER_WAVE = hex('#2e6b8f');
const WATER_SPARKLE = hex('#7fb6d8');
const waterPixel = (x, y) => {
  const band = x >> 3;
  if (x % 8 >= 2 && x % 8 <= 5 && (y + band) % 8 === 3) return WATER_WAVE;
  if ((x * 5 + y * 7) % 11 === 0) return WATER_SPARKLE;
  return WATER_BASE;
};

// 基地旗帜：灰色基座 + 旗杆 + 红底白星
const ARENA_BG = hex('#0d110b');
const PEDESTAL = hex('#8a8f94');
const PEDESTAL_DARK = hex('#6e7378');
const POLE = hex('#b8bec4');
const FLAG = hex('#c04343');
const FLAG_LIGHT = hex('#d85a5a');
const STAR = hex('#f2efe2');
const basePixel = (x, y) => {
  if (y >= 12) {
    if (x === 0 || x === 15 || y === 15) return PEDESTAL_DARK;
    if ((x + y) % 4 === 0) return PEDESTAL_DARK;
    return PEDESTAL;
  }
  if ((x === 7 || x === 8) && y >= 2 && y <= 10) return POLE;
  if (y >= 2 && y <= 6 && x >= 9 && x <= 14) {
    if (x === 11 && y === 4) return STAR;
    if (y === 2 || x === 9) return FLAG_LIGHT;
    return FLAG;
  }
  return ARENA_BG;
};

let cache = null;

export function getTileSprites() {
  if (!cache) {
    cache = {
      [TILE.BRICK]: createSprite(brickPixel),
      [TILE.STEEL]: createSprite(steelPixel),
      [TILE.GRASS]: createSprite(grassPixel),
      [TILE.WATER]: createSprite(waterPixel),
      [TILE.BASE]: createSprite(basePixel),
    };
  }
  return cache;
}
