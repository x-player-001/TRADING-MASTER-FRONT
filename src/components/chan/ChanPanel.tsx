/**
 * 缠论分析面板
 * 显示分型、笔、中枢数据，并提供开关控制图表显示
 */

import React, { useState } from 'react';
import { Switch, Spin } from 'antd';
import { ChanAnalysisData } from '../../services/chanAPI';
import styles from './ChanPanel.module.scss';

export interface ChanPanelProps {
  chanData: ChanAnalysisData | null;
  isLoading: boolean;
  error: Error | null;
  onToggleFractals: (show: boolean) => void;
  onToggleStrokes: (show: boolean) => void;
  onToggleCenters: (show: boolean) => void;
  showFractals: boolean;
  showStrokes: boolean;
  showCenters: boolean;
}

const ChanPanel: React.FC<ChanPanelProps> = ({
  chanData,
  isLoading,
  error,
  onToggleFractals,
  onToggleStrokes,
  onToggleCenters,
  showFractals,
  showStrokes,
  showCenters,
}) => {
  const [activeTab, setActiveTab] = useState<'fractals' | 'strokes' | 'centers' | 'stats'>('centers');

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 渲染控制开关
  const renderControls = () => (
    <div className={styles.filter}>
      <div className={styles.filterLabel}>图表显示</div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>分型标记</span>
        <Switch checked={showFractals} onChange={onToggleFractals} size="small" />
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>笔的连线</span>
        <Switch checked={showStrokes} onChange={onToggleStrokes} size="small" />
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>中枢区域</span>
        <Switch checked={showCenters} onChange={onToggleCenters} size="small" />
      </div>
    </div>
  );

  // 渲染分型列表
  const renderFractals = () => {
    if (!chanData?.fractals.length) {
      return <div className={styles.empty}>暂无分型数据</div>;
    }

    // 只显示已确认的分型
    const confirmedFractals = chanData.fractals.filter((f) => f.is_confirmed);

    return (
      <div className={styles.list}>
        {confirmedFractals.slice(-10).reverse().map((fractal, idx) => (
          <div key={idx} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.fractalType} data-type={fractal.type}>
                {fractal.type === 'top' ? '⬇️ 顶分型' : '⬆️ 底分型'}
              </span>
              <span className={styles.strength}>强度 {(fractal.strength * 100).toFixed(0)}%</span>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.label}>价格:</span>
              <span className={styles.value}>${fractal.price.toFixed(2)}</span>
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.time}>{formatTime(fractal.time)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染笔列表
  const renderStrokes = () => {
    if (!chanData?.strokes.length) {
      return <div className={styles.empty}>暂无笔数据</div>;
    }

    // 只显示有效笔
    const validStrokes = chanData.strokes.filter((s) => s.is_valid);

    return (
      <div className={styles.list}>
        {validStrokes.slice(-10).reverse().map((stroke, idx) => (
          <div key={idx} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.strokeDirection} data-direction={stroke.direction}>
                {stroke.direction === 'up' ? '📈 向上笔' : '📉 向下笔'}
              </span>
              <span className={styles.amplitude}>
                {stroke.amplitude_percent.toFixed(2)}%
              </span>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.label}>起点:</span>
              <span className={styles.value}>${stroke.start.price.toFixed(2)}</span>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.label}>终点:</span>
              <span className={styles.value}>${stroke.end.price.toFixed(2)}</span>
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.infoItem}>持续 {stroke.duration_bars} 根K线</span>
              <span className={styles.time}>{formatTime(stroke.start.time)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染中枢列表
  const renderCenters = () => {
    if (!chanData?.centers.length) {
      return <div className={styles.empty}>暂无中枢数据</div>;
    }

    return (
      <div className={styles.list}>
        {chanData.centers.slice(-5).reverse().map((center, idx) => (
          <div key={idx} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.centerStatus} data-active={center.is_active}>
                {center.is_active ? '🟢 活跃中枢' : '⚪ 历史中枢'}
              </span>
              <span className={styles.strength}>强度 {center.strength}</span>
            </div>
            <div className={styles.levels}>
              <div className={styles.level}>
                <span className={styles.label}>阻力位:</span>
                <span className={`${styles.value} ${styles.resistance}`}>
                  ${center.high.toFixed(2)}
                </span>
              </div>
              <div className={styles.level}>
                <span className={styles.label}>中轴:</span>
                <span className={styles.value}>${center.middle.toFixed(2)}</span>
              </div>
              <div className={styles.level}>
                <span className={styles.label}>支撑位:</span>
                <span className={`${styles.value} ${styles.support}`}>
                  ${center.low.toFixed(2)}
                </span>
              </div>
            </div>
            <div className={styles.cardFooter}>
              <div className={styles.info}>
                <span className={styles.infoItem}>{center.stroke_count} 笔</span>
                <span className={styles.infoItem}>{center.duration_bars} 根K线</span>
                {center.is_extending && <span className={styles.infoItem}>🔄 扩展中</span>}
              </div>
              <div className={styles.timeRange}>
                <span className={styles.timeLabel}>起始:</span>
                <span className={styles.time}>{formatTime(center.start_time)}</span>
                <span className={styles.timeSeparator}>~</span>
                <span className={styles.time}>{formatTime(center.end_time)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染统计数据
  const renderStatistics = () => {
    if (!chanData?.statistics) {
      return <div className={styles.empty}>暂无统计数据</div>;
    }

    const stats = chanData.statistics;

    return (
      <div className={styles.statistics}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>分型数量</div>
          <div className={styles.statValue}>{stats.valid_fractals}</div>
          <div className={styles.statSubtitle}>总计 {stats.total_fractals}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>有效笔</div>
          <div className={styles.statValue}>{stats.valid_strokes}</div>
          <div className={styles.statSubtitle}>总计 {stats.total_strokes}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>中枢数量</div>
          <div className={styles.statValue}>{stats.valid_centers}</div>
          <div className={styles.statSubtitle}>总计 {stats.total_centers}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>当前状态</div>
          <div className={`${styles.statValue} ${styles.status}`}>
            {chanData.current_state.in_center ? '震荡' : '趋势'}
          </div>
          <div className={styles.statSubtitle}>
            {chanData.current_state.last_stroke_direction === 'up' ? '上行' : '下行'}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.chanPanel}>
        <div className={styles.loading}>
          <Spin size="small" /> 加载缠论数据...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.chanPanel}>
        <div className={styles.empty}>加载失败: {error.message}</div>
      </div>
    );
  }

  return (
    <div className={styles.chanPanel}>
      {/* Tab导航 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'centers' ? styles.active : ''}`}
          onClick={() => setActiveTab('centers')}
        >
          中枢
          <span className={styles.badge}>{chanData?.centers.length || 0}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'strokes' ? styles.active : ''}`}
          onClick={() => setActiveTab('strokes')}
        >
          笔
          <span className={styles.badge}>{chanData?.strokes.filter((s) => s.is_valid).length || 0}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'fractals' ? styles.active : ''}`}
          onClick={() => setActiveTab('fractals')}
        >
          分型
          <span className={styles.badge}>{chanData?.fractals.filter((f) => f.is_confirmed).length || 0}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'stats' ? styles.active : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          统计
        </button>
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {renderControls()}
        {activeTab === 'fractals' && renderFractals()}
        {activeTab === 'strokes' && renderStrokes()}
        {activeTab === 'centers' && renderCenters()}
        {activeTab === 'stats' && renderStatistics()}
      </div>
    </div>
  );
};

export default ChanPanel;
