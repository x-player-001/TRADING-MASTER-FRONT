import { apiGet, apiPost } from './apiClient';

// 对接后端 /api/trade-record（真实成交驱动）。
// 为减少页面层改动，对外保留 JournalEntry/Analysis 等命名，
// 在 list/detail 解析时将后端新字段（log/ai_analysis/log_id…）映射回旧命名。

export type JournalStatus = 'analyzing' | 'open' | 'closed' | 'dismissed' | 'failed';
export type TradeDirection = 'LONG' | 'SHORT';

export type EntryAction = 'enter' | 'wait' | 'skip';
export type RiskStatus = 'materialized' | 'cleared' | 'pending';

export interface RiskReviewItem {
  risk: string;
  status: RiskStatus;
  note?: string;
}

export interface Analysis {
  id: number;
  log_id: number;
  analysis_type: 'entry' | 'reassess';
  market_snapshot?: Record<string, any>;
  claude_analysis: string;   // 来自后端 ai_analysis
  risk_points?: string[];
  opportunities?: string[];
  overall_assessment?: string;
  confidence_score?: number;
  created_at: string;

  // 入场评估(entry)可执行清单字段，AI 未返回时为 null
  action?: EntryAction | null;
  entry_zone_low?: number | null;
  entry_zone_high?: number | null;
  invalidation_price?: number | null;
  target_1?: number | null;
  target_2?: number | null;
  rr_ratio?: number | null;

  // 再评估(reassess)风险复盘
  risk_review?: RiskReviewItem[] | null;
}

// 平仓后的交易复盘（后端 review 对象）
export interface TradeReview {
  id: number;
  log_id: number;
  exit_reason?: string;
  ai_review?: string;
  what_went_well?: string;
  what_went_wrong?: string;
  lessons?: string;
  created_at: string;
}

export interface JournalEntry {
  id: number;
  symbol: string;
  direction: TradeDirection;
  // 计划字段（入场评估时填写，可选）
  planned_entry_price?: number;
  planned_stop_loss?: number;
  planned_take_profit?: number;
  timeframe?: string;
  entry_reason?: string;
  status: JournalStatus;

  // 真实成交字段（同步自交易所）
  entry_price?: number;
  exit_price?: number;
  qty?: number;
  leverage?: number;
  realized_pnl?: number;
  pnl_pct?: number;
  first_trade_id?: string;
  last_trade_id?: string;

  // 复盘与最新评估摘要
  review?: TradeReview;       // 来自后端 review 对象
  overall_assessment?: string;
  confidence_score?: number;

  created_at: string;
  opened_at?: string;
  closed_at?: string;
  analyses?: Analysis[];
}

export interface CalibrationBucket {
  bucket: string;
  samples: number;
  win_rate: number | null;
  avg_pnl_pct: number | null;
}

export interface JournalStats {
  total: number;
  win: number;
  loss: number;
  win_rate: number;
  open?: number;
  analyzing?: number;
  total_pnl?: number;
}

export interface AnalyzeRequest {
  symbol: string;
  direction: TradeDirection;
  entry_reason?: string;
  planned_entry_price?: number;
  planned_stop_loss?: number;
  planned_take_profit?: number;
  timeframe?: string;
  end_time?: number;
}

export interface AnalyzeResponse {
  log_id: number;
}

export interface ReassessRequest {
  current_price: number;
  concern: string;
}

// 全局同步结果
export interface SyncAllResult {
  new_trades: number; // 新拉取的成交笔数
  filled: number;     // 回填真实成交数据的条数
  created: number;    // 新建的未评估持仓数
  closed: number;     // 检测到并平仓的条数
}

// 单条同步结果
export type SyncAction = 'filled' | 'closed' | 'noop';
export interface SyncOneResult {
  action: SyncAction;
  log_id: number;
}

// 后端单条评估原始结构（ai_analysis 命名）
interface RawAnalysis extends Omit<Analysis, 'claude_analysis'> {
  ai_analysis?: string;
  claude_analysis?: string;
}

const mapAnalysis = (a: RawAnalysis): Analysis => ({
  ...a,
  claude_analysis: a.ai_analysis ?? a.claude_analysis ?? '',
});

const BASE = '/api/trade-record';

export const journalAPI = {
  // 入场评估（异步，返回 log_id，前端轮询详情）
  analyze: (req: AnalyzeRequest): Promise<AnalyzeResponse> =>
    apiPost(`${BASE}/analyze`, req),

  // 放弃评估 analyzing → dismissed
  dismiss: (id: number): Promise<JournalEntry> =>
    apiPost(`${BASE}/${id}/dismiss`),

  // 持仓中再评估（异步，返回 log_id，前端轮询详情）
  reassess: (id: number, req: ReassessRequest): Promise<AnalyzeResponse> =>
    apiPost(`${BASE}/${id}/reassess`, req),

  // 全局同步：拉 7 天成交 → 回填/新建/平仓+复盘
  syncAll: (): Promise<SyncAllResult> =>
    apiPost(`${BASE}/sync`),

  // 单条同步：只同步该记录对应币种
  syncOne: (id: number): Promise<SyncOneResult> =>
    apiPost(`${BASE}/${id}/sync`),

  list: async (status?: JournalStatus): Promise<JournalEntry[]> => {
    const res = await apiGet<{ count: number; list: JournalEntry[] }>(
      `${BASE}/records`, { params: status ? { status } : undefined }
    );
    return res.list ?? (res as unknown as JournalEntry[]);
  },

  detail: async (id: number): Promise<JournalEntry> => {
    const res = await apiGet<{ log: JournalEntry; analyses: RawAnalysis[]; review: TradeReview | null }>(`${BASE}/${id}`);
    return {
      ...res.log,
      analyses: (res.analyses ?? []).map(mapAnalysis),
      review: res.review ?? undefined,
    };
  },

  stats: (): Promise<JournalStats> =>
    apiGet(`${BASE}/stats`),

  calibration: (): Promise<CalibrationBucket[]> =>
    apiGet(`${BASE}/calibration`),
};
