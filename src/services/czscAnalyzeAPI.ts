/**
 * CZSC回测系统 - K线分析接口
 * Base URL: http://localhost:8000
 */

import { czscApiPost } from './czscApiClient';

// ============= 类型定义 =============

/**
 * 分析K线请求
 */
export interface AnalyzeKlineRequest {
  symbol: string;                  // 必填：标的代码
  freq: string;                    // 必填：周期 (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
  sdt?: string;                    // 可选：开始时间 (ISO 8601格式)
  edt?: string;                    // 可选：结束时间
  limit?: number;                  // 可选：K线数量限制，默认1000
}

/**
 * 笔数据
 */
export interface BiData {
  dt: string;                      // 时间
  direction: 'up' | 'down';        // 方向
  high: number;                    // 高点
  low: number;                     // 低点
  power: number;                   // 力度
}

/**
 * 信号数据（每根K线的信号详情）
 */
export interface SignalData {
  dt: string;                      // K线时间
  [key: string]: any;              // 动态信号字段，如 "15分钟_D1_分型": "顶分型"
}

/**
 * K线分析响应
 */
export interface AnalyzeKlineResponse {
  symbol: string;
  freq: string;
  bars_count: number;              // K线数量
  signals_count: number;           // 信号数量
  bi_list: BiData[];               // 笔的列表
  signals: SignalData[];           // 每根K线的信号详情
  latest_price: number;            // 最新价格
  task_id: string;                 // 分析任务ID
}

// ============= API服务类 =============

class CZSCAnalyzeAPI {
  /**
   * 分析K线数据，生成缠论信号
   * POST /api/v1/analyze
   *
   * 说明：分析结果会自动保存到数据库（signal_records和signal_summary表）
   */
  async analyzeKline(request: AnalyzeKlineRequest): Promise<AnalyzeKlineResponse> {
    return czscApiPost<AnalyzeKlineResponse>('/api/v1/analyze', request);
  }
}

// 导出单例
export const czscAnalyzeAPI = new CZSCAnalyzeAPI();
export default czscAnalyzeAPI;
