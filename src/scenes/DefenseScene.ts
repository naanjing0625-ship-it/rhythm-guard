import Phaser from 'phaser';
import { gameState } from '../core/GameState';
import { eventBus, Events } from '../core/EventBus';
import { ENEMY_DEFS } from '../config/enemies';
import { getCorePixelPosition, GRID_CELL_SIZE, GRID_SIZE, isCoreCell } from '../config/items';
import { getTdLevelScaling, TD_CONTENT, type LevelScaling, type WaveConfig } from '../config/tdContent';
import { CombatSystem } from '../systems/defense/CombatSystem';
import { combatSfx } from '../systems/defense/CombatSfxEngine';
import { playAttackVfx, pulseTower } from '../systems/defense/CombatVfx';
import { updateEnemyAbilities } from '../systems/defense/EnemyAbilities';
import { createEnemy, getEnemyMoveSpeed, isBossEnemy, isEnemySlowed, tickEnemySlow, type EnemyState } from '../systems/defense/Enemy';
import { applyBossFinaleModifiers } from '../config/enemies';
import { getScaledEnemy, WaveManager } from '../systems/defense/WaveManager';
import { createTowerState, type TowerState } from '../systems/defense/Tower';
import { getRunChapterCoreVisual, getRunDefenseBgmProfile } from '../config/chapterDefense';
import { getRunChapterTheme } from '../config/chapterTheme';
import { RHYTHM_THEME, TD_HUD_STYLE, TD_TITLE_STYLE } from '../config/rhythmTheme';
import { createTextButton, setTextButtonHighlighted } from '../ui/HUD';
import {
  addRhythmTdBackdrop,
  createRhythmProgressBar,
  drawRhythmCore,
  drawRhythmGrid,
  showRhythmToast,
} from '../ui/RhythmTdChrome';
import { createEnemyNoteParts, getEnemyBadgeText } from '../ui/EnemyNoteSprite';
import { attachItemTooltip, ItemTooltipView } from '../ui/ItemTooltip';
import { createTowerVisual } from '../ui/TowerSprite';
import { landscapeCoachLayout, TutorialCoach } from '../ui/TutorialCoach';
import { TUTORIAL_REPAIR_FULL_HEAL } from '../config/tutorial';
import { GAME_WIDTH, GAME_HEIGHT, prepareLandscapeScene } from '../core/Game';

export class DefenseScene extends Phaser.Scene {
  private towers: TowerState[] = [];
  private enemies: EnemyState[] = [];
  private waveManager!: WaveManager;
  private combat = new CombatSystem();
  private cellSize = GRID_CELL_SIZE;
  private gridX = 0;
  private gridY = 60;
  private coreX = 0;
  private coreY = 0;
  private coreRadius = TD_CONTENT.defense.core.radius;
  private enemySprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private healerAuras: Map<string, Phaser.GameObjects.Arc> = new Map();
  private towerSprites: Phaser.GameObjects.Container[] = [];
  private hpFill!: Phaser.GameObjects.Rectangle;
  private waveText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private tipText!: Phaser.GameObjects.Text;
  private repairBtn!: Phaser.GameObjects.Container;
  private repairBtnLabel!: Phaser.GameObjects.Text;
  private repairBtnCanUse = false;
  private coreHitZone: Phaser.GameObjects.Arc | null = null;
  private shield = 0;
  private allWavesSpawned = false;
  private wavesSpawnFinished = new Set<number>();
  private wavesRewarded = new Set<number>();
  private animTime = 0;
  private levelWaves: WaveConfig[] = [];
  private levelScaling: LevelScaling = { hp: 1, damage: 1, speed: 1 };
  private itemTooltip = new ItemTooltipView();
  private tutorialCoach = new TutorialCoach();
  private tutorialCoachLayout = landscapeCoachLayout(650);
  private cleanedUp = false;
  private bossPhaseActive = false;
  private bossFinalePending = false;
  private bossSiegeWarned = false;
  private bossEnemyId: string | null = null;
  private bossBarFill: Phaser.GameObjects.Rectangle | null = null;
  private bossBarBg: Phaser.GameObjects.Rectangle | null = null;
  private bossBarLabel: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('DefenseScene');
  }

  private resetDefenseState(): void {
    this.towers = [];
    this.enemies = [];
    this.enemySprites.clear();
    for (const aura of this.healerAuras.values()) aura.destroy();
    this.healerAuras.clear();
    this.towerSprites = [];
    this.shield = 0;
    this.allWavesSpawned = false;
    this.wavesSpawnFinished = new Set();
    this.wavesRewarded = new Set();
    this.animTime = 0;
    this.repairBtnCanUse = true;
    this.bossPhaseActive = false;
    this.bossFinalePending = false;
    this.bossSiegeWarned = false;
    this.bossEnemyId = null;
    this.bossBarFill = null;
    this.bossBarBg = null;
    this.bossBarLabel = null;
  }

  create(): void {
    const run = gameState.run;
    if (!run) { this.scene.start('LevelSelectScene'); return; }

    this.children.removeAll(true);
    this.resetDefenseState();
    this.time.removeAllEvents();
    this.cleanedUp = false;
    this.tutorialCoach.destroy();
    this.tutorialCoach = new TutorialCoach();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupScene());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupScene());

    run.victory = false;
    run.starsEarned = 0;

    prepareLandscapeScene(this);
    this.levelWaves = run.level.waves;
    this.levelScaling = getTdLevelScaling(run.level.id);

    this.gridX = (GAME_WIDTH - GRID_SIZE * this.cellSize) / 2;
    const corePos = getCorePixelPosition(this.cellSize, this.gridX, this.gridY);
    this.coreX = corePos.x;
    this.coreY = corePos.y;

    addRhythmTdBackdrop(this, getRunChapterTheme());
    this.add.text(GAME_WIDTH / 2, 20, gameState.simulatorMode ? '⚔ 模拟战斗' : '🎵 律动守卫', { ...TD_TITLE_STYLE }).setOrigin(0.5);

    this.drawGrid();
    this.setupTowers();
    this.shield = this.combat.computeShield(this.towers);
    run.shield = this.shield;
    if (this.shield > 0) {
      this.pulseCoreShield();
      this.showToast(`岩盾仪激活！护盾 +${Math.round(this.shield)}`, RHYTHM_THEME.primary);
    }

    this.waveManager = new WaveManager(this.levelWaves);
    combatSfx.setVolume(gameState.save?.settings.volume ?? 0.8);
    void this.kickBattleBgm();

    this.waveText = this.add.text(20, 48, '', { ...TD_HUD_STYLE }).setDepth(290);
    this.goldText = this.add.text(GAME_WIDTH - 20, 48, '', {
      fontSize: '15px', color: RHYTHM_THEME.textGold, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(290);
    this.tipText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 82, '', {
      fontSize: '12px',
      color: RHYTHM_THEME.textDark,
      fontFamily: 'Arial',
      wordWrap: { width: GAME_WIDTH - 240 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(290);

    const hpBar = createRhythmProgressBar(this, GAME_WIDTH / 2, GAME_HEIGHT - 30, 300, 12);
    this.hpFill = hpBar.fill;

    const repairCost = TD_CONTENT.defense.economy.repairCost;
    this.repairBtn = createTextButton(this, GAME_WIDTH - 100, GAME_HEIGHT - 58, `修复 ${repairCost}♪`, () => this.repairCore(), RHYTHM_THEME.noteBlue);
    this.repairBtnLabel = this.repairBtn.list[1] as Phaser.GameObjects.Text;
    if (gameState.simulatorMode) {
      createTextButton(this, 100, GAME_HEIGHT - 58, '结束模拟', () => {
        gameState.simulatorMode = false;
        gameState.clearRun();
        this.goToScene('BattleSimulatorScene');
      }, 0x888888);
    } else {
      createTextButton(this, 100, GAME_HEIGHT - 58, '道具说明', () => this.showTowerGuide(), RHYTHM_THEME.primary);
    }

    this.updateHud();
    this.showNextWavePreview();

    if (gameState.tutorialMode) {
      this.time.delayedCall(400, () => {
        this.tutorialCoach.show(this, 'defense_welcome', undefined, this.tutorialCoachLayout);
      });
    }
  }

  update(_time: number, delta: number): void {
    const run = gameState.run;
    if (!run) return;

    const deltaMs = delta;
    const deltaSec = delta / 1000;
    this.animTime += deltaSec;

    const waveResult = this.waveManager.update(deltaMs, (type, waveIdx) => {
      const wave = this.levelWaves[waveIdx];
      const def = applyBossFinaleModifiers(
        getScaledEnemy(type, waveIdx, this.levelScaling),
        wave,
      );
      const pos = this.getSpawnPosition();
      return createEnemy(def, pos.x, pos.y);
    });

    if (waveResult.waveStarted !== null) {
      const idx = waveResult.waveStarted;
      eventBus.emit(Events.WAVE_START, idx + 1);
      this.announceWave(idx);
      void this.kickBattleBgm();
      if (this.levelWaves[idx]?.bossFinale) {
        this.bossPhaseActive = true;
        this.bossFinalePending = true;
      }
    }

    if (waveResult.waveSpawnFinished !== null) {
      this.wavesSpawnFinished.add(waveResult.waveSpawnFinished);
    }

    for (const event of waveResult.spawned) {
      this.enemies.push(event.enemy);
      this.createEnemySprite(event.enemy);
      this.flashSpawnPoint(event.enemy.x, event.enemy.y);
      if (this.bossPhaseActive && isBossEnemy(event.enemy)) {
        this.trackBossEnemy(event.enemy);
      }
    }

    if (this.waveManager.isDone) this.allWavesSpawned = true;

    const abilityFx = updateEnemyAbilities(this.enemies, deltaMs);
    for (const enraged of abilityFx.enraged) {
      this.flashEnemy(enraged, 0xff4444);
      const sprite = this.enemySprites.get(enraged.id);
      if (sprite) sprite.setScale(1.25);
      this.showToast(`${enraged.def.name} 狂暴！`, 0xff4444);
    }
    for (const healed of abilityFx.healed) {
      this.flashEnemy(healed, 0x2ecc71);
    }

    this.updateHealerAuras();
    this.moveEnemies(deltaSec);

    const result = this.combat.update(
      this.towers,
      this.enemies,
      deltaSec,
      this.coreX,
      this.coreY,
      this.coreRadius,
      this.shield,
      this.bossPhaseActive,
    );

    this.shield = Math.max(0, this.shield - result.shieldAbsorbed);
    if (result.shieldAbsorbed > 0) {
      this.flashCore(0x9b59b6);
    }

    for (const atk of result.attacks) {
      playAttackVfx(this, atk);
      const tower = this.towers.find((t) => Math.hypot(t.x - atk.fromX, t.y - atk.fromY) < 2);
      if (tower) {
        pulseTower(this, tower.x, tower.y, atk.color);
        combatSfx.playTowerAttack(
          tower.item.type,
          atk.mode,
          tower.item.tier,
          atk.appliedSlow ?? false,
        );
      }
    }

    if (result.coreDamage > 0) {
      eventBus.emit(Events.CORE_DAMAGED, result.coreDamage);
      this.flashCore(0xe74c3c);
      combatSfx.playCoreHurt(result.coreDamage);
      if (this.bossPhaseActive && this.enemies.some((e) => e.alive && e.siegingCore) && !this.bossSiegeWarned) {
        this.bossSiegeWarned = true;
        this.showToast('Boss 正在围攻核心！优先击杀', RHYTHM_THEME.noteRed, 2200);
      }
    }
    run.coreHp -= result.coreDamage;

    const economy = TD_CONTENT.defense.economy;
    for (const killed of result.towerKilled) {
      if (economy.killRewardEnabled) {
        run.defenseGold += killed.def.reward;
      }
      run.killCount++;
      eventBus.emit(Events.ENEMY_KILLED, killed);
      this.removeEnemySprite(killed.id);
      this.removeHealerAura(killed.id);
      if (this.bossEnemyId === killed.id) {
        this.hideBossBar();
        this.showToast('传奇英雄已击破！', 0xd4a017, 2200);
      }
    }

    this.tryShowRepairTutorial(run);

    for (const reached of result.coreReached) {
      this.removeEnemySprite(reached.id);
      this.removeHealerAura(reached.id);
    }

    this.enemies = this.enemies.filter((e) => e.alive);
    this.tryGrantWaveClearBonus(run);
    this.updateEnemySprites();
    this.updateHud();

    if (run.coreHp <= 0) {
      run.victory = false;
      if (gameState.simulatorMode) {
        gameState.simulatorMode = false;
        gameState.clearRun();
        this.goToScene('BattleSimulatorScene', { battleResult: 'lose' });
        return;
      }
      this.goToScene('ResultScene');
      return;
    }

    if (this.allWavesSpawned && this.enemies.length === 0) {
      if (this.bossFinalePending) return;
      run.victory = true;
      if (gameState.simulatorMode) {
        gameState.simulatorMode = false;
        gameState.clearRun();
        this.goToScene('BattleSimulatorScene', { battleResult: 'win' });
        return;
      }
      if (gameState.tutorialMode) {
        run.starsEarned = 0;
        this.tutorialCoach.show(this, 'defense_win', () => this.goToScene('ResultScene'), this.tutorialCoachLayout);
        return;
      }
      const hpRatio = run.coreHp / run.coreMaxHp;
      run.starsEarned = hpRatio > 0.8 ? 3 : hpRatio > 0.5 ? 2 : 1;
      this.goToScene('ResultScene');
    }
  }

  private repairCore(): void {
    const run = gameState.run;
    if (!run) return;
    const { repairCost, repairHp } = TD_CONTENT.defense.economy;
    const remaining = run.level.repairLimit - run.repairsUsed;
    if (remaining <= 0) {
      this.showToast(`本关修复次数已用完（${run.level.repairLimit} 次）`, RHYTHM_THEME.noteRed);
      return;
    }
    if (run.coreHp >= run.coreMaxHp) {
      this.showToast('节拍核心已满血，无需修复', 0x888888);
      return;
    }
    if (run.defenseGold < repairCost) {
      this.showToast(`音律币不足（需要 ${repairCost} ♪）`, RHYTHM_THEME.noteRed);
      return;
    }
    run.defenseGold -= repairCost;
    run.repairsUsed++;
    if (gameState.tutorialMode && TUTORIAL_REPAIR_FULL_HEAL) {
      run.coreHp = run.coreMaxHp;
    } else {
      run.coreHp = Math.min(run.coreMaxHp, run.coreHp + repairHp);
    }
    this.pulseCoreShield();
    this.showToast(
      gameState.tutorialMode && TUTORIAL_REPAIR_FULL_HEAL
        ? `节拍核心已回满！（剩余 ${run.level.repairLimit - run.repairsUsed} 次修复）`
        : `节拍核心修复 +${repairHp} HP（剩余 ${run.level.repairLimit - run.repairsUsed} 次）`,
      RHYTHM_THEME.primary,
    );
    this.updateHud();
  }

  private tryShowRepairTutorial(run: NonNullable<typeof gameState.run>): void {
    if (!gameState.tutorialMode) return;
    if (this.tutorialCoach.hasShown('defense_repair')) return;
    if (this.tutorialCoach.isVisible()) return;
    if (run.coreHp >= run.coreMaxHp) return;
    const { repairCost } = TD_CONTENT.defense.economy;
    if (run.defenseGold < repairCost) return;
    this.tutorialCoach.showOnce(this, 'defense_repair', this.tutorialCoachLayout);
  }

  private showTowerGuide(): void {
    this.showToast('🥁🪘🎵✨ 四轨鼓组 | 👹🧟🐉🦂 怪物来犯 — 守住节拍核心', RHYTHM_THEME.primary, 2400);
  }

  private showNextWavePreview(): void {
    const idx = this.waveManager.currentWave - 1;
    const wave = this.levelWaves[idx];
    if (!wave) return;
    this.tipText.setText(this.formatWaveBriefing(wave));
  }

  private announceWave(waveIdx: number): void {
    const wave = this.levelWaves[waveIdx];
    if (!wave) return;
    const title = wave.templateName ?? `第 ${waveIdx + 1} 波`;
    const briefing = this.formatWaveBriefing(wave);
    if (wave.bossFinale) {
      this.showToast('【终局 Boss 战】传奇英雄降临！', 0xd4a017, 3200);
      this.time.delayedCall(900, () => {
        this.showToast('击破 Boss 才能胜利 — 漏到核心只会持续扣血', RHYTHM_THEME.noteRed, 3400);
      });
    } else {
      this.showToast(`【${title}】${briefing}`, RHYTHM_THEME.noteRed, 2800);
    }
    this.tipText.setText(briefing);

    const hasFlyer = wave.enemies.some((g) => ENEMY_DEFS[g.type]?.flying);
    const hasArmored = wave.enemies.some((g) => ENEMY_DEFS[g.type]?.armorType === 'armored' || ENEMY_DEFS[g.type]?.armorType === 'boss');
    const hasHealer = wave.enemies.some((g) => g.type === 'healer');
    if (hasFlyer) {
      this.time.delayedCall(800, () => this.showToast('狮鹫骑士为飞行 — 节拍拳够不到，用毒囊炮/弧光术', RHYTHM_THEME.noteBlue, 2600));
    }
    if (hasArmored) {
      this.time.delayedCall(hasFlyer ? 1600 : 800, () => this.showToast('护甲怪怕溅射 — 毒囊炮更有效', RHYTHM_THEME.noteYellow, 2400));
    }
    if (hasHealer) {
      this.time.delayedCall(1200, () => this.showToast('祝福牧师会回血 — 优先点掉', RHYTHM_THEME.primary, 2400));
    }
  }

  private formatWaveBriefing(wave: WaveConfig): string {
    const parts = wave.enemies.map((g) => {
      const name = ENEMY_DEFS[g.type]?.name ?? g.type;
      return `${name}×${g.count}`;
    });
    const prefix = wave.templateName ? `${wave.templateName}: ` : '';
    return prefix + parts.join(' · ');
  }

  private tryGrantWaveClearBonus(run: NonNullable<typeof gameState.run>): void {
    if (this.enemies.length > 0) return;
    const bonus = TD_CONTENT.defense.economy.waveClearBonus;
    for (const waveIdx of this.wavesSpawnFinished) {
      if (this.wavesRewarded.has(waveIdx)) continue;
      this.wavesRewarded.add(waveIdx);
      run.wavesCleared++;
      run.defenseGold += bonus;
      eventBus.emit(Events.WAVE_COMPLETE, waveIdx + 1);
      this.showToast(`节拍清空 +${bonus} ♪`, RHYTHM_THEME.noteYellow);
    }
    this.showNextWavePreview();
  }

  private getSpawnPosition(): { x: number; y: number } {
    const edges = TD_CONTENT.defense.spawn.edges;
    const edge = edges[Phaser.Math.Between(0, edges.length - 1)];
    const gridW = GRID_SIZE * this.cellSize;
    const gridH = GRID_SIZE * this.cellSize;
    switch (edge) {
      case 'top':
        return { x: this.gridX + Phaser.Math.Between(0, gridW), y: this.gridY - 20 };
      case 'right':
        return { x: this.gridX + gridW + 20, y: this.gridY + Phaser.Math.Between(0, gridH) };
      case 'bottom':
        return { x: this.gridX + Phaser.Math.Between(0, gridW), y: this.gridY + gridH + 20 };
      default:
        return { x: this.gridX - 20, y: this.gridY + Phaser.Math.Between(0, gridH) };
    }
  }

  private moveEnemies(deltaSec: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      tickEnemySlow(enemy, deltaSec);
      if (enemy.siegingCore) continue;
      const dx = this.coreX - enemy.x;
      const dy = this.coreY - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        const speed = getEnemyMoveSpeed(enemy);
        enemy.x += (dx / dist) * speed * deltaSec;
        enemy.y += (dy / dist) * speed * deltaSec;
      }
    }
  }

  private trackBossEnemy(enemy: EnemyState): void {
    this.bossFinalePending = false;
    this.bossEnemyId = enemy.id;
    this.showBossBar(enemy);
  }

  private showBossBar(enemy: EnemyState): void {
    this.hideBossBar();
    const bar = createRhythmProgressBar(this, GAME_WIDTH / 2, 72, 360, 14);
    this.bossBarBg = bar.bg;
    this.bossBarFill = bar.fill;
    this.bossBarFill.fillColor = RHYTHM_THEME.noteRed;
    this.bossBarLabel = this.add.text(GAME_WIDTH / 2, 58, `👑 ${enemy.def.name}`, {
      fontSize: '13px',
      color: RHYTHM_THEME.textGold,
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(292);
    this.updateBossBar(enemy);
  }

  private updateBossBar(enemy: EnemyState): void {
    if (!this.bossBarFill) return;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    this.bossBarFill.width = 360 * ratio;
    this.bossBarFill.fillColor = ratio > 0.35 ? RHYTHM_THEME.noteRed : RHYTHM_THEME.hpDanger;
  }

  private hideBossBar(): void {
    this.bossBarBg?.destroy();
    this.bossBarFill?.destroy();
    this.bossBarLabel?.destroy();
    this.bossBarBg = null;
    this.bossBarFill = null;
    this.bossBarLabel = null;
    this.bossEnemyId = null;
  }

  private createEnemySprite(enemy: EnemyState): void {
    const parts = createEnemyNoteParts(this, enemy);
    const badge = getEnemyBadgeText(enemy);
    if (badge) {
      parts.push(this.add.text(0, enemy.def.size + 8, badge, {
        fontSize: '9px',
        color: '#ffffff',
        fontFamily: 'Arial',
        backgroundColor: '#7b4fffcc',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5));
    }

    const hpFill = parts[2] as Phaser.GameObjects.Rectangle;
    const container = this.add.container(enemy.x, enemy.y, parts);
    container.setData('hpFill', hpFill);
    container.setData('enemyId', enemy.id);
    container.setDepth(10);
    if (container.input) container.disableInteractive();
    this.enemySprites.set(enemy.id, container);

    if (enemy.def.abilities?.some((a) => a.id === 'heal_aura')) {
      this.createHealerAura(enemy);
    }
  }

  private createHealerAura(enemy: EnemyState): void {
    const aura = this.add.circle(enemy.x, enemy.y, 90, RHYTHM_THEME.primary, 0.08);
    aura.setStrokeStyle(1, RHYTHM_THEME.primary, 0.35);
    aura.setDepth(5);
    this.healerAuras.set(enemy.id, aura);
  }

  private updateHealerAuras(): void {
    for (const enemy of this.enemies) {
      const aura = this.healerAuras.get(enemy.id);
      if (!aura) continue;
      const bob = enemy.def.flying ? Math.sin(this.animTime * 6 + enemy.x * 0.02) * 6 : 0;
      aura.setPosition(enemy.x, enemy.y + bob);
      aura.setAlpha(0.08 + Math.sin(this.animTime * 3) * 0.04);
    }
  }

  private removeHealerAura(id: string): void {
    const aura = this.healerAuras.get(id);
    if (aura) {
      aura.destroy();
      this.healerAuras.delete(id);
    }
  }

  private updateEnemySprites(): void {
    for (const enemy of this.enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (!sprite) continue;
      const flyBob = enemy.def.flying ? Math.sin(this.animTime * 6 + enemy.x * 0.02) * 6 : 0;
      sprite.setPosition(enemy.x, enemy.y + flyBob);
      sprite.setAlpha(isEnemySlowed(enemy) ? 0.78 : 1);
      const hpFill = sprite.getData('hpFill') as Phaser.GameObjects.Rectangle;
      if (hpFill) hpFill.width = 34 * (enemy.hp / enemy.maxHp);
    }
  }

  private removeEnemySprite(id: string): void {
    const sprite = this.enemySprites.get(id);
    if (!sprite) return;
    this.tweens.add({
      targets: sprite,
      alpha: 0,
      scale: 0,
      duration: 200,
      onComplete: () => sprite.destroy(),
    });
    this.enemySprites.delete(id);
  }

  private flashEnemy(enemy: EnemyState, color: number): void {
    const ring = this.add.circle(enemy.x, enemy.y, enemy.def.size + 8, color, 0.35);
    ring.setDepth(40);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.6,
      duration: 300,
      onComplete: () => ring.destroy(),
    });
  }

  private flashSpawnPoint(x: number, y: number): void {
    const marker = this.add.circle(x, y, 14, RHYTHM_THEME.primary, 0.45);
    marker.setDepth(8);
    this.tweens.add({
      targets: marker,
      scale: 2,
      alpha: 0,
      duration: 400,
      onComplete: () => marker.destroy(),
    });
  }

  private pulseCoreShield(): void {
    const ring = this.add.circle(this.coreX, this.coreY, this.coreRadius, RHYTHM_THEME.primary, 0.2);
    ring.setStrokeStyle(2, RHYTHM_THEME.primary, 0.6);
    ring.setDepth(15);
    this.tweens.add({
      targets: ring,
      scale: 1.4,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy(),
    });
  }

  private flashCore(color: number): void {
    const flash = this.add.circle(this.coreX, this.coreY, this.coreRadius + 8, color, 0.35);
    flash.setDepth(20);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.2,
      duration: 250,
      onComplete: () => flash.destroy(),
    });
  }

  private showToast(text: string, color: number, duration = 1200): void {
    showRhythmToast(this, text, color, duration);
  }

  private updateHud(): void {
    const run = gameState.run!;
    const alive = this.enemies.filter((e) => e.alive).length;
    const waveLabel = this.bossPhaseActive
      ? `终局 Boss | 敌人 ${alive}`
      : `波次 ${this.waveManager.currentWave}/${this.waveManager.totalWaves} | 敌人 ${alive}`;
    this.waveText.setText(
      waveLabel + `${this.shield > 0 ? ` | 护盾 ${Math.round(this.shield)}` : ''}`,
    );
    this.goldText.setText(`♪ ${run.defenseGold} | 击退 ${run.killCount}`);
    const ratio = Math.max(0, run.coreHp / run.coreMaxHp);
    this.hpFill.width = 300 * ratio;
    this.hpFill.fillColor = ratio > 0.5 ? RHYTHM_THEME.progressFill : ratio > 0.25 ? RHYTHM_THEME.hpWarn : RHYTHM_THEME.hpDanger;

    const { repairCost } = TD_CONTENT.defense.economy;
    const repairRemaining = run.level.repairLimit - run.repairsUsed;
    this.repairBtnLabel.setText(`修复 ${repairCost}♪ (${repairRemaining}/${run.level.repairLimit})`);
    const canRepair = repairRemaining > 0 && run.defenseGold >= repairCost && run.coreHp < run.coreMaxHp;
    if (canRepair !== this.repairBtnCanUse) {
      this.repairBtnCanUse = canRepair;
      setTextButtonHighlighted(this.repairBtn, canRepair, RHYTHM_THEME.noteBlue);
    }

    if (this.bossEnemyId) {
      const boss = this.enemies.find((e) => e.id === this.bossEnemyId);
      if (boss?.alive) this.updateBossBar(boss);
    }
  }

  private drawGrid(): void {
    drawRhythmGrid(this, {
      gridX: this.gridX,
      gridY: this.gridY,
      cellSize: this.cellSize,
      gridSize: GRID_SIZE,
      isCore: isCoreCell,
      variant: 'defense',
    });
    this.coreHitZone = drawRhythmCore(
      this,
      this.coreX,
      this.coreY,
      this.coreRadius,
      gameState.run!.level.name,
      {
        visual: getRunChapterCoreVisual(),
        onClick: () => this.repairCore(),
      },
    );
  }

  private kickBattleBgm(): void {
    void combatSfx.ensureBattleBgm(getRunDefenseBgmProfile());
  }

  private cleanupScene(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    this.itemTooltip.hide();
    this.tutorialCoach.destroy();
    combatSfx.stopBattleBgm();
    combatSfx.destroy();
    this.time.removeAllEvents();
    this.coreHitZone?.destroy();
    this.coreHitZone = null;
    for (const aura of this.healerAuras.values()) aura.destroy();
    this.healerAuras.clear();
    this.enemySprites.clear();
  }

  private goToScene(key: string, data?: object): void {
    this.cleanupScene();
    this.scene.start(key, data);
  }

  private setupTowers(): void {
    const run = gameState.run!;
    this.towers = [];
    for (const placed of run.placedTowers) {
      const tower = createTowerState(placed.row, placed.col, placed.item, this.cellSize, this.gridX, this.gridY);
      this.towers.push(tower);
      const visual = createTowerVisual(this, 0, 0, placed.item, {
        displaySize: this.cellSize - 12,
        showProfession: true,
        depth: 20,
      });
      const wrapper = this.add.container(tower.x, tower.y, [visual]);
      wrapper.setSize(this.cellSize - 10, this.cellSize - 10);
      wrapper.setInteractive({ useHandCursor: true });
      attachItemTooltip(this, this.itemTooltip, wrapper, () => placed.item, { cellSize: this.cellSize });
      this.towerSprites.push(wrapper);
    }
  }
}
