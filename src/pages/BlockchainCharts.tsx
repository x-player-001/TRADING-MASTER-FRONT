import React, { useState, useEffect } from 'react';
import styles from './BlockchainCharts.module.scss';
import PageHeader from '../components/ui/PageHeader';
import TradingViewChart from '../components/charts/TradingViewChart';
import { blockchainAPI } from '../services/blockchainAPI';
import type { Token, OHLCV } from '../types/blockchain';
import type { CandlestickData, VolumeData } from '../types/kline';

const BlockchainCharts: React.FC = () => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [token, setToken] = useState<Token | null>(null);
  const [ohlcvData, setOhlcvData] = useState<OHLCV[]>([]);
  const [chartData, setChartData] = useState<CandlestickData[]>([]);
  const [volumeData, setVolumeData] = useState<VolumeData[]>([]);
  const [interval, setInterval] = useState('1d');
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 从URL获取address参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const address = params.get('address');
    if (address) {
      setTokenAddress(address);
      fetchTokenData(address);
    }
  }, []);

  const fetchTokenData = async (address: string) => {
    if (!address) return;

    try {
      setLoading(true);
      setError(null);

      const [tokenRes, ohlcvRes] = await Promise.all([
        blockchainAPI.getTokenDetail(address),
        blockchainAPI.getTokenOHLCV(address, { interval, limit })
      ]);

      setToken(tokenRes);
      setOhlcvData(ohlcvRes);

      // 转换为图表数据格式
      const candlesticks: CandlestickData[] = ohlcvRes.map(item => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000),
        open: item.open_price,
        high: item.high_price,
        low: item.low_price,
        close: item.close_price
      }));

      const volumes: VolumeData[] = ohlcvRes.map(item => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000),
        value: item.volume,
        color: item.close_price >= item.open_price ? '#26a69a' : '#ef5350'
      }));

      setChartData(candlesticks);
      setVolumeData(volumes);
    } catch (err: any) {
      console.error('获取代币数据失败:', err);
      setError(err.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (tokenAddress.trim()) {
      fetchTokenData(tokenAddress.trim());
    }
  };

  const handleIntervalChange = (newInterval: string) => {
    setInterval(newInterval);
    if (tokenAddress) {
      fetchTokenData(tokenAddress);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    if (tokenAddress) {
      fetchTokenData(tokenAddress);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="链上K线图表"
        subtitle="BSC链上代币价格走势分析"
        icon="📈"
      />

      <div className={styles.content}>
        {/* 搜索栏 */}
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="输入代币合约地址 (如 0x55d398326f99059ff775485246999027b3197955)"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className={styles.addressInput}
          />
          <button onClick={handleSearch} className={styles.searchBtn}>
            🔍 查询
          </button>
        </div>

        {/* 代币信息 */}
        {token && (
          <div className={styles.tokenInfo}>
            <div className={styles.infoItem}>
              <span className={styles.label}>符号:</span>
              <span className={styles.value}>{token.symbol}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>名称:</span>
              <span className={styles.value}>{token.name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>地址:</span>
              <code className={styles.address}>{token.address}</code>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>数据源:</span>
              <span className={styles.badge}>{token.data_source.toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* 图表控制 */}
        {token && (
          <div className={styles.controls}>
            <div className={styles.controlGroup}>
              <label>时间间隔:</label>
              <select value={interval} onChange={(e) => handleIntervalChange(e.target.value)}>
                <option value="1h">1小时</option>
                <option value="4h">4小时</option>
                <option value="1d">1天</option>
              </select>
            </div>

            <div className={styles.controlGroup}>
              <label>K线数量:</label>
              <select value={limit} onChange={(e) => handleLimitChange(Number(e.target.value))}>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>

            <div className={styles.stats}>
              <span>总计: <strong>{ohlcvData.length}</strong> 条K线数据</span>
            </div>
          </div>
        )}

        {/* 图表区域 */}
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : error ? (
          <div className={styles.error}>
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <p>{error}</p>
          </div>
        ) : chartData.length > 0 ? (
          <div className={styles.chartContainer}>
            <TradingViewChart
              candlestickData={chartData}
              volumeData={volumeData}
              height={600}
              showVolume={true}
              theme="dark"
            />
          </div>
        ) : token ? (
          <div className={styles.empty}>
            <span style={{ fontSize: '3rem' }}>📊</span>
            <p>暂无K线数据</p>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <span style={{ fontSize: '4rem' }}>📈</span>
            <p>请输入代币合约地址查询K线图表</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockchainCharts;
