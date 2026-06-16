import { apiGet, apiPost } from './apiClient';

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
  journal_id: number;
  analysis_type: 'entry' | 'reassess';
  market_snapshot?: Record<string, any>;
  claude_analysis: string;
  risk_points?: string[];
  opportunities?: string[];
  overall_assessment?: string;
  confidence_score?: number;
  created_at: string;

  // 入场评估(entry)新增可执行清单字段，旧记录/AI 未返回时为 null
  action?: EntryAction | null;
  entry_zone_low?: number | null;
  entry_zone_high?: number | null;
  invalidation_price?: number | null;
  target_1?: number | null;
  target_2?: number | null;
  rr_ratio?: number | null;

  // 再评估(reassess)新增，入场时未记录风险点则为 null
  risk_review?: RiskReviewItem[] | null;
}

export interface JournalEntry {
  id: number;
  symbol: string;
  direction: TradeDirection;
  planned_entry_price: number;
  planned_stop_loss: number;
  planned_take_profit?: number;
  size?: number;
  timeframe?: string;
  entry_reason?: string;
  status: JournalStatus;
  review?: string;
  actual_exit_price?: number;
  exit_reason?: string;
  pnl?: number;
  pnl_pct?: number;
  created_at: string;
  opened_at?: string;
  closed_at?: string;
  analyses?: Analysis[];
}

export interface CalibrationBucket {
  bucket: string;          // 如 "80+" / "60-79"
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
  planned_entry_price: number;
  planned_stop_loss: number;
  planned_take_profit?: number;
  size?: number;
  timeframe?: string;
  entry_reason?: string;
  end_time?: number;
}

export interface AnalyzeResponse {
  journal_id: number;
}

export interface ReassessRequest {
  current_price: number;
  concern: string;
}

export interface CloseRequest {
  actual_exit_price: number;
  exit_reason?: string;
}

export const journalAPI = {
  analyze: (req: AnalyzeRequest): Promise<AnalyzeResponse> =>
    apiPost('/api/journal/analyze', req),

  open: (id: number): Promise<JournalEntry> =>
    apiPost(`/api/journal/${id}/open`),

  dismiss: (id: number): Promise<JournalEntry> =>
    apiPost(`/api/journal/${id}/dismiss`),

  reassess: (id: number, req: ReassessRequest): Promise<{ assessment: string; risk_review?: RiskReviewItem[] | null }> =>
    apiPost(`/api/journal/${id}/reassess`, req),

  close: (id: number, req: CloseRequest): Promise<JournalEntry> =>
    apiPost(`/api/journal/${id}/close`, req),

  list: async (status?: JournalStatus): Promise<JournalEntry[]> => {
    const res = await apiGet<{ count: number; list: JournalEntry[] }>(
      '/api/journal/records', { params: status ? { status } : undefined }
    );
    return res.list ?? res;
  },

  detail: async (id: number): Promise<JournalEntry> => {
    const res = await apiGet<{ journal: JournalEntry; analyses: Analysis[]; review: string | null }>(`/api/journal/${id}`);
    return { ...res.journal, analyses: res.analyses, review: res.review ?? undefined };
  },

  stats: (): Promise<JournalStats> =>
    apiGet('/api/journal/stats'),

  calibration: (): Promise<CalibrationBucket[]> =>
    apiGet('/api/journal/calibration'),
};
