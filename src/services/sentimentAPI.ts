import { astockGet } from './astockApiClient';

// ===== 市场情绪 =====
// 用涨停家数、连板高度、晋级率等刻画市场所处阶段（高潮/发酵/分歧/修复/冰点/退潮）。
//
// ⚠️ 三个使用注意（后端明确提示）：
// 1. seal_rate（封板率）只有近14个交易日有值，历史段为 null——封板率需要盘中
//    数据，日线算不出。画趋势图必须跳过空值，不能当 0 处理。
// 2. 行业粒度不统一：2026-08-21 之后是东财细分行业（一般零售、航运港口），
//    之前是证监会大类（C39计算机…）。跨期行业对比会混淆，看板只展示近期。
// 3. 阶段对「打板」无区分度——实测各阶段涨停股次日收益都在 1.8~2.0%。
//    阶段的价值在风险规避（冰点 -1.63、退潮 -0.65 超额），不要暗示某阶段适合打板。

// 连板梯队的一档
export interface SentimentTier {
  boards: number;          // 几连板
  count: number;           // 该档家数
  codes: string[];         // 前10只个股代码
  names: string[];
}

export interface SentimentToday {
  trade_date: string;

  phase: string;           // 阶段：高潮/发酵/分歧/修复/冰点/退潮
  phase_raw: string;       // 原始阶段判定
  stance: string;          // 建议姿态，如「谨慎试仓」

  zt_count: number;        // 涨停家数
  zb_count: number;        // 炸板家数
  seal_rate: number | null;// 封板率%，仅近14日有值
  first_board: number;     // 首板家数
  ge2: number;             // ≥2板家数
  ge3: number;
  ge5: number;
  height: number;          // 最高连板高度
  tier_filled: number;     // 梯队填充档数
  advance_rate: number;    // 晋级率（小数，0.2027 = 20.27%）

  prev_zt_avg_pct: number; // 昨日涨停股今日平均涨幅%
  prev_zt_win_rate: number;// 昨日涨停股今日胜率%
  strong_count: number;    // 强势股家数

  // 当前阶段的历史后续表现——比孤零零一个阶段标签有用得多
  phase_hist_ret5: number;    // 该阶段历史 T+5 平均收益%
  phase_hist_excess5: number; // 该阶段历史 T+5 平均超额%
  phase_hist_days: number;    // 该阶段历史样本天数

  tiers: SentimentTier[];  // 连板梯队，可画金字塔
}

// 历史序列的一天（按日期升序返回，可直接画图）
export interface SentimentTrendPoint {
  trade_date: string;
  zt_count: number;
  zb_count: number;
  seal_rate: number | null;  // ⚠️ 历史段为 null，画线需跳过
  height: number;
  ge2: number;
  advance_rate: number;
  phase: string;
}

// 行业热度
export interface SentimentIndustry {
  industry: string;
  zt_count: number;      // 涨停数
  max_boards: number;    // 最高板
  tier_count: number;    // 梯队档位
  ge2: number;           // 二板宽度
  heat: number;          // 热度 = 0.35×涨停数 + 0.25×最高板 + 0.25×梯队档位 + 0.15×二板宽度
  codes: string[];
  names: string[];
}

// 各阶段历史统计
export interface SentimentPhase {
  phase: string;
  days: number;          // 历史天数
  pct: number;           // 占比%
  avg_zt: number;        // 平均涨停家数
  avg_height: number;    // 平均最高板
  avg_advance: number;   // 平均晋级率（小数）
}

// ── 展示辅助 ──────────────────────────────────────────
// 阶段按情绪由强到弱排列，用于配色和排序
export const PHASE_ORDER = ['高潮', '发酵', '分歧', '修复', '冰点', '退潮'];

export const PHASE_COLORS: Record<string, string> = {
  高潮: '#ef4444',
  发酵: '#f97316',
  分歧: '#f59e0b',
  修复: '#3b82f6',
  冰点: '#6b7280',
  退潮: '#10b981',
};

// antd Tag 用色
export const PHASE_TAG_COLORS: Record<string, string> = {
  高潮: 'red',
  发酵: 'volcano',
  分歧: 'orange',
  修复: 'blue',
  冰点: 'default',
  退潮: 'green',
};

class SentimentAPIService {
  // 看板顶部总览（不传 date 默认最近一个交易日）
  async getToday(date?: string): Promise<SentimentToday> {
    return astockGet<SentimentToday>('/api/sentiment/today', {
      params: date ? { date } : undefined,
    });
  }

  // 历史序列，按日期升序
  async getTrend(days = 60): Promise<SentimentTrendPoint[]> {
    return astockGet<SentimentTrendPoint[]>('/api/sentiment/trend', { params: { days } });
  }

  // 行业热度榜
  async getIndustry(params: { date?: string; min_zt?: number; limit?: number } = {}): Promise<SentimentIndustry[]> {
    return astockGet<SentimentIndustry[]>('/api/sentiment/industry', { params });
  }

  // 各阶段历史统计
  async getPhases(): Promise<SentimentPhase[]> {
    return astockGet<SentimentPhase[]>('/api/sentiment/phases');
  }
}

export const sentimentAPI = new SentimentAPIService();
export default SentimentAPIService;
