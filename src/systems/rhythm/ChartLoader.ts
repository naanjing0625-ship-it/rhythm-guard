import { CHARTS } from '../../config/charts';
import type { ChartNote } from './RingNote';

export interface ChartData {
  id: string;
  bpm: number;
  offset: number;
  duration: number;
  notes: ChartNote[];
}

export async function loadChart(chartId: string): Promise<ChartData> {
  const chart = CHARTS[chartId];
  if (!chart) throw new Error(`Chart not found: ${chartId}`);
  return chart as ChartData;
}
