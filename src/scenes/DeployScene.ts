import Phaser from 'phaser';
import { gameState } from '../core/GameState';
import { canMerge, getItemDef, GRID_CELL_SIZE, GRID_SIZE, mergeItems, type ItemInstance } from '../config/items';
import { RHYTHM_THEME, TD_BODY_STYLE, TD_TITLE_STYLE } from '../config/rhythmTheme';
import { GridBoard } from '../systems/deploy/GridBoard';
import { createTextButton } from '../ui/HUD';
import { getRunChapterTheme } from '../config/chapterTheme';
import { addRhythmTdBackdrop, drawRhythmGrid, showRhythmToast } from '../ui/RhythmTdChrome';
import { attachItemTooltip, ItemTooltipView } from '../ui/ItemTooltip';
import { createTowerVisual } from '../ui/TowerSprite';
import { DEPLOY_INTRO_SEQUENCE, TUTORIAL_MIN_TOWERS } from '../config/tutorial';
import { landscapeCoachLayout, TutorialCoach } from '../ui/TutorialCoach';
import { GAME_WIDTH, GAME_HEIGHT, prepareLandscapeScene } from '../core/Game';
import { applyTextResolution } from '../core/renderUtils';

interface DragState {
  item: ItemInstance;
  source: 'inventory' | 'grid';
  gridPos: { row: number; col: number } | null;
  sprite: Phaser.GameObjects.Container;
  originX: number;
  originY: number;
}

interface LootStack {
  type: ItemInstance['type'];
  tier: number;
  items: ItemInstance[];
}

interface InventoryLayout {
  originX: number;
  originY: number;
  gap: number;
  slot: number;
  cols: number;
  iconSize: number;
}

function groupLoot(loot: ItemInstance[]): LootStack[] {
  const order: string[] = [];
  const map = new Map<string, ItemInstance[]>();
  for (const item of loot) {
    const key = `${item.type}_${item.tier}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }
  return order.map((key) => {
    const items = map.get(key)!;
    return { type: items[0].type, tier: items[0].tier, items };
  });
}

function takeOneFromLoot(loot: ItemInstance[], item: ItemInstance): ItemInstance[] {
  const idx = loot.findIndex((i) => i.id === item.id);
  if (idx < 0) return loot;
  return [...loot.slice(0, idx), ...loot.slice(idx + 1)];
}

export class DeployScene extends Phaser.Scene {
  private board!: GridBoard;
  private cellSize = GRID_CELL_SIZE;
  private gridX = 0;
  private gridY = 80;
  private towerSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private inventorySprites: Phaser.GameObjects.Container[] = [];
  private inventoryEmptyText: Phaser.GameObjects.Text | null = null;
  private activeDrag: DragState | null = null;
  private selectedItem: ItemInstance | null = null;
  private infoText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private defenseStarted = false;
  private itemTooltip = new ItemTooltipView();
  private tutorialCoach = new TutorialCoach();
  private tutorialMergeHintShown = false;
  private tutorialCoachLayout = landscapeCoachLayout(650);

  constructor() {
    super('DeployScene');
  }

  create(): void {
    const run = gameState.run;
    if (!run) { this.scene.start('LevelSelectScene'); return; }

    prepareLandscapeScene(this);

    this.children.removeAll(true);
    this.time.removeAllEvents();

    this.board = new GridBoard(run.placedTowers);
    this.gridX = (GAME_WIDTH - GRID_SIZE * this.cellSize) / 2;
    this.activeDrag = null;
    this.selectedItem = null;
    this.defenseStarted = false;
    this.towerSprites.clear();
    this.inventorySprites = [];
    this.inventoryEmptyText = null;
    this.tutorialCoach.destroy();
    this.tutorialCoach = new TutorialCoach();
    this.tutorialMergeHintShown = false;

    addRhythmTdBackdrop(this, getRunChapterTheme());
    this.add.text(GAME_WIDTH / 2, 30, gameState.tutorialMode ? '🎵 部署教学 — 放置并合成' : '🎵 律动手牌 — 放置并合成', { ...TD_TITLE_STYLE }).setOrigin(0.5).setDepth(10);

    this.infoText = this.add.text(GAME_WIDTH / 2, 55, '', { ...TD_BODY_STYLE }).setOrigin(0.5).setDepth(10);
    this.hintText = this.add.text(GAME_WIDTH / 2, 75, '拖拽放置合成 · 🥁底鼓 · 🪘军鼓 · 🎵踩镲 · ✨碎镲', {
      fontSize: '13px', color: RHYTHM_THEME.textMuted, fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(10);

    const invLayout = this.getInventoryLayout();
    this.add.text(invLayout.originX, invLayout.originY - 20, '已获得', {
      fontSize: '14px',
      color: RHYTHM_THEME.textAccent,
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(12);

    this.drawGrid();
    this.drawInventory(run.loot);
    this.refreshInfo();

    createTextButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 50, '进入律动守卫', () => this.startDefense());

    if (gameState.tutorialMode) {
      this.time.delayedCall(300, () => {
        this.tutorialCoach.showSequence(
          this,
          [...DEPLOY_INTRO_SEQUENCE],
          this.tutorialCoachLayout,
        );
      });
    }
  }

  private onTutorialTowerPlaced(): void {
    if (!gameState.tutorialMode) return;
    this.tutorialCoach.showOnce(this, 'deploy_placed', this.tutorialCoachLayout);
    const placed = this.board.getPlacedTowers().length;
    if (placed >= 2 && !this.tutorialMergeHintShown && !this.tutorialCoach.isVisible()) {
      this.tutorialMergeHintShown = true;
      this.time.delayedCall(500, () => {
        if (!this.tutorialCoach.isVisible()) {
          this.tutorialCoach.showOnce(this, 'deploy_merge', this.tutorialCoachLayout);
        }
      });
    }
    if (placed >= TUTORIAL_MIN_TOWERS) {
      this.tutorialCoach.showOnce(this, 'deploy_start', this.tutorialCoachLayout);
    }
  }

  private onTutorialMerge(): void {
    if (!gameState.tutorialMode) return;
    this.tutorialCoach.showOnce(this, 'deploy_merge_done', this.tutorialCoachLayout);
    if (this.board.getPlacedTowers().length >= TUTORIAL_MIN_TOWERS) {
      this.tutorialCoach.showOnce(this, 'deploy_start', this.tutorialCoachLayout);
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
      this.pickUpFromGrid(row, col);
      return;
    }

    if (this.selectedItem) {
      this.placeFromInventory(row, col, this.selectedItem);
      this.selectedItem = null;
      this.redrawTowers();
      this.drawInventory(gameState.run!.loot);
      this.refreshInfo();
    }
  }

  private pickUpFromGrid(row: number, col: number): void {
    const cell = this.board.getCell(row, col);
    if (!cell?.item) return;
    const item = this.board.remove(row, col)!;
    this.selectedItem = item;
    this.redrawTowers();
    this.refreshInfo();
    this.hintText.setText(`已选中 ${getItemDef(item.type, item.tier).name}，点击空格放置或合成`);
  }

  private placeFromInventory(row: number, col: number, item: ItemInstance): void {
    const run = gameState.run!;
    const cell = this.board.getCell(row, col);
    if (!cell || cell.isCore) return;

    if (!cell.item) {
      if (run.loot.some((i) => i.id === item.id)) {
        this.board.place(row, col, item);
        run.loot = takeOneFromLoot(run.loot, item);
      } else {
        this.board.place(row, col, item);
      }
      this.hintText.setText('拖拽道具到棋盘，或点击选中后点击空格放置');
      this.onTutorialTowerPlaced();
      return;
    }

    if (canMerge(item, cell.item) && run.mergeUsesLeft > 0) {
      const merged = mergeItems(item, cell.item);
      this.board.remove(row, col);
      this.board.place(row, col, merged);
      if (run.loot.some((i) => i.id === item.id)) {
        run.loot = takeOneFromLoot(run.loot, item);
      }
      run.mergeUsesLeft--;
      this.onTutorialMerge();
    }
  }

  private getInventoryLayout(): InventoryLayout {
    const originX = 12;
    const originY = 88;
    const iconSize = 52;
    const labelH = 14;
    const gap = 64;
    const slot = iconSize + labelH + 4;
    const availableWidth = Math.max(88, this.gridX - originX - 12);
    const cols = Math.max(2, Math.floor(availableWidth / gap));
    return { originX, originY, gap, slot, cols, iconSize };
  }

  private drawInventory(loot: ItemInstance[]): void {
    this.itemTooltip.hide();
    this.inventorySprites.forEach((s) => s.destroy());
    this.inventorySprites = [];
    if (this.inventoryEmptyText) {
      this.inventoryEmptyText.destroy();
      this.inventoryEmptyText = null;
    }

    const layout = this.getInventoryLayout();
    const stacks = groupLoot(loot);
    if (stacks.length === 0) {
      this.inventoryEmptyText = this.add.text(layout.originX, layout.originY + 8, '（暂无道具）', {
        fontSize: '13px', color: RHYTHM_THEME.textMuted, fontFamily: 'Arial',
      }).setOrigin(0, 0).setDepth(12);
      return;
    }

    stacks.forEach((stack, i) => {
      const col = i % layout.cols;
      const row = Math.floor(i / layout.cols);
      const x = Math.round(layout.originX + layout.slot / 2 + col * layout.gap);
      const y = Math.round(layout.originY + layout.slot / 2 + row * layout.gap);
      const sprite = this.createInventoryStackSprite(x, y, stack, layout.iconSize);
      const rep = stack.items[0];
      this.setupDraggable(sprite, rep, 'inventory');
      this.attachItemTip(sprite, () => rep, stack.items.length);
      if (this.selectedItem && stack.items.some((it) => it.id === this.selectedItem!.id)) {
        sprite.setScale(1.1);
      }
      this.inventorySprites.push(sprite);
    });
  }

  private createInventoryStackSprite(x: number, y: number, stack: LootStack, iconSize: number): Phaser.GameObjects.Container {
    const rep = stack.items[0];
    const visual = createTowerVisual(this, 0, 0, rep, {
      displaySize: iconSize,
      showProfession: true,
      inventoryMode: true,
    });
    const countBadge = this.createStackCountBadge(stack.items.length, iconSize);

    const wrapper = this.add.container(x, y, [visual, countBadge]);
    wrapper.setSize(iconSize, iconSize);
    wrapper.setData('item', rep);
    wrapper.setData('stackItems', stack.items);
    wrapper.setDepth(12);
    return wrapper;
  }

  private createStackCountBadge(count: number, iconSize: number): Phaser.GameObjects.Container {
    const badgeW = Math.max(18, Math.round(iconSize * 0.38));
    const badgeH = Math.max(16, Math.round(iconSize * 0.3));
    const offset = iconSize * 0.38;
    const g = this.add.graphics();
    g.fillStyle(0x7b4fff, 1);
    g.fillRoundedRect(-badgeW, -badgeH, badgeW, badgeH, 4);

    const fontSize = Math.max(11, Math.round(iconSize * 0.24));
    const label = applyTextResolution(this.add.text(-badgeW / 2, -badgeH / 2, String(count), {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    return this.add.container(offset, offset, [g, label]);
  }

  private createItemSprite(x: number, y: number, item: ItemInstance): Phaser.GameObjects.Container {
    const container = createTowerVisual(this, x, y, item, {
      displaySize: this.cellSize - 10,
      showProfession: true,
    });
    container.setData('item', item);
    return container;
  }

  private attachItemTip(
    sprite: Phaser.GameObjects.Container,
    getItem: () => ItemInstance,
    count?: number,
  ): void {
    attachItemTooltip(this, this.itemTooltip, sprite, getItem, {
      count,
      cellSize: this.cellSize,
      isDragActive: () => this.activeDrag !== null,
    });
  }

  private setupDraggable(
    sprite: Phaser.GameObjects.Container,
    item: ItemInstance,
    source: 'inventory' | 'grid',
    gridPos?: { row: number; col: number },
  ): void {
    sprite.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(sprite);

    sprite.on('pointerdown', () => {
      const stackItems = sprite.getData('stackItems') as ItemInstance[] | undefined;
      const pick = stackItems?.[0] ?? item;
      this.selectedItem = pick;
      this.hintText.setText(`已选中 ${getItemDef(pick.type, pick.tier).name} ×${stackItems?.length ?? 1}`);
    });

    sprite.on('dragstart', () => {
      this.itemTooltip.hide();
      const stackItems = sprite.getData('stackItems') as ItemInstance[] | undefined;
      const dragItem = stackItems?.[0] ?? item;
      this.activeDrag = {
        item: dragItem,
        source,
        gridPos: gridPos ? { ...gridPos } : null,
        sprite,
        originX: sprite.x,
        originY: sprite.y,
      };
      sprite.setDepth(200);
      sprite.setScale(1.1);
      if (source === 'grid' && gridPos) {
        this.board.remove(gridPos.row, gridPos.col);
      }
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

      if (!placed && this.activeDrag.source === 'grid' && this.activeDrag.gridPos) {
        this.board.place(this.activeDrag.gridPos.row, this.activeDrag.gridPos.col, this.activeDrag.item);
      }

      sprite.setScale(1);
      this.activeDrag = null;
      this.redrawTowers();
      this.drawInventory(gameState.run!.loot);
      this.refreshInfo();
    });
  }

  private pointerToGrid(pointer: Phaser.Input.Pointer): { row: number; col: number } {
    const col = Math.floor((pointer.x - this.gridX) / this.cellSize);
    const row = Math.floor((pointer.y - this.gridY) / this.cellSize);
    return { row, col };
  }

  private handleDrop(row: number, col: number, drag: DragState): boolean {
    const run = gameState.run!;
    const cell = this.board.getCell(row, col);
    if (!cell || cell.isCore) return false;

    if (drag.source === 'inventory') {
      if (!cell.item) {
        this.board.place(row, col, drag.item);
        run.loot = takeOneFromLoot(run.loot, drag.item);
        this.onTutorialTowerPlaced();
        return true;
      }
      if (canMerge(drag.item, cell.item) && run.mergeUsesLeft > 0) {
        const merged = mergeItems(drag.item, cell.item);
        this.board.remove(row, col);
        this.board.place(row, col, merged);
        run.loot = takeOneFromLoot(run.loot, drag.item);
        run.mergeUsesLeft--;
        this.onTutorialMerge();
        return true;
      }
      return false;
    }

    if (!drag.gridPos) return false;

    if (row === drag.gridPos.row && col === drag.gridPos.col) {
      this.board.place(row, col, drag.item);
      return true;
    }

    if (!cell.item) {
      this.board.place(row, col, drag.item);
      return true;
    }

    if (canMerge(drag.item, cell.item) && run.mergeUsesLeft > 0) {
      const merged = mergeItems(drag.item, cell.item);
      this.board.remove(row, col);
      this.board.place(row, col, merged);
      run.mergeUsesLeft--;
      this.onTutorialMerge();
      return true;
    }

    return false;
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
      const sprite = this.createItemSprite(x, y, placed.item);
      this.setupDraggable(sprite, placed.item, 'grid', { row: placed.row, col: placed.col });
      this.attachItemTip(sprite, () => placed.item);
      this.towerSprites.set(`${placed.row}_${placed.col}`, sprite);
    }
  }

  private refreshInfo(): void {
    const run = gameState.run!;
    this.infoText.setText(`合成次数: ${run.mergeUsesLeft} | 已部署: ${this.board.getPlacedTowers().length} | 剩余道具: ${run.loot.length}`);
  }

  private startDefense(): void {
    if (this.defenseStarted) return;
    const placedCount = this.board.getPlacedTowers().length;
    if (gameState.tutorialMode && placedCount < TUTORIAL_MIN_TOWERS) {
      showRhythmToast(this, `请先放置至少 ${TUTORIAL_MIN_TOWERS} 个道具`, RHYTHM_THEME.noteYellow);
      return;
    }
    this.defenseStarted = true;
    this.tutorialCoach.destroy();
    const run = gameState.run!;
    run.placedTowers = this.board.getPlacedTowers();
    run.shield = 0;
    run.victory = false;
    run.defenseGold = 0;
    run.killCount = 0;
    run.wavesCleared = 0;
    this.time.removeAllEvents();
    this.scene.start('DefenseScene');
  }

  shutdown(): void {
    this.itemTooltip.hide();
    this.tutorialCoach.destroy();
    this.time.removeAllEvents();
  }
}
