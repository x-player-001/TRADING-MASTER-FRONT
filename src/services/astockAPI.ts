import { astockGet } from './astockApiClient';

// ===== 市场状态 =====
export interface MarketStatus {
  trade_date: string;          // YYYY-MM-DD
  sh_pct_chg: number | null;   // 上证涨跌幅
  gem_pct_chg: number | null;  // 创业板涨跌幅
  below_ma20: boolean;         // 是否跌破MA20
  is_open: boolean;            // 是否开盘/可交易
  reason: string | null;       // 不可交易原因等
}

// ===== 每日选股 =====
export type BoardGroup = 'main' | 'other';

export interface Pick {
  id: number;
  trade_date: string;
  code: string;
  name: string;
  rank: number;
  total_score: number;
  factor_scores: Record<string, number>;
  reasons: string | null;
  decision_raw_close: number | null;
  limit_up: boolean;           // 是否涨停
  tradable: boolean;           // 是否可交易
  param_version: string;       // 当前条目所属套别 v1 / v2
  board_group: BoardGroup;     // 主板 / 非主板
  also_in_versions: string[];  // 同时被哪些其他套选中（非空=双选,信号强）
}

export interface DailyPicks {
  trade_date: string;
  market: MarketStatus | null;
  actionable: boolean;         // 当日是否适合操作
  main: Pick[];                // 主板 Top10
  other: Pick[];               // 非主板 Top10
  picks: Pick[];               // 合并 20 只（兼容保留）
}

// ===== 个股详情 =====
export interface Factor {
  trade_date: string;
  passed_hard_filter: boolean;
  reject_reasons: string | null;
  in_pullback_window: boolean;
  total_score: number;
  score_low_position: number;
  score_shrink_consolidation: number;
  score_probe_pullback: number;
  score_small_yang: number;
  score_confirm_prev_high: number;
  score_pullback_ma5: number;
  score_healthy_turnover: number;
  score_strong_rally: number;
  score_chip_concentration: number;
  score_sector_strength: number;
}

export interface StockDetail {
  code: string;
  name: string | null;
  industry: string | null;
  board: string | null;
  factors: Factor[];
  pick_history: Pick[];
}

// ===== 验证回测 =====
export interface ValidationReport {
  id: number;
  period_start: string;
  period_end: string;
  param_version: string;
  pick_count: number;
  tradable_count: number;
  hit_rate_7pct: number | null;
  avg_t3_high_ret: number | null;
  avg_profit_loss_ratio: number | null;
  benchmark_market_ret: number | null;
  benchmark_random_hit_rate: number | null;
  edge_over_random: number | null;
  created_at: string;
}

export interface DailyValidation {
  snapshot_id: number;
  trade_date: string;
  code: string;
  name: string;
  rank: number;
  total_score: number;
  board_group: BoardGroup;
  param_version: string;
  t1_high_ret: number | null;
  t2_high_ret: number | null;
  t3_high_ret: number | null;
  t1_close_ret: number | null;
  t2_close_ret: number | null;
  t3_close_ret: number | null;
  hit_7pct: boolean | null;
  max_drawdown: number | null;
  is_complete: boolean;
}

// ===== 参数版本 =====
export interface ParamVersion {
  version: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

// ===== K线 =====
export interface KlineBar {
  trade_date: string;          // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;               // 后复权（画图用）
  raw_close: number;           // 原始收盘价
  volume: number;
  amount: number;
  pct_chg: number;
  turnover: number;
}

export interface KlineMark {
  trade_date: string;          // 被选中的日期（买点）
  rank: number;
  total_score: number;
  reasons: string | null;
}

export interface KlineResponse {
  code: string;
  name: string;
  adjust: string;              // hfq / none
  bars: KlineBar[];
  marks: KlineMark[];
}

// 因子字段中文名映射（用于详情展示）
export const FACTOR_LABELS: Record<string, string> = {
  score_low_position: '低位',
  score_shrink_consolidation: '缩量横盘',
  score_probe_pullback: '试探回踩',
  score_small_yang: '小阳',
  score_confirm_prev_high: '确认前高',
  score_pullback_ma5: '回踩MA5',
  score_healthy_turnover: '健康换手',
  score_strong_rally: '强势上涨',
  score_chip_concentration: '筹码集中',
  score_sector_strength: '板块强度',
};

// 策略版本：v1=不看板块, v2=结合板块
export type StrategyVersion = 'v1' | 'v2';

class AStockAPIService {
  // 某交易日 Top N 选股（不传 date 默认最近一个交易日）
  async getDailyPicks(date?: string, version?: StrategyVersion): Promise<DailyPicks> {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    if (version) params.version = version;
    return astockGet<DailyPicks>('/api/picks/daily', { params });
  }

  // 有选股记录的交易日列表
  async getPickDates(limit = 60): Promise<string[]> {
    return astockGet<string[]>('/api/picks/dates', { params: { limit } });
  }

  // 个股详情（因子明细 + 历史入选）
  async getStockDetail(code: string, days = 30): Promise<StockDetail> {
    return astockGet<StockDetail>(`/api/picks/${code}/detail`, { params: { days } });
  }

  // 周期验证报告汇总
  async getValidationSummary(limit = 12, version?: StrategyVersion): Promise<ValidationReport[]> {
    const params: Record<string, unknown> = { limit };
    if (version) params.version = version;
    return astockGet<ValidationReport[]>('/api/validation/summary', { params });
  }

  // 某交易日选股的事后验证明细
  async getDailyValidation(date: string, version?: StrategyVersion): Promise<DailyValidation[]> {
    const params: Record<string, unknown> = { date };
    if (version) params.version = version;
    return astockGet<DailyValidation[]>('/api/validation/daily', { params });
  }

  // 市场状态
  async getMarketStatus(date?: string): Promise<MarketStatus> {
    return astockGet<MarketStatus>('/api/market/status', { params: date ? { date } : undefined });
  }

  // 参数版本列表
  async getParamVersions(): Promise<ParamVersion[]> {
    return astockGet<ParamVersion[]>('/api/params/versions');
  }

  // 个股K线（含选中买点标记）
  async getKline(code: string, params?: {
    limit?: number;
    start?: string;
    end?: string;
    adjust?: 'hfq' | 'none';
  }): Promise<KlineResponse> {
    return astockGet<KlineResponse>(`/api/quotes/${code}/kline`, { params });
  }
}

export const astockAPI = new AStockAPIService();
export default AStockAPIService;
