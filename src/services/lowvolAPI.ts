import { astockGet } from './astockApiClient';
import type { BoardGroup } from './astockAPI';

// ===== 低位放量池（watch_lowvol）=====
// ≤15% 低位 + 成交量超过前60日最大量的票入池，跟踪 10 个交易日后结算。
// 与低位首板池（watch_pool）是两套独立的表和接口：
//   - 首板池标签是「30日内是否再次涨停」，状态 watching→hit/expired
//   - 放量池标签是「T+1/3/5/10 收益率 + 超额」，状态 watching→settled
// excess5 = T+5 相对全市场同期的超额收益，判断有无 edge 的关键指标
// （绝对收益会被牛熊行情带偏）。

export type LowvolStatus = 'watching' | 'settled';
export type LowvolOrderBy = 'entry_score' | 'trigger_date' | 'excess5' | 'ret5';

export const LOWVOL_STATUS_LABELS: Record<LowvolStatus, string> = {
  watching: '跟踪中',
  settled: '已结算',
};

// 入池评分分项
export type LowvolEntryScores = Record<string, number>;

export const LOWVOL_SCORE_LABELS: Record<string, string> = {
  low_position: '低位程度',
  volume_x: '放量倍数',
};

// 入池后每个交易日的跟踪记录
export interface LowvolTrackPoint {
  trade_date: string;
  days_since: number;         // 距触发日第几个交易日
  close: number;
  pct_chg: number;            // 当日涨跌%
  ret_since: number;          // 相对触发日收盘的涨跌%
  amount_ratio: number;       // 成交额/触发日成交额
  is_limit_up: boolean;
}

export interface LowvolItem {
  id: number;
  code: string;
  name: string;
  board_group: BoardGroup;

  trigger_date: string;          // 触发日（放量日）
  trigger_close: number;         // 触发日收盘价
  trigger_pct: number;           // 触发日涨幅%
  gain_from_low: number;         // 距低点涨幅%，越小越低位
  vol_ratio: number;             // 放量倍数（相对前60日最大量）
  limit_up: boolean;             // 触发日是否涨停
  first_board: boolean;          // 是否首板

  entry_score: number;           // 入池评分 0~1
  entry_scores: LowvolEntryScores;

  status: LowvolStatus;
  settle_date: string | null;    // 结算日，null=窗口未走满

  // 收益结算：窗口未走满时对应字段为 null
  ret1: number | null;           // T+1 收益率%
  ret3: number | null;           // T+3
  ret5: number | null;           // T+5
  ret10: number | null;          // T+10
  excess5: number | null;        // T+5 相对全市场同期的超额收益%
  max_ret10: number | null;      // 10日内最大收益%
  max_dd10: number | null;       // 10日内最大回撤%

  track: LowvolTrackPoint[];     // 列表接口恒为空，详情接口才有
}

export interface LowvolListParams {
  status?: LowvolStatus;
  first_board?: boolean;         // true=只看触发日同时涨停的
  exclude_limit_up?: boolean;    // true=剔除触发日涨停的（涨停当天难买入）
  board_group?: BoardGroup;
  since?: string;                // 只看触发日 >= 该日期
  order_by?: LowvolOrderBy;
  limit?: number;
}

export interface LowvolStats {
  total: number;
  watching: number;
  settled: number;

  avg_ret5: number | null;
  avg_ret10: number | null;
  avg_excess5: number | null;    // 平均超额收益，核心指标
  win_rate5: number | null;      // 胜率%（T+5 为正的比例）

  // 首板 vs 非首板分组：键是中文（"首板" / "非首板"），值是平均超额收益%
  by_first_board?: Record<string, number | null>;

  benchmark_hint?: string;
}

class LowvolAPIService {
  // 低位放量池列表
  async getLowvolList(params: LowvolListParams = {}): Promise<LowvolItem[]> {
    return astockGet<LowvolItem[]>('/api/lowvol', { params });
  }

  // 收益统计
  // ⚠️ 裸路径 /api/lowvol/stats 经外网代理会返回 503，带任意查询参数即正常，
  // 故未指定 since 时兜底传一个足够早的日期（等价于全量统计）
  async getLowvolStats(since?: string): Promise<LowvolStats> {
    return astockGet<LowvolStats>('/api/lowvol/stats', {
      params: { since: since ?? '2000-01-01' },
    });
  }

  // 个股详情（含每日跟踪曲线）
  async getLowvolDetail(code: string, triggerDate?: string): Promise<LowvolItem> {
    return astockGet<LowvolItem>(`/api/lowvol/${code}`, {
      params: triggerDate ? { trigger_date: triggerDate } : undefined,
    });
  }
}

export const lowvolAPI = new LowvolAPIService();
export default LowvolAPIService;
