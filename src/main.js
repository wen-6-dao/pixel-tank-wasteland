import { CONFIG } from './config.js';
import { createGameLoop } from './core/gameLoop.js';
import { InputManager } from './core/input.js';
import { BulletPool } from './core/bulletPool.js';
import { Tank } from './entities/tank.js';
import { Enemy, rectsOverlap } from './entities/enemy.js';
import { Boss } from './entities/boss.js';
import { Pickup } from './entities/pickup.js';
import { Item, ITEM_TYPES } from './entities/item.js';
import { Map, TILE } from './world/map.js';
import { WaveManager } from './world/wave.js';
import { pickUpgrades, UPGRADES } from './world/upgrades.js';
import { BOSS_BUFFS } from './world/bossBuffs.js';
import { drawArena } from './render/arena.js';
import { drawMap } from './render/map.js';
import { drawTank, getTankPalette } from './render/tank.js';
import { drawPickup } from './render/pickup.js';
import { drawItem } from './render/item.js';
import { drawHUD } from './render/hud.js';
import { ParticleSystem, explosionBurst, brickDebris, muzzleFlash, hitSpark, ember, bossEntranceBurst } from './effects/particles.js';
import { createCamera } from './effects/camera.js';
import { createSfx } from './audio/sfx.js';
import { createMusic } from './audio/music.js';
import {
  META_UPGRADES,
  loadSave,
  saveGame,
  applyMeta,
  metaLevel,
  metaCost,
  coinMultiplier,
} from './meta/save.js';
import { mulberry32, randomSeed } from './core/rng.js';
import qrcode from './vendor/qrcode.mjs';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const input = new InputManager(window, canvas);
input.attach();

const upgradeOverlay = document.getElementById('upgrade-overlay');
const upgradeTitle = document.getElementById('upgrade-title');
const upgradeCards = document.getElementById('upgrade-cards');
const upgradeStats = document.getElementById('upgrade-stats');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverStats = document.getElementById('gameover-stats');
const menuOverlay = document.getElementById('menu-overlay');
const menuBest = document.getElementById('menu-best');
const menuCoins = document.getElementById('menu-coins');
const menuMeta = document.getElementById('menu-meta');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const qrCanvas = document.getElementById('qr-canvas');
const qrUrl = document.getElementById('qr-url');
const qrCopyBtn = document.getElementById('qr-copy');
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
const fireBtn = document.getElementById('fire-btn');
const musicBtn = document.getElementById('music-btn');
const volumeBtn = document.getElementById('volume-btn');
const musicPanel = document.getElementById('music-panel');
const mpToggle = document.getElementById('mp-toggle');
const mpVolume = document.getElementById('mp-volume');
const mpValue = document.getElementById('mp-value');
const rotateBtn = document.getElementById('rotate-btn');
const rotateHint = document.getElementById('rotate-hint');

let save = loadSave();
let music = createMusic();
music.setEnabled(save.musicOn !== false);
music.setVolume(save.musicVolume ?? 0.55);
let runSeed = randomSeed();
let rng = mulberry32(runSeed);
let map = Map.generate(runSeed);
let player = new Tank();
applyMeta(player, save);
const bulletPool = new BulletPool();
let enemies = [];
let pickups = [];
let lastFireAt = 0; // 真实时间冷却（毫秒），避免追帧导致连发
let state = 'menu'; // 'menu' | 'playing' | 'upgrading' | 'gameover'
let area = 1;
let bossDefeated = false;
let areaBannerTimer = 0;
let freezeTimer = 0;
let flashTimer = 0;
let burnZones = [];
let runStats = { kills: 0, bossKills: 0, wavesCleared: 0, upgradesPicked: 0, finalized: false };
const wave = new WaveManager();

const particles = new ParticleSystem();
const camera = createCamera();
const sfx = createSfx();

const game = {
  CONFIG, TILE, map, player, bulletPool, enemies, pickups, wave,
  Tank, Enemy, Boss, Pickup, Item, ITEM_TYPES, BOSS_BUFFS, UPGRADES, world: null, loop: null,
  particles, camera, sfx, music,
  get state() { return state; },
  get area() { return area; },
  get freezeTimer() { return freezeTimer; },
  get flashTimer() { return flashTimer; },
  get burnZones() { return burnZones; },
  get runStats() { return runStats; },
  get score() { return computeScore(); },
  get seed() { return runSeed; },
  save,
  META_UPGRADES,
  Map,
  WaveManager,
  mulberry32,
  input,
};
window.game = game;

// 浏览器要求用户手势后才能发声：每次手势都尝试解锁/修复（幂等，可反复调用）
window.addEventListener('pointerdown', () => {
  sfx.unlock();
  music.unlock();
});
window.addEventListener('keydown', () => {
  sfx.unlock();
  music.unlock();
});
// 从后台切回时自动恢复可能被浏览器挂起的音频上下文
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    sfx.unlock();
    music.unlock();
  }
});

function hideOverlays() {
  upgradeOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
}

/** 重置一局：新地图、新玩家（应用永久升级）、清空战斗状态 */
function resetRun() {
  runSeed = randomSeed();
  rng = mulberry32(runSeed);
  map = Map.generate(runSeed);
  player = new Tank();
  applyMeta(player, save);
  wave.random = rng;
  enemies = [];
  pickups = [];
  lastFireAt = 0;
  burnZones = [];
  freezeTimer = 0;
  flashTimer = 0;
  for (const bullet of [...bulletPool.active]) bulletPool.release(bullet);
  wave.reset();
  area = 1;
  bossDefeated = false;
  areaBannerTimer = 0;
  runStats = { kills: 0, bossKills: 0, wavesCleared: 0, upgradesPicked: 0, finalized: false };
  hideOverlays();
  game.map = map;
  game.player = player;
  game.enemies = enemies;
  game.pickups = pickups;
}

function startRun() {
  resetRun();
  state = 'playing';
  menuOverlay.classList.add('hidden');
}

function goMenu() {
  resetRun();
  state = 'menu';
  menuOverlay.classList.remove('hidden');
  renderMenu();
}

function computeScore() {
  return (
    runStats.kills * 25 +
    runStats.bossKills * 150 +
    runStats.wavesCleared * 100 +
    area * 50 +
    player.xp
  );
}

function computeCoins() {
  return Math.floor((player.xp / 10 + area * 5 + runStats.bossKills * 20) * coinMultiplier(save));
}

/** 结算一次：只执行一次，更新最高分与金币并持久化 */
function finalizeRun() {
  if (runStats.finalized) return;
  runStats.finalized = true;
  const score = computeScore();
  const coins = computeCoins();
  save.coins += coins;
  save.bestScore = Math.max(save.bestScore, score);
  saveGame(save);
  runStats.score = score;
  runStats.coins = coins;
}

function renderMenu() {
  menuBest.textContent = save.bestScore;
  menuCoins.textContent = save.coins;
  renderQr();
  menuMeta.innerHTML = '';
  for (const def of META_UPGRADES) {
    const lvl = metaLevel(save, def.id);
    const maxed = lvl >= def.max;
    const cost = metaCost(def, lvl);
    const row = document.createElement('div');
    row.className = 'meta-row';
    const info = document.createElement('div');
    info.className = 'meta-info';
    info.innerHTML = `<span class="meta-name">${def.name}</span><div class="meta-desc">${def.desc}</div>`;
    const lvlEl = document.createElement('span');
    lvlEl.className = 'meta-lvl';
    lvlEl.textContent = maxed ? 'MAX' : `Lv.${lvl}`;
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.textContent = maxed ? '已满级' : `升级 ${cost} 金币`;
    btn.disabled = maxed || save.coins < cost;
    btn.addEventListener('click', () => buyMeta(def));
    row.append(info, lvlEl, btn);
    menuMeta.appendChild(row);
  }
}

/** 通过 WebRTC 探测局域网 IP（本地联机扫码用） */
function discoverLanIp() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ip) => {
      if (done) return;
      done = true;
      try {
        pc.close();
      } catch {
        /* noop */
      }
      resolve(ip);
    };
    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.onicecandidate = (e) => {
        if (!e.candidate) return finish(null);
        const m = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(e.candidate.candidate);
        if (m) finish(m[1]);
      };
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .catch(() => finish(null));
      setTimeout(() => finish(null), 1500);
    } catch {
      finish(null);
    }
  });
}

/** 计算可分享的游玩地址：部署站直接用当前 URL；本机 localhost 尝试转成局域网 IP */
async function computeShareUrl() {
  if (window.location.protocol === 'file:') return null;
  const { hostname, port, pathname, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isLocal) return `${origin}${pathname}`;
  const ip = await discoverLanIp();
  if (ip) return `http://${ip}:${port || 5173}${pathname}`;
  return window.location.href;
}

/** 用内嵌二维码库把分享地址画到 canvas */
function drawQr(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const scale = 4;
  const pad = 14;
  qrCanvas.width = n * scale + pad * 2;
  qrCanvas.height = n * scale + pad * 2;
  const c = qrCanvas.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, qrCanvas.width, qrCanvas.height);
  c.fillStyle = '#000000';
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (qr.isDark(x, y)) c.fillRect(pad + x * scale, pad + y * scale, scale, scale);
    }
  }
}

async function renderQr() {
  const url = await computeShareUrl();
  if (!url) {
    qrUrl.textContent = '离线版不支持扫码';
    return;
  }
  drawQr(url);
  qrUrl.textContent = url;
}

function copyQrUrl() {
  const text = qrUrl.textContent;
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      qrCopyBtn.textContent = '已复制 ✓';
      setTimeout(() => {
        qrCopyBtn.textContent = '复制链接';
      }, 1500);
    });
  }
}

// —— 触摸控件：左侧虚拟摇杆 + 右侧开火按钮 ——
let JOY_R = 64;
let joyOrigin = null;

/** 根据屏幕尺寸调整摇杆与按钮大小（横竖屏切换时调用） */
function applyJoySize() {
  JOY_R = Math.max(52, Math.min(96, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.16)));
  joyBase.style.width = `${JOY_R * 2}px`;
  joyBase.style.height = `${JOY_R * 2}px`;
  joyKnob.style.width = `${Math.round(JOY_R * 0.78)}px`;
  joyKnob.style.height = `${Math.round(JOY_R * 0.78)}px`;
  const knobInset = Math.round(JOY_R * 0.39);
  joyKnob.style.margin = `-${knobInset}px 0 0 -${knobInset}px`;
}

function positionJoy(x, y) {
  joyBase.style.left = `${x}px`;
  joyBase.style.top = `${y}px`;
}

function updateJoy(touch) {
  if (!joyOrigin) return;
  const dx = touch.clientX - joyOrigin.x;
  const dy = touch.clientY - joyOrigin.y;
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  input.setJoystick(dx / JOY_R, dy / JOY_R, Math.hypot(dx, dy) > 8);
}

function endJoy() {
  joyOrigin = null;
  input.setJoystick(0, 0, false);
  joyBase.style.display = 'none';
  joyKnob.style.display = 'none';
}

joyZone.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyOrigin = { x: t.clientX, y: t.clientY };
    joyBase.style.display = 'block';
    joyKnob.style.display = 'block';
    joyKnob.style.transform = 'translate(0px, 0px)';
    positionJoy(joyOrigin.x, joyOrigin.y);
    updateJoy(t);
  },
  { passive: false },
);
joyZone.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault();
    updateJoy(e.changedTouches[0]);
  },
  { passive: false },
);
joyZone.addEventListener('touchend', endJoy);
joyZone.addEventListener('touchcancel', endJoy);

fireBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.setFireHeld(true);
});
fireBtn.addEventListener('pointerup', () => input.setFireHeld(false));
fireBtn.addEventListener('pointercancel', () => input.setFireHeld(false));
qrCopyBtn.addEventListener('click', copyQrUrl);

// —— 背景音乐开关（独立于音效，M 只管音效，B/♪ 只管音乐）——
function syncMusicButton() {
  if (!musicBtn) return;
  musicBtn.textContent = music.enabled ? '♪' : '✕';
  musicBtn.title = music.enabled ? '关闭背景音乐（B）' : '开启背景音乐（B）';
  musicBtn.setAttribute('aria-pressed', String(music.enabled));
  if (mpToggle) {
    mpToggle.textContent = music.enabled ? '♪ 开' : '✕ 关';
    mpToggle.setAttribute('aria-pressed', String(music.enabled));
  }
  if (mpVolume && mpValue) {
    const pct = Math.round(music.volume * 100);
    mpVolume.value = String(pct);
    mpValue.textContent = `${pct}%`;
  }
}

function toggleMusic() {
  music.setEnabled(!music.enabled);
  save.musicOn = music.enabled;
  saveGame(save);
  syncMusicButton();
}

if (musicBtn) {
  musicBtn.addEventListener('click', toggleMusic);
  syncMusicButton();
}

// —— 音量调节面板（⚙ 按钮打开；滑块实时生效并持久化）——
function openMusicPanel() {
  if (!musicPanel) return;
  syncMusicButton();
  musicPanel.classList.remove('hidden');
}

function closeMusicPanel() {
  musicPanel?.classList.add('hidden');
}

if (volumeBtn && musicPanel) {
  volumeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (musicPanel.classList.contains('hidden')) openMusicPanel();
    else closeMusicPanel();
  });
  document.addEventListener('pointerdown', (e) => {
    if (musicPanel.classList.contains('hidden')) return;
    if (e.target === musicPanel || musicPanel.contains(e.target)) return;
    if (e.target === volumeBtn || volumeBtn.contains(e.target)) return;
    closeMusicPanel();
  });
  if (mpToggle) {
    mpToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMusic();
    });
  }
  if (mpVolume) {
    mpVolume.addEventListener('input', () => {
      const v = (Number(mpVolume.value) || 0) / 100;
      music.setVolume(v);
      save.musicVolume = v;
      saveGame(save);
      syncMusicButton();
    });
  }
}

// —— 手机横竖屏切换：全屏 + 锁定横屏（不支持时提示旋转手机）——
function isLandscape() {
  return window.matchMedia('(orientation: landscape)').matches;
}

function syncRotateUi() {
  if (!rotateBtn) return;
  const landscape = isLandscape();
  rotateBtn.textContent = landscape ? '⤡' : '⇄';
  rotateBtn.title = landscape ? '退出全屏 / 恢复竖屏' : '全屏横屏游玩';
  if (rotateHint) {
    rotateHint.textContent = '建议横屏体验：点右上角 ⇄ 全屏横屏；或旋转手机（竖屏亦可游玩）';
  }
  applyJoySize();
}

async function enterLandscape() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement) {
      const rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (rq) await rq.call(el);
    }
  } catch {
    // 浏览器可能拒绝全屏（如 iOS Safari 对普通元素），继续尝试锁屏方向
  }
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch {
    // 不支持锁定时，用户可手动旋转手机
  }
  syncRotateUi();
}

function leaveFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen?.();
  } catch {
    /* noop */
  }
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* noop */
  }
  syncRotateUi();
}

if (rotateBtn) {
  rotateBtn.addEventListener('click', () => {
    if (isLandscape()) leaveFullscreen();
    else enterLandscape();
  });
}
window.addEventListener('orientationchange', syncRotateUi);
window.addEventListener('resize', syncRotateUi);
document.addEventListener('fullscreenchange', syncRotateUi);
syncRotateUi();

function buyMeta(def) {
  const lvl = metaLevel(save, def.id);
  if (lvl >= def.max) return;
  const cost = metaCost(def, lvl);
  if (save.coins < cost) return;
  save.coins -= cost;
  save.meta[def.id] = lvl + 1;
  saveGame(save);
  sfx.upgrade();
  renderMenu();
}

/** 击败 Boss 后进入下一区域：只换地图，保留玩家属性与升级 */
function regenerateMap() {
  // 区域换图：从本局 rng 序列派生子种子，保证整局可复现
  map = Map.generate((rng() * 0x7fffffff) | 0);
  enemies = [];
  pickups = [];
  for (const bullet of [...bulletPool.active]) bulletPool.release(bullet);
  game.map = map;
  game.enemies = enemies;
  game.pickups = pickups;
}

function killEnemy(enemy) {
  if (!enemy.alive) return;
  enemy.alive = false;
  runStats.kills += 1;
  if (enemy.isBoss) {
    runStats.bossKills += 1;
    bossDefeated = true;
    explosionBurst(particles, enemy.x, enemy.y, 2.2);
    camera.addShake(13, 0.7);
    freezeTimer = Math.max(freezeTimer, 0.25);
    flashTimer = 0.35;
    sfx.explosion(true);
    const gems = CONFIG.boss.xpGems + Math.floor(area / 2);
    for (let i = 0; i < gems; i += 1) {
      pickups.push(
        new Pickup(
          enemy.x + (i - (gems - 1) / 2) * 16,
          enemy.y - 12 + Math.floor(i / 3) * 12,
          CONFIG.boss.xpGemValue,
        ),
      );
    }
    const shuffled = [...ITEM_TYPES];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 0; i < CONFIG.boss.itemDrops; i += 1) {
      pickups.push(new Item(enemy.x + (i % 2 === 0 ? -20 : 20), enemy.y + 16, shuffled[i]));
    }
  } else {
    explosionBurst(particles, enemy.x, enemy.y, 0.7);
    camera.addShake(3, 0.15);
    sfx.enemyDie();
    pickups.push(new Pickup(enemy.x, enemy.y, enemy.config.xp));
  }
}

/** 普通敌人血量随波次增长曲线 */
function waveHpScale() {
  const w = wave.wave - 1;
  return 1 + CONFIG.enemyScale.linear * w + CONFIG.enemyScale.quad * w ** 1.5;
}

/** 爆炸：范围伤害敌人 + 破坏半径内砖墙 */
function explode(x, y, radius, damage) {
  const { tileSize } = CONFIG.map;
  const c0 = Math.max(0, Math.floor((x - radius) / tileSize));
  const c1 = Math.min(CONFIG.map.cols - 1, Math.floor((x + radius) / tileSize));
  const r0 = Math.max(0, Math.floor((y - radius) / tileSize));
  const r1 = Math.min(CONFIG.map.rows - 1, Math.floor((y + radius) / tileSize));
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const cx = c * tileSize + tileSize / 2;
      const cy = r * tileSize + tileSize / 2;
      if (map.get(c, r) === TILE.BRICK && Math.hypot(cx - x, cy - y) <= radius) {
        map.destroyBrick(c, r);
      }
    }
  }
  for (const e of enemies) {
    if (!e.alive) continue;
    if (Math.hypot(e.x - x, e.y - y) <= radius) {
      e.hp -= damage;
      if (e.hp <= 0) killEnemy(e);
    }
  }
  explosionBurst(particles, x, y, Math.min(1.8, 0.35 + radius / 40));
  camera.addShake(Math.min(10, 3 + radius / 8), 0.25);
  freezeTimer = Math.max(freezeTimer, 0.08);
  flashTimer = Math.max(flashTimer, 0.14);
  sfx.explosion(radius > 60);
}

function showUpgradeChoice() {
  state = 'upgrading';
  upgradeTitle.textContent = bossDefeated
    ? `Boss 击败！第 ${wave.wave} 波完成`
    : `第 ${wave.wave} 波完成！`;
  const p = player;
  upgradeStats.textContent =
    `伤害 ${p.damage.toFixed(2)} · 冷却 ${p.cooldown.toFixed(2)}s · 多重 ${p.multishot}` +
    ` · 穿透 ${p.pierce} · 爆炸 ${p.explosion}px · 暴击 ${Math.round(p.critChance * 100)}%` +
    ` · 护甲 ${p.armor} · 生命 ${p.maxHp}`;
  const choices = pickUpgrades(player, 3);
  upgradeCards.innerHTML = '';
  for (const u of choices) {
    const card = document.createElement('button');
    card.className = 'upgrade-card';
    card.dataset.id = u.id;
    const stacks = player.upgrades[u.id] ?? 0;
    const title = document.createElement('span');
    title.className = 'icon';
    title.textContent = u.icon;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = u.name;
    const desc = document.createElement('span');
    desc.className = 'desc';
    desc.textContent = u.desc;
    const stack = document.createElement('span');
    stack.className = 'stack';
    stack.textContent = stacks > 0 ? `已选 ×${stacks}` : '新升级';
    card.append(title, name, desc, stack);
    card.addEventListener('click', () => {
      player.applyUpgrade(u);
      runStats.upgradesPicked += 1;
      runStats.wavesCleared += 1;
      sfx.upgrade();
      upgradeOverlay.classList.add('hidden');
      if (bossDefeated) {
        area += 1;
        regenerateMap(); // 进入下一区域，地图重新随机生成
        bossDefeated = false;
        areaBannerTimer = 2.4;
      }
      wave.advance();
      state = 'playing';
    });
    upgradeCards.appendChild(card);
  }
  upgradeOverlay.classList.remove('hidden');
}

function gameOver() {
  state = 'gameover';
  finalizeRun();
  gameoverStats.innerHTML =
    `区域 ${area} · 第 ${wave.wave} 波<br>` +
    `击杀 <b>${runStats.kills}</b>（Boss <b>${runStats.bossKills}</b>） · 升级 ${runStats.upgradesPicked} 项<br>` +
    `累计经验 ${player.xp} · 得分 <b>${runStats.score}</b><br>` +
    `+ 金币 <b>${runStats.coins}</b> · 最高分 <b>${save.bestScore}</b>`;
  gameoverOverlay.classList.remove('hidden');
}

const world = {
  get player() {
    return player;
  },
  get map() {
    return map;
  },
  get enemies() {
    return enemies;
  },
  isBlocked(x, y, w, h, self, ignorePlayer = false) {
    const half = player.halfSize;
    const hitMap = map.rectCollides(x, y, w, h);
    const hitPlayer =
      !ignorePlayer &&
      self !== player &&
      rectsOverlap(x, y, w, h, player.x - half, player.y - half, half * 2, half * 2);
    const hitEnemy = enemies.some(
      (e) =>
        e !== self &&
        e.alive &&
        rectsOverlap(x, y, w, h, e.x - e.halfSize, e.y - e.halfSize, e.halfSize * 2, e.halfSize * 2),
    );
    return hitMap || hitPlayer || hitEnemy;
  },
  fireEnemyBullet(enemy, angle = enemy.turretAngle, damage = CONFIG.bullet.enemyDamage) {
    bulletPool.fire({
      x: enemy.x + Math.cos(angle) * CONFIG.bullet.muzzleOffset,
      y: enemy.y + Math.sin(angle) * CONFIG.bullet.muzzleOffset,
      direction: angle,
      speed: CONFIG.bullet.enemySpeed * (enemy.bulletSpeedMult ?? 1),
      owner: 'enemy',
      damage,
      source: enemy,
    });
  },
  spawnEnemy(point) {
    const type = wave.queue[wave.queue.length - 1];
    if (type === 'boss') {
      enemies.push(new Boss(point.x, point.y, area, rng));
      bossEntranceBurst(particles, point.x, point.y);
      camera.addShake(9, 0.6);
      freezeTimer = Math.max(freezeTimer, 0.08);
      flashTimer = Math.max(flashTimer, 0.22);
      sfx.boss();
    } else {
      const enemy = new Enemy(type, point.x, point.y);
      enemy.hp = Math.max(1, Math.round(enemy.hp * waveHpScale()));
      enemies.push(enemy);
    }
  },
  /** Boss 召唤小兵：在 Boss 周围找空地放置普通坦克 */
  spawnMinion(boss) {
    const minions = enemies.filter((e) => e.alive && e.isMinion);
    const cap = CONFIG.boss.minionCap + (boss.summoner ? 2 : 0);
    if (minions.length >= cap) return;
    // 小兵是 13px 坦克，半径 6.5（不能用 Boss 的 13px 判定，否则 Boss 身边永远“被占”）
    const half = (CONFIG.player.spriteSize * CONFIG.player.pixelSize) / 2;
    const offsets = [[24, 0], [-24, 0], [0, 24], [0, -24], [28, 28], [-28, -28]];
    for (const [ox, oy] of offsets) {
      const x = boss.x + ox;
      const y = boss.y + oy;
      if (map.rectCollides(x - half, y - half, half * 2, half * 2)) continue;
      if (Math.hypot(player.x - x, player.y - y) < 30) continue;
      if (enemies.some((e) => e.alive && Math.hypot(e.x - x, e.y - y) < half * 2)) continue;
      const minion = new Enemy(boss.summoner ? 'fast' : 'normal', x, y);
      minion.isMinion = true;
      minion.hp = Math.max(1, Math.round(minion.hp * waveHpScale()));
      enemies.push(minion);
      return;
    }
  },

  /** Boss 冲锋命中玩家：眩晕 + 伤害（能量护盾/无敌期间免疫） */
  chargeHitPlayer(boss) {
    const half = player.halfSize;
    const bh = boss.halfSize;
    if (
      !rectsOverlap(
        boss.x - bh,
        boss.y - bh,
        bh * 2,
        bh * 2,
        player.x - half,
        player.y - half,
        half * 2,
        half * 2,
      )
    ) {
      return false;
    }
    if (player.invulnTimer <= 0) {
      const dmg = Math.max(1, CONFIG.boss.chargeDamage - player.armor);
      player.hp -= dmg;
      player.stunTimer = Math.max(player.stunTimer, CONFIG.boss.chargeStun);
      player.invulnTimer = CONFIG.player.invulnTime;
      hitSpark(particles, player.x, player.y, '#c04a3a');
      camera.addShake(8, 0.3);
      freezeTimer = Math.max(freezeTimer, 0.14);
      sfx.hurt();
      if (player.hp <= 0) {
        player.hp = 0;
        gameOver();
      }
    }
    return true;
  },

  /** 暴走冲锋的燃烧轨迹 */
  spawnBurnZone(x, y) {
    burnZones.push({ x, y, ttl: CONFIG.boss.burnZoneTtl });
  },
  /** 清屏道具：消灭所有普通敌人并清除敌方子弹 */
  clearField() {
    for (const e of enemies) {
      if (!e.isBoss && e.alive) e.alive = false;
    }
    for (const bullet of [...bulletPool.active]) {
      if (bullet.owner === 'enemy') bulletPool.release(bullet);
    }
  },
  pickSpawnPoint(half = player.halfSize, minPlayerDist = half * 2 + 8) {
    const free = CONFIG.enemy.spawnPoints.filter((p) => {
      if (map.rectCollides(p.x - half, p.y - half, half * 2, half * 2)) return false;
      if (Math.hypot(player.x - p.x, player.y - p.y) < minPlayerDist) return false;
      return !enemies.some((e) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) < half * 2);
    });
    if (free.length > 0) return free[Math.floor(rng() * free.length)];

    // 兜底：全图扫描找一块空地
    const { tileSize, cols, rows } = CONFIG.map;
    const tiles = [];
    for (let r = 2; r <= rows - 3; r += 1) {
      for (let c = 2; c <= cols - 3; c += 1) tiles.push([c, r]);
    }
    for (let i = tiles.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    for (const [c, r] of tiles) {
      const px = c * tileSize + tileSize / 2;
      const py = r * tileSize + tileSize / 2;
      if (map.rectCollides(px - half, py - half, half * 2, half * 2)) continue;
      if (Math.hypot(player.x - px, player.y - py) < minPlayerDist) continue;
      if (enemies.some((e) => e.alive && Math.hypot(e.x - px, e.y - py) < half * 2)) continue;
      return { x: px, y: py };
    }
    return null;
  },
  enemiesAlive() {
    return enemies.filter((e) => e.alive).length;
  },
};

game.world = world;

const loop = createGameLoop({
  update: (dt) => {
    if (state === 'menu') {
      if (input.consumePressed('KeyM')) sfx.toggleMuted();
      if (input.consumePressed('KeyB')) toggleMusic();
      return;
    }

    if (state === 'upgrading') {
      if (input.consumePressed('KeyM')) sfx.toggleMuted();
      if (input.consumePressed('KeyB')) toggleMusic();
      return;
    }

    if (state === 'gameover') {
      if (input.consumePressed('KeyR')) startRun();
      if (input.consumePressed('KeyB')) toggleMusic();
      return;
    }

    camera.update(dt);
    if (flashTimer > 0) flashTimer -= dt;

    // 冻结帧（命中停顿）：暂停世界更新，渲染继续
    if (freezeTimer > 0) {
      freezeTimer -= dt;
      return;
    }

    if (input.consumePressed('KeyM')) sfx.toggleMuted();
    if (input.consumePressed('KeyB')) toggleMusic();

    areaBannerTimer = Math.max(0, areaBannerTimer - dt);
    player.update(dt, input, world);
    if (player.invulnTimer > 0) player.invulnTimer -= dt;
    if (player.damageBoostTimer > 0) player.damageBoostTimer -= dt;
    if (player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);
    }

    // 玩家射击（多重射击齐射，狂暴期间伤害 ×2）
    if (
      (input.isDown('Space') || input.isDown('MouseLeft') || input.touchFire) &&
      performance.now() - lastFireAt >= player.cooldown * 1000 &&
      player.stunTimer <= 0
    ) {
      const base = player.turretAngle;
      const shotDamage = player.damage * (player.damageBoostTimer > 0 ? 2 : 1);
      const muzzleX = player.x + Math.cos(base) * CONFIG.bullet.muzzleOffset;
      const muzzleY = player.y + Math.sin(base) * CONFIG.bullet.muzzleOffset;
      sfx.shoot();
      muzzleFlash(particles, muzzleX, muzzleY, base);
      for (let i = 0; i < player.multishot; i += 1) {
        const spread = (i - (player.multishot - 1) / 2) * CONFIG.player.multishotSpread;
        bulletPool.fire({
          x: muzzleX,
          y: muzzleY,
          direction: base + spread,
          speed: CONFIG.bullet.playerSpeed * (1 + player.bulletSpeedMult),
          owner: 'player',
          damage: shotDamage,
          pierce: player.pierce,
          explosion: player.explosion,
          freezeChance: player.freezeChance,
          burnDps: player.burnDps,
          critChance: player.critChance,
          critMult: player.critMult,
        });
      }
      lastFireAt = performance.now();
    }

    for (const enemy of enemies) {
      if (enemy.alive) enemy.update(dt, world);
    }
    for (const enemy of enemies) {
      if (enemy.alive && enemy.hp <= 0) killEnemy(enemy);
    }

    // Boss 狂暴光环：100px 内小兵加速
    const auraBoss = enemies.find((e) => e.isBoss && e.alive && e.hasBuff('aura'));
    for (const e of enemies) {
      e.auraBoost = !!(
        auraBoss &&
        e.isMinion &&
        e.alive &&
        Math.hypot(auraBoss.x - e.x, auraBoss.y - e.y) < 100
      );
    }

    for (const enemy of enemies) {
      // 燃烧中的敌人飘出余烬
      if (enemy.alive && enemy.burnTimer > 0 && Math.random() < dt * 8) {
        ember(particles, enemy.x, enemy.y - enemy.halfSize);
      }
      // 暴走 Boss 红色气场
      if (enemy.isBoss && enemy.alive && enemy.enraged && Math.random() < dt * 12) {
        ember(particles, enemy.x + (Math.random() - 0.5) * 20, enemy.y - enemy.halfSize);
      }
    }
    bulletPool.update(dt, map, (col, row) => {
      const cx = col * CONFIG.map.tileSize + CONFIG.map.tileSize / 2;
      const cy = row * CONFIG.map.tileSize + CONFIG.map.tileSize / 2;
      brickDebris(particles, cx, cy);
      camera.addShake(2, 0.12);
      sfx.brick();
    });

    // 玩家子弹 vs 敌人（穿透/冰冻/燃烧/爆炸/暴击）
    for (const bullet of [...bulletPool.active]) {
      if (bullet.owner !== 'player') continue;
      for (const enemy of enemies) {
        if (!enemy.alive || bullet.hitSet.has(enemy)) continue;
        const half = enemy.halfSize;
        if (
          rectsOverlap(
            bullet.x - bullet.radius,
            bullet.y - bullet.radius,
            bullet.radius * 2,
            bullet.radius * 2,
            enemy.x - half,
            enemy.y - half,
            half * 2,
            half * 2,
          )
        ) {
          // Boss 相位：无敌期间子弹直接穿过
          if (enemy.isBoss && enemy.hasBuff('phase') && enemy.phased) continue;
          // Boss 铁壁：消耗免伤层
          if (enemy.isBoss && enemy.hasBuff('armor') && enemy.armorLayers > 0) {
            enemy.armorLayers -= 1;
            bulletPool.release(bullet);
            break;
          }
          // Boss 荆棘：概率反弹子弹
          if (enemy.isBoss && enemy.hasBuff('thorns') && Math.random() < enemy.thorns) {
            world.fireEnemyBullet(
              enemy,
              Math.atan2(player.y - enemy.y, player.x - enemy.x),
              10,
            );
            bulletPool.release(bullet);
            break;
          }
          // Boss 护盾：吸收伤害（燃烧 DoT 穿透）
          if (enemy.isBoss && enemy.shield > 0) {
            enemy.shield = Math.max(0, enemy.shield - bullet.damage);
            bulletPool.release(bullet);
            break;
          }
          bullet.hitSet.add(enemy);
          const isCrit = Math.random() < bullet.critChance;
          const dmg = bullet.damage * (isCrit ? bullet.critMult : 1);
          enemy.hp -= dmg;
          if (bullet.freezeChance > 0 && Math.random() < bullet.freezeChance) {
            enemy.applySlow(CONFIG.player.freezeDuration);
          }
          if (bullet.burnDps > 0) enemy.ignite(bullet.burnDps, CONFIG.player.burnDuration);
          if (bullet.explosion > 0) explode(bullet.x, bullet.y, bullet.explosion, bullet.damage);
          if (bullet.pierce > 0) bullet.pierce -= 1;
          else bulletPool.release(bullet);
          if (enemy.hp <= 0) killEnemy(enemy);
          break;
        }
      }
    }

    // 敌方子弹 vs 玩家（护甲减免，受击后短暂无敌）
    for (const bullet of [...bulletPool.active]) {
      if (bullet.owner !== 'enemy') continue;
      const half = player.halfSize;
      if (
        rectsOverlap(
          bullet.x - bullet.radius,
          bullet.y - bullet.radius,
          bullet.radius * 2,
          bullet.radius * 2,
          player.x - half,
          player.y - half,
          half * 2,
          half * 2,
        )
      ) {
        const dmg = Math.max(1, bullet.damage - player.armor);
        if (player.invulnTimer <= 0) {
          player.hp -= dmg;
          player.invulnTimer = CONFIG.player.invulnTime;
          // Boss 嗜血：造成伤害的 30% 回血
          if (bullet.source?.isBoss && bullet.source.alive && bullet.source.lifesteal > 0) {
            bullet.source.hp = Math.min(
              bullet.source.maxHp,
              bullet.source.hp + dmg * bullet.source.lifesteal,
            );
          }
          hitSpark(particles, player.x, player.y, '#c04a3a');
          camera.addShake(6, 0.25);
          freezeTimer = Math.max(freezeTimer, 0.12);
          sfx.hurt();
          if (player.hp <= 0) {
            player.hp = 0;
            gameOver();
          }
        }
        bulletPool.release(bullet);
      }
    }

    enemies = enemies.filter((e) => e.alive);

    // 暴走燃烧轨迹：持续伤害
    for (const zone of burnZones) zone.ttl -= dt;
    burnZones = burnZones.filter((z) => z.ttl > 0);
    if (burnZones.length > 0 && player.invulnTimer <= 0) {
      let zoneDps = 0;
      for (const zone of burnZones) {
        if (
          Math.hypot(zone.x - player.x, zone.y - player.y) <
          CONFIG.boss.burnZoneRadius + player.halfSize
        ) {
          zoneDps += Math.max(0, CONFIG.boss.burnZoneDps - player.armor);
        }
      }
      if (zoneDps > 0) {
        player.hp -= zoneDps * dt;
        if (player.hp <= 0) {
          player.hp = 0;
          gameOver();
        }
      }
    }

    for (const pickup of pickups) {
      pickup.update(dt, player, world, () => sfx.pickup());
    }
    pickups = pickups.filter((p) => p.alive);

    particles.update(dt);

    wave.update(dt, world);
    game.enemies = enemies;
    game.pickups = pickups;
    game.map = map;
    game.player = player;

    if (input.consumePressed('KeyR')) startRun();

    // 波次清空 → 暂停并弹出三选一升级
    if (wave.isCleared(world)) showUpgradeChoice();
  },
  render: (alpha) => {
    const shake = camera.offset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    drawArena(ctx);
    drawMap(ctx, map, 'terrain');
    bulletPool.draw(ctx);
    for (const enemy of enemies) {
      if (enemy.isBoss && enemy.bossStun > 0 && Math.floor(enemy.bossStun * 20) % 2 === 0) {
        continue; // 撞墙自晕闪烁
      }
      if (enemy.isBoss && enemy.phased && Math.floor(enemy.phaseTimer * 20) % 2 === 0) {
        continue; // 相位无敌闪烁
      }
      const paletteKey = enemy.isBoss && enemy.enraged ? 'bossEnraged' : enemy.type;
      drawTank(ctx, enemy, alpha, {
        palette: getTankPalette(paletteKey),
        bodyAngle: enemy.direction,
        turretAngle: enemy.turretAngle,
      });
      if (enemy.isBoss) {
        const ex = Math.round(enemy.x);
        const ey = Math.round(enemy.y);
        if (enemy.shield > 0) {
          ctx.strokeStyle = 'rgba(127, 212, 232, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ex, ey, enemy.halfSize + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (enemy.chargeWindup > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.fillRect(ex - enemy.halfSize, ey - enemy.halfSize, enemy.halfSize * 2, enemy.halfSize * 2);
        }
      }
    }
    const stunBlink = player.stunTimer > 0 && Math.floor(player.stunTimer * 20) % 2 === 0;
    const invulnBlink = player.invulnTimer > 0 && Math.floor(player.invulnTimer * 24) % 2 === 0;
    const playerVisible = !stunBlink && !invulnBlink;
    if (playerVisible) drawTank(ctx, player, alpha);
    for (const pickup of pickups) {
      if (pickup.isItem) drawItem(ctx, pickup);
      else drawPickup(ctx, pickup);
    }
    drawMap(ctx, map, 'grass');
    // 暴走燃烧轨迹
    for (const zone of burnZones) {
      ctx.fillStyle =
        Math.floor(zone.ttl * 12) % 2 === 0
          ? 'rgba(255, 106, 53, 0.75)'
          : 'rgba(255, 154, 61, 0.85)';
      ctx.fillRect(Math.round(zone.x - 7), Math.round(zone.y - 7), 14, 14);
    }
    particles.draw(ctx);
    ctx.restore();

    // 爆炸/受击白闪
    if (flashTimer > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.32, flashTimer * 0.7)})`;
      ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    }

    const boss = enemies.find((e) => e.isBoss && e.alive);
    drawHUD(
      ctx,
      player,
      loop.stats.fps,
      map,
      bulletPool,
      wave,
      enemies.filter((e) => e.alive).length,
      boss,
      area,
      areaBannerTimer,
      sfx.muted,
      music.enabled,
      computeScore(),
    );
  },
});

game.loop = loop;
loop.start();

// 菜单按钮
startBtn.addEventListener('click', () => {
  sfx.unlock();
  music.unlock();
  startRun();
});
restartBtn.addEventListener('click', () => {
  sfx.unlock();
  music.unlock();
  startRun();
});
menuBtn.addEventListener('click', () => {
  sfx.unlock();
  music.unlock();
  goMenu();
});
renderMenu();

window.addEventListener('pagehide', () => {
  loop.stop();
  input.detach();
});
