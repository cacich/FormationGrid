import type { UnitId } from './units.ts';

export type Chapter = {
  name: string;
  from: number;
  to: number;
  units: UnitId[];
  intro: string;
};

// Story (tutorial): each chapter introduces one new unit type.
export const STORY_CHAPTERS: Chapter[] = [
  { name: '前哨', from: 0, to: 4, units: [0, 1], intro: '步兵守住眼前一格，弓兵射向前方三格。' },
  { name: '列陣', from: 5, to: 11, units: [0, 1, 2], intro: '新兵種「劍士」：一次橫掃前方三格。' },
  { name: '奔襲', from: 12, to: 19, units: [0, 1, 2, 3], intro: '新兵種「騎兵」：日字跳躍，越過正前方直取側翼。' },
  { name: '秘術', from: 20, to: 29, units: [0, 1, 2, 3, 4], intro: '新兵種「法師」：沿兩條前斜線施術各兩格。' },
  { name: '親征', from: 30, to: 39, units: [0, 1, 2, 3, 4, 5], intro: '新兵種「將軍」：鎮守四周六格，唯獨背後斜角是死角。' },
];

const ALL: UnitId[] = [0, 1, 2, 3, 4, 5];
const CAMPAIGN: [string, UnitId[], string][] = [
  ['邊境', [0, 1, 2], '步兵、弓兵、劍士鎮守邊境，敵軍還算稀疏。'],
  ['丘陵', [0, 1, 2, 3], '騎兵隨軍出征，丘陵間的敵軍開始分散。'],
  ['渡河', [0, 1, 2, 3, 4], '法師加入渡河部隊，斜線射程派上用場。'],
  ['密林', ALL, '將軍親臨，六種兵種全數開放。'],
  ['峽谷', ALL, '峽谷地形狹窄，敵軍藏在更刁鑽的位置。'],
  ['荒漠', ALL, '敵軍增援，兵力分配要更精打細算。'],
  ['雪嶺', ALL, '雪嶺之上，每個朝向都得反覆推敲。'],
  ['古堡', ALL, '古堡守軍密集，佈陣推理難度再升。'],
  ['天關', ALL, '天險關隘，幾乎每名敵軍都只有少數解法。'],
  ['王城', ALL, '最終決戰，全力攻下王城。'],
];
export const CAMPAIGN_CHAPTERS: Chapter[] = CAMPAIGN.map(([name, units, intro], i) => ({
  name,
  from: i * 10,
  to: i * 10 + 9,
  units,
  intro,
}));

export const chapterIndex = (chapters: Chapter[], level: number) =>
  chapters.findIndex((c) => level >= c.from && level <= c.to);
