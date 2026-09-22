import { astockGet } from './astockApiClient';

// ===== 板块轮动看板 =====
// 按近期涨幅与成交额占比的变化，给概念板块打上轮动阶段标签。
//
// ⚠️ 后端明确标注（note 字段原样返回，前端必须展示）：
//   概念历史只有 8 个交易日（自 2026-09-10 积累，无法回补），
//   stage 是**规则判定、未经预测力验证**，仅供观察，
//   **不参与选股决策**。
// 故本模块只做「当下什么板块在动」的观察，不提供排序打分或选股入口。

export type RotationStage = '刚启动' | '升温' | '持续' | '退潮' | '一日游';

export const STAGE_LABELS: Record<RotationStage, string> = {
  刚启动: '刚启动',
  升温: '升温',
  持续: '持续',
  退潮: '退潮',
  一日游: '一日游',
};

// 阶段配色：启动/升温偏暖（在走强），持续中性，退潮/一日游偏冷
export const STAGE_COLORS: Record<RotationStage, string> = {
  刚启动: '#ef4444',
  升温: '#f97316',
  持续: '#3b82f6',
  退潮: '#10b981',
  一日游: '#a8a29e',
};

export const STAGE_HINTS: Record<RotationStage, string> = {
  刚启动: '刚开始异动，样本最少，最不确定',
  升温: '近3日均涨幅高于前3日，资金在进',
  持续: '已连续走强一段时间',
  退潮: '强度回落，资金在撤',
  一日游: '只涨了一天就熄火',
};

// 每日走势点，可画迷你趋势
export interface RotationSeriesPoint {
  trade_date: string;
  pct_chg: number | null;
  turnover_share: number | null;  // 成交额占全市场比
  rank_pct: number | null;        // 当日涨幅排名（越小越靠前）
}

export interface RotationConcept {
  thscode: string;
  name: string;
  pct_chg: number | null;         // 当日涨幅%
  avg3: number | null;            // 近3日均涨幅%
  avg_prev3: number | null;       // 前3日均涨幅%，与 avg3 对比看升温/退潮
  turnover_share: number | null;  // 成交额占比
  share_trend: number | null;     // 占比变化趋势
  rank_pct: number | null;        // 当日涨幅排名
  stage: RotationStage | string;
  stage_reason: string | null;    // 判定依据，原样展示
  up_days: number | null;         // 窗口内上涨天数
  max_day_pct: number | null;     // 窗口内单日最大涨幅
  peers: string[];                // 同源概念（成分重叠 ≥15% 被合并的）
  peer_count: number;
  series: RotationSeriesPoint[];
}

// 题材（来自涨停原因聚合，与概念是两个维度）
export interface RotationTheme {
  theme: string;
  zt_count: number;
  max_boards: number;
  consec_days: number;            // 连续上榜天数
  is_new: boolean;                // 今日新出现
}

export interface RotationBoard {
  trade_date: string;
  days_available: number;         // 实际可用历史天数
  window: number;                 // 回看窗口
  dates: string[];
  concepts: RotationConcept[];
  themes: RotationTheme[];
  stage_counts: Partial<Record<RotationStage, number>>;
  median_delta: number | null;    // 全市场中位涨幅，stage_reason 的参照
  note: string | null;            // 口径提醒，必须原样展示给用户
}

export interface RotationParams {
  window?: number;                // 回看窗口，默认 8
  limit?: number;                 // 返回概念数，默认 20
  dedup?: boolean;                // 同源概念去重（成分重叠≥15%），默认 true
  include_broad?: boolean;        // 是否含宽基/交易属性标签，默认 false
  stage?: RotationStage;
}

class RotationAPIService {
  // 裸路径可能撞上那台按请求行长度误伤的设备，统一带个无意义参数兜底
  async getBoard(params: RotationParams = {}): Promise<RotationBoard> {
    return astockGet<RotationBoard>('/api/rotation', { params: { _: 12, ...params } });
  }
}

export const rotationAPI = new RotationAPIService();
export default RotationAPIService;
