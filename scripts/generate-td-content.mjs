/**
 * 塔防内容生成 — 数值曲线参考 Shroom Guard（合成倍率 / 四类蘑菇分工 / 城堡血量 / 入侵英雄波次）
 * 结构保留 Kingdom Rush / Bloons 式伤害类型与波次模板。
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDirs = [
  join(__dirname, '../src/data/td'),
  join(__dirname, '../public/assets/td'),
];

/** Shroom Guard 式合成成长：每合一次约 +82% 伤害（与 Rush Royale 同类） */
const SG = {
  mergeDamageMult: 1.82,
  mergeShieldMult: 1.68,
  mergeRangeMult: 1.07,
  mergeAspdMult: 1.09,
  mergeAoeMult: 1.14,
  hpPerWave: 0.22,
  damagePerWave: 0.2,
  speedPerWave: 0.04,
  rewardPerWave: 0.08,
};

function round(n) {
  return Math.round(n);
}

function buildCombatTiers(base) {
  return [1, 2, 3, 4].map((tier) => {
    const step = tier - 1;
    const tierDef = {
      tier,
      name: base.names[step],
      damage: round(base.damage * SG.mergeDamageMult ** step),
      range: round(base.range * SG.mergeRangeMult ** step),
      attackSpeed: +(base.attackSpeed * SG.mergeAspdMult ** step).toFixed(2),
    };
    if (base.aoeRadius != null) {
      tierDef.aoeRadius = round(base.aoeRadius * SG.mergeAoeMult ** step);
    }
    if (base.chainCount != null) {
      tierDef.chainCount = base.chainCount + step;
    }
    return tierDef;
  });
}

function buildShieldTiers(base) {
  return [1, 2, 3, 4].map((tier) => ({
    tier,
    name: base.names[tier - 1],
    damage: 0,
    range: 0,
    attackSpeed: 0,
    shieldAmount: round(base.shield * SG.mergeShieldMult ** (tier - 1)),
  }));
}

const content = {
  meta: {
    version: '2.1.0',
    referenceGames: ['Shroom Guard', 'Kingdom Rush', 'Bloons TD 6'],
    designNotes:
      '节奏四轨映射：Kick=节拍拳近战 | Snare=毒囊溅射 | Hihat=弧光连锁 | Crash=岩盾护堡；敌人=入侵英雄',
    shroomGuardMapping: {
      towers: {
        kick: '节拍拳 — 近战单体（Kick）',
        snare: '毒囊炮 — 范围毒爆（Snare）',
        hihat: '弧光术 — 弹射连锁（Hi-hat）',
        crash: '岩盾仪 — 城堡护盾（Crash）',
      },
      enemies: {
        goblin: '见习勇者 — 人海',
        grunt: '王国步兵 — 标准',
        fast: '疾风游侠 — 高速',
        assassin: '暗影剑客 — 精英快攻',
        shielder: '圣盾骑士 — 护甲',
        tank: '重装圣骑士 — 重甲',
        healer: '祝福牧师 — 治疗光环',
        flyer: '狮鹫骑士 — 飞行',
        brute: '攻城巨像 — 精英肉盾',
        warlord: '传奇英雄 — Boss',
      },
      balanceRules: [
        '合成每阶约 +82% 塔伤害',
        'T1 塔约 4~6 次击杀标准步兵',
        '漏一只标准兵约扣 4~6 城堡 HP',
        'Boss 需 T3+ 混合阵容 + 合成',
      ],
    },
  },

  defense: {
    core: {
      name: '节拍核心',
      radius: 35,
      description: '入侵英雄抵达核心时扣除城堡 HP',
    },
    grid: {
      size: 6,
      coreCells: [[2, 2], [2, 3], [3, 2], [3, 3]],
    },
    spawn: {
      edges: ['top', 'right', 'bottom', 'left'],
      defaultEdge: 'random',
    },
    scaling: {
      hpPerWave: SG.hpPerWave,
      damagePerWave: SG.damagePerWave,
      speedPerWave: SG.speedPerWave,
      rewardPerWave: SG.rewardPerWave,
    },
    economy: {
      killRewardEnabled: true,
      waveClearBonus: 15,
      sellRefundRatio: 0.55,
      repairCost: 20,
      repairHp: 15,
    },
    armorRules: {
      light: { physical: 0, magic: 0, explosive: 0, chain: 0 },
      armored: { physical: -0.4, magic: 0, explosive: 0.2, chain: 0 },
      flying: { physical: -0.25, magic: 0, explosive: 0, chain: 0.12 },
      boss: { physical: -0.3, magic: -0.15, explosive: -0.1, chain: -0.08 },
    },
  },

  attacks: {
    melee_physical: {
      id: 'melee_physical',
      name: '近战撞击',
      mode: 'melee',
      damageType: 'physical',
      targeting: 'nearest',
      description: '节拍拳 — 单体最近，无法打飞行',
    },
    aoe_explosive: {
      id: 'aoe_explosive',
      name: '毒孢溅射',
      mode: 'aoe',
      damageType: 'explosive',
      targeting: 'nearest_cluster',
      description: '毒囊炮 — 范围伤害，克制护甲',
    },
    chain_magic: {
      id: 'chain_magic',
      name: '闪电连锁',
      mode: 'chain',
      damageType: 'chain',
      targeting: 'nearest_then_chain',
      description: '弧光术 — 弹射多目标，克制飞行',
    },
    shield_barrier: {
      id: 'shield_barrier',
      name: '岩盾护堡',
      mode: 'shield',
      damageType: 'true',
      targeting: 'core',
      description: '岩盾仪 — 战斗前为核心提供护盾',
    },
  },

  towers: {
    kick: {
      family: 'kick',
      role: '节拍拳·近战单体',
      shroomGuardAnalogue: 'Mushroom',
      attackId: 'melee_physical',
      color: 0xe74c3c,
      tiers: buildCombatTiers({
        names: ['节拍拳手', '重音卫士', '铁拳冲锋', '御鼓禁卫'],
        damage: 7,
        range: 72,
        attackSpeed: 1.05,
      }),
    },
    snare: {
      family: 'snare',
      role: '毒囊炮·范围溅射',
      shroomGuardAnalogue: 'Poison Mushroom',
      attackId: 'aoe_explosive',
      color: 0x3498db,
      tiers: buildCombatTiers({
        names: ['毒囊炮手', '爆裂药剂', '腐化投弹', '瘟疫统领'],
        damage: 5,
        range: 92,
        attackSpeed: 0.72,
        aoeRadius: 52,
      }),
    },
    hihat: {
      family: 'hihat',
      role: '弧光术·弹射连锁',
      shroomGuardAnalogue: 'Shroomer / Mage',
      attackId: 'chain_magic',
      color: 0xf1c40f,
      tiers: buildCombatTiers({
        names: ['静电符咒', '弧光术士', '雷暴引者', '天罚雷使'],
        damage: 4,
        range: 108,
        attackSpeed: 1.45,
        chainCount: 3,
      }),
    },
    crash: {
      family: 'crash',
      role: '岩盾仪·核心护盾',
      shroomGuardAnalogue: 'Rock Shroom',
      attackId: 'shield_barrier',
      color: 0x9b59b6,
      tiers: buildShieldTiers({
        names: ['碎石护符', '岩盾结界', '节拍壁垒', '不朽鸣墙'],
        shield: 12,
      }),
    },
  },

  enemies: {
    goblin: {
      type: 'goblin',
      name: '见习勇者',
      hp: 14,
      speed: 100,
      damage: 2,
      reward: 2,
      color: 0x27ae60,
      size: 11,
      armorType: 'light',
      tags: ['ground', 'swarm'],
      shroomGuardAnalogue: 'Hero Swarm',
    },
    grunt: {
      type: 'grunt',
      name: '王国步兵',
      hp: 38,
      speed: 58,
      damage: 4,
      reward: 4,
      color: 0xc0392b,
      size: 16,
      armorType: 'light',
      tags: ['ground', 'swarm'],
      shroomGuardAnalogue: 'Footman',
    },
    fast: {
      type: 'fast',
      name: '疾风游侠',
      hp: 22,
      speed: 118,
      damage: 3,
      reward: 6,
      color: 0xe67e22,
      size: 12,
      armorType: 'light',
      tags: ['ground', 'fast'],
      shroomGuardAnalogue: 'Swift Hero',
    },
    assassin: {
      type: 'assassin',
      name: '暗影剑客',
      hp: 28,
      speed: 145,
      damage: 9,
      reward: 12,
      color: 0x2c3e50,
      size: 13,
      armorType: 'light',
      tags: ['ground', 'fast', 'elite'],
      shroomGuardAnalogue: 'Assassin Hero',
    },
    shielder: {
      type: 'shielder',
      name: '圣盾骑士',
      hp: 95,
      speed: 42,
      damage: 5,
      reward: 8,
      color: 0x95a5a6,
      size: 18,
      armorType: 'armored',
      tags: ['ground', 'armored'],
      shroomGuardAnalogue: 'Shield Hero',
    },
    tank: {
      type: 'tank',
      name: '重装圣骑士',
      hp: 135,
      speed: 32,
      damage: 10,
      reward: 12,
      color: 0x7f8c8d,
      size: 22,
      armorType: 'armored',
      tags: ['ground', 'armored', 'elite'],
      shroomGuardAnalogue: 'Heavy Knight',
    },
    healer: {
      type: 'healer',
      name: '祝福牧师',
      hp: 48,
      speed: 48,
      damage: 3,
      reward: 10,
      color: 0x16a085,
      size: 15,
      armorType: 'light',
      tags: ['ground', 'support'],
      abilities: [{ id: 'heal_aura', radius: 85, amount: 5, intervalMs: 2500 }],
      shroomGuardAnalogue: 'Heal Hero (counter Healshroom)',
    },
    flyer: {
      type: 'flyer',
      name: '狮鹫骑士',
      hp: 32,
      speed: 85,
      damage: 7,
      reward: 9,
      color: 0x8e44ad,
      size: 14,
      armorType: 'flying',
      flying: true,
      tags: ['flying'],
      shroomGuardAnalogue: 'Flying Hero',
    },
    brute: {
      type: 'brute',
      name: '攻城巨像',
      hp: 300,
      speed: 26,
      damage: 16,
      reward: 20,
      color: 0x6c3483,
      size: 26,
      armorType: 'armored',
      tags: ['ground', 'elite'],
      shroomGuardAnalogue: 'Siege Golem',
    },
    warlord: {
      type: 'warlord',
      name: '传奇英雄',
      hp: 1650,
      speed: 20,
      damage: 32,
      reward: 80,
      color: 0x922b21,
      size: 32,
      armorType: 'boss',
      tags: ['ground', 'boss'],
      abilities: [{ id: 'enrage', thresholdHpRatio: 0.35, speedMult: 1.45, damageMult: 1.35 }],
      shroomGuardAnalogue: 'Chapter Boss Hero',
    },
  },

  waveTemplates: {
    tutorial_swarm: {
      id: 'tutorial_swarm',
      name: '勇者先遣',
      delayBefore: 2500,
      threatBudget: 70,
      enemies: [
        { type: 'goblin', count: 10, interval: 650 },
        { type: 'grunt', count: 5, interval: 950 },
      ],
    },
    wolf_rush: {
      id: 'wolf_rush',
      name: '游侠奔袭',
      delayBefore: 1800,
      threatBudget: 85,
      enemies: [{ type: 'fast', count: 9, interval: 700 }],
    },
    shield_wall: {
      id: 'shield_wall',
      name: '盾墙推进',
      delayBefore: 2200,
      threatBudget: 125,
      enemies: [
        { type: 'shielder', count: 3, interval: 2000 },
        { type: 'grunt', count: 7, interval: 850 },
      ],
    },
    sky_assault: {
      id: 'sky_assault',
      name: '狮鹫空袭',
      delayBefore: 2000,
      threatBudget: 110,
      enemies: [
        { type: 'flyer', count: 7, interval: 800 },
        { type: 'fast', count: 5, interval: 600 },
      ],
    },
    shaman_support: {
      id: 'shaman_support',
      name: '牧师支援',
      delayBefore: 2200,
      threatBudget: 145,
      enemies: [
        { type: 'healer', count: 2, interval: 2800 },
        { type: 'tank', count: 2, interval: 3000 },
        { type: 'grunt', count: 8, interval: 750 },
      ],
    },
    shadow_blitz: {
      id: 'shadow_blitz',
      name: '暗影闪击',
      delayBefore: 1400,
      threatBudget: 135,
      enemies: [
        { type: 'assassin', count: 7, interval: 550 },
        { type: 'fast', count: 10, interval: 480 },
      ],
    },
    brute_siege: {
      id: 'brute_siege',
      name: '巨像攻城',
      delayBefore: 2800,
      threatBudget: 185,
      enemies: [
        { type: 'brute', count: 2, interval: 3800 },
        { type: 'shielder', count: 3, interval: 2200 },
        { type: 'flyer', count: 5, interval: 950 },
      ],
    },
    warlord_finale: {
      id: 'warlord_finale',
      name: '传奇降临',
      delayBefore: 3200,
      threatBudget: 320,
      enemies: [
        { type: 'warlord', count: 1, interval: 0 },
        { type: 'grunt', count: 8, interval: 650 },
        { type: 'flyer', count: 5, interval: 850 },
      ],
    },
  },

  levels: {
    level_01: { coreHp: 70, waves: ['tutorial_swarm'] },
    level_02: { coreHp: 72, waves: ['tutorial_swarm', 'wolf_rush'] },
    level_03: { coreHp: 82, waves: ['tutorial_swarm', 'shield_wall'] },
    level_04: { coreHp: 88, waves: ['wolf_rush', 'wolf_rush', 'shield_wall'] },
    level_05: { coreHp: 100, waves: ['tutorial_swarm', 'sky_assault', 'shield_wall', 'sky_assault'] },
    level_06: { coreHp: 98, waves: ['sky_assault', 'shaman_support', 'shield_wall'] },
    level_07: { coreHp: 108, waves: ['shadow_blitz', 'sky_assault', 'brute_siege', 'shaman_support'] },
    level_08: { coreHp: 130, waves: ['shadow_blitz', 'brute_siege', 'shaman_support', 'sky_assault', 'warlord_finale'] },
  },
};

const CORE_HP_MULT = 0.6;
const WAVE_COUNT_MULT = 1.2;

for (const lvl of Object.values(content.levels)) {
  lvl.coreHp = Math.max(1, Math.round(lvl.coreHp * CORE_HP_MULT));
  for (const wId of lvl.waves) {
    if (!content.waveTemplates[wId]) throw new Error(`Missing wave template: ${wId}`);
  }
}

function scaleWaveCount(count) {
  if (count <= 1) return count;
  return Math.max(1, Math.ceil(count * WAVE_COUNT_MULT));
}

for (const tmpl of Object.values(content.waveTemplates)) {
  for (const g of tmpl.enemies) {
    g.count = scaleWaveCount(g.count);
  }
  tmpl.threatBudget = Math.round(tmpl.threatBudget * WAVE_COUNT_MULT);
}
for (const tmpl of Object.values(content.waveTemplates)) {
  for (const g of tmpl.enemies) {
    if (!content.enemies[g.type]) throw new Error(`Missing enemy: ${g.type} in ${tmpl.id}`);
  }
}
for (const tower of Object.values(content.towers)) {
  if (!content.attacks[tower.attackId]) throw new Error(`Missing attack: ${tower.attackId}`);
}

const json = JSON.stringify(content, null, 2);
for (const dir of outDirs) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'rhythm_guard_td.json'), json);
}

console.log('✓ TD content generated (Shroom Guard balance v2.1.0)');
console.log(`  grid: ${content.defense.grid.size}×${content.defense.grid.size}`);
console.log(`  enemies: ${Object.keys(content.enemies).length}`);
console.log(`  towers: ${Object.keys(content.towers).length} families`);
console.log(`  kick T4 damage: ${content.towers.kick.tiers[3].damage}`);
console.log(`  warlord HP: ${content.enemies.warlord.hp}`);
console.log(`  level_08 coreHp: ${content.levels.level_08.coreHp}`);
