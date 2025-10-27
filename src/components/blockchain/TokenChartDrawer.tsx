import React, { useState, useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, Time, CandlestickData } from 'lightweight-charts';
import { blockchainAPI } from '../../services/blockchainAPI';
import type { TokenKline } from '../../types/blockchain';
import styles from './TokenChartDrawer.module.scss';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  pairAddress: string;
  tokenSymbol: string;
  chain: string;
}

const TokenChartDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  tokenAddress,
  pairAddress,
  tokenSymbol,
  chain
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 固定为5分钟K线
  const timeframe: 'minute' = 'minute';
  const aggregate: number = 5;

  // 初始化图表
  useEffect(() => {
    if (!isOpen || !chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#1f2937' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      crosshair: {
        mode: 1,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
    });

    // 使用 v5 API: chart.addSeries(SeriesType, options)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // 响应式调整宽度
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // 使用ResizeObserver监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver && chartContainerRef.current) {
        resizeObserver.unobserve(chartContainerRef.current);
      }
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    };
  }, [isOpen]);

  // 加载K线数据
  useEffect(() => {
    if (!isOpen) return;
    fetchKlineData();
  }, [isOpen, pairAddress]);

  // 生成DexScreener链接
  const getDexScreenerUrl = (): string => {
    return `https://dexscreener.com/${chain}/${pairAddress}`;
  };

  const fetchKlineData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await blockchainAPI.getTokenKlines({
        pair_address: pairAddress,
        timeframe,
        aggregate,
        limit: 500,
      });

      if (response.data && response.data.length > 0) {
        const chartData: CandlestickData<Time>[] = response.data.map((kline: TokenKline) => ({
          time: kline.timestamp as Time,
          open: parseFloat(kline.open),
          high: parseFloat(kline.high),
          low: parseFloat(kline.low),
          close: parseFloat(kline.close),
        }));

        // 按时间排序
        chartData.sort((a, b) => (a.time as number) - (b.time as number));

        if (candlestickSeriesRef.current) {
          candlestickSeriesRef.current.setData(chartData);
          chartRef.current?.timeScale().fitContent();
        }
      } else {
        setError('暂无K线数据');
      }
    } catch (err: any) {
      console.error('获取K线数据失败:', err);
      setError(err.message || '获取K线数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div className={styles.overlay} onClick={onClose} />

      {/* 抽屉 */}
      <div className={styles.drawer}>
        {/* 头部 */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h3 className={styles.title}>
              <a
                href={getDexScreenerUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.titleLink}
              >
                {tokenSymbol} <span className={styles.chain}>({chain})</span>
              </a>
            </h3>
            <p className={styles.subtitle}>K线图表 (5分钟)</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 图表区域 */}
        <div className={styles.content}>
          {loading && <div className={styles.loading}>⏳ 加载中...</div>}
          {error && <div className={styles.error}>❌ {error}</div>}
          <div ref={chartContainerRef} className={styles.chartContainer} />
        </div>
      </div>
    </>
  );
};

export default TokenChartDrawer;
