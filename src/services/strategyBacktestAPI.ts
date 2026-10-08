import { apiGet, API_BASE_URL } from './apiClient';

// ===== 策略回测结果（只读） =====
// 文档：docs/STRATEGY_BACKTEST_API.md
// 回测由服务器脚本离线跑出并入库；接口对所有策略通用，前端按 annotations 画图，不为单个策略适配。
// 响应为 { success, data }，apiClient 已自动解包；列表的 total 在 data 外层，单独用 fetch 取。
// 时间均为毫秒时间戳（UTC）；win_rate / pnl_pct / mfe_pct / mae_pct 是小数，显示时乘 100。

export interface BacktestStrategy {
  id: string;
  name: string;
  description?: string;
  timeframe: string;
  version: number;
  default_params: Record<string, unknown>;
  param_docs?: { key: string; label: string }[];
  exit_reasons?: Record<string, string>;
}

export interface BacktestSummary {
  trades: number;
  wins: number;
  win_rate: number | null;
  total_pnl: number;
  avg_pnl: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  profit_factor: number | null;
  t_stat: number | null;
  avg_r: number | null;
  max_drawdown: number | null;
  max_consecutive_losses: number | null;
  symbols: number | null;
}

export interface BacktestGroupRow {
  key: string;
  trades: number;
  win_rate: number | null;
  total_pnl: number;
  avg_pnl: number | null;
}

export interface BacktestStats {
  summary: BacktestSummary;
  by_month: BacktestGroupRow[];
  by_exit_reason: BacktestGroupRow[];
  by_symbol?: BacktestGroupRow[];
}

export type BacktestRunStatus = 'running' | 'done' | 'failed';

export interface BacktestRun {
  id: number;
  strategy_id: string;
  strategy_name: string;
  strategy_version: number;
  timeframe: string;
  params: Record<string, unknown>;
  data_from: number | null;
  data_to: number | null;
  status: BacktestRunStatus;
  symbols_total: number | null;
  trade_count: number | null;
  signal_count: number | null;
  summary: BacktestStats | null;
  note: string | null;
  created_at: number | null;
  finished_at: number | null;
}

export type BacktestTradeStatus = 'closed' | 'unfilled';

export type BacktestAnnotation =
  | { type: 'marker'; time: number; price: number; label?: string; role?: 'entry' | 'exit' | 'point'; position?: 'above' | 'below'; color?: string }
  | { type: 'hline'; from_time: number; to_time: number; price: number; label?: string; style?: 'solid' | 'dashed'; color?: string }
  | { type: 'segment'; points: { time: number; price: number }[]; label?: string; color?: string }
  | { type: 'box'; from_time: number; to_time: number; top: number; bottom: number; label?: string; color?: string };

export interface BacktestTrade {
  id: number;
  run_id: number;
  strategy_id: string;
  symbol: string;
  timeframe: string;
  side: 'long' | 'short';
  status: BacktestTradeStatus;
  signal_time: number;
  entry_time: number | null;
  entry_price: number | null;
  stop_price: number | null;
  target_price: number | null;
  exit_time: number | null;
  exit_price: number | null;
  exit_reason: string | null;
  pnl: number | null;
  pnl_pct: number | null;
  r_multiple: number | null;
  mfe_pct: number | null;
  mae_pct: number | null;
  bars_held: number | null;
  features: Record<string, unknown> | null;
  /** 仅详情接口返回 */
  annotations?: BacktestAnnotation[];
}

export interface BacktestKline {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestTradeDetail {
  trade: BacktestTrade;
  klines: BacktestKline[];
  prev_id: number | null;
  next_id: number | null;
  /** 实际使用的K线周期（标注时间已对齐到该周期的K线） */
  interval?: string;
  /** 可选周期，用来生成切换按钮 */
  intervals?: string[];
}

export type BacktestSortKey = 'signal_time' | 'pnl' | 'r_multiple' | 'mfe_pct' | 'mae_pct';

/** 列表与详情共用的筛选条件（详情据此算上一笔 / 下一笔） */
export interface BacktestTradeFilters {
  status?: BacktestTradeStatus[];
  symbol?: string;
  exit_reason?: string[];
  result?: 'win' | 'loss';
  from?: number;
  to?: number;
}

export interface BacktestTradesQuery extends BacktestTradeFilters {
  sort?: BacktestSortKey;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

const BASE = '/api/strategy-backtest';

const toParams = (q: object): Record<string, string | number> => {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) out[k] = v.join(',');
    } else {
      out[k] = v as string | number;
    }
  }
  return out;
};

/** total 在 data 外层：不走 apiClient（拦截器解包后会丢） */
const getList = async <T>(path: string, q: object): Promise<{ data: T[]; total: number }> => {
  const qs = new URLSearchParams(Object.entries(toParams(q)).map(([k, v]) => [k, String(v)])).toString();
  const res = await fetch(`${API_BASE_URL}${BASE}${path}${qs ? `?${qs}` : ''}`);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.success === false) {
    throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  }
  const data: T[] = Array.isArray(body.data) ? body.data : [];
  return { data, total: Number(body.total ?? data.length) };
};

class StrategyBacktestAPIService {
  getStrategies(): Promise<BacktestStrategy[]> {
    return apiGet(`${BASE}/strategies`);
  }

  getRuns(q: { strategy_id?: string; limit?: number; offset?: number } = {}) {
    return getList<BacktestRun>('/runs', q);
  }

  getRun(id: number): Promise<{ run: BacktestRun; strategy: BacktestStrategy | null }> {
    return apiGet(`${BASE}/runs/${id}`);
  }

  getTrades(runId: number, q: BacktestTradesQuery = {}) {
    return getList<BacktestTrade>(`/runs/${runId}/trades`, q);
  }

  getStats(runId: number, q: { symbol?: string; from?: number; to?: number } = {}): Promise<BacktestStats> {
    return apiGet(`${BASE}/runs/${runId}/stats`, { params: toParams(q) });
  }

  /** interval 不传用交易本身的周期；bars_before / bars_after 的单位跟着所选周期走 */
  getTrade(
    id: number,
    q: BacktestTradeFilters & { interval?: string; bars_before?: number; bars_after?: number } = {}
  ): Promise<BacktestTradeDetail> {
    return apiGet(`${BASE}/trades/${id}`, { params: toParams(q) });
  }
}

export const strategyBacktestAPI = new StrategyBacktestAPIService();
export default StrategyBacktestAPIService;
