/**
 * 信号面板组件
 * 显示交易信号列表和过滤器
 */

import React from 'react';
import { Card, Radio, Slider, Empty, Tag, Space } from 'antd';
import { ThunderboltOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import { Signal, SignalType, signalUtils } from '../../services/signalAPI';
import { useSignalStore } from '../../stores/signalStore';
import styles from './SignalPanel.module.scss';

interface SignalPanelProps {
  signals: Signal[];
  isLoading?: boolean;
  onSignalClick?: (signal: Signal) => void;
}

const SignalPanel: React.FC<SignalPanelProps> = ({
  signals,
  isLoading = false,
  onSignalClick,
}) => {
  const { filter, setFilter, resetFilter } = useSignalStore();

  /**
   * 处理信号类型过滤
   */
  const handleTypeFilterChange = (value: SignalType | 'ALL') => {
    setFilter({ signalType: value });
  };

  /**
   * 处理信号强度过滤
   */
  const handleStrengthFilterChange = (value: number) => {
    setFilter({ minStrength: value });
  };

  /**
   * 渲染信号项
   */
  const renderSignalItem = (signal: Signal) => {
    const icon = signalUtils.getSignalIcon(signal.signal_type);
    const signalColor = signalUtils.getSignalColor(signal.signal_type);
    const strengthColor = signalUtils.getStrengthColor(signal.strength);
    const strengthLevel = signalUtils.getStrengthLevel(signal.strength);
    const signalText = signalUtils.getSignalText(signal.signal_type);
    const time = signalUtils.formatSignalTime(signal.timestamp);

    return (
      <div
        key={signal.id}
        className={`${styles.signalItem} ${signal.signal_type === 'BUY' ? styles.buy : styles.sell}`}
        onClick={() => onSignalClick?.(signal)}
      >
        {/* 信号头部 */}
        <div className={styles.signalHeader}>
          <div className={styles.signalType}>
            <span className={styles.icon}>{icon}</span>
            <span className={styles.typeText} style={{ color: signalColor }}>
              {signalText}
            </span>
          </div>

          <div className={styles.signalMeta}>
            <Tag color={strengthColor} className={styles.strengthTag}>
              强度 {signal.strength}
            </Tag>
            <span className={styles.price}>${signal.price.toLocaleString()}</span>
            <span className={styles.time}>{time}</span>
          </div>
        </div>

        {/* 信号描述 */}
        <div className={styles.signalDescription}>{signal.description}</div>

        {/* 指标详情 */}
        {signal.indicators && (
          <div className={styles.indicators}>
            {signal.indicators.ma_cross && (
              <Tag color="blue" className={styles.indicatorTag}>
                MA: {signal.indicators.ma_cross.type === 'golden' ? '金叉' : '死叉'}
              </Tag>
            )}
            {signal.indicators.rsi && (
              <Tag color="purple" className={styles.indicatorTag}>
                RSI: {signal.indicators.rsi.value.toFixed(1)}
              </Tag>
            )}
            {signal.indicators.macd && (
              <Tag color="cyan" className={styles.indicatorTag}>
                MACD: {signal.indicators.macd.histogram.toFixed(2)}
              </Tag>
            )}
            {signal.indicators.pattern && (
              <Tag color="orange" className={styles.indicatorTag}>
                {signalUtils.getPatternName(signal.indicators.pattern)}
              </Tag>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card
      className={styles.signalPanel}
      title={
        <div className={styles.panelTitle}>
          <ThunderboltOutlined className={styles.titleIcon} />
          <span>交易信号</span>
          <span className={styles.count}>({signals.length})</span>
        </div>
      }
      extra={
        <a onClick={resetFilter} className={styles.resetFilter}>
          重置过滤
        </a>
      }
    >
      {/* 过滤器 */}
      <div className={styles.filters}>
        {/* 信号类型过滤 */}
        <div className={styles.filterGroup}>
          <label>信号类型:</label>
          <Radio.Group
            value={filter.signalType}
            onChange={(e) => handleTypeFilterChange(e.target.value)}
            size="small"
          >
            <Radio.Button value="ALL">全部</Radio.Button>
            <Radio.Button value="BUY">
              <RiseOutlined /> 买入
            </Radio.Button>
            <Radio.Button value="SELL">
              <FallOutlined /> 卖出
            </Radio.Button>
          </Radio.Group>
        </div>

        {/* 信号强度过滤 */}
        <div className={styles.filterGroup}>
          <label>最小强度: {filter.minStrength}</label>
          <Slider
            min={0}
            max={100}
            step={10}
            value={filter.minStrength}
            onChange={handleStrengthFilterChange}
            marks={{
              0: '弱',
              40: '中',
              70: '强',
              100: '极强',
            }}
            className={styles.strengthSlider}
          />
        </div>
      </div>

      {/* 信号列表 */}
      <div className={styles.signalList}>
        {isLoading ? (
          <div className={styles.loading}>加载中...</div>
        ) : signals.length === 0 ? (
          <Empty
            description="暂无信号"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className={styles.empty}
          />
        ) : (
          signals.map((signal) => renderSignalItem(signal))
        )}
      </div>
    </Card>
  );
};

export default SignalPanel;
