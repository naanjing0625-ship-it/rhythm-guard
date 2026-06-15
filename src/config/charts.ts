import type { ChartData } from '../systems/rhythm/ChartLoader';
import levelTutorial from '../data/charts/level_tutorial.json';
import level01 from '../data/charts/level_01.json';
import level02 from '../data/charts/level_02.json';
import level03 from '../data/charts/level_03.json';
import level04 from '../data/charts/level_04.json';
import level05 from '../data/charts/level_05.json';
import level06 from '../data/charts/level_06.json';
import level07 from '../data/charts/level_07.json';
import level08 from '../data/charts/level_08.json';

export const CHARTS: Record<string, ChartData> = {
  level_tutorial: levelTutorial as ChartData,
  level_01: level01 as ChartData,
  level_02: level02 as ChartData,
  level_03: level03 as ChartData,
  level_04: level04 as ChartData,
  level_05: level05 as ChartData,
  level_06: level06 as ChartData,
  level_07: level07 as ChartData,
  level_08: level08 as ChartData,
};
