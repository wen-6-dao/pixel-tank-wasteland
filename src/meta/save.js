/**
 * 局外成长（Meta）：
 * - 永久升级：用每局结算的金币购买，开局自动生效；
 * - localStorage 持久化最高分、金币与永久升级。
 */
export const META_UPGRADES = [
  { id: 'damage', name: '初始伤害', desc: '开局伤害 +0.5', max: 4, cost: (lvl) => 30 + lvl * 30, apply(p) { p.damage += 0.5; } },
  { id: 'hp', name: '初始生命', desc: '最大生命 +20（并回复）', max: 5, cost: (lvl) => 25 + lvl * 25, apply(p) { p.maxHp += 20; p.hp += 20; } },
  { id: 'cooldown', name: '初始射速', desc: '射击冷却 -0.03s（下限 0.12s）', max: 4, cost: (lvl) => 40 + lvl * 40, apply(p) { p.cooldown = Math.max(0.12, p.cooldown - 0.03); } },
  { id: 'armor', name: '开局护甲', desc: '护甲 +1', max: 3, cost: (lvl) => 50 + lvl * 50, apply(p) { p.armor += 1; } },
  { id: 'greed', name: '财富加成', desc: '局末金币 +25%', max: 4, cost: (lvl) => 60 + lvl * 60, apply(p) { /* 结算时读取层数 */ } },
  { id: 'multishot', name: '初始多重', desc: '开局多重射击 +1', max: 1, cost: () => 200, apply(p) { p.multishot += 1; } },
];

export const DEFAULT_SAVE = {
  bestScore: 0,
  coins: 0,
  meta: {},
  musicOn: true,
  musicVolume: 0.55,
};

export function loadSave() {
  try {
    const raw = localStorage.getItem('tank-battle-save');
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const s = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_SAVE),
      ...s,
      meta: { ...structuredClone(DEFAULT_SAVE.meta), ...(s.meta ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function saveGame(save) {
  try {
    localStorage.setItem('tank-battle-save', JSON.stringify(save));
  } catch {
    // 隐私模式等场景下静默失败
  }
}

export function metaLevel(save, id) {
  return save.meta[id] ?? 0;
}

export function metaCost(def, level) {
  return def.cost(level);
}

/** 开局应用所有已购买的永久升级 */
export function applyMeta(player, save) {
  for (const def of META_UPGRADES) {
    const lvl = metaLevel(save, def.id);
    for (let i = 0; i < lvl; i += 1) def.apply(player);
  }
}

/** 局末金币加成倍率（财富加成） */
export function coinMultiplier(save) {
  return 1 + 0.25 * metaLevel(save, 'greed');
}
