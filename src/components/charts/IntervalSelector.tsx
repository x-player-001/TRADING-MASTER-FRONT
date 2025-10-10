/**
 * K线时间周期选择器组件
 */

import React from 'react';
import { useKlineStore } from '../../stores/klineStore';
import type { KlineInterval } from '../../types/kline';
import styles from './IntervalSelector.module.scss';

// 支持的时间周期配置
const INTERVALS: Array<{ value: KlineInterval; label: string }> = [
  { value: '1m', label: '1分钟' },
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: '1d', label: '1天' },
];

interface IntervalSelectorProps {
  compact?: boolean; // 紧凑模式，只显示周期代码
}

const IntervalSelector: React.FC<IntervalSelectorProps> = ({ compact = false }) => {
  const { selectedInterval, setInterval } = useKlineStore();

  const handleIntervalChange = (interval: KlineInterval) => {
    setInterval(interval);
  };

  return (
    <div className={`${styles.intervalSelector} ${compact ? styles.compact : ''}`}>
      {INTERVALS.map(({ value, label }) => (
        <button
          key={value}
          className={`${styles.intervalButton} ${
            selectedInterval === value ? styles.active : ''
          }`}
          onClick={() => handleIntervalChange(value)}
          title={label}
        >
          {compact ? value : label}
        </button>
      ))}
    </div>
  );
};

export default IntervalSelector;
