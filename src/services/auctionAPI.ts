import { astockGet } from './astockApiClient';

// ===== 集合竞价 =====
// 全市场汇总与个股明细是两个独立接口，互不包含对方的数据。

// 全市场竞价汇总，每个交易日一条
export interface AuctionMarketDay {
  trade_date: string;
  total_amount: number;   // 竞价成交额（元），沪 + 深 + 北
  sh_amount: number;
  sz_amount: number;
  bj_amount: number;
  chg_pct: number | null; // 较上一个有数据交易日的变化%，首日为 null
  n_codes: number;        // 应采集股票数
  n_fetched: number;      // 实际采集到的股票数
  complete: boolean;      // 当日是否采集完整
  n_traded: number;       // 竞价有成交的股票数
  n_up: number;
  n_down: number;
  n_limit_up: number;     // 竞价涨停
  n_limit_down: number;   // 竞价跌停
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);

// 后端字段类型不稳定（数字/字符串混返），统一转成 number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeMarketDay = (d: any): AuctionMarketDay => ({
  trade_date: String(d.trade_date),
  total_amount: num(d.total_amount),
  sh_amount: num(d.sh_amount),
  sz_amount: num(d.sz_amount),
  bj_amount: num(d.bj_amount),
  chg_pct: numOrNull(d.chg_pct),
  n_codes: num(d.n_codes),
  n_fetched: num(d.n_fetched),
  complete: Boolean(d.complete),
  n_traded: num(d.n_traded),
  n_up: num(d.n_up),
  n_down: num(d.n_down),
  n_limit_up: num(d.n_limit_up),
  n_limit_down: num(d.n_limit_down),
});

// ===== 按概念聚合的竞价资金 =====
// strength 类字段是倍数（与全市场基准 market_strength 对比看强弱），
// up_ratio / avg_pct / top_share / share / auction_pct 已经是百分数。

export type AuctionConceptOrder = 'up_strength' | 'strength' | 'amount' | 'n_hot' | 'median_strength';

// 概念内贡献竞价额最多的成分股
export interface AuctionConceptStock {
  code: string;
  name: string | null;
  auction_amount: number;
  share: number;              // 占该概念竞价额 %
  auction_pct: number | null; // 竞价涨跌 %
  strength: number;
}

export interface AuctionConcept {
  concept: string;
  thscode: string | null;
  n_stocks: number;
  auction_amount: number;
  up_amount: number;       // 竞价红盘成分的竞价额
  strength: number;        // 相对强度，不分买卖方向
  up_strength: number;     // 抢筹强度，只计竞价红盘成分
  median_strength: number; // 成分股强度中位数
  n_hot: number;           // 抢筹只数
  up_ratio: number;        // 竞价红盘占比 %
  avg_pct: number;         // 成分股平均竞价涨跌 %
  top_share: number;       // 最大单票占比 %
  top: AuctionConceptStock[];
}

export interface AuctionConceptList {
  trade_date: string | null;
  prev_date: string | null;
  market_strength: number | null;    // 全市场相对强度，作基准
  market_up_strength: number | null; // 全市场抢筹强度
  total: number;
  items: AuctionConcept[];
  note: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeConcept = (c: any): AuctionConcept => ({
  concept: String(c.concept ?? ''),
  thscode: c.thscode ?? null,
  n_stocks: num(c.n_stocks),
  auction_amount: num(c.auction_amount),
  up_amount: num(c.up_amount),
  strength: num(c.strength),
  up_strength: num(c.up_strength),
  median_strength: num(c.median_strength),
  n_hot: num(c.n_hot),
  up_ratio: num(c.up_ratio),
  avg_pct: num(c.avg_pct),
  top_share: num(c.top_share),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  top: (Array.isArray(c.top) ? c.top : []).map((s: any) => ({
    code: String(s.code),
    name: s.name ?? null,
    auction_amount: num(s.auction_amount),
    share: num(s.share),
    auction_pct: numOrNull(s.auction_pct),
    strength: num(s.strength),
  })),
});

class AuctionAPIService {
  /** 全市场竞价汇总，按日期倒序；传 days（默认 30）或 start/end */
  async getMarket(params: { days?: number; start?: string; end?: string } = {}): Promise<AuctionMarketDay[]> {
    const data = await astockGet<unknown[]>('/api/auction/market', { params });
    return (Array.isArray(data) ? data : []).map(normalizeMarketDay);
  }

  /**
   * 按概念聚合的竞价资金，默认最新交易日、按抢筹强度排序。
   * 后端默认过滤：成分股 < 10 的概念、单票占比 > 40% 的概念（一只票在撑）、宽基标签
   */
  async getConcepts(params: {
    trade_date?: string;
    order_by?: AuctionConceptOrder;
    limit?: number;
    min_stocks?: number;
    max_top_share?: number;
    include_broad?: boolean;
  } = {}): Promise<AuctionConceptList> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = await astockGet<any>('/api/auction/concepts', { params });
    return {
      trade_date: d?.trade_date ?? null,
      prev_date: d?.prev_date ?? null,
      market_strength: numOrNull(d?.market_strength),
      market_up_strength: numOrNull(d?.market_up_strength),
      total: num(d?.total),
      items: (Array.isArray(d?.items) ? d.items : []).map(normalizeConcept),
      note: d?.note ?? null,
    };
  }
}

export const auctionAPI = new AuctionAPIService();
export default AuctionAPIService;
