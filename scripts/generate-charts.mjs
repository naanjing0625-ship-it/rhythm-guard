/**
 * 生成关卡律动时间点（不含颜色，进入游戏时随机黄/蓝/红）
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDirs = [
  join(__dirname, '../public/assets/charts'),
  join(__dirname, '../src/data/charts'),
];
for (const dir of outDirs) mkdirSync(dir, { recursive: true });

const SLOT_GAP = 0.7;
const SLOTS_PER_WAVE = 3;

const LEVEL_CHARTS = [
  { id: 'level_01', duration: 60, bpm: 120, waves: 7 },
  { id: 'level_02', duration: 65, bpm: 120, waves: 7 },
  { id: 'level_03', duration: 70, bpm: 120, waves: 8 },
  { id: 'level_04', duration: 75, bpm: 120, waves: 8 },
  { id: 'level_05', duration: 80, bpm: 120, waves: 9 },
  { id: 'level_06', duration: 85, bpm: 125, waves: 9 },
  { id: 'level_07', duration: 95, bpm: 125, waves: 10 },
  { id: 'level_08', duration: 105, bpm: 130, waves: 11 },
];

function waveTimes(startTime) {
  return Array.from({ length: SLOTS_PER_WAVE }, (_, i) => ({
    time: startTime + SLOT_GAP * i,
  }));
}

const WAVE_MIN_SPACING = 6;

function generateNotes(duration, waves) {
  const notes = [];
  const firstStart = 3.5;
  const lastWaveEnd = firstStart + SLOT_GAP * (SLOTS_PER_WAVE - 1) + 1.5;
  const spacing = waves <= 1
    ? 0
    : Math.max(WAVE_MIN_SPACING, (duration - lastWaveEnd) / (waves - 1));

  for (let w = 0; w < waves; w++) {
    const start = firstStart + w * spacing;
    if (start + lastWaveEnd - firstStart < duration - 0.5) {
      notes.push(...waveTimes(start));
    }
  }

  return notes.sort((a, b) => a.time - b.time);
}

for (const level of LEVEL_CHARTS) {
  const notes = generateNotes(level.duration, level.waves);
  const chart = {
    id: level.id,
    bpm: level.bpm,
    offset: 0,
    duration: level.duration,
    notes,
  };
  const payload = JSON.stringify(chart, null, 2);
  for (const dir of outDirs) {
    writeFileSync(join(dir, `${level.id}.json`), payload);
  }
  console.log(`${level.id}: ${notes.length} slots, ${level.duration}s @ ${level.bpm}BPM`);
}
