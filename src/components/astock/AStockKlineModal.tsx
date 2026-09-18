import React, { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { astockAPI, KlineMark } from '../../services/astockAPI';
import { conceptAPI, StockConcept } from '../../services/conceptAPI';
import { favoriteAPI } from '../../services/favoriteAPI';
import styles from './AStockKlineModal.module.scss';

interface AStockKlineModalProps {
  code: string;
  name?: string;
  onClose: () => void;
  isDark?: boolean;
  sidebarCollapsed?: boolean;
}

// "2026-06-10" -> BusinessDay（日线用日期对象，避免时区偏移）
const toBusinessDay = (d: string) => {
  const [year, month, day] = d.split('-').map(Number);
  return { year, month, day };
};

// 后端数值字段可能是 number、数字字符串或 null，统一转为 number|null
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// 计算 EMA
const calcEMA = (closes: number[], period: number) => {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < closes.length; i++) {
    ema = i === 0 ? closes[i] : closes[i] * k + ema * (1 - k);
    out.push(i >= period - 1 ? ema : null);
  }
  return out;
};

const AStockKlineModal: React.FC<AStockKlineModalProps> = ({ code, name, onClose, isDark = false, sidebarCollapsed = false }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockName, setStockName] = useState(name ?? '');
  const [marks, setMarks] = useState<KlineMark[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [concepts, setConcepts] = useState<StockConcept[]>([]);
  const [faved, setFaved] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const bg = isDark ? '#1e1e1e' : '#ffffff';
    const textColor = isDark ? '#d1d4dc' : '#191919';
    const gridColor = isDark ? '#2b2b43' : '#e1e3eb';

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: 500,
      layout: { background: { color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      timeScale: { timeVisible: false, secondsVisible: false, borderColor: gridColor },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: gridColor },
    });

    // A股配色：红涨绿跌
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef5350',
      downColor: '#26a69a',
      borderUpColor: '#ef5350',
      borderDownColor: '#26a69a',
      wickUpColor: '#ef5350',
      wickDownColor: '#26a69a',
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });

    // 成交量（叠加在底部独立刻度）
    // 注意：须用 volumeSeries.priceScale() 取刻度，chart.priceScale('volume')
    // 在该刻度尚未建立时会抛错，导致整个 effect 中断、图表空白
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    astockAPI.getKline(code, { limit: 250, adjust: 'hfq' })
      .then(res => {
        setStockName(res.name || code);
        setMarks(res.marks);

        // 用原始价（raw_*）绘图，与行情软件显示的价格一致。
        // 后端同一字段可能返回 number / 数字字符串 / null（停牌等），
        // lightweight-charts 遇到非数字会整批拒绝导致图表空白，故统一转数字再剔除无效行
        const bars = res.bars
          .map(b => ({
            time: toBusinessDay(b.trade_date),
            open: toNum(b.raw_open),
            high: toNum(b.raw_high),
            low: toNum(b.raw_low),
            close: toNum(b.raw_close),
            volume: toNum(b.volume) ?? 0,
          }))
          .filter(
            (b): b is typeof b & { open: number; high: number; low: number; close: number } =>
              b.open !== null && b.high !== null && b.low !== null && b.close !== null
          );

        if (!bars.length) {
          setError('该股票无有效K线数据');
          setLoading(false);
          return;
        }

        const candleData = bars.map(b => ({
          time: b.time,
          open: b.open, high: b.high, low: b.low, close: b.close,
        }));
        candleSeries.setData(candleData as any);

        const volData = bars.map(b => ({
          time: b.time,
          value: b.volume,
          color: b.close >= b.open ? 'rgba(239,83,80,0.5)' : 'rgba(38,166,154,0.5)',
        }));
        volumeSeries.setData(volData as any);

        const closes = bars.map(b => b.close);
        const dates = bars.map(b => b.time);
        const ema20 = calcEMA(closes, 20);
        ema20Series.setData(ema20.map((v, i) => v === null ? null : { time: dates[i], value: v }).filter(Boolean) as any);

        // 默认展示最近100根 + 右侧30格留白
        const barCount = bars.length;
        const visibleBars = 100;
        const rightOffset = 10;
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(0, barCount - visibleBars),
          to: barCount - 1 + rightOffset,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || '加载K线失败');
        setLoading(false);
      });

    const observer = new ResizeObserver(() => {
      const w = container.clientWidth;
      if (w > 0) chart.applyOptions({ width: w });
    });
    observer.observe(container);

    // 动画结束后布局才稳定，补一次尺寸校正（ResizeObserver 只在尺寸变化时触发，
    // 若首帧宽度已是终值则不会回调，图表会停在兜底宽度）
    const raf = requestAnimationFrame(() => {
      const w = container.clientWidth;
      if (w > 0) chart.applyOptions({ width: w });
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      chart.remove();
    };
  }, [code, isDark]);

  // 收藏状态：打开弹窗时查一次
  useEffect(() => {
    let cancelled = false;
    setFaved(false);
    favoriteAPI
      .getCodes()
      .then((codes) => {
        if (!cancelled) setFaved(codes.includes(code));
      })
      .catch((err) => console.error('加载收藏状态失败:', err));
    return () => { cancelled = true; };
  }, [code]);

  // POST 幂等、DELETE 不存在返回 404，可放心做乐观更新：先翻转，失败回滚
  const toggleFav = async () => {
    if (favBusy) return;
    setFavBusy(true);
    const next = !faved;
    setFaved(next);
    try {
      if (next) await favoriteAPI.add(code);
      else await favoriteAPI.remove(code);
    } catch (err: any) {
      setFaved(!next);
      message.error(err?.message || (next ? '收藏失败' : '取消收藏失败'));
    } finally {
      setFavBusy(false);
    }
  };

  // 概念板块单独取，和 K 线解耦：概念接口挂了不影响图表渲染
  useEffect(() => {
    let cancelled = false;
    setConcepts([]);
    conceptAPI
      .getStockConcepts(code)
      .then((res) => {
        if (!cancelled) setConcepts(res?.concepts ?? []);
      })
      .catch((err) => {
        console.error('加载概念板块失败:', err);
      });
    return () => { cancelled = true; };
  }, [code]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={styles.overlay}
      style={{ paddingLeft: sidebarCollapsed ? '4rem' : '15rem' }}
      onClick={handleOverlayClick}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span
              className={`${styles.favStar} ${faved ? styles.favStarOn : ''} ${favBusy ? styles.favStarBusy : ''}`}
              onClick={toggleFav}
              role="button"
              title={faved ? '取消收藏' : '收藏'}
              aria-label={faved ? '取消收藏' : '收藏'}
            >
              {faved ? '★' : '☆'}
            </span>
            <span className={styles.symbol}>{stockName || code}</span>
            <span className={styles.code}>{code}</span>
            {/* 概念按成分股数升序返回，窄题材在前，取前 6 个 */}
            {concepts.length > 0 && (
              <span className={styles.concepts}>
                {concepts.slice(0, 6).map((c) => (
                  <span
                    key={c.thscode}
                    className={styles.conceptTag}
                    title={`${c.concept_name} · ${c.member_count} 只成分股`}
                  >
                    {c.concept_name}
                  </span>
                ))}
                {concepts.length > 6 && (
                  <span
                    className={styles.conceptMore}
                    title={concepts.slice(6).map((c) => c.concept_name).join('、')}
                  >
                    +{concepts.length - 6}
                  </span>
                )}
              </span>
            )}
            <span className={styles.subtitle}>日线 · 原始价 · 最近250根</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.chartWrap} ref={chartContainerRef}>
            {loading && <div className={styles.loading}>加载中...</div>}
            {error && <div className={styles.errorMsg}>{error}</div>}
          </div>

          {marks.length > 0 && (
            <div className={styles.marksPanel}>
              <div className={styles.marksTitle}>选中记录（{marks.length}）</div>
              <div className={styles.marksList}>
                {/* 同一交易日可能有多条记录（不同参数套各选一次），故用下标作 key */}
                {marks.map((m, idx) => (
                  <div
                    key={`${m.trade_date}-${idx}`}
                    className={`${styles.markItem} ${activeIdx === idx ? styles.markActive : ''}`}
                    onClick={() => setActiveIdx(activeIdx === idx ? null : idx)}
                  >
                    <div className={styles.markHead}>
                      <span className={styles.markDate}>{m.trade_date}</span>
                      <span className={styles.markRank}>#{m.rank}</span>
                      <span className={styles.markScore}>{(m.total_score * 100).toFixed(1)}分</span>
                    </div>
                    {activeIdx === idx && m.reasons && (
                      <div className={styles.markReasons}>{m.reasons}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AStockKlineModal;
