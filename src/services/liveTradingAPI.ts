import { apiGet, API_BASE_URL } from './apiClient';
import type { PaperDailyPoint, PaperEquityPoint, PaperTrade, PaperTradeFeatures } from './paperTradingAPI';

// ===== 实盘（只读） =====
// 文档：docs/LIVE_TRADING_API.md
// 交易由服务器 pm2 `live` 进程在币安真实下单；暂停 / 恢复 / 一键平仓只能在服务器上执行，接口只读。
// 响应为 { success, data }，apiClient 已自动解包；/trades 的 total 在 data 外层，单独用 fetch 取。
// 时间均为毫秒时间戳（UTC），金额单位 USDT；win_rate 是 0~1 小数。

export type LivePhase = 'running' | 'starting' | 'reconnecting' | 'lagging' | 'offline';
export type LiveMode = 'live' | 'shadow';
export type LiveControl = 'running' | 'paused' | 'flatten';

export interface LiveRuntimeStatus {
  phase: LivePhase;
  online: boolean;
  mode: LiveMode | null;
  control: LiveControl | null;
  data_lag_minutes: number | null;
  uptime_minutes: number | null;
  server_time: number;
  /** 北京时间今日已平仓净盈亏 */
  today_pnl: number | null;
  daily_loss_limit: number | null;
  /** 进程从未运行过时为 null */
  status: {
    started_at: number;
    heartbeat_at: number;
    mode: LiveMode;
    control: LiveControl;
    market_ws: boolean;
    user_ws: boolean;
    last_bar_time: number;
    balance: number;
    available: number;
    active_trades: number;
    error_trades: number;
  } | null;
}

export interface LiveConfig {
  strategy_ids?: string[];
  risk_per_trade_usdt: number;
  max_notional_usdt: number;
  max_leverage: number;
  max_active_trades: number;
  daily_loss_limit_usdt: number;
  [key: string]: unknown;
}

export type LiveTradeStatus =
  | 'placing'
  | 'pending'
  | 'entering'
  | 'open'
  | 'closing'
  | 'closed'
  | 'cancelled'
  | 'skipped'
  | 'shadow'
  | 'error';

export interface LiveTrade {
  id: number;
  strategy_id: string;
  symbol: string;
  timeframe: string;
  side: 'short' | 'long';
  status: LiveTradeStatus;
  trigger_time: number;
  setup_time: number;
  signal_time: number;
  entry_trigger: number;
  entry_limit: number | null;
  base_stop: number;
  stop_price: number | null;
  take_profit: number | null;
  planned_qty: number | null;
  leverage: number | null;
  risk_usdt: number | null;
  expire_at: number | null;
  max_hold_until: number | null;
  entry_mode: 'algo' | 'ioc' | null;
  filled_qty: number | null;
  fill_price: number | null;
  fill_time: number | null;
  exit_time: number | null;
  exit_price: number | null;
  exit_reason: string | null;
  gross_pnl: number | null;
  fees: number | null;
  funding: number | null;
  pnl: number | null;
  r_multiple: number | null;
  mfe_r: number | null;
  mae_r: number | null;
  cancel_reason: string | null;
  error_msg: string | null;
  features: PaperTradeFeatures | null;
  /** 仅 open 有值 */
  last_price?: number | null;
  unrealized_pnl?: number | null;
  unrealized_r?: number | null;
}

export interface LiveStats {
  closed: number;
  wins: number;
  losses: number;
  win_rate: number | null;
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

export interface LiveGroupSummary {
  status_counts: Partial<Record<LiveTradeStatus, number>>;
  cancel_reasons: Record<string, number>;
  skip_reasons: Record<string, number>;
  stats: LiveStats;
}

export interface LiveSummary {
  config: LiveConfig;
  total: LiveGroupSummary & { total_funding: number };
  strategies: (LiveGroupSummary & { strategy_id: string; name: string; timeframe: string })[];
  open_positions: LiveTrade[];
  /** 其他进行中：placing / pending / entering / closing */
  pending_orders: LiveTrade[];
  /** 待人工处理，非空时醒目提示 */
  error_trades: LiveTrade[];
  unrealized_pnl: number;
}

export interface LiveLevel {
  kind: 'entry_trigger' | 'entry_limit' | 'base_stop' | 'stop' | 'take_profit' | string;
  price: number;
}

export interface LiveMarker {
  kind: 'trigger' | 'setup' | 'entry' | 'exit' | string;
  time: number;
  price: number | null;
  reason?: string;
}

export interface LiveEvent {
  id: number;
  kind: string;
  payload: unknown;
  created_at: string;
}

export interface LiveTradeDetail {
  trade: LiveTrade;
  interval: string;
  klines: { open_time: number; open: number; high: number; low: number; close: number; volume: number }[];
  levels: LiveLevel[];
  markers: LiveMarker[];
  events: LiveEvent[];
  /** 同一信号的模拟盘交易，没有为 null */
  paper_trade: PaperTrade | null;
}

export interface LiveTradesQuery {
  status?: LiveTradeStatus[];
  strategy_id?: string;
  symbol?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

export const LIVE_ACTIVE_STATUSES: LiveTradeStatus[] = ['placing', 'pending', 'entering', 'open', 'closing'];

export const LIVE_STATUS_LABELS: Record<LiveTradeStatus, string> = {
  placing: '下单中',
  pending: '挂单中',
  entering: '挂保护单',
  open: '持仓',
  closing: '平仓中',
  closed: '已平仓',
  cancelled: '已撤单',
  skipped: '已跳过',
  shadow: '影子记录',
  error: '需人工处理',
};

export const LIVE_EXIT_REASON_LABELS: Record<string, string> = {
  stop: '止损',
  take_profit: '止盈',
  time: '到期平仓',
  flatten: '一键平仓',
  protect_failed: '止损挂不上',
  wrong_side: '方向异常',
  external: '外部平仓',
};

export const LIVE_CANCEL_REASON_LABELS: Record<string, string> = {
  expired: '条件单到期未触发',
  stop_before_entry: '触发前先破新高',
  entry_unfilled: '跳空穿过 IOC 限价未成交',
  insufficient_margin: '保证金不足',
  rejected_on_trigger: '触发时被拒单',
  symbol_busy: '该币已有进行中的交易',
  max_active_trades: '进行中交易数已满',
  daily_loss_limit: '已达当日亏损上限',
  risk_out_of_range: '止损距离不在 0.3%~10%',
  symbol_dirty: '该币有非本程序的持仓 / 挂单',
  stale_signal: '信号延迟超过 90 秒',
  control_paused: '已暂停开仓',
  control_flatten: '一键平仓中',
  error_pending: '有交易待人工处理',
  below_min_qty: '数量低于最小下单量',
  below_min_notional: '名义价值低于最小值',
  stop_too_wide: '止损过宽',
  symbol_not_trading: '该币未在交易',
};

/** entry_rejected:<code> 这类带错误码的原因也能翻译 */
export const liveReasonLabel = (reason: string | null | undefined): string => {
  if (!reason) return '';
  if (reason.startsWith('entry_rejected')) return `挂单被拒${reason.includes(':') ? `（${reason.split(':')[1]}）` : ''}`;
  return LIVE_CANCEL_REASON_LABELS[reason] ?? reason;
};

export const LIVE_EVENT_LABELS: Record<string, string> = {
  entry_placed: '挂入场条件单',
  entry_ioc: '直接 IOC 下单',
  entry_filled: '入场成交',
  fill_recovered: '补查到成交',
  entry_cancel_sent: '发送撤单',
  insufficient_margin: '保证金不足',
  entry_rejected: '入场单被拒',
  cancelled: '已撤单',
  stop_placed: '止损单已挂',
  tp_placed: '止盈单已挂',
  stop_failed: '止损单失败',
  tp_failed: '止盈单失败',
  opened: '持仓建立',
  flatten_begin: '开始平仓',
  flatten_sent: '平仓单已发',
  flatten_failed: '平仓失败',
  closed: '已平仓',
  exit_reason_inferred: '推断平仓原因',
  op_error: '操作异常',
  error: '异常',
};

const BASE = '/api/live';

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

class LiveTradingAPIService {
  getStatus(): Promise<LiveRuntimeStatus> {
    return apiGet(`${BASE}/status`);
  }

  getConfig(): Promise<{ config: LiveConfig; strategies: unknown[] }> {
    return apiGet(`${BASE}/config`);
  }

  getSummary(params: { from?: number; to?: number } = {}): Promise<LiveSummary> {
    return apiGet(`${BASE}/summary`, { params: toParams(params) });
  }

  /** 不走 apiClient：total 在 data 外层，拦截器解包后会丢 */
  async getTrades(q: LiveTradesQuery = {}): Promise<{ data: LiveTrade[]; total: number }> {
    const qs = new URLSearchParams(Object.entries(toParams(q)).map(([k, v]) => [k, String(v)])).toString();
    const res = await fetch(`${API_BASE_URL}${BASE}/trades${qs ? `?${qs}` : ''}`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.success === false) {
      throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
    }
    const data: LiveTrade[] = Array.isArray(body.data) ? body.data : [];
    return { data, total: Number(body.total ?? data.length) };
  }

  getTrade(id: number, q: { interval?: string; bars_before?: number; bars_after?: number } = {}): Promise<LiveTradeDetail> {
    return apiGet(`${BASE}/trades/${id}`, { params: toParams(q) });
  }

  /** 结构同模拟盘：[{ time, trade_id, symbol, pnl, equity, drawdown }] */
  getEquity(params: { strategy_id?: string; from?: number; to?: number } = {}): Promise<PaperEquityPoint[]> {
    return apiGet(`${BASE}/equity`, { params: toParams(params) });
  }

  /** 结构同模拟盘：[{ date, trades, wins, pnl, r, equity }] */
  getDaily(params: { strategy_id?: string; days?: number } = {}): Promise<PaperDailyPoint[]> {
    return apiGet(`${BASE}/daily`, { params: toParams(params) });
  }
}

export const liveTradingAPI = new LiveTradingAPIService();
export default LiveTradingAPIService;
