export const CONFIG = Object.freeze({
  canvasWidth: 640,
  canvasHeight: 360,

  // 固定逻辑时间步长：物理/输入更新以 60Hz 步进，渲染频率独立
  fixedTimestep: 1 / 60,
  // 单帧最大累积时间，防止后台切回时出现“死亡螺旋”
  maxFrameTime: 0.25,

  arena: {
    margin: 12, // 仅用于画布边框装饰（地图外圈钢墙承担实际阻挡）
  },

  map: {
    tileSize: 16,
    cols: 40,
    rows: 20,
    spawn: { x: 72, y: 278 },
    spawnSafe: { col: 2, row: 14, w: 5, h: 5 },
    base: { col: 20, row: 18 },
    baseSafe: { col: 17, row: 15, w: 7, h: 4 },
  },

  bullet: {
    poolCapacity: 64,
    playerSpeed: 200, // 像素/秒
    enemySpeed: 150,
    enemyDamage: 10,
    radius: 3,
    muzzleOffset: 14,
  },

  enemy: {
    spawnPoints: [
      { x: 56, y: 56 },
      { x: 328, y: 56 },
      { x: 584, y: 56 },
      { x: 584, y: 264 },
    ],
    types: {
      // 普通坦克：中速追击，血量 2（让伤害升级可见）
      normal: { hp: 2, speed: 40, shootCooldown: 0, xp: 10 },
      // 快速坦克：高速追击，不射击
      fast: { hp: 1, speed: 90, shootCooldown: 0, xp: 15 },
      // 射手坦克：保持距离并远程射击
      shooter: { hp: 4, speed: 30, shootCooldown: 1.6, xp: 25, range: 150, minRange: 90 },
    },
  },

  wave: {
    baseCount: 3,
    perWave: 2,
    maxCount: 24,
    firstSpawnDelay: 0.7,
    spawnIntervalStart: 0.9,
    spawnIntervalMin: 0.45,
  },

  pickup: {
    ttl: 8,
    collectRadius: 22,
  },

  boss: {
    everyNWaves: 5,
    baseHp: 120,
    hpPerArea: 60,
    hpAreaQuad: 30,
    speed: 26,
    chargeSpeed: 120,
    chargeDuration: 0.7,
    chargeWindup: 0.4,        // 冲锋前白闪预警
    chargeStun: 1.2,          // 命中玩家眩晕时长
    chargeDamage: 15,
    chargeSelfStun: 0.6,      // 撞墙自晕
    patternInterval: 2.6,
    patternIntervalPhase2: 1.8,
    enrageThreshold: 0.3,     // 残血暴走阈值
    enragePatternInterval: 1.0,
    enrageBulletDamage: 22,
    enrageChargeInterval: 2.5,
    enragePhase2Fire: 0.55,
    bulletDamage: 15,
    minionCap: 4,
    xpGems: 4,       // 死亡掉落经验宝石数量（每区域 +1）
    xpGemValue: 30,
    itemDrops: 2,
    shieldBase: 30,
    shieldPerArea: 15,
    shieldDuration: 3,
    shieldCooldown: 6,
    burnZoneDps: 8,
    burnZoneTtl: 1,
    burnZoneRadius: 14,
  },

  // 普通敌人血量随波次增长：base × (1 + 0.10(w-1) + 0.06(w-1)^1.5)
  enemyScale: {
    linear: 0.1,
    quad: 0.06,
  },

  player: {
    startX: 72,
    startY: 278,
    startDirection: -Math.PI / 2, // 初始朝上
    speed: 60,                    // 像素/秒（约 3.75 格/秒）
    pixelSize: 1,                 // 坦克 13×13 像素 = 0.8 个瓦片
    spriteSize: 13,
    // —— 肉鸽属性（升级可叠加）——
    maxHp: 100,
    armor: 0,
    regen: 0,
    damage: 1,
    cooldown: 0.3,
    multishot: 1,
    pierce: 0,
    explosion: 0,
    critChance: 0,
    critMult: 2,
    freezeChance: 0,
    burnDps: 0,
    bulletSpeedMult: 0,
    freezeDuration: 2,   // 秒
    burnDuration: 3,     // 秒
    multishotSpread: 0.09, // 多重射击相邻子弹夹角（弧度）
    invulnTime: 0.4,     // 受击后无敌时间（秒）
  },
});
