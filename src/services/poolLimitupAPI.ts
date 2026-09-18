import { astockGet } from './astockApiClient';

// ===== 池内涨停 =====
// 把当日涨停股与三个池子做交集，回答「今天池里的票有多少封板了」。
//
// ⚠️ 两种状态必须分开展示：
//   is_sealed_now: true  —— 当前封着
//   is_sealed_now: false —— 今天摸过板但没封住（炸板）
//   open_times           —— 今天炸过几次；当前封着也可能非零（封→炸→再封），
//                           这是判断封板结不结实的关键，涨停池本身不返回该字段。

export type PoolName = 'pullback' | 'watch' | 'lowvol';

export const POOL_LABELS: Record<PoolName, string> = {
  pullback: '回踩池',
  watch: '首板池',
  lowvol: '放量池',
};

export interface PoolLimitupItem {
  code: string;
  name: string;
  pools: PoolName[];          // 同一只票命中多个池时只返回一行，这里列出全部
  is_sealed_now: boolean;
  open_times: number;         // 今日炸板次数
  boards: number;             // 连板数
  first_seal_time: string | null;
  seal_amount: number | null; // 封单金额
  pct_chg: number | null;
  close: number | null;
  limit_up_reason: string | null;
  snapshot_at: string | null;
  in_favorite: boolean;
}

export interface PoolLimitupStats {
  trade_date: string;
  total_limitup: number;      // 全市场涨停/摸板数
  in_pools: number;           // 其中在池内的
  sealed: number;             // 当前封着
  broken: number;             // 已炸板
  by_pool: Partial<Record<PoolName, number>>;
  snapshot_at: string | null;
  // 数据非当日时为 true——防止周末查看时把上个交易日的涨停当成今天的
  is_stale: boolean;
}

export interface PoolLimitupParams {
  trade_date?: string;
  pool?: PoolName;
  sealed_only?: boolean;
  since_days?: number;        // 默认 30，0=不限
}

// ⚠️ 与 favoriteAPI 同一个坑：中间网络设备按请求行长度误伤，
// 裸路径 GET /api/pool-limitup (17) → 503，带任意查询参数即 200。
// 这里的调用本来就会带 since_days，PAD 只是兜底。详见 favoriteAPI.ts 注释。
const PAD = { _: 12 };

class PoolLimitupAPIService {
  // 池内涨停列表。排序：封着的在前 → 连板多的在前 → 炸板少的在前
  async getList(params: PoolLimitupParams = {}): Promise<PoolLimitupItem[]> {
    return astockGet<PoolLimitupItem[]>('/api/pool-limitup', {
      params: { ...PAD, ...params },
    });
  }

  async getStats(params: { trade_date?: string; since_days?: number } = {}): Promise<PoolLimitupStats> {
    return astockGet<PoolLimitupStats>('/api/pool-limitup/stats', {
      params: { ...PAD, ...params },
    });
  }
}

export const poolLimitupAPI = new PoolLimitupAPIService();
export default PoolLimitupAPIService;
