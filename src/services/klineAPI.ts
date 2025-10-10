/**
 * K线数据API服务
 * 基于API_REFERENCE.md中的K线数据接口
 */

import { apiGet, apiPost } from './apiClient';
import type {
  KlineResponse,
  KlineStatistics,
  KlineIntegrity,
  TopSymbolsOverviewResponse,
  BatchLatestKlinesResponse,
  SupportedIntervalsResponse,
  KlineInterval,
} from '../types/kline';

/**
 * K线数据API接口封装
 * ⚠️ 注意: apiClient会自动解包响应的data字段，直接使用返回数据
 */
export const klineAPI = {
  /**
   * 获取K线数据
   * GET /api/klines/:symbol/:interval
   * @param symbol 币种符号，如 'BTCUSDT'
   * @param interval 时间周期，如 '1m', '5m', '1h'
   * @param limit 返回数据条数，默认300，最大1000
   * @param startTime 开始时间戳(毫秒)
   * @param endTime 结束时间戳(毫秒)
   */
  getKlines: (
    symbol: string,
    interval: KlineInterval,
    limit = 300,
    startTime?: number,
    endTime?: number
  ): Promise<KlineResponse> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (startTime) params.append('start_time', startTime.toString());
    if (endTime) params.append('end_time', endTime.toString());

    return apiGet<KlineResponse>(`/api/klines/${symbol}/${interval}?${params.toString()}`);
  },

  /**
   * 获取最新K线数据
   * GET /api/klines/:symbol/:interval/latest
   * @param symbol 币种符号
   * @param interval 时间周期
   * @param limit 返回数据条数，默认100，最大500
   */
  getLatestKlines: (
    symbol: string,
    interval: KlineInterval,
    limit = 100
  ): Promise<KlineResponse> => {
    return apiGet<KlineResponse>(`/api/klines/${symbol}/${interval}/latest?limit=${limit}`);
  },

  /**
   * 按时间范围查询K线数据
   * GET /api/klines/:symbol/:interval/range
   * @param symbol 币种符号
   * @param interval 时间周期
   * @param startTime 开始时间戳(毫秒) - 必填
   * @param endTime 结束时间戳(毫秒) - 必填
   * @param limit 返回数据条数，默认1000，最大2000
   */
  getKlinesByRange: (
    symbol: string,
    interval: KlineInterval,
    startTime: number,
    endTime: number,
    limit = 1000
  ): Promise<KlineResponse> => {
    const params = new URLSearchParams({
      start_time: startTime.toString(),
      end_time: endTime.toString(),
      limit: limit.toString(),
    });

    return apiGet<KlineResponse>(`/api/klines/${symbol}/${interval}/range?${params.toString()}`);
  },

  /**
   * 获取K线数据统计信息
   * GET /api/klines/:symbol/statistics
   * @param symbol 币种符号
   */
  getStatistics: (symbol: string): Promise<KlineStatistics> => {
    return apiGet<KlineStatistics>(`/api/klines/${symbol}/statistics`);
  },

  /**
   * 检查K线数据完整性
   * GET /api/klines/:symbol/:interval/integrity
   * @param symbol 币种符号
   * @param interval 时间周期
   * @param days 检查天数，默认1，最大30
   */
  checkIntegrity: (
    symbol: string,
    interval: KlineInterval,
    days = 1
  ): Promise<KlineIntegrity> => {
    return apiGet<KlineIntegrity>(`/api/klines/${symbol}/${interval}/integrity?days=${days}`);
  },

  /**
   * 获取支持的时间周期列表
   * GET /api/klines/config/intervals
   */
  getSupportedIntervals: (): Promise<SupportedIntervalsResponse> => {
    return apiGet<SupportedIntervalsResponse>('/api/klines/config/intervals');
  },

  /**
   * 获取TOP币种的K线数据概览
   * GET /api/klines/overview/top-symbols
   * @param interval 时间周期，默认 '1m'
   * @param limit 返回币种数量，默认10
   */
  getTopSymbolsOverview: (
    interval: KlineInterval = '1m',
    limit = 10
  ): Promise<TopSymbolsOverviewResponse> => {
    return apiGet<TopSymbolsOverviewResponse>(
      `/api/klines/overview/top-symbols?interval=${interval}&limit=${limit}`
    );
  },

  /**
   * 批量获取多个币种的最新K线
   * POST /api/klines/batch/latest
   * @param symbols 币种数组，如 ['BTCUSDT', 'ETHUSDT']
   * @param interval 时间周期
   * @param limit 每个币种返回的K线数量，默认1
   */
  batchGetLatest: (
    symbols: string[],
    interval: KlineInterval,
    limit = 1
  ): Promise<BatchLatestKlinesResponse> => {
    return apiPost<BatchLatestKlinesResponse>('/api/klines/batch/latest', {
      symbols,
      interval,
      limit,
    });
  },
};

/**
 * K线数据转换工具函数
 */
export const klineUtils = {
  /**
   * 将后端K线数据转换为TradingView格式
   * @param klines 后端K线数据数组
   */
  convertToTradingViewFormat: (klines: any[]) => {
    // ⚠️ 重要: lightweight-charts要求数据必须按时间升序排列
    // 先按open_time升序排序
    const sortedKlines = [...klines].sort((a, b) => a.open_time - b.open_time);

    const candlesticks = sortedKlines.map((k) => ({
      // lightweight-charts不支持时区，需要手动 +8小时 来显示北京时间
      // 将毫秒转为秒，并加上8小时偏移 (8 * 3600)
      time: Math.floor(k.open_time / 1000) + 8 * 3600,
      open: parseFloat(k.open),
      high: parseFloat(k.high),
      low: parseFloat(k.low),
      close: parseFloat(k.close),
    }));

    const volumes = sortedKlines.map((k) => {
      const open = parseFloat(k.open);
      const close = parseFloat(k.close);
      return {
        time: Math.floor(k.open_time / 1000) + 8 * 3600, // +8小时显示北京时间
        value: parseFloat(k.volume),
        color: close >= open ? '#26a69a' : '#ef5350', // 涨绿跌红
      };
    });

    return { candlesticks, volumes };
  },

  /**
   * 计算K线统计数据
   * @param klines K线数据数组
   */
  calculateStats: (klines: any[]) => {
    if (klines.length === 0) {
      return {
        latestPrice: 0,
        change24h: 0,
        changePercent24h: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
      };
    }

    const latest = klines[klines.length - 1];
    const first = klines[0];

    const latestPrice = parseFloat(latest.close);
    const firstPrice = parseFloat(first.open);
    const change24h = latestPrice - firstPrice;
    const changePercent24h = (change24h / firstPrice) * 100;

    const high24h = Math.max(...klines.map((k) => parseFloat(k.high)));
    const low24h = Math.min(...klines.map((k) => parseFloat(k.low)));
    const volume24h = klines.reduce((sum, k) => sum + parseFloat(k.volume), 0);

    return {
      latestPrice,
      change24h,
      changePercent24h,
      high24h,
      low24h,
      volume24h,
    };
  },
};
