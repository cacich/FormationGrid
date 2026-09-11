import type { UnitId } from './units.ts';

// Each chapter introduces one new unit type; levels are 0-based and contiguous.
export const CHAPTERS: {
  name: string;
  from: number;
  to: number;
  units: UnitId[];
  intro: string;
}[] = [
  { name: '前哨', from: 0, to: 4, units: [0, 1], intro: '步兵守住眼前一格，弓兵射向前方三格。' },
  { name: '列陣', from: 5, to: 11, units: [0, 1, 2], intro: '新兵種「劍士」：一次橫掃前方三格。' },
  { name: '奔襲', from: 12, to: 19, units: [0, 1, 2, 3], intro: '新兵種「騎兵」：日字跳躍，越過正前方直取側翼。' },
  { name: '秘術', from: 20, to: 29, units: [0, 1, 2, 3, 4], intro: '新兵種「法師」：沿兩條前斜線施術各兩格。' },
  { name: '親征', from: 30, to: 39, units: [0, 1, 2, 3, 4, 5], intro: '新兵種「將軍」：鎮守四周六格，唯獨背後斜角是死角。' },
];
export const chapterOf = (level: number) =>
  CHAPTERS.findIndex((c) => level >= c.from && level <= c.to);
