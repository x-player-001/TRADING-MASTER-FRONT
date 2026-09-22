import { astockGet, astockPost } from './astockApiClient';

// ===== 盘后复盘（DeepSeek）=====
// 后端盘后管线跑完 LLM 后落库，GET 只读缓存、不触发模型调用。
//
// ⚠️ 后端原话（note 字段）：
//   「LLM 对已有数据的翻译,只作展示,不参与选股决策。内容中的日期与数值可回查核对。」
//   所以这里只做展示，不排序、不打分、不做筛选入口。
//
// content 是 Markdown 片段，实测只用到 **加粗**，没有标题/列表/链接。

export type ReviewKind = 'concept' | 'stock';

export interface ReviewItem {
  trade_date: string;
  kind: ReviewKind;
  code: string | null;     // 板块复盘为 null
  name: string | null;
  content: string;
  model: string;           // 实测 'deepseek-chat'
  created_at: string;
}

// GET /api/review 的返回：板块 1 条 + 个股 N 条
export interface ReviewDay {
  trade_date: string;
  concept: ReviewItem | null;
  stocks: ReviewItem[];
  total: number;
  note: string | null;
}

export interface ReviewAnalyzeResult extends ReviewItem {
  cached?: boolean;        // true=命中当日已有结果，没有真的调模型
}

class ReviewAPIService {
  // 当日全部复盘。kind 可只取一类（实测生效，但传非法值会被静默忽略）
  async getDay(params: { trade_date?: string; kind?: ReviewKind } = {}): Promise<ReviewDay> {
    return astockGet<ReviewDay>('/api/review', { params: { _: 12, ...params } });
  }

  // 某只票的历史复盘，按时间倒序。没有记录时返回空数组（不是 404）
  async getStockHistory(code: string, limit = 10): Promise<ReviewItem[]> {
    return astockGet<ReviewItem[]>(`/api/review/stock/${code}`, { params: { _: 12, limit } });
  }

  // ⚠️ 实时调模型：耗时 10~20 秒且每次计费，必须由用户显式点击触发。
  // 默认幂等——同票同日已有结果直接返回 cached=true，不会重复计费。
  async analyze(code: string, opts: { trade_date?: string; force?: boolean } = {}): Promise<ReviewAnalyzeResult> {
    return astockPost<ReviewAnalyzeResult>('/api/review/analyze', undefined, {
      params: { _: 12, code, ...opts },
      timeout: 45_000,  // 客户端默认 15s 会把正常的 10~20s 分析掐断
    });
  }
}

export const reviewAPI = new ReviewAPIService();
export default ReviewAPIService;
