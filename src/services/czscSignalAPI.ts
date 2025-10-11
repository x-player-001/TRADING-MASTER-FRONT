/**
 * CZSC回测系统 - 信号监控接口
 * Base URL: http://localhost:8000
 */

import { czscApiGet, czscApiPost } from './czscApiClient';

// ============= 类型定义 =============

/**
 * 查询历史信号请求参数 (GET)
 */
export interface QuerySignalsGetRequest {
  symbol: string;         // 必填：标的代码
  freq: string;           // 必填：周期
  limit?: number;         // 可选：返回数量，默认100
}

/**
 * 查询历史信号请求参数 (POST - 支持更多筛选条件)
 */
export interface QuerySignalsPostRequest {
  symbol: string;         // 必填：标的代码
  freq: string;           // 必填：周期
  start_time?: string;    // 可选：开始时间 (ISO 8601)
  end_time?: string;      // 可选：结束时间 (ISO 8601)
  signal_names?: string[]; // 可选：信号名称列表，如 ["15分钟_D1_分型"]
  limit?: number;         // 可选：返回数量，默认100
}

/**
 * 信号记录
 */
export interface SignalRecord {
  dt: string;             // K线时间
  symbol?: string;        // 标的代码
  freq?: string;          // 周期
  [key: string]: any;     // 动态信号字段，如 "15分钟_D1_分型": "顶分型"
}

/**
 * 查询历史信号响应
 */
export interface QuerySignalsResponse {
  signals: SignalRecord[];
  total?: number;
  symbol?: string;
  freq?: string;
}

/**
 * 信号汇总响应
 */
export interface SignalSummaryResponse {
  symbol: string;
  freq: string;
  latest_signal_time: string;    // 最新信号时间
  total_signals: number;          // 累计信号数量
  signal_names: string[];         // 有效信号列表
  stats?: {                       // 可选的统计信息
    [signalName: string]: number;
  };
}

/**
 * 分析请求
 */
export interface AnalyzeRequest {
  symbol: string;         // 必填：标的代码
  freq: string;           // 必填：周期
  sdt?: string;           // 可选：开始时间
  edt?: string;           // 可选：结束时间
  limit?: number;         // 可选：K线数量限制
}

/**
 * 笔数据
 */
export interface BiData {
  dt: string;
  direction: 'up' | 'down';
  high: number;
  low: number;
  power: number;
}

/**
 * 信号详情
 */
export interface SignalDetail {
  dt: string;             // K线时间
  [key: string]: any;     // 动态信号字段
}

/**
 * 分析响应
 */
export interface AnalyzeResponse {
  symbol: string;
  freq: string;
  bars_count: number;
  signals_count: number;
  bi_list: BiData[];
  signals: SignalDetail[];
  latest_price: number;
  task_id: string;
}

// ============= API服务类 =============

class CZSCSignalAPI {
  /**
   * 查询历史信号 (GET方式 - 简单查询)
   * GET /api/v1/signals/query?symbol=BTCUSDT&freq=15m&limit=100
   */
  async querySignalsGet(params: QuerySignalsGetRequest): Promise<QuerySignalsResponse> {
    return czscApiGet<QuerySignalsResponse>('/api/v1/signals/query', { params });
  }

  /**
   * 查询历史信号 (POST方式 - 支持更多筛选条件)
   * POST /api/v1/signals/query
   *
   * 支持按时间范围和信号名称筛选
   */
  async querySignalsPost(request: QuerySignalsPostRequest): Promise<QuerySignalsResponse> {
    return czscApiPost<QuerySignalsResponse>('/api/v1/signals/query', request);
  }

  /**
   * 获取信号汇总
   * GET /api/v1/signals/summary?symbol=BTCUSDT&freq=15m
   *
   * 返回最新信号时间、累计数量、有效信号列表
   */
  async getSignalSummary(params: { symbol: string; freq: string }): Promise<SignalSummaryResponse> {
    return czscApiGet<SignalSummaryResponse>('/api/v1/signals/summary', { params });
  }

  /**
   * 执行K线分析并生成信号
   * POST /api/v1/analyze
   */
  async analyzeAndGenerateSignals(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    return czscApiPost<AnalyzeResponse>('/api/v1/analyze', request);
  }
}

// 导出单例
export const czscSignalAPI = new CZSCSignalAPI();
export default czscSignalAPI;

// ============= 工具函数 =============

export const signalMonitorUtils = {
  /**
   * 格式化信号类型
   */
  formatSignalType(signalName: any): string {
    // 确保是字符串
    const name = String(signalName || '');

    if (name.includes('分型')) return '分型信号';
    if (name.includes('笔')) return '笔信号';
    if (name.includes('BS') || name.includes('买') || name.includes('卖')) {
      return '买卖点';
    }
    if (name.includes('MACD')) return 'MACD';
    if (name.includes('DMA')) return 'DMA';
    return '其他';
  },

  /**
   * 获取信号颜色
   */
  getSignalColor(signalValue: any): string {
    // 确保是字符串
    const value = String(signalValue || '');

    if (value.includes('买') || value.includes('看多') || value.includes('做多')) {
      return '#10b981'; // 绿色
    }
    if (value.includes('卖') || value.includes('看空') || value.includes('做空')) {
      return '#ef4444'; // 红色
    }
    if (value.includes('顶分型')) {
      return '#ef4444'; // 红色
    }
    if (value.includes('底分型')) {
      return '#10b981'; // 绿色
    }
    return '#6b7280'; // 灰色（中性）
  },

  /**
   * 获取信号图标
   */
  getSignalIcon(signalValue: any): string {
    // 确保是字符串
    const value = String(signalValue || '');

    if (value.includes('买') || value.includes('看多') || value.includes('底分型')) {
      return '🟢';
    }
    if (value.includes('卖') || value.includes('看空') || value.includes('顶分型')) {
      return '🔴';
    }
    if (value.includes('向上')) {
      return '⬆️';
    }
    if (value.includes('向下')) {
      return '⬇️';
    }
    return '⚪';
  },

  /**
   * 格式化周期
   */
  formatFreq(freq: string): string {
    const freqMap: Record<string, string> = {
      '1m': '1分钟',
      '5m': '5分钟',
      '15m': '15分钟',
      '30m': '30分钟',
      '1h': '1小时',
      '4h': '4小时',
      '1d': '1天',
      '1w': '1周',
    };
    return freqMap[freq] || freq;
  },

  /**
   * 格式化时间
   */
  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  },

  /**
   * 格式化简短时间（仅日期时间）
   */
  formatShortTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * 判断是否为买入信号
   */
  isBuySignal(signalValue: any): boolean {
    // 确保是字符串
    const value = String(signalValue || '');

    return value.includes('买') ||
           value.includes('看多') ||
           value.includes('做多') ||
           value.includes('底分型');
  },

  /**
   * 判断是否为卖出信号
   */
  isSellSignal(signalValue: any): boolean {
    // 确保是字符串
    const value = String(signalValue || '');

    return value.includes('卖') ||
           value.includes('看空') ||
           value.includes('做空') ||
           value.includes('顶分型');
  },

  /**
   * 解析信号记录中的所有信号字段
   * 从SignalRecord中提取所有信号字段（排除dt, symbol, freq等基础字段）
   */
  extractSignals(record: SignalRecord): Array<{ name: string; value: string; rawValue: any }> {
    const excludeKeys = ['dt', 'symbol', 'freq', 'id', 'task_id', 'created_at'];
    return Object.entries(record)
      .filter(([key]) => !excludeKeys.includes(key))
      .map(([name, value]) => {
        // 处理对象类型的值
        let displayValue: string;
        if (value === null || value === undefined) {
          displayValue = '-';
        } else if (typeof value === 'object') {
          // 如果是对象，优化显示格式
          try {
            // 尝试提取关键字段
            if (Array.isArray(value)) {
              displayValue = `[${value.length}项]`;
            } else if (Object.keys(value).length <= 3) {
              // 少于3个键，直接显示
              displayValue = JSON.stringify(value);
            } else {
              // 多于3个键，只显示键名
              const keys = Object.keys(value).slice(0, 3).join(', ');
              displayValue = `{${keys}...}`;
            }
          } catch {
            displayValue = '[对象]';
          }
        } else {
          displayValue = String(value);
        }

        return {
          name,
          value: displayValue,
          rawValue: value, // 保留原始值以便后续处理
        };
      });
  },

  /**
   * 解析信号统计数据
   */
  parseSignalStats(stats: any): Array<{ name: string; count: number }> {
    if (!stats || typeof stats !== 'object') {
      return [];
    }

    return Object.entries(stats).map(([name, count]) => ({
      name,
      count: typeof count === 'number' ? count : 0,
    }));
  },
};
