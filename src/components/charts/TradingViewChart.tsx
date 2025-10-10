/**
 * TradingView Lightweight Charts 封装组件
 * 支持蜡烛图和成交量图表展示
 */

import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers, LineStyle } from 'lightweight-charts';
import type { CandlestickData, VolumeData } from '../../types/kline';
import type { Signal } from '../../services/signalAPI';
import type { StructureRange, StructureBreakout } from '../../services/structureAPI';
import type { ChanFractal, ChanStroke, ChanCenter } from '../../services/chanAPI';
import { createRangePrimitive, RangePrimitive } from './RangePrimitive';
import { createCenterPrimitive, CenterPrimitive } from './CenterPrimitive';
import styles from './TradingViewChart.module.scss';

interface TradingViewChartProps {
  candlestickData: CandlestickData[];
  volumeData?: VolumeData[];
  signals?: Signal[];              // 交易信号数据
  ranges?: StructureRange[];       // 结构区间(支撑/阻力位)
  breakouts?: StructureBreakout[]; // 突破信号
  // 缠论数据
  fractals?: ChanFractal[];        // 分型数据
  strokes?: ChanStroke[];          // 笔数据
  centers?: ChanCenter[];          // 中枢数据
  width?: number;
  height?: number;
  showVolume?: boolean;            // 是否显示成交量，默认true
  showRanges?: boolean;            // 是否显示支撑/阻力线，默认true
  showBreakouts?: boolean;         // 是否显示突破信号，默认true
  // 缠论显示开关
  showFractals?: boolean;          // 是否显示分型标记，默认false
  showStrokes?: boolean;           // 是否显示笔的连线，默认false
  showCenters?: boolean;           // 是否显示中枢区域，默认false
  theme?: 'light' | 'dark';        // 主题，默认dark
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
  candlestickData,
  volumeData = [],
  signals = [],
  ranges = [],
  breakouts = [],
  fractals = [],
  strokes = [],
  centers = [],
  width,
  height = 500,
  showVolume = true,
  showRanges = true,
  showBreakouts = true,
  showFractals = false,
  showStrokes = false,
  showCenters = false,
  theme = 'dark',
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const seriesMarkersRef = useRef<any>(null);     // v5: 存储signal markers plugin实例
  const breakoutMarkersRef = useRef<any>(null);   // v5: 存储breakout markers plugin实例
  const rangePrimitivesRef = useRef<RangePrimitive[]>([]); // 存储区间范围框图元实例
  // 缠论图元引用
  const strokeSeriesRef = useRef<any[]>([]);      // 存储笔的LineSeries实例
  const centerPrimitivesRef = useRef<CenterPrimitive[]>([]); // 存储中枢图元实例
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // 主题配置
  const isDark = theme === 'dark';
  const backgroundColor = isDark ? '#1e1e1e' : '#ffffff';
  const textColor = isDark ? '#d1d4dc' : '#191919';
  const gridColor = isDark ? '#2b2b43' : '#e1e3eb';

  /**
   * 初始化图表
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 创建图表实例
    const chart = createChart(chartContainerRef.current, {
      width: width || chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: backgroundColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: 0, // Normal crosshair mode
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: gridColor,
        // 注意：lightweight-charts 不原生支持时区配置
        // 通过手动调整时间戳 (+8小时) 来显示北京时间
      },
      rightPriceScale: {
        borderColor: gridColor,
      },
    });

    chartRef.current = chart;

    // 添加蜡烛图系列 (v5.0 新API: 使用 addSeries)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',        // 涨的颜色(绿色)
      downColor: '#ef5350',      // 跌的颜色(红色)
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // 添加成交量图表系列(如果启用) (v5.0 新API: 使用 addSeries)
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '', // 使用独立的价格轴
      });
      volumeSeriesRef.current = volumeSeries;

      // 设置成交量在下方，占据20%的高度
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
    }

    // 响应式调整大小
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newWidth = width || chartContainerRef.current.clientWidth;
        chartRef.current.applyOptions({
          width: newWidth,
        });
      }
    };

    // 使用ResizeObserver监听容器大小变化
    resizeObserverRef.current = new ResizeObserver(handleResize);
    resizeObserverRef.current.observe(chartContainerRef.current);

    // 清理函数
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [width, height, showVolume, theme, backgroundColor, textColor, gridColor]);

  /**
   * 更新蜡烛图数据
   */
  useEffect(() => {
    if (candlestickSeriesRef.current && candlestickData.length > 0) {
      candlestickSeriesRef.current.setData(candlestickData);

      // 自动适配时间范围
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [candlestickData]);

  /**
   * 合并所有标记（信号、突破、分型）并统一更新
   * 因为 lightweight-charts 的 markers 只能有一个 plugin 实例
   */
  useEffect(() => {
    if (!candlestickSeriesRef.current || candlestickData.length === 0) {
      return;
    }

    try {
      // 🔥 关键：先清除旧的 markers primitive
      if (seriesMarkersRef.current && typeof candlestickSeriesRef.current.detachPrimitive === 'function') {
        try {
          (candlestickSeriesRef.current as any).detachPrimitive((seriesMarkersRef.current as any)._internal__primitive);
          seriesMarkersRef.current = null;
        } catch (err) {
          console.error('[TradingViewChart] Error detaching old markers:', err);
        }
      }

      const firstKlineTime = candlestickData[0].time;
      const allMarkers: any[] = [];

      // 1. 添加信号标记
      if (signals.length > 0) {
        const validSignals = signals.filter((signal) => {
          const signalTime = Math.floor(signal.timestamp / 1000) + 8 * 3600;
          return signalTime >= firstKlineTime;
        });

        const signalMarkers = validSignals.map((signal) => {
          const isBuy = signal.signal_type === 'BUY';
          const timeInSeconds = Math.floor(signal.timestamp / 1000) + 8 * 3600;
          return {
            time: timeInSeconds,
            position: isBuy ? ('belowBar' as const) : ('aboveBar' as const),
            color: isBuy ? '#10b981' : '#ef4444',
            shape: isBuy ? ('arrowUp' as const) : ('arrowDown' as const),
            text: `${signal.signal_type} ${signal.strength}`,
          };
        });
        allMarkers.push(...signalMarkers);
      }

      // 2. 添加突破信号标记
      if (breakouts.length > 0) {
        const validBreakouts = breakouts.filter((breakout) => {
          const breakoutTime = Math.floor(breakout.breakout_time / 1000) + 8 * 3600;
          return breakoutTime >= firstKlineTime;
        });

        const breakoutMarkers = validBreakouts.map((breakout) => {
          const isUp = breakout.direction === 'UP';
          const timeInSeconds = Math.floor(breakout.breakout_time / 1000) + 8 * 3600;
          return {
            time: timeInSeconds,
            position: isUp ? ('belowBar' as const) : ('aboveBar' as const),
            color: isUp ? '#4CAF50' : '#FF9800',
            shape: isUp ? ('arrowUp' as const) : ('arrowDown' as const),
            text: `突破${isUp ? '↑' : '↓'} ${breakout.confidence}%`,
          };
        });
        allMarkers.push(...breakoutMarkers);
      }

      // 3. 添加分型标记（如果启用）
      if (fractals.length > 0) {
        const confirmedFractals = fractals.filter((fractal) => {
          if (!fractal.is_confirmed) return false;
          const fractalTime = Math.floor(fractal.time / 1000) + 8 * 3600;
          return fractalTime >= firstKlineTime;
        });

        const fractalMarkers = confirmedFractals.map((fractal) => {
          const isTop = fractal.type === 'top';
          const timeInSeconds = Math.floor(fractal.time / 1000) + 8 * 3600;
          return {
            time: timeInSeconds,
            position: isTop ? ('aboveBar' as const) : ('belowBar' as const),
            color: isTop ? '#EF5350' : '#26A69A',
            shape: isTop ? ('arrowDown' as const) : ('arrowUp' as const),
            text: isTop ? '顶' : '底',
          };
        });
        allMarkers.push(...fractalMarkers);
      }

      // 创建合并后的 markers plugin（即使为空数组也要创建，以清除旧标记）
      const markersPlugin = createSeriesMarkers(candlestickSeriesRef.current, allMarkers);
      seriesMarkersRef.current = markersPlugin;

      // 附加到系列
      if (typeof candlestickSeriesRef.current.attachPrimitive === 'function') {
        (candlestickSeriesRef.current as any).attachPrimitive((markersPlugin as any)._internal__primitive);
      }

      console.log(`[TradingViewChart] 创建了 ${allMarkers.length} 个标记 (信号+突破+分型)`);
    } catch (err) {
      console.error('[TradingViewChart] Error with markers:', err);
    }
  }, [candlestickData, signals, breakouts, fractals]);

  /**
   * 更新成交量数据
   */
  useEffect(() => {
    if (volumeSeriesRef.current && volumeData.length > 0 && showVolume) {
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [volumeData, showVolume]);

  /**
   * 更新支撑/阻力区间（Custom Primitives）
   */
  useEffect(() => {
    if (!candlestickSeriesRef.current) {
      return;
    }

    // 清除旧的区间图元（无论是否显示都要清除）
    rangePrimitivesRef.current.forEach((primitive) => {
      try {
        candlestickSeriesRef.current.detachPrimitive(primitive);
      } catch (err) {
        console.error('[TradingViewChart] Error removing range primitive:', err);
      }
    });
    rangePrimitivesRef.current = [];

    // 如果不显示或没有数据，直接返回
    if (!showRanges || ranges.length === 0 || candlestickData.length === 0) {
      return;
    }

    // 创建新的区间图元
    if (ranges.length > 0) {
      // 获取最后一根K线的时间，用于限制区间结束时间
      const lastKlineTime = candlestickData[candlestickData.length - 1].time;

      ranges.forEach((range) => {
        try {
          /**
           * lightweight-charts不支持时区，需要 +8小时 来显示北京时间
           * 这样区间范围框的左右边界才能对齐K线图的时间轴
           */
          const startTimeSeconds = range.start_time ? Math.floor(range.start_time / 1000) + 8 * 3600 : undefined;
          let endTimeSeconds = range.end_time ? Math.floor(range.end_time / 1000) + 8 * 3600 : undefined;

          // 🔥 限制结束时间不能超过最后一根K线的时间，避免无限延伸
          if (endTimeSeconds && endTimeSeconds > lastKlineTime) {
            endTimeSeconds = lastKlineTime;
          }

          // 创建区间范围框图元
          const rangePrimitive = createRangePrimitive(
            {
              support: range.support,
              resistance: range.resistance,
              middle: range.middle,
              startTime: startTimeSeconds as any,
              endTime: endTimeSeconds as any,
            },
            {
              supportColor: '#2196F3',        // 蓝色支撑线
              resistanceColor: '#F44336',     // 红色阻力线
              middleColor: '#9E9E9E',         // 灰色中轨线
              fillColor: '#3B82F6',           // 蓝色填充
              fillOpacity: 0.08,              // 8%透明度
              lineWidth: 2,
              showMiddle: true,
            }
          );

          // 附加到系列
          candlestickSeriesRef.current.attachPrimitive(rangePrimitive);
          rangePrimitivesRef.current.push(rangePrimitive);
        } catch (err) {
          console.error('[TradingViewChart] Error creating range primitive:', err);
        }
      });

      console.log(`[TradingViewChart] 创建了 ${rangePrimitivesRef.current.length} 个区间范围框`);
    }
  }, [ranges, showRanges]);


  /**
   * 更新缠论笔的连线（LineSeries）
   */
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !showStrokes) {
      // 清除现有笔连线
      strokeSeriesRef.current.forEach((series) => {
        try {
          chartRef.current.removeSeries(series);
        } catch (err) {
          console.error('[TradingViewChart] Error removing stroke series:', err);
        }
      });
      strokeSeriesRef.current = [];
      return;
    }

    if (strokes.length === 0 || candlestickData.length === 0) {
      return;
    }

    try {
      // 清除旧的笔连线
      strokeSeriesRef.current.forEach((series) => {
        try {
          chartRef.current.removeSeries(series);
        } catch (err) {
          console.error('[TradingViewChart] Error removing old stroke series:', err);
        }
      });
      strokeSeriesRef.current = [];

      // 只显示有效笔
      const validStrokes = strokes.filter((s) => s.is_valid);

      validStrokes.forEach((stroke) => {
        const isUp = stroke.direction === 'up';
        const startTime = Math.floor(stroke.start.time / 1000) + 8 * 3600;
        const endTime = Math.floor(stroke.end.time / 1000) + 8 * 3600;

        // 使用 LineSeries 创建笔连线
        // 使用白色，与K线明显区分
        const lineSeries = chartRef.current.addSeries(LineSeries, {
          color: '#FFFFFF',  // 白色
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        lineSeries.setData([
          { time: startTime, value: stroke.start.price },
          { time: endTime, value: stroke.end.price },
        ]);

        strokeSeriesRef.current.push(lineSeries);
      });

      console.log(`[TradingViewChart] 创建了 ${validStrokes.length} 条笔连线`);
    } catch (err) {
      console.error('[TradingViewChart] Error with stroke lines:', err);
    }
  }, [strokes, showStrokes, candlestickData]);

  /**
   * 更新缠论中枢区域（Custom Primitives）
   */
  useEffect(() => {
    if (!candlestickSeriesRef.current || !showCenters) {
      // 清除现有中枢图元
      centerPrimitivesRef.current.forEach((primitive) => {
        try {
          if (typeof candlestickSeriesRef.current.detachPrimitive === 'function') {
            candlestickSeriesRef.current.detachPrimitive(primitive);
          }
        } catch (err) {
          console.error('[TradingViewChart] Error detaching center primitive:', err);
        }
      });
      centerPrimitivesRef.current = [];
      return;
    }

    if (centers.length === 0 || candlestickData.length === 0) {
      return;
    }

    try {
      // 清除旧的中枢图元
      centerPrimitivesRef.current.forEach((primitive) => {
        try {
          if (typeof candlestickSeriesRef.current.detachPrimitive === 'function') {
            candlestickSeriesRef.current.detachPrimitive(primitive);
          }
        } catch (err) {
          console.error('[TradingViewChart] Error detaching old center primitive:', err);
        }
      });
      centerPrimitivesRef.current = [];

      const lastKlineTime = candlestickData[candlestickData.length - 1].time;

      centers.forEach((center) => {
        const startTimeSeconds = Math.floor(center.start_time / 1000) + 8 * 3600;
        let endTimeSeconds = Math.floor(center.end_time / 1000) + 8 * 3600;

        // 限制结束时间，防止无限延伸
        if (endTimeSeconds > lastKlineTime) {
          endTimeSeconds = lastKlineTime;
        }

        const centerPrimitive = createCenterPrimitive(
          {
            high: center.high,
            low: center.low,
            middle: center.middle,
            startTime: startTimeSeconds as any,
            endTime: endTimeSeconds as any,
            isActive: center.is_active,
            strength: center.strength,
          },
          {
            // 活跃中枢使用黄色，历史中枢使用灰色
            fillColor: center.is_active ? 'rgba(255, 193, 7, 0.15)' : 'rgba(96, 125, 139, 0.08)',
            borderColor: center.is_active ? 'rgba(255, 193, 7, 0.6)' : 'rgba(96, 125, 139, 0.4)',
            showMiddleLine: true,
          }
        );

        candlestickSeriesRef.current.attachPrimitive(centerPrimitive);
        centerPrimitivesRef.current.push(centerPrimitive);
      });

      console.log(`[TradingViewChart] 创建了 ${centerPrimitivesRef.current.length} 个中枢图元`);
    } catch (err) {
      console.error('[TradingViewChart] Error with center primitives:', err);
    }
  }, [centers, showCenters, candlestickData]);

  return (
    <div className={styles.chartContainer}>
      <div ref={chartContainerRef} className={styles.chart} />
    </div>
  );
};

export default TradingViewChart;
