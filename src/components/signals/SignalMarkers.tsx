/**
 * 信号标记组件
 * 在K线图表上叠加显示交易信号标记
 */

import React from 'react';
import { Tooltip } from 'antd';
import { Signal, signalUtils } from '../../services/signalAPI';
import styles from './SignalMarkers.module.scss';

interface SignalMarkersProps {
  signals: Signal[];
  chartWidth: number;
  chartHeight: number;
  priceRange: { min: number; max: number };
  timeRange: { start: number; end: number };
  onMarkerClick?: (signal: Signal) => void;
}

const SignalMarkers: React.FC<SignalMarkersProps> = ({
  signals,
  chartWidth,
  chartHeight,
  priceRange,
  timeRange,
  onMarkerClick,
}) => {
  /**
   * 计算信号标记的位置
   */
  const calculatePosition = (signal: Signal) => {
    // 计算X坐标（时间轴）
    const timePercent =
      (signal.timestamp - timeRange.start) / (timeRange.end - timeRange.start);
    const x = timePercent * chartWidth;

    // 计算Y坐标（价格轴）
    const pricePercent =
      (signal.price - priceRange.min) / (priceRange.max - priceRange.min);
    const y = chartHeight - pricePercent * chartHeight;

    return { x, y };
  };

  /**
   * 渲染信号标记
   */
  const renderMarker = (signal: Signal) => {
    const { x, y } = calculatePosition(signal);
    const isBuy = signal.signal_type === 'BUY';
    const strengthLevel = signalUtils.getStrengthLevel(signal.strength);

    // 超出可见范围则不渲染
    if (x < 0 || x > chartWidth || y < 0 || y > chartHeight) {
      return null;
    }

    const markerSize = strengthLevel === 'strong' ? 24 : strengthLevel === 'medium' ? 20 : 16;

    const tooltipContent = (
      <div className={styles.tooltipContent}>
        <div className={styles.tooltipHeader}>
          <span className={styles.tooltipType}>
            {isBuy ? '🟢 买入信号' : '🔴 卖出信号'}
          </span>
          <span className={styles.tooltipStrength}>强度: {signal.strength}</span>
        </div>
        <div className={styles.tooltipPrice}>价格: ${signal.price.toLocaleString()}</div>
        <div className={styles.tooltipTime}>
          {signalUtils.formatSignalTime(signal.timestamp)}
        </div>
        <div className={styles.tooltipDesc}>{signal.description}</div>
      </div>
    );

    return (
      <Tooltip key={signal.id} title={tooltipContent} placement="top">
        <div
          className={`${styles.marker} ${isBuy ? styles.buyMarker : styles.sellMarker} ${
            styles[strengthLevel]
          }`}
          style={{
            left: `${x}px`,
            top: `${y}px`,
            width: `${markerSize}px`,
            height: `${markerSize}px`,
          }}
          onClick={() => onMarkerClick?.(signal)}
        >
          {isBuy ? '▲' : '▼'}
        </div>
      </Tooltip>
    );
  };

  return (
    <div className={styles.signalMarkers} style={{ width: chartWidth, height: chartHeight }}>
      {signals.map((signal) => renderMarker(signal))}
    </div>
  );
};

export default SignalMarkers;
