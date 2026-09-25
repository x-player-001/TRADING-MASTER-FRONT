import { apiGet, apiPost, apiPatch, apiDelete, API_BASE_URL } from './apiClient';
import type {
  ReplayBar as EngineBar,
  ReplayIntervalBar,
  ReplayOrder,
  ReplayPosition,
  ReplayFill,
  ReplaySession,
  ReplayEvent,
  ReplayExitReason,
  ReplaySide,
  ReplayOrderType,
} from './kline_replay/replay_types';
import type { ReplaySyncPayload } from './kline_replay/replay_account';

// ===== K线回放 + 模拟交易 =====
// 文档：docs/KLINE_REPLAY_API.md
// 分工：前端揭示K线并撮合（kline_replay/ReplayAccount），后端只下发数据、存储交易记录和统计。
// 响应为 { success, data }，apiClient 已自动解包。时间均为毫秒时间戳。
// 百分比字段（mfe_pct / mae_pct / max_drawdown_pct）已经是百分数，不用再乘 100。

export type {
  ReplayOrder,
  ReplayPosition,
  ReplayFill,
  ReplaySession,
  ReplayEvent,
  ReplayExitReason,
  ReplaySide,
  ReplayOrderType,
  ReplaySyncPayload,
};

export type ReplayInterval = '5m' | '15m' | '1h' | '4h';
export const REPLAY_INTERVALS: ReplayInterval[] = ['5m', '15m', '1h', '4h'];
export const INTERVAL_MS: Record<ReplayInterval, number> = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
};

/** 图表用K线：5m 没有 is_closed；大周期最后一根可能未收盘 */
export type ReplayBar = EngineBar & { is_closed?: boolean };
export type { ReplayIntervalBar };

export interface DataCoverage {
  start_date: string; // 'YYYYMMDD'（北京时间）
  end_date: string;
  days: number;
}

/** 列表 / 状态里的会话一定有 id */
export type ReplaySessionRow = ReplaySession & { id: number };

/** GET /sessions/:id 与 POST /sessions 的返回：用于恢复 ReplayAccount */
export interface ReplaySessionState {
  session: ReplaySessionRow;
  cursor_bar: EngineBar;
  positions: ReplayPosition[];
  orders: ReplayOrder[];
  fills: ReplayFill[];
}

export interface BarsChunk {
  bars: EngineBar[];
  end_of_data: boolean;
}

export interface CreateSessionParams {
  symbol: string;
  start_time: number;
  name?: string;
  initial_balance?: number;
  leverage?: number;
  taker_fee_rate?: number;
  maker_fee_rate?: number;
  slippage_rate?: number;
  note?: string;
}

/** 只更新进度时的同步体（不带交易记录） */
export interface ReplayProgressPayload {
  revision: number;
  progress: ReplaySyncPayload['progress'];
}

/** 同步结果：409 表示已有更新的版本入库，把本地 revision 调到 current_revision 之上即可 */
export type SyncResult =
  | { ok: true }
  | { ok: false; conflict: true; current_revision: number }
  | { ok: false; conflict: false; error: string };

export const EXIT_REASON_LABELS: Record<string, string> = {
  take_profit: '止盈',
  stop_loss: '止损',
  manual: '手动平仓',
  order: '委托平仓',
  reverse: '反手',
  session_end: '会话结束',
};

export interface ReplayStats {
  trade_count: number;
  win_count: number;
  loss_count: number;
  win_rate: number | null;
  total_net_pnl: number;
  total_fee: number;
  avg_win: number | null;
  avg_loss: number | null;
  payoff_ratio: number | null;
  profit_factor: number | null;
  expectancy: number | null;
  r_trade_count: number;
  total_r: number | null;
  avg_r: number | null;
  avg_win_r: number | null;
  avg_loss_r: number | null;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  max_drawdown: number | null;
  max_drawdown_pct: number | null; // 仅单会话统计有值
  max_drawdown_r: number | null;
  avg_bars_held: number | null;
  avg_mfe_pct: number | null;
  avg_mae_pct: number | null;
}

export interface StatsResult {
  overall: ReplayStats;
  by_direction: { long?: ReplayStats; short?: ReplayStats };
  by_tag: Record<string, ReplayStats>;
  by_exit_reason: Record<string, ReplayStats>;
  equity_curve: { position_id: number; close_bar_time: number; cum_net_pnl: number; cum_r: number | null }[];
}

const BASE = '/api/replay';
const syncUrl = (id: number) => `${API_BASE_URL}${BASE}/sessions/${id}/sync`;

class ReplayAPIService {
  getDataCoverage(): Promise<DataCoverage[]> {
    return apiGet(`${BASE}/data-coverage`);
  }

  // ── 会话 ──
  listSessions(params: { status?: 'active' | 'finished'; symbol?: string; limit?: number; offset?: number } = {}): Promise<ReplaySessionRow[]> {
    return apiGet(`${BASE}/sessions`, { params });
  }

  createSession(params: CreateSessionParams): Promise<ReplaySessionState> {
    return apiPost(`${BASE}/sessions`, params);
  }

  getSession(id: number): Promise<ReplaySessionState> {
    return apiGet(`${BASE}/sessions/${id}`);
  }

  updateSession(id: number, data: { name?: string; note?: string }): Promise<unknown> {
    return apiPatch(`${BASE}/sessions/${id}`, data);
  }

  deleteSession(id: number): Promise<unknown> {
    return apiDelete(`${BASE}/sessions/${id}`);
  }

  // ── K线 ──
  /** 截止 end_time（含）的历史K线，limit ≤ 1500 */
  getKlines(id: number, interval: ReplayInterval, endTime: number, limit = 300): Promise<ReplayIntervalBar[]> {
    return apiGet(`${BASE}/sessions/${id}/klines`, { params: { interval, end_time: endTime, limit } });
  }

  /** after 之后的 5m（未来部分，放缓冲区不渲染），limit ≤ 2000；自动跨过数据空洞 */
  getBars(id: number, after: number, limit = 600): Promise<BarsChunk> {
    return apiGet(`${BASE}/sessions/${id}/bars`, { params: { after, limit }, timeout: 30000 });
  }

  // ── 同步 ──
  /**
   * POST /sessions/:id/sync。不走 apiClient：409 时要读出 current_revision，拦截器会把它吞掉。
   * 调用方需串行发送（上一次返回后再发下一次）。
   */
  async sync(id: number, payload: ReplaySyncPayload | ReplayProgressPayload): Promise<SyncResult> {
    try {
      const res = await fetch(syncUrl(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        const cur = Number(body?.current_revision ?? body?.data?.current_revision);
        return { ok: false, conflict: true, current_revision: Number.isFinite(cur) ? cur : payload.revision };
      }
      if (!res.ok || body?.success === false) {
        return { ok: false, conflict: false, error: body?.error || body?.message || `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, conflict: false, error: (err as Error).message || '网络错误' };
    }
  }

  /** 关页面时发最后一次：后端接受 text/plain 的 JSON，sendBeacon 跨域也能发 */
  beaconSync(id: number, payload: ReplaySyncPayload | ReplayProgressPayload): boolean {
    try {
      return navigator.sendBeacon(syncUrl(id), JSON.stringify(payload));
    } catch {
      return false;
    }
  }

  // ── 查询与统计（基于已同步的数据） ──
  getSessionStats(id: number): Promise<StatsResult> {
    return apiGet(`${BASE}/sessions/${id}/stats`);
  }
}

export const replayAPI = new ReplayAPIService();
export default ReplayAPIService;
