import { apiGet, API_BASE_URL } from './apiClient';

// ===== 模拟盘（只读） =====
// 文档：docs/PAPER_TRADING_API.md
// 交易由服务器 pm2 `paper` 进程用实时行情自动产生，接口只读。
// 响应为 { success, data }，apiClient 已自动解包；/trades 的 total 在 data 外层，单独用 fetch 取。
// 时间均为毫秒时间戳（UTC）；win_rate 是 0~1 小数，显示时乘 100。

export type PaperPhase = 'running' | 'starting' | 'reconnecting' | 'lagging' | 'offline';

export interface PaperRuntimeStatus {
  phase: PaperPhase;
  online: boolean;
  data_lag_minutes: number | null;
  uptime_minutes: number | null;
  server_time: number;
  /** 进程从未运行过时为 null */
  status: {
    started_at: number;
    heartbeat_at: number;
    last_bar_time: number;
    ws_connected: boolean;
    symbols: number;
    bars_processed: number;
    gap_filled: number;
    pending: number;
    open_positions: number;
  } | null;
}

export interface PaperAccount {
  risk_per_trade_usdt: number;
  fee_rate: number;
  one_position_per_symbol: boolean;
}

export interface PaperStrategy {
  id: string;
  name: string;
  enabled: boolean;
  timeframe: string;
  stop_atr_buffer: number;
  take_profit_r: number;
  order_valid_bars: number;
  max_hold_bars: number;
  filters: Record<string, number>;
}

export type PaperTradeStatus = 'pending' | 'open' | 'closed' | 'cancelled' | 'expired' | 'skipped';

export interface PaperTradeFeatures {
  dif_ratio?: number | null;
  hist_ratio?: number | null;
  gap?: number | null;
  gdep?: number | null;
  imp_pct?: number | null;
  leg_pct?: number | null;
  qv24_m?: number | null;
  qv_surge?: number | null;
  atr_pct?: number | null;
  range48?: number | null;
  wait?: number | null;
  wick?: number | null;
  body?: number | null;
  [key: string]: number | null | undefined;
}

export interface PaperTrade {
  id: number;
  strategy_id: string;
  symbol: string;
  timeframe: string;
  side: 'short' | 'long';
  status: PaperTradeStatus;
  trigger_time: number;
  setup_time: number;
  signal_time: number;
  entry_trigger: number;
  base_stop: number;
  stop_price: number | null;
  take_profit: number | null;
  expire_at: number | null;
  max_hold_until: number | null;
  fill_time: number | null;
  fill_price: number | null;
  qty: number | null;
  notional: number | null;
  risk_usdt: number;
  exit_time: number | null;
  exit_price: number | null;
  exit_reason: 'stop' | 'take_profit' | 'time' | null;
  gross_pnl: number | null;
  fees: number | null;
  pnl: number | null;
  r_multiple: number | null;
  mfe_r: number | null;
  mae_r: number | null;
  cancel_reason: string | null;
  features: PaperTradeFeatures | null;
  /** 仅持仓（status=open）有值 */
  last_price?: number | null;
  unrealized_pnl?: number | null;
  unrealized_r?: number | null;
}

export interface PaperStats {
  closed: number;
  wins: number;
  losses: number;
  win_rate: number | null; // 0~1
  total_pnl: number;
  total_fees: number;
  total_r: number;
  avg_r: number | null;
  profit_factor: number | null;
  max_drawdown: number;
  best_r: number | null;
  worst_r: number | null;
  by_exit_reason: Record<string, number>;
}

export interface PaperStrategySummary {
  strategy_id: string;
  name: string;
  enabled: boolean;
  status_counts: Record<PaperTradeStatus, number>;
  stats: PaperStats;
}

export interface PaperSummary {
  account: PaperAccount;
  total: PaperStats;
  strategies: PaperStrategySummary[];
  open_positions: PaperTrade[];
  pending_orders: PaperTrade[];
  unrealized_pnl: number;
}

export interface PaperTradesQuery {
  status?: PaperTradeStatus[];
  strategy_id?: string;
  symbol?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

export interface PaperKline {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PaperTradeDetail {
  trade: PaperTrade;
  timeframe: string;
  klines: PaperKline[];
}

export interface PaperEquityPoint {
  time: number;
  trade_id: number;
  symbol: string;
  pnl: number;
  equity: number;
  drawdown: number;
}

export interface PaperDailyPoint {
  date: string; // 'YYYY-MM-DD'（北京时间，按平仓日）
  trades: number;
  wins: number;
  pnl: number;
  r: number;
  equity: number;
}

export const PAPER_STATUS_LABELS: Record<PaperTradeStatus, string> = {
  pending: '挂单中',
  open: '持仓',
  closed: '已平仓',
  cancelled: '已撤单',
  expired: '已过期',
  skipped: '已跳过',
};

export const PAPER_EXIT_REASON_LABELS: Record<string, string> = {
  stop: '止损',
  take_profit: '止盈',
  time: '超时平仓',
};

export const PAPER_CANCEL_REASON_LABELS: Record<string, string> = {
  stop_before_entry: '成交前先破新高',
  risk_out_of_range: '止损距离超出 0.3%~10%',
  symbol_busy: '该币已有挂单或持仓',
};

const BASE = '/api/paper';

const cleanParams = (q: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== ''));

class PaperTradingAPIService {
  getStatus(): Promise<PaperRuntimeStatus> {
    return apiGet(`${BASE}/status`);
  }

  getStrategies(): Promise<{ account: PaperAccount; strategies: PaperStrategy[] }> {
    return apiGet(`${BASE}/strategies`);
  }

  getSummary(params: { from?: number; to?: number } = {}): Promise<PaperSummary> {
    return apiGet(`${BASE}/summary`, { params: cleanParams(params) });
  }

  /** 不走 apiClient：total 在 data 外层，拦截器解包后会丢 */
  async getTrades(q: PaperTradesQuery = {}): Promise<{ data: PaperTrade[]; total: number }> {
    const params = cleanParams({ ...q, status: q.status?.length ? q.status.join(',') : undefined });
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    const res = await fetch(`${API_BASE_URL}${BASE}/trades${qs ? `?${qs}` : ''}`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.success === false) {
      throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
    }
    const data: PaperTrade[] = Array.isArray(body.data) ? body.data : [];
    return { data, total: Number(body.total ?? data.length) };
  }

  getTrade(id: number, params: { bars_before?: number; bars_after?: number } = {}): Promise<PaperTradeDetail> {
    return apiGet(`${BASE}/trades/${id}`, { params: cleanParams(params) });
  }

  getEquity(params: { strategy_id?: string; from?: number; to?: number } = {}): Promise<PaperEquityPoint[]> {
    return apiGet(`${BASE}/equity`, { params: cleanParams(params) });
  }

  getDaily(params: { strategy_id?: string; days?: number } = {}): Promise<PaperDailyPoint[]> {
    return apiGet(`${BASE}/daily`, { params: cleanParams(params) });
  }
}

export const paperTradingAPI = new PaperTradingAPIService();
export default PaperTradingAPIService;
