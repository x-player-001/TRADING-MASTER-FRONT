/**
 * 结构检测API服务
 * 提供支撑/阻力位、突破信号、统计数据等接口
 */

import apiClient from './apiClient';

// ============= 类型定义 =============

/**
 * 区间形态数据
 */
export interface StructureRange {
  id: number;
  symbol: string;
  interval: string;
  type: string;             // 类型 'range'
  resistance: number;       // 阻力位
  support: number;          // 支撑位
  middle: number;           // 中轨
  range_size: number;       // 区间大小
  range_percent: number;    // 区间百分比
  touch_count: number;      // 触碰次数
  support_touches: number;  // 支撑触碰次数
  resistance_touches: number; // 阻力触碰次数
  duration_bars: number;    // 持续K线数
  near_resistance: boolean; // 是否接近阻力位
  near_support: boolean;    // 是否接近支撑位
  breakout_direction: 'UP' | 'DOWN' | null; // 突破方向
  confidence: number;       // 置信度 0-1
  strength: number;         // 强度 0-100
  start_time: number;       // 开始时间(毫秒)
  end_time: number;         // 结束时间(毫秒)
  avg_volume: number;       // 平均成交量
  volume_trend: string;     // 成交量趋势
  pattern_data: any;        // 模式数据
  created_at: string;
  updated_at: string;
}

/**
 * 突破信号数据
 */
export interface StructureBreakout {
  id: number;
  symbol: string;
  interval: string;
  direction: 'UP' | 'DOWN';       // 突破方向
  breakout_price: number;         // 突破价格
  target_price: number;           // 目标价格
  stop_loss: number;              // 止损价格
  breakout_time: number;          // 突破时间(毫秒)
  confidence: number;             // 置信度 0-100
  status: 'pending' | 'hit' | 'stopped' | 'expired';
  result?: 'win' | 'loss' | null; // 信号结果
  created_at: string;
}

/**
 * 统计数据
 */
export interface StructureStatistics {
  symbol: string;
  interval: string;
  total_signals: number;
  win_count: number;
  loss_count: number;
  win_rate: number;              // 胜率 0-100
  avg_profit: number;            // 平均盈利(%)
  avg_loss: number;              // 平均亏损(%)
  risk_reward_ratio: number;     // 盈亏比
  max_consecutive_wins: number;  // 最大连胜
  max_consecutive_losses: number;// 最大连亏
  total_profit: number;          // 总盈利(%)
  sharpe_ratio?: number;         // 夏普比率
}

/**
 * 结构配置
 */
export interface StructureConfig {
  enabled: boolean;
  min_range_duration: number;    // 最小区间持续时间(秒)
  min_touches: number;           // 最小触碰次数
  breakout_threshold: number;    // 突破阈值(%)
  confidence_threshold: number;  // 最小置信度
}

// ============= API请求参数接口 =============

export interface GetStructureRangesParams {
  symbol: string;
  interval: string;
  limit?: number;
  status?: 'active' | 'broken' | 'expired';
}

export interface GetStructureBreakoutsParams {
  symbol: string;
  interval: string;
  limit?: number;
  direction?: 'UP' | 'DOWN';
  status?: 'pending' | 'hit' | 'stopped' | 'expired';
}

export interface GetStructureStatisticsParams {
  symbol: string;
  interval: string;
  days?: number;
}

export interface UpdateSignalResultParams {
  result: 'win' | 'loss';
  exit_price?: number;
  exit_time?: string;
  notes?: string;
}

// ============= API响应类型 =============

export type StructureRangesResponse = StructureRange[];
export type StructureBreakoutsResponse = StructureBreakout[];
export type StructureStatisticsResponse = StructureStatistics;
export type StructureConfigResponse = StructureConfig;

// ============= API服务类 =============

class StructureAPI {
  /**
   * 获取区间形态数据
   * GET /api/structure/ranges/:symbol/:interval
   */
  async getRanges(params: GetStructureRangesParams): Promise<StructureRange[]> {
    const { symbol, interval, limit = 10, status } = params;
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit.toString());
    if (status) queryParams.append('status', status);

    const url = `/api/structure/ranges/${symbol}/${interval}${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    return apiClient.get<StructureRange[]>(url);
  }

  /**
   * 获取突破信号数据
   * GET /api/structure/breakouts/:symbol/:interval
   */
  async getBreakouts(params: GetStructureBreakoutsParams): Promise<StructureBreakout[]> {
    const { symbol, interval, limit = 20, direction, status } = params;
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit.toString());
    if (direction) queryParams.append('direction', direction);
    if (status) queryParams.append('status', status);

    const url = `/api/structure/breakouts/${symbol}/${interval}${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    return apiClient.get<StructureBreakout[]>(url);
  }

  /**
   * 获取统计数据
   * GET /api/structure/statistics/:symbol/:interval
   */
  async getStatistics(params: GetStructureStatisticsParams): Promise<StructureStatistics> {
    const { symbol, interval, days = 30 } = params;
    const queryParams = new URLSearchParams();
    if (days) queryParams.append('days', days.toString());

    const url = `/api/structure/statistics/${symbol}/${interval}${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    return apiClient.get<StructureStatistics>(url);
  }

  /**
   * 更新信号结果
   * POST /api/structure/update-signal-result/:signal_id
   */
  async updateSignalResult(
    signalId: number,
    data: UpdateSignalResultParams
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post(`/api/structure/update-signal-result/${signalId}`, data);
  }

  /**
   * 获取结构配置
   * GET /api/structure/config
   */
  async getConfig(): Promise<StructureConfig> {
    return apiClient.get<StructureConfig>('/api/structure/config');
  }

  /**
   * 更新结构配置
   * PUT /api/structure/config
   */
  async updateConfig(config: Partial<StructureConfig>): Promise<{ success: boolean; message: string }> {
    return apiClient.put('/api/structure/config', config);
  }

  /**
   * 手动触发区间检测
   * POST /api/structure/detect/:symbol/:interval
   * 注意：apiClient会自动解包data字段
   */
  async triggerDetection(
    symbol: string,
    interval: string,
    force: boolean = false
  ): Promise<{
    symbol: string;
    interval: string;
    kline_count: number;
    detected_count: number;
    saved_count: number;
    ranges?: StructureRange[];
  }> {
    const queryParams = force ? '?force=true' : '';
    return apiClient.post(`/api/structure/detect/${symbol}/${interval}${queryParams}`);
  }

  /**
   * 获取活跃的区间和突破信号（组合查询）
   */
  async getActiveStructure(
    symbol: string,
    interval: string
  ): Promise<{
    ranges: StructureRange[];
    breakouts: StructureBreakout[];
    statistics: StructureStatistics;
  }> {
    const [ranges, breakouts, statistics] = await Promise.all([
      this.getRanges({ symbol, interval, status: 'active', limit: 5 }),
      this.getBreakouts({ symbol, interval, status: 'pending', limit: 10 }),
      this.getStatistics({ symbol, interval, days: 30 }),
    ]);

    return { ranges, breakouts, statistics };
  }
}

// 导出单例
export const structureAPI = new StructureAPI();
export default structureAPI;
