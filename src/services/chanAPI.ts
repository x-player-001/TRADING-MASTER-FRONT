/**
 * 缠论分析API服务
 * 提供分型、笔、中枢数据接口
 */

import apiClient from './apiClient';

// ============= 类型定义 =============

/**
 * 分型数据 (局部高点/低点)
 */
export interface ChanFractal {
  type: 'top' | 'bottom';      // 分型类型
  kline_index: number;          // K线索引
  price: number;                // 分型价格
  time: number;                 // 时间戳(毫秒)
  strength: number;             // 强度 0-1
  is_confirmed: boolean;        // 是否已确认
}

/**
 * 笔数据 (相邻分型之间的连线)
 */
export interface ChanStroke {
  id: string;                   // 笔的唯一标识
  direction: 'up' | 'down';     // 笔方向
  start: {
    index: number;
    price: number;
    time: number;
  };
  end: {
    index: number;
    price: number;
    time: number;
  };
  amplitude_percent: number;    // 振幅百分比
  duration_bars: number;        // 持续K线数
  is_valid: boolean;            // 是否有效笔
}

/**
 * 中枢数据 (至少3笔价格重叠区域)
 */
export interface ChanCenter {
  id: string;                   // 中枢唯一标识
  high: number;                 // 中枢上沿(阻力位)
  low: number;                  // 中枢下沿(支撑位)
  middle: number;               // 中枢中轴
  height_percent: number;       // 中枢高度百分比
  start_time: number;           // 开始时间戳(毫秒)
  end_time: number;             // 结束时间戳(毫秒)
  start_index: number;          // 开始K线索引
  end_index: number;            // 结束K线索引
  duration_bars: number;        // 持续K线数
  strength: number;             // 中枢强度 0-100
  stroke_count: number;         // 组成笔数量
  is_active: boolean;           // 是否当前活跃
  is_extending: boolean;        // 是否在扩展中
  extension_count: number;      // 扩展次数
}

/**
 * 当前状态
 */
export interface ChanCurrentState {
  in_center: boolean;           // 当前是否处于中枢震荡
  center_id?: string;           // 当前活跃中枢ID
  last_stroke_direction?: 'up' | 'down'; // 最新笔方向
  last_fractal_type?: 'top' | 'bottom';  // 最新分型类型
}

/**
 * 统计数据
 */
export interface ChanStatistics {
  total_fractals: number;
  valid_fractals: number;
  total_strokes: number;
  valid_strokes: number;
  total_centers: number;
  valid_centers: number;
}

/**
 * 缠论分析完整响应
 */
export interface ChanAnalysisData {
  symbol: string;
  interval: string;
  analysis_time: number;        // 分析时间戳
  kline_count: number;          // 分析的K线数量
  fractals: ChanFractal[];
  strokes: ChanStroke[];
  centers: ChanCenter[];
  current_state: ChanCurrentState;
  statistics: ChanStatistics;
}

// ============= API请求参数 =============

export interface GetChanAnalysisParams {
  symbol: string;
  interval: string;
  lookback?: number;  // 回溯K线数量 (50-1000, 默认200)
}

// ============= API服务类 =============

class ChanAPI {
  /**
   * 获取缠论分析数据
   * GET /api/structure/chan-analysis/:symbol/:interval
   */
  async getChanAnalysis(params: GetChanAnalysisParams): Promise<ChanAnalysisData> {
    const { symbol, interval, lookback = 200 } = params;
    const queryParams = new URLSearchParams();
    if (lookback) queryParams.append('lookback', lookback.toString());

    const url = `/api/structure/chan-analysis/${symbol}/${interval}${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    return apiClient.get<ChanAnalysisData>(url);
  }
}

// 导出单例
export const chanAPI = new ChanAPI();
export default chanAPI;
