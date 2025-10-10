import { MarketData, TradingSignal, PortfolioStats, SystemStatus } from '../types';

// 主流加密货币市场数据
export const mockMarketData: MarketData[] = [
  {
    symbol: 'BTCUSDT',
    displayName: 'Bitcoin',
    price: 67842.50,
    change24h: 1245.80,
    changePercent24h: 1.87,
    volume24h: 28475962340,
    high24h: 68950.00,
    low24h: 65720.30,
    marketCap: 1334567890000
  },
  {
    symbol: 'ETHUSDT',
    displayName: 'Ethereum',
    price: 3456.78,
    change24h: -89.45,
    changePercent24h: -2.52,
    volume24h: 15678943210,
    high24h: 3598.90,
    low24h: 3398.50,
    marketCap: 415234567890
  },
  {
    symbol: 'BNBUSDT',
    displayName: 'BNB',
    price: 598.34,
    change24h: 23.67,
    changePercent24h: 4.12,
    volume24h: 2456789123,
    high24h: 612.80,
    low24h: 567.90,
    marketCap: 89567123456
  },
  {
    symbol: 'SOLUSDT',
    displayName: 'Solana',
    price: 187.45,
    change24h: 12.89,
    changePercent24h: 7.38,
    volume24h: 5678934567,
    high24h: 195.60,
    low24h: 172.30,
    marketCap: 87654321987
  },
  {
    symbol: 'ADAUSDT',
    displayName: 'Cardano',
    price: 0.4567,
    change24h: -0.0234,
    changePercent24h: -4.88,
    volume24h: 892345678,
    high24h: 0.4890,
    low24h: 0.4325,
    marketCap: 16234567890
  }
];

// 交易信号数据
export const mockTradingSignals: TradingSignal[] = [
  {
    id: '1',
    symbol: 'BTCUSDT',
    type: 'BUY',
    price: 67500.00,
    confidence: 0.87,
    timestamp: Date.now() - 300000, // 5分钟前
    description: 'RSI超卖反弹，MACD金叉形成',
    status: 'ACTIVE'
  },
  {
    id: '2',
    symbol: 'ETHUSDT',
    type: 'SELL',
    price: 3480.00,
    confidence: 0.72,
    timestamp: Date.now() - 600000, // 10分钟前
    description: '突破支撑位，成交量放大',
    status: 'EXECUTED'
  },
  {
    id: '3',
    symbol: 'SOLUSDT',
    type: 'BUY',
    price: 185.20,
    confidence: 0.94,
    timestamp: Date.now() - 900000, // 15分钟前
    description: '布林带下轨反弹，量价齐升',
    status: 'ACTIVE'
  }
];

// 投资组合统计
export const mockPortfolioStats: PortfolioStats = {
  totalValue: 125678.90,
  totalPnL: 23456.78,
  totalPnLPercent: 22.95,
  dayPnL: 3456.12,
  dayPnLPercent: 2.83,
  activePositions: 8
};

// 系统状态
export const mockSystemStatus: SystemStatus = {
  status: 'ONLINE',
  uptime: 99.97,
  latency: 42,
  activeSessions: 1247,
  lastUpdate: Date.now()
};

// 格式化数字为货币
export const formatCurrency = (value: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: value >= 1 ? 2 : 6
  }).format(value);
};

// 格式化百分比
export const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// 格式化时间
export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 格式化大数字
export const formatLargeNumber = (value: number): string => {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toFixed(2);
};