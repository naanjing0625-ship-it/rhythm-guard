import Phaser from 'phaser';
import {
  canMerge,
  createItemInstance,
  getItemDef,
  GRID_CELL_SIZE,
  GRID_SIZE,
  LANE_TYPES,
  MAX_TIER,
  mergeItems,
  type ItemInstance,
  type ItemType,
} from '../config/items';
import { getItemVisualTheme } from '../config/itemVisuals';
import { LEVELS, type LevelConfig } from '../config/levels';
import { RHYTHM_THEME, TD_BODY_STYLE, TD_TITLE_STYLE } from '../config/rhythmTheme';
import { gameState } from '../core/GameState';
import { GridBoard } from '../systems/deploy/GridBoard';
import { pulseTower } from '../systems/defense/CombatVfx';
import { createTextButton, setTextButtonHighlighted } from '../ui/HUD';
import { resolveChapterTheme } from '../config/chapterTheme';
import { addRhythmTdBackdrop, drawRhythmGrid } from '../ui/RhythmTdChrome';
import { attachItemTooltip, ItemTooltipView } from '../ui/ItemTooltip';
import { createTowerVisual } from '../ui/TowerSprite';
import { GAME_WIDTH, GAME_HEIGHT, prepareLandscapeScene } from '../core/Game';

interface DragState {
  item: ItemInstance;
  gridPos: { row: number; col: number };
  sprite: Phaser.GameObjects.Container;
  originX: number;
  originY: number;
}

export class BattleSimulatorScene extends Phaser.Scene {
  private board!: GridBoard;
  private cellSize = GRID_CELL_SIZE;
  private gridX = 0;
  private gridY = 72;
  private towerSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private paletteSprites: Phaser.GameObjects.Container[] = [];
  private tierButtons: Phaser.GameObjects.Container[] = [];
  private selectedLevel!: LevelConfig;
  private selectedType: ItemType = 'kick';
  private selectedTier = 1;
  private levelIndex = 0;
  private statusText!: Phaser.GameObjects.Text;
  private itemTooltip = new ItemTooltipView();
  private heldItem: ItemInstance | null = null;
  private activeDrag: DragState | null = null;
  private mergeCount = 0;

  constructor() {
    super('BattleSimulatorScene');
  }

  init(data?: { battleResult?: 'win' | 'lose' }): void {
    this.lastBattleResult = data?.battleResult ?? null;
  }

  private lastBattleResult: 'win' | 'lose' | null = null;

  create(): void {
    prepareLandscapeScene(this);
    this.children.removeAll(true);
    gameState.simulatorMode = false;

    this.levelIndex = Math.max(0, LEVELS.findIndex((l) => l.id === gameState.selectedLevelId));
    if (this.levelIndex < 0) this.levelIndex = 0;
    this.selectedLevel = LEVELS[this.levelIndex];
    this.selectedType = 'kick';
    this.selectedTier = 1;
    this.heldItem = null;
    this.activeDrag = null;
    this.mergeCount = 0;
    this.board = new GridBoard();
    this.towerSprites.clear();
    this.paletteSprites = [];
    this.tierButtons = [];

    addRhythmTdBackdrop(this, resolveChapterTheme(this.selectedLevel.chapter));
    this.add.text(GAME_WIDTH / 2, 24, '⚔ 战斗模拟器', { ...TD_TITLE_STYLE, fontSize: '26px' }).setOrigin(0.5).setDepth(10);
    this.statusText = this.add.text(GAME_WIDTH / 2, 48, '', { ...TD_BODY_STYLE, fontSize: '13px' }).setOrigin(0.5).setDepth(10);

    this.gridX = (GAME_WIDTH - GRID_SIZE * this.cellSize) / 2 + 40;
    this.drawLevelPicker();
    this.drawPalette();
    this.drawGrid();
    this.refreshStatus();

    createTextButton(this, GAME_WIDTH / 2 - 120, GAME_HEIGHT - 44, '清空棋盘', () => this.clearBoard(), 0x888888);
    createTextButton(this, GAME_WIDTH / 2 + 20, GAME_HEIGHT - 44, '开始战斗', () => this.startBattle(), 0x27ae60);
    createTextButton(this, GAME_WIDTH - 90, GAME_HEIGHT - 44, '返回', () => this.scene.start('MenuScene'), RHYTHM_THEME.primary);

    if (this.lastBattleResult) {
      const msg = this.lastBattleResult === 'win' ? '上次模拟：守卫成功' : '上次模拟：核心失守';
      const color = this.lastBattleResult === 'win' ? RHYTHM_THEME.textAccent : '#e74c3c';
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 78, msg, {
        fontSize: '14px', color, fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);
      this.lastBattleResult = null;
    }
  }

  private drawLevelPicker(): void {
    createTextButton(this, 52, 88, '◀', () => this.changeLevel(-1), RHYTHM_THEME.gridStroke).setScale(0.7);
    this.add.text(100, 88, this.selectedLevel.name, {
      fontSize: '15px', color: RHYTHM_THEME.textDark, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(12);
    createTextButton(this, 220, 88, '▶', () => this.changeLevel(1), RHYTHM_THEME.gridStroke).setScale(0.7);
    this.add.text(100, 108, `${this.selectedLevel.waves.length} 波 · 核心 ${this.selectedLevel.coreHp} HP`, {
      fontSize: '12px', color: RHYTHM_THEME.textMuted, fontFamily: 'Arial',
    }).setOrigin(0, 0.5).setDepth(12);
  }

  private changeLevel(delta: number): void {
    this.levelIndex = (this.levelIndex + delta + LEVELS.length) % LEVELS.length;
    this.selectedLevel = LEVELS[this.levelIndex];
    gameState.selectedLevelId = this.selectedLevel.id;
    this.scene.restart();
  }

  private drawPalette(): void {
    const baseX = 14;
    const baseY = 130;

    this.add.text(baseX, baseY - 18, '棋子', {
      fontSize: '13px', color: RHYTHM_THEME.textAccent, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(12);

    for (let t = 1; t <= MAX_TIER; t++) {
      const btn = createTextButton(this, baseX + 18 + (t - 1) * 34, baseY + 8, `T${t}`, () => {
        this.selectedTier = t;
        this.refreshPaletteIcons();
        this.refreshPaletteHighlight();
        this.refreshStatus();
      }, this.selectedTier === t ? RHYTHM_THEME.primary : RHYTHM_THEME.gridStroke);
      btn.setScale(0.65);
      this.tierButtons.push(btn);
    }

    LANE_TYPES.forEach((type, i) => {
      const y = baseY + 38 + i * 52;
      const wrapper = this.createPaletteEntry(baseX + 24, y, type);
      this.paletteSprites.push(wrapper);
    });

    this.refreshPaletteHighlight();
  }

  private createPaletteEntry(x: number, y: number, type: ItemType): Phaser.GameObjects.Container {
    const item = createItemInstance(type, this.selectedTier);
    const visual = createTowerVisual(this, 0, 0, item, { displaySize: 40, showProfession: true });
    const wrapper = this.add.container(x, y, [visual]);
    wrapper.setSize(44, 44);
    wrapper.setInteractive(
      new Phaser.Geom.Rectangle(-22, -22, 44, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    if (wrapper.input) wrapper.input.cursor = 'pointer';
    wrapper.setDepth(12);
    wrapper.setData('type', type);
    attachItemTooltip(this, this.itemTooltip, wrapper, () => createItemInstance(type, this.selectedTier), {
      cellSize: this.cellSize,
      isDragActive: () => this.activeDrag !== null,
    });
    wrapper.on('pointerdown', () => {
      this.selectedType = type;
      this.heldItem = null;
      this.refreshPaletteHighlight();
      this.refreshStatus();
    });
    return wrapper;
  }

  private refreshPaletteIcons(): void {
    const snapshots = this.paletteSprites.map((w) => ({
      type: w.getData('type') as ItemType,
      x: w.x,
      y: w.y,
    }));
    for (const w of this.paletteSprites) w.destroy();
    this.paletteSprites = snapshots.map(({ type, x, y }) => this.createPaletteEntry(x, y, type));
  }

  private refreshPaletteHighlight(): void {
    for (let t = 1; t <= MAX_TIER; t++) {
      setTextButtonHighlighted(this.tierButtons[t - 1], t === this.selectedTier);
    }

    for (const sprite of this.paletteSprites) {
      const type = sprite.getData('type') as ItemType;
      const selected = type === this.selectedType;
      sprite.setScale(selected ? 1.12 : 1);
      sprite.setAlpha(selected ? 1 : 0.72);
    }
  }

  private drawGrid(): void {
    drawRhythmGrid(this, {
      gridX: this.gridX,
      gridY: this.gridY,
      cellSize: this.cellSize,
      gridSize: GRID_SIZE,
      isCore: (r, c) => Boolean(this.board.getCell(r, c)?.isCore),
      interactive: true,
      onCellClick: (r, c) => this.onGridCellClick(r, c),
    });
    this.redrawTowers();
  }

  private onGridCellClick(row: number, col: number): void {
    if (this.activeDrag) return;

    const cell = this.board.getCell(row, col);
    if (!cell || cell.isCore) return;

    if (cell.item) {
      if (this.heldItem) {
        if (canMerge(this.heldItem, cell.item)) {
          const merged = mergeItems(this.heldItem, cell.item);
          this.board.remove(row, col);
          this.board.place(row, col, merged);
          this.heldItem = null;
          this.playMergeEffect(row, col, merged);
        }
      } else {
        const incoming = createItemInstance(this.selectedType, this.selectedTier);
        if (canMerge(incoming, cell.item)) {
          const merged = mergeItems(incoming, cell.item);
          this.board.remove(row, col);
          this.board.place(row, col, merged);
          this.playMergeEffect(row, col, merged);
        } else {
          this.heldItem = this.board.remove(row, col)!;
        }
      }
      this.redrawTowers();
      this.refreshStatus();
      return;
    }

    if (this.heldItem) {
      this.board.place(row, col, this.heldItem);
      this.heldItem = null;
      this.redrawTowers();
      this.refreshStatus();
      return;
    }

    const placed = createItemInstance(this.selectedType, this.selectedTier);
    this.board.place(row, col, placed);
    this.redrawTowers();
    this.refreshStatus();
  }

  private setupDraggable(
    sprite: Phaser.GameObjects.Container,
    item: ItemInstance,
    gridPos: { row: number; col: number },
  ): void {
    sprite.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(sprite);

    let pointerDownX = 0;
    let pointerDownY = 0;
    let didDrag = false;

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointerDownX = pointer.x;
      pointerDownY = pointer.y;
      didDrag = false;
    });

    sprite.on('dragstart', () => {
      didDrag = true;
      this.itemTooltip.hide();
      this.activeDrag = {
        item,
        gridPos: { ...gridPos },
        sprite,
        originX: sprite.x,
        originY: sprite.y,
      };
      sprite.setDepth(200);
      sprite.setScale(1.08);
      this.board.remove(gridPos.row, gridPos.col);
    });

    sprite.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      sprite.setPosition(dragX, dragY);
    });

    sprite.on('dragend', (pointer: Phaser.Input.Pointer) => {
      if (!this.activeDrag) return;
      const { row, col } = this.pointerToGrid(pointer);
      let placed = false;

      if (row >= 0 && col >= 0 && row < GRID_SIZE && col < GRID_SIZE) {
        placed = this.handleDrop(row, col, this.activeDrag);
      }

      if (!placed) {
        this.board.place(this.activeDrag.gridPos.row, this.activeDrag.gridPos.col, this.activeDrag.item);
      }

      sprite.setScale(1);
      this.activeDrag = null;
      this.redrawTowers();
      this.refreshStatus();
    });

    sprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (didDrag || this.activeDrag) return;
      const moved = Phaser.Math.Distance.Between(pointerDownX, pointerDownY, pointer.x, pointer.y);
      if (moved > 10) return;
      this.onTowerClick(gridPos.row, gridPos.col);
    });
  }

  private onTowerClick(row: number, col: number): void {
    const cell = this.board.getCell(row, col);
    if (!cell?.item) return;

    if (this.heldItem) {
      if (!canMerge(this.heldItem, cell.item)) return;
      const merged = mergeItems(this.heldItem, cell.item);
      this.board.remove(row, col);
      this.board.place(row, col, merged);
      this.heldItem = null;
      this.playMergeEffect(row, col, merged);
    } else {
      const incoming = createItemInstance(this.selectedType, this.selectedTier);
      if (canMerge(incoming, cell.item)) {
        const merged = mergeItems(incoming, cell.item);
        this.board.remove(row, col);
        this.board.place(row, col, merged);
        this.playMergeEffect(row, col, merged);
      } else {
        this.heldItem = this.board.remove(row, col)!;
      }
    }
    this.redrawTowers();
    this.refreshStatus();
  }

  private pointerToGrid(pointer: Phaser.Input.Pointer): { row: number; col: number } {
    const col = Math.floor((pointer.x - this.gridX) / this.cellSize);
    const row = Math.floor((pointer.y - this.gridY) / this.cellSize);
    return { row, col };
  }

  private handleDrop(row: number, col: number, drag: DragState): boolean {
    const cell = this.board.getCell(row, col);
    if (!cell || cell.isCore) return false;

    if (row === drag.gridPos.row && col === drag.gridPos.col) {
      this.board.place(row, col, drag.item);
      return true;
    }

    if (!cell.item) {
      this.board.place(row, col, drag.item);
      return true;
    }

    if (canMerge(drag.item, cell.item)) {
      const merged = mergeItems(drag.item, cell.item);
      this.board.remove(row, col);
      this.board.place(row, col, merged);
      this.playMergeEffect(row, col, merged);
      return true;
    }

    return false;
  }

  private playMergeEffect(row: number, col: number, merged: ItemInstance): void {
    this.mergeCount++;
    const x = this.gridX + col * this.cellSize + this.cellSize / 2;
    const y = this.gridY + row * this.cellSize + this.cellSize / 2;
    const def = getItemDef(merged.type, merged.tier);
    pulseTower(this, x, y, def.color);

    const label = this.add.text(x, y - 8, `合成 lv${merged.tier}`, {
      fontSize: '18px',
      color: '#ffd700',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#7b4fff',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(120);

    this.tweens.add({
      targets: label,
      y: y - 36,
      alpha: 0,
      scale: 1.2,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });

    const flash = this.add.rectangle(x, y, this.cellSize - 4, this.cellSize - 4, def.color, 0.35);
    flash.setDepth(119);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.15,
      duration: 320,
      onComplete: () => flash.destroy(),
    });
  }

  private redrawTowers(): void {
    this.towerSprites.forEach((s) => {
      this.input.setDraggable(s, false);
      s.destroy();
    });
    this.towerSprites.clear();

    for (const placed of this.board.getPlacedTowers()) {
      const x = this.gridX + placed.col * this.cellSize + this.cellSize / 2;
      const y = this.gridY + placed.row * this.cellSize + this.cellSize / 2;
      const sprite = createTowerVisual(this, x, y, placed.item, {
        displaySize: this.cellSize - 10,
        showProfession: true,
        depth: 15,
      });
      attachItemTooltip(this, this.itemTooltip, sprite, () => placed.item, {
        cellSize: this.cellSize,
        isDragActive: () => this.activeDrag !== null,
      });
      this.setupDraggable(sprite, placed.item, { row: placed.row, col: placed.col });
      this.towerSprites.set(`${placed.row}_${placed.col}`, sprite);
    }
  }

  private clearBoard(): void {
    this.board = new GridBoard();
    this.heldItem = null;
    this.activeDrag = null;
    this.mergeCount = 0;
    this.redrawTowers();
    this.refreshStatus();
  }

  private refreshStatus(): void {
    const theme = getItemVisualTheme(this.selectedType);
    const count = this.board.getPlacedTowers().length;
    this.statusText.setColor(RHYTHM_THEME.textDark);

    if (this.heldItem) {
      const heldDef = getItemDef(this.heldItem.type, this.heldItem.tier);
      this.statusText.setText(
        `手持 ${heldDef.name} · 点击空格放置 / 拖到同阶同职业上合成 · 已合成 ${this.mergeCount} 次`,
      );
      return;
    }

    this.statusText.setText(
      `选中 ${theme.familyLabel} lv${this.selectedTier} · 已放置 ${count} 个 · `
      + '点击空格放置 · 点击棋子拿起 · 拖拽合成 · 合成不限次数',
    );
  }

  private startBattle(): void {
    const placed = this.board.getPlacedTowers();
    if (placed.length === 0) {
      this.statusText.setText('请至少放置 1 个棋子后再开始战斗');
      this.statusText.setColor('#e74c3c');
      return;
    }

    gameState.simulatorMode = true;
    gameState.startRun(this.selectedLevel);
    const run = gameState.run!;
    run.placedTowers = placed.map((p) => ({
      row: p.row,
      col: p.col,
      item: { ...p.item },
    }));
    run.defenseGold = 9999;
    run.rhythmResult = {
      score: 0,
      maxScore: 1,
      accuracy: 1,
      laneHits: { 0: 0, 1: 0, 2: 0 },
      judgements: { perfect: 0, great: 0, good: 0, miss: 0 },
    };
    this.scene.start('DefenseScene');
  }

  shutdown(): void {
    this.itemTooltip.hide();
  }
}
