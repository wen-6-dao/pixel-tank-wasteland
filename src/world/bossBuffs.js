/**
 * Boss 肉鸽 Buff 池：Boss 生成时按区域抽取随机增益。
 * 区域 1 抽 1 个，区域 3 抽 2 个，区域 5 起抽 3 个（上限）。
 * 效果通过 hasBuff(id) 在 Boss 更新/伤害结算中读取。
 */
export const BOSS_BUFFS = [
  {
    id: 'armor',
    name: '铁壁',
    desc: '每 8 秒获得 2 层免伤',
    apply(boss) {
      boss.armorLayers = 2;
      boss.armorTimer = 8;
    },
  },
  {
    id: 'bulletHell',
    name: '弹幕强化',
    desc: '弹幕数量 +50%，弹速 +20%',
    apply(boss) {
      boss.patternMult = 1.5;
      boss.bulletSpeedMult = 1.2;
    },
  },
  {
    id: 'lifesteal',
    name: '嗜血',
    desc: '造成伤害的 30% 转化为回血',
    apply(boss) {
      boss.lifesteal = 0.3;
    },
  },
  {
    id: 'phase',
    name: '相位',
    desc: '每 10 秒无敌 1.5 秒（0.5 秒预警）',
    apply(boss) {
      boss.phaseTimer = 10;
    },
  },
  {
    id: 'summoner',
    name: '召唤大师',
    desc: '小兵升级为快速型，上限 +2',
    apply(boss) {
      boss.summoner = true;
    },
  },
  {
    id: 'thorns',
    name: '荆棘',
    desc: '15% 概率反弹玩家子弹',
    apply(boss) {
      boss.thorns = 0.15;
    },
  },
  {
    id: 'haste',
    name: '极速',
    desc: '攻击模式间隔 -25%',
    apply(boss) {
      boss.haste = true;
    },
  },
  {
    id: 'aura',
    name: '狂暴光环',
    desc: '100px 内小兵移速 +50%',
    apply(boss) {
      boss.aura = true;
    },
  },
  {
    id: 'colossus',
    name: '巨人',
    desc: '生命 +25%，移速 -15%',
    apply(boss) {
      boss.maxHp = Math.round(boss.maxHp * 1.25);
      boss.hp = boss.maxHp;
      boss.speed *= 0.85;
    },
  },
];

// 互斥组合，避免出现无法反制的组合
const EXCLUSIONS = [
  ['phase', 'thorns'],
  ['haste', 'bulletHell'],
  ['colossus', 'aura'],
];

export function drawBossBuffs(area, random = Math.random) {
  const count = area >= 5 ? 3 : area >= 3 ? 2 : 1;
  const picked = [];
  const pool = BOSS_BUFFS.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (const candidate of pool) {
    if (picked.length >= count) break;
    const conflict = EXCLUSIONS.some(
      ([a, b]) =>
        (candidate.id === a && picked.some((p) => p.id === b)) ||
        (candidate.id === b && picked.some((p) => p.id === a)),
    );
    if (!conflict) picked.push(candidate);
  }
  return picked;
}
