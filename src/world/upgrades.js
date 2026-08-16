/**
 * 三选一升级池（13 种，均可叠加）。
 * apply 直接修改玩家属性；max 为叠加上限。
 */
export const UPGRADES = [
  {
    id: 'damage',
    name: '伤害强化',
    icon: '💥',
    desc: '子弹伤害 +50%，上限 ×4（之后每层 +0.25）',
    max: 10,
    apply(p) {
      // applyUpgrade 已先自增计数，这里直接用当前层数
      const n = p.upgrades.damage ?? 1;
      p.damage = n <= 3 ? 1.5 ** n : 4 + (n - 4) * 0.25;
    },
  },
  {
    id: 'fireRate',
    name: '射速提升',
    icon: '⚡',
    desc: '射击冷却 -20%，下限 0.10 秒',
    max: 10,
    apply(p) {
      p.cooldown = Math.max(0.1, p.cooldown * 0.8);
    },
  },
  { id: 'multishot', name: '多重射击', icon: '🔱', desc: '每次射击额外发射 1 发子弹', max: 6, apply(p) { p.multishot += 1; } },
  { id: 'pierce', name: '穿透弹', icon: '➶', desc: '子弹可多穿透 1 个敌人', max: 6, apply(p) { p.pierce += 1; } },
  {
    id: 'explosion',
    name: '爆炸弹',
    icon: '💣',
    desc: '命中后爆炸，范围 +20px 并破坏砖墙（上限 120px）',
    max: 5,
    apply(p) {
      p.explosion = Math.min(120, p.explosion + 20);
    },
  },
  { id: 'speed', name: '机动性', icon: '🏃', desc: '移动速度 +15%（乘法叠加）', max: 8, apply(p) { p.speed *= 1.15; } },
  { id: 'maxHp', name: '生命提升', icon: '❤️', desc: '最大生命 +30，并立即回复 30 点', max: 10, apply(p) { p.maxHp += 30; p.hp += 30; } },
  { id: 'armor', name: '护甲', icon: '🛡️', desc: '受到的伤害 -2', max: 8, apply(p) { p.armor += 2; } },
  { id: 'regen', name: '生命恢复', icon: '💚', desc: '每秒恢复 2 点生命', max: 10, apply(p) { p.regen += 2; } },
  { id: 'freeze', name: '冰冻弹', icon: '❄️', desc: '命中后 35% 概率冰冻敌人 2 秒', max: 5, apply(p) { p.freezeChance += 0.35; } },
  { id: 'burn', name: '燃烧弹', icon: '🔥', desc: '命中后点燃敌人，每秒 2 点燃烧伤害', max: 5, apply(p) { p.burnDps += 2; } },
  {
    id: 'crit',
    name: '暴击',
    icon: '🎯',
    desc: '暴击率 +10%（上限 80%），暴击造成 2 倍伤害',
    max: 8,
    apply(p) {
      p.critChance = Math.min(0.8, p.critChance + 0.1);
    },
  },
  { id: 'bulletSpeed', name: '弹速提升', icon: '🚀', desc: '子弹速度 +15%', max: 5, apply(p) { p.bulletSpeedMult += 0.15; } },
];

export function pickUpgrades(player, count = 3) {
  const available = UPGRADES.filter((u) => (player.upgrades[u.id] ?? 0) < u.max);
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}
