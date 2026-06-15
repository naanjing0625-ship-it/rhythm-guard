import { getScaledEnemy, type EnemyType, type WaveConfig } from '../../config/enemies';

import type { EnemyState } from './Enemy';



export interface SpawnEvent {

  enemy: EnemyState;

  waveIndex: number;

}



export interface WaveUpdateResult {

  spawned: SpawnEvent[];

  waveStarted: number | null;

  waveSpawnFinished: number | null;

}



export class WaveManager {

  private waves: WaveConfig[];

  private waveIndex = 0;

  private spawnQueue: { type: EnemyType; waveIndex: number }[] = [];

  private spawnTimer = 0;

  private waveDelay = 0;

  private state: 'waiting' | 'spawning' | 'between' | 'done' = 'waiting';

  private spawnIndex = 0;



  constructor(waves: WaveConfig[]) {

    this.waves = waves;

    this.startNextWave();

  }



  get currentWave(): number {

    return Math.min(this.waveIndex + 1, this.waves.length);

  }



  get totalWaves(): number {

    return this.waves.length;

  }



  get isDone(): boolean {

    return this.state === 'done';

  }



  private startNextWave(): void {

    if (this.waveIndex >= this.waves.length) {

      this.state = 'done';

      return;

    }

    const wave = this.waves[this.waveIndex];

    this.spawnQueue = [];

    for (const group of wave.enemies) {

      for (let i = 0; i < group.count; i++) {

        this.spawnQueue.push({ type: group.type, waveIndex: this.waveIndex });

      }

    }

    this.spawnIndex = 0;

    this.waveDelay = wave.delayBefore;

    this.state = 'waiting';

  }



  update(deltaMs: number, spawnFn: (type: EnemyType, waveIndex: number) => EnemyState | null): WaveUpdateResult {

    const spawned: SpawnEvent[] = [];

    let waveStarted: number | null = null;

    let waveSpawnFinished: number | null = null;



    if (this.state === 'done') return { spawned, waveStarted, waveSpawnFinished };



    if (this.state === 'waiting') {

      this.waveDelay -= deltaMs;

      if (this.waveDelay <= 0) {

        this.state = 'spawning';

        this.spawnTimer = 0;

        waveStarted = this.waveIndex;

      }

      return { spawned, waveStarted, waveSpawnFinished };

    }



    this.spawnTimer -= deltaMs;

    if (this.spawnTimer <= 0 && this.spawnIndex < this.spawnQueue.length) {

      const entry = this.spawnQueue[this.spawnIndex++];

      const wave = this.waves[entry.waveIndex];

      const group = wave.enemies.find((g) => g.type === entry.type);

      const enemy = spawnFn(entry.type, entry.waveIndex);

      if (enemy) spawned.push({ enemy, waveIndex: entry.waveIndex });

      this.spawnTimer = group?.interval ?? 1000;

    }



    if (this.state === 'spawning' && this.spawnIndex >= this.spawnQueue.length) {

      waveSpawnFinished = this.waveIndex;

      this.waveIndex++;

      if (this.waveIndex < this.waves.length) {

        this.startNextWave();

      } else {

        this.state = 'done';

      }

    }



    return { spawned, waveStarted, waveSpawnFinished };

  }

}



export { getScaledEnemy };


