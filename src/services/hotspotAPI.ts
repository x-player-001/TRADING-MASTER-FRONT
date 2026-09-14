import { astockGet } from './astockApiClient';

// ===== 盘中热点（实时）=====
// 与 /api/sentiment/* 的根本区别：这组**不读库**，直接调同花顺 API + 60秒缓存，
// 盘中实时刷新。多客户端共享同一份缓存，轮询不会放大对上游的压力。
//
// ⚠️ 两个注意：
// 1. 依赖外部 API，上游抖动会直接反映到看板，失败返回 503（不是 500）。
//    前端应显示「数据源暂不可用」而非崩掉。
// 2. 盘中阶段用本组的 /sentiment（现算当下），历史趋势用 /api/sentiment/*（日频读库）。
//    实测同一时刻两者可能相反：实时「退潮·离场规避」vs 昨收「修复·谨慎试仓」。

export interface HotspotConcept {
  thscode: string;
  name: string;
  last_price: number | null;
  pct_chg: number | null;
  turnover: number | null;   // 成交额
  volume: number | null;
}

export interface HotspotTheme {
  theme: string;
  count: number;             // 该题材涨停家数
  max_boards: number;        // 该题材最高连板
  names: string[];
}

export interface HotspotLimitUp {
  code: string;
  name: string;
  pct_chg: number | null;
  last_price: number | null;
  boards: number;            // 连板数
  boards_text: string;       // 如「4天4板」
  limit_up_time: string | null;  // 首封时间
  seal_money: number | null;     // 封单金额
  max_seal_money: number | null;
  reason: string | null;         // 涨停原因串，如「800G光引擎+CPO+AI算力」
  themes: string[];              // 原因拆词后的题材标签
  is_st: boolean;
  is_new: boolean;
}

export interface HotspotHotStock {
  code: string;
  name: string;
  rank: number;
  heat: number | null;
  rank_change: number | null;
  rank_trend: 'up' | 'down' | 'flat' | string;
}

// 看板首屏：一次取全，各分量共享同一份缓存
export interface HotspotOverview {
  updated_at: string;
  zt_count: number;
  max_boards: number;
  lianban_count: number;     // 连板家数
  concepts: HotspotConcept[];
  themes: HotspotTheme[];
  top_limitup: HotspotLimitUp[];
  hot: HotspotHotStock[];
}

// 盘中实时情绪阶段——用当下涨停/跌停现算
export interface HotspotSentiment {
  as_of: string;
  trade_date: string | null;

  phase: string;             // 冰点/启动/主升/高潮/退潮/修复
  stance: string;            // 空仓观望/可以进场/持股待涨/减仓兑现/离场规避/谨慎试仓

  zt_count: number;
  dt_count: number;          // 跌停数
  zt_dt_ratio: number | null;// 涨跌停比
  first_board: number;
  ge2: number;
  ge3: number;
  ge5: number;
  height: number;
  tier_filled: number;

  advance_rate: number;      // 晋级率（小数）——最核心的指标

  phase_hist_ret5: number | null;
  phase_hist_excess5: number | null;
  phase_hist_days: number | null;

  prev_phase: string | null; // 昨收对照，便于看变化
  prev_zt_count: number | null;
  prev_height: number | null;
}

// 连板天梯的一档
export interface HotspotLadderTier {
  trade_date: string;
  tier: string;              // two_board / three_board ...
  boards: number;
  count: number;
  codes: string[];
  names: string[];
  seal_nextday: boolean[];   // 官方给出的次日是否封板，比自算准
}

// ── 展示辅助 ──────────────────────────────────────────
// 六阶段由强到弱
export const PHASE_ORDER = ['高潮', '主升', '启动', '修复', '冰点', '退潮'];

// 阶段配色：进攻性阶段偏暖，防守性阶段偏冷
export const PHASE_THEME: Record<string, { color: string; glow: string; label: string }> = {
  高潮: { color: '#ef4444', glow: 'rgba(239,68,68,0.45)', label: '情绪高潮' },
  主升: { color: '#f97316', glow: 'rgba(249,115,22,0.45)', label: '主升阶段' },
  启动: { color: '#f59e0b', glow: 'rgba(245,158,11,0.45)', label: '启动阶段' },
  修复: { color: '#3b82f6', glow: 'rgba(59,130,246,0.45)', label: '修复阶段' },
  冰点: { color: '#64748b', glow: 'rgba(100,116,139,0.45)', label: '冰点' },
  退潮: { color: '#10b981', glow: 'rgba(16,185,129,0.45)', label: '退潮' },
};

export const phaseTheme = (phase?: string | null) =>
  PHASE_THEME[phase ?? ''] ?? { color: '#6b7280', glow: 'rgba(107,114,128,0.4)', label: phase ?? '—' };

// 上游失败返回 503，据此显示「数据源暂不可用」
export const isUpstreamDown = (err: unknown): boolean => {
  const msg = (err as Error)?.message ?? '';
  return msg.includes('503') || msg.includes('服务暂时不可用');
};

// 这组要穿透到外部 API（同花顺），冷缓存时明显慢于读库接口，
// 单独放宽超时，避免刚打开页面就被默认 15 秒掐断
const HOTSPOT_TIMEOUT = 30000;

class HotspotAPIService {
  // 看板首屏（推荐：一次取全，避免多次往返）
  async getOverview(params: { top_concepts?: number; top_themes?: number } = {}): Promise<HotspotOverview> {
    return astockGet<HotspotOverview>('/api/hotspot/overview', { params, timeout: HOTSPOT_TIMEOUT });
  }

  // 盘中实时情绪阶段
  async getSentiment(): Promise<HotspotSentiment> {
    return astockGet<HotspotSentiment>('/api/hotspot/sentiment', { timeout: HOTSPOT_TIMEOUT });
  }

  // 今日主线（涨停原因拆词聚合）
  async getThemes(params: { date?: string; min_count?: number; limit?: number } = {}): Promise<HotspotTheme[]> {
    return astockGet<HotspotTheme[]>('/api/hotspot/themes', { params, timeout: HOTSPOT_TIMEOUT });
  }

  // 概念板块实时行情：涨幅与成交额同时靠前才是真有资金进场
  async getConcepts(params: { limit?: number; order_by?: 'pct' | 'turnover' } = {}): Promise<HotspotConcept[]> {
    return astockGet<HotspotConcept[]>('/api/hotspot/concepts', { params, timeout: HOTSPOT_TIMEOUT });
  }

  // 实时涨停池
  async getLimitUp(params: { date?: string; limit?: number } = {}): Promise<HotspotLimitUp[]> {
    return astockGet<HotspotLimitUp[]>('/api/hotspot/limitup', { params, timeout: HOTSPOT_TIMEOUT });
  }

  // 连板天梯，含官方 seal_nextday
  async getLadder(days = 1): Promise<HotspotLadderTier[]> {
    return astockGet<HotspotLadderTier[]>('/api/hotspot/ladder', { params: { days }, timeout: HOTSPOT_TIMEOUT });
  }

  // 人气榜 / 飙升榜
  async getHot(kind: 'hot' | 'skyrocket' = 'hot'): Promise<HotspotHotStock[]> {
    return astockGet<HotspotHotStock[]>('/api/hotspot/hot', { params: { kind }, timeout: HOTSPOT_TIMEOUT });
  }
}

export const hotspotAPI = new HotspotAPIService();
export default HotspotAPIService;
