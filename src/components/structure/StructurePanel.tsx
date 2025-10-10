/**
 * 结构检测面板组件
 * 显示支撑/阻力位、突破信号和统计数据
 */

import React, { useState } from 'react';
import { Slider, message } from 'antd';
import {
  StructureRange,
  StructureBreakout,
  StructureStatistics,
} from '../../services/structureAPI';
import styles from './StructurePanel.module.scss';

interface StructurePanelProps {
  ranges: StructureRange[];
  breakouts: StructureBreakout[];
  statistics: StructureStatistics | null;
  isLoading?: boolean;
  onRangeClick?: (range: StructureRange) => void;
  onBreakoutClick?: (breakout: StructureBreakout) => void;
  onUpdateResult?: (breakoutId: number, result: 'win' | 'loss') => void;
}

const StructurePanel: React.FC<StructurePanelProps> = ({
  ranges,
  breakouts,
  statistics,
  isLoading = false,
  onRangeClick,
  onBreakoutClick,
  onUpdateResult,
}) => {
  const [activeTab, setActiveTab] = useState<'ranges' | 'breakouts' | 'statistics'>('breakouts');
  const [minConfidence, setMinConfidence] = useState<number>(0);

  /**
   * 过滤突破信号（按置信度）
   */
  const filteredBreakouts = breakouts.filter(
    (breakout) => breakout.confidence >= minConfidence
  );

  /**
   * 格式化时间
   */
  const formatTime = (timestamp: number | undefined): string => {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 格式化价格
   */
  const formatPrice = (price: number | undefined): string => {
    if (price === undefined || price === null) return '--';
    return price.toFixed(2);
  };

  /**
   * 格式化数字（带小数位）
   */
  const formatNumber = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined || value === null || isNaN(value)) return '--';
    return value.toFixed(decimals);
  };

  /**
   * 渲染区间列表
   */
  const renderRanges = () => {
    if (ranges.length === 0) {
      return <div className={styles.empty}>暂无活跃区间</div>;
    }

    return (
      <div className={styles.list}>
        {ranges.map((range) => (
          <div
            key={range.id}
            className={`${styles.card} ${styles.rangeCard}`}
            onClick={() => onRangeClick?.(range)}
          >
            <div className={styles.cardHeader}>
              <span className={styles.status} data-status={range.breakout_direction ? 'broken' : 'active'}>
                {range.breakout_direction ? '突破' : '活跃'}
              </span>
              <span className={styles.strength}>
                强度: {range.strength !== undefined ? `${range.strength}` : '--'}
              </span>
            </div>

            <div className={styles.levels}>
              <div className={styles.level}>
                <span className={styles.label}>阻力位:</span>
                <span className={`${styles.value} ${styles.resistance}`}>
                  {formatPrice(range.resistance)}
                </span>
              </div>
              <div className={styles.level}>
                <span className={styles.label}>中轨位:</span>
                <span className={styles.value}>{formatPrice(range.middle)}</span>
              </div>
              <div className={styles.level}>
                <span className={styles.label}>支撑位:</span>
                <span className={`${styles.value} ${styles.support}`}>
                  {formatPrice(range.support)}
                </span>
              </div>
            </div>

            <div className={styles.cardFooter}>
              <div className={styles.info}>
                <span className={styles.infoItem}>触碰: {range.touch_count}</span>
                <span className={styles.infoItem}>K线: {range.duration_bars}</span>
              </div>
              <div className={styles.timeRange}>
                <span className={styles.timeLabel}>起始:</span>
                <span className={styles.time}>{formatTime(range.start_time)}</span>
                <span className={styles.timeSeparator}>~</span>
                <span className={styles.time}>{formatTime(range.end_time)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * 渲染突破信号列表
   */
  const renderBreakouts = () => {
    if (filteredBreakouts.length === 0) {
      return <div className={styles.empty}>暂无突破信号</div>;
    }

    return (
      <>
        {/* 置信度过滤器 */}
        <div className={styles.filter}>
          <label className={styles.filterLabel}>
            最小置信度: {minConfidence}%
          </label>
          <Slider
            min={0}
            max={100}
            value={minConfidence}
            onChange={setMinConfidence}
            tooltip={{ formatter: (value) => `${value}%` }}
          />
        </div>

        <div className={styles.list}>
          {filteredBreakouts.map((breakout) => (
            <div
              key={breakout.id}
              className={`${styles.card} ${styles.breakoutCard}`}
              onClick={() => onBreakoutClick?.(breakout)}
            >
              <div className={styles.cardHeader}>
                <span
                  className={styles.direction}
                  data-direction={breakout.direction.toLowerCase()}
                >
                  {breakout.direction === 'UP' ? '向上突破 ↑' : '向下突破 ↓'}
                </span>
                <span className={styles.confidence}>
                  置信: {breakout.confidence !== undefined ? `${breakout.confidence}%` : '--'}
                </span>
              </div>

              <div className={styles.prices}>
                <div className={styles.priceRow}>
                  <span className={styles.label}>突破价:</span>
                  <span className={styles.value}>{formatPrice(breakout.breakout_price)}</span>
                </div>
                <div className={styles.priceRow}>
                  <span className={styles.label}>目标价:</span>
                  <span className={styles.value}>{formatPrice(breakout.target_price)}</span>
                </div>
                <div className={styles.priceRow}>
                  <span className={styles.label}>止损价:</span>
                  <span className={styles.value}>{formatPrice(breakout.stop_loss)}</span>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.status} data-status={breakout.status}>
                  {breakout.status === 'pending'
                    ? '待确认'
                    : breakout.status === 'hit'
                    ? '已达目标'
                    : breakout.status === 'stopped'
                    ? '已止损'
                    : '已过期'}
                </span>
                <span className={styles.time}>{formatTime(breakout.breakout_time)}</span>
              </div>

              {/* 结果标记（如果已有结果）*/}
              {breakout.result && (
                <div className={styles.result} data-result={breakout.result}>
                  {breakout.result === 'win' ? '✓ 盈利' : '✗ 亏损'}
                </div>
              )}

              {/* 结果更新按钮（仅待确认状态）*/}
              {breakout.status === 'pending' && onUpdateResult && (
                <div className={styles.actions}>
                  <button
                    className={`${styles.actionBtn} ${styles.winBtn}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateResult(breakout.id, 'win');
                      message.success('已标记为盈利');
                    }}
                  >
                    盈利
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.lossBtn}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateResult(breakout.id, 'loss');
                      message.warning('已标记为亏损');
                    }}
                  >
                    亏损
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  /**
   * 渲染统计数据
   */
  const renderStatistics = () => {
    if (!statistics) {
      return <div className={styles.empty}>暂无统计数据</div>;
    }

    return (
      <div className={styles.statistics}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>总信号数</div>
          <div className={styles.statValue}>{statistics.total_signals ?? 0}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>胜率</div>
          <div className={`${styles.statValue} ${styles.winRate}`}>
            {formatNumber(statistics.win_rate, 1)}%
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>盈亏比</div>
          <div className={styles.statValue}>{formatNumber(statistics.risk_reward_ratio, 2)}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>总盈利</div>
          <div
            className={`${styles.statValue} ${
              (statistics.total_profit ?? 0) >= 0 ? styles.profit : styles.loss
            }`}
          >
            {(statistics.total_profit ?? 0) >= 0 ? '+' : ''}
            {formatNumber(statistics.total_profit, 2)}%
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>平均盈利</div>
          <div className={`${styles.statValue} ${styles.profit}`}>
            +{formatNumber(statistics.avg_profit, 2)}%
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>平均亏损</div>
          <div className={`${styles.statValue} ${styles.loss}`}>
            {formatNumber(statistics.avg_loss, 2)}%
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>最大连胜</div>
          <div className={styles.statValue}>{statistics.max_consecutive_wins ?? 0}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>最大连亏</div>
          <div className={styles.statValue}>{statistics.max_consecutive_losses ?? 0}</div>
        </div>

        {statistics.sharpe_ratio !== undefined && statistics.sharpe_ratio !== null && (
          <div className={styles.statCard}>
            <div className={styles.statLabel}>夏普比率</div>
            <div className={styles.statValue}>{formatNumber(statistics.sharpe_ratio, 2)}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.structurePanel}>
      {/* Tab导航 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'breakouts' ? styles.active : ''}`}
          onClick={() => setActiveTab('breakouts')}
        >
          突破信号
          {breakouts.length > 0 && <span className={styles.badge}>{breakouts.length}</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'ranges' ? styles.active : ''}`}
          onClick={() => setActiveTab('ranges')}
        >
          区间形态
          {ranges.length > 0 && <span className={styles.badge}>{ranges.length}</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'statistics' ? styles.active : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          统计数据
        </button>
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loading}>加载中...</div>
        ) : (
          <>
            {activeTab === 'ranges' && renderRanges()}
            {activeTab === 'breakouts' && renderBreakouts()}
            {activeTab === 'statistics' && renderStatistics()}
          </>
        )}
      </div>
    </div>
  );
};

export default StructurePanel;
