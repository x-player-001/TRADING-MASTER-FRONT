/**
 * 交易信号API服务
 * 用于获取和管理交易信号数据
 */

import apiClient from './apiClient';

/**
 * 信号类型
 */
export type SignalType = 'BUY' | 'SELL' | 'NEUTRAL';

/**
 * 信号强度级别
 */
export type SignalStrength = 'weak' | 'medium' | 'strong';

/**
 * MA交叉指标
 */
export interface MACrossIndicator {
  type: 'golden' | 'death' | 'none';
  fast_ma: number;
  slow_ma: number;
}

/**
 * RSI指标
 */
export interface RSIIndicator {
  value: number;
  status: 'oversold' | 'overbought' | 'neutral';
}

/**
 * MACD指标
 */
export interface MACDIndicator {
  macd: number;
  signal: number;
  histogram: number;
  cross?: 'bullish' | 'bearish' | 'none';
}

/**
 * 信号指标集合
 */
export interface SignalIndicators {
  ma_cross?: MACrossIndicator;
  rsi?: RSIIndicator;
  macd?: MACDIndicator;
  pattern?: string; // K线形态
  [key: string]: any; // 支持其他指标
}

/**
 * 交易信号
 */
export interface Signal {
  id: number;
  symbol: string;
  interval: string;
  signal_type: SignalType;
  strength: number; // 0-100
  price: number;
  indicators: SignalIndicators;
  description: string;
  timestamp: number;
  created_at: string;
}

/**
 * 最新信号响应
 */
export interface LatestSignalResponse {
  symbol: string;
  interval: string;
  count: number;
  signals: Signal[];
}

/**
 * 历史信号响应
 */
export interface HistorySignalResponse {
  symbol: string;
  interval: string;
  count: number;
  signals: Signal[];
}

/**
 * 信号概览响应
 */
export interface SignalOverviewResponse {
  interval: string;
  count: number;
  signals: Array<{
    symbol: string;
    signal_type: SignalType;
    strength: number;
    price: number;
    description: string;
    timestamp: number;
  }>;
}

/**
 * 生成信号响应
 */
export interface GenerateSignalResponse {
  symbol: string;
  interval: string;
  signal: Signal | null;
  message: string;
}

/**
 * K线形态
 */
export interface Pattern {
  id: number;
  symbol: string;
  interval: string;
  pattern_type: string;
  confidence: number; // 0-1
  description: string;
  detected_at: number;
  created_at: string;
}

/**
 * 形态识别响应
 */
export interface PatternsResponse {
  symbol: string;
  interval: string;
  count: number;
  patterns: Pattern[];
}

class SignalAPI {
  private baseURL = '/api/signals';

  /**
   * 获取最新信号
   * @param symbol 币种符号
   * @param interval 时间周期
   * @param limit 返回数量，默认1，最大50
   */
  async getLatestSignals(
    symbol: string,
    interval: string,
    limit: number = 1
  ): Promise<LatestSignalResponse> {
    const params = { limit };
    return await apiClient.get<LatestSignalResponse>(
      `${this.baseURL}/${symbol}/${interval}/latest`,
      { params }
    );
  }

  /**
   * 获取历史信号
   * @param symbol 币种符号
   * @param interval 时间周期
   * @param startTime 开始时间戳(毫秒)
   * @param endTime 结束时间戳(毫秒)
   * @param limit 返回数量，默认50，最大200
   */
  async getHistorySignals(
    symbol: string,
    interval: string,
    startTime?: number,
    endTime?: number,
    limit: number = 50
  ): Promise<HistorySignalResponse> {
    const params: any = { limit };
    if (startTime) params.start_time = startTime;
    if (endTime) params.end_time = endTime;

    return await apiClient.get<HistorySignalResponse>(
      `${this.baseURL}/${symbol}/${interval}/history`,
      { params }
    );
  }

  /**
   * 获取多币种信号概览
   * @param interval 时间周期
   * @param limit 返回币种数量，默认10
   */
  async getSignalOverview(
    interval: string,
    limit: number = 10
  ): Promise<SignalOverviewResponse> {
    const params = { limit };
    return await apiClient.get<SignalOverviewResponse>(
      `${this.baseURL}/overview/${interval}`,
      { params }
    );
  }

  /**
   * 手动生成信号（测试用）
   * @param symbol 币种符号
   * @param interval 时间周期
   * @param klineCount K线数据数量，默认100，最大500
   */
  async generateSignal(
    symbol: string,
    interval: string,
    klineCount: number = 100
  ): Promise<GenerateSignalResponse> {
    const params = { kline_count: klineCount };
    return await apiClient.post<GenerateSignalResponse>(
      `${this.baseURL}/${symbol}/${interval}/generate`,
      null,
      { params }
    );
  }

  /**
   * 获取形态识别记录
   * @param symbol 币种符号
   * @param interval 时间周期
   * @param limit 返回数量，默认10，最大50
   */
  async getPatterns(
    symbol: string,
    interval: string,
    limit: number = 10
  ): Promise<PatternsResponse> {
    const params = { limit };
    return await apiClient.get<PatternsResponse>(
      `${this.baseURL}/${symbol}/${interval}/patterns`,
      { params }
    );
  }
}

// 导出单例
export const signalAPI = new SignalAPI();

// 工具函数
export const signalUtils = {
  /**
   * 获取信号强度级别
   */
  getStrengthLevel(strength: number): SignalStrength {
    if (strength <= 40) return 'weak';
    if (strength <= 70) return 'medium';
    return 'strong';
  },

  /**
   * 获取信号强度颜色
   */
  getStrengthColor(strength: number): string {
    const level = this.getStrengthLevel(strength);
    switch (level) {
      case 'weak':
        return '#94a3b8'; // 灰色
      case 'medium':
        return '#f59e0b'; // 橙色
      case 'strong':
        return '#10b981'; // 绿色
      default:
        return '#94a3b8';
    }
  },

  /**
   * 获取信号类型图标
   */
  getSignalIcon(signalType: SignalType): string {
    switch (signalType) {
      case 'BUY':
        return '🟢';
      case 'SELL':
        return '🔴';
      case 'NEUTRAL':
        return '⚪';
      default:
        return '⚪';
    }
  },

  /**
   * 获取信号类型颜色
   */
  getSignalColor(signalType: SignalType): string {
    switch (signalType) {
      case 'BUY':
        return '#10b981'; // 绿色
      case 'SELL':
        return '#ef4444'; // 红色
      case 'NEUTRAL':
        return '#94a3b8'; // 灰色
      default:
        return '#94a3b8';
    }
  },

  /**
   * 获取信号类型文本
   */
  getSignalText(signalType: SignalType): string {
    switch (signalType) {
      case 'BUY':
        return '买入';
      case 'SELL':
        return '卖出';
      case 'NEUTRAL':
        return '中性';
      default:
        return '未知';
    }
  },

  /**
   * 格式化信号时间
   */
  formatSignalTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * 判断是否为中强信号
   */
  isMediumOrStrongSignal(strength: number): boolean {
    return strength > 40;
  },

  /**
   * 获取形态中文名称
   */
  getPatternName(patternType: string): string {
    const patternMap: Record<string, string> = {
      bullish_engulfing: '看涨吞没',
      bearish_engulfing: '看跌吞没',
      hammer: '锤子线',
      shooting_star: '流星线',
      doji: '十字星',
      morning_star: '早晨之星',
      evening_star: '黄昏之星',
      three_white_soldiers: '红三兵',
      three_black_crows: '三只乌鸦',
    };
    return patternMap[patternType] || patternType;
  },
};
