/**
 * K线图表主页面
 * 整合TradingView图表、币种选择器、时间周期选择器等组件
 */

import React, { useMemo, useState } from 'react';
import { Button, Card, Alert, Spin, message, Modal } from 'antd';
import { CheckCircleOutlined, WarningOutlined, DownloadOutlined, ThunderboltOutlined, LineChartOutlined } from '@ant-design/icons';
import PageHeader from '../components/ui/PageHeader';
import { StatusOverview, StatusCardProps, CoolRefreshButton } from '../components/ui';
import TradingViewChart from '../components/charts/TradingViewChart';
import IntervalSelector from '../components/charts/IntervalSelector';
import SymbolSelector from '../components/charts/SymbolSelector';
import SignalPanel from '../components/signals/SignalPanel';
import StructurePanel from '../components/structure/StructurePanel';
import ChanPanel from '../components/chan/ChanPanel';
import { useKlineData } from '../hooks/useKlineData';
import { useSignalData } from '../hooks/useSignalData';
import { useStructureData } from '../hooks/useStructureData';
import { useChanData } from '../hooks/useChanData';
import { klineUtils } from '../services/klineAPI';
import { historicalAPI } from '../services/historicalAPI';
import { structureAPI } from '../services/structureAPI';
import styles from './KlineChart.module.scss';

const KlineChart: React.FC = () => {
  // 历史数据拉取状态
  const [isPullingHistory, setIsPullingHistory] = useState(false);
  // 手动触发检测状态
  const [isTriggeringDetection, setIsTriggeringDetection] = useState(false);

  // 图表图层显示开关
  const [showSignalsOnChart, setShowSignalsOnChart] = useState(true);        // 信号标记显示
  const [showStructureOnChart, setShowStructureOnChart] = useState(true);    // 区间形态显示
  const [showChanOnChart, setShowChanOnChart] = useState(false);             // 缠论显示

  // 缠论显示开关
  const [showChan, setShowChan] = useState(false);           // 缠论功能总开关
  const [showFractals, setShowFractals] = useState(true);     // 分型标记开关
  const [showStrokes, setShowStrokes] = useState(true);       // 笔连线开关
  const [showCenters, setShowCenters] = useState(true);       // 中枢区域开关

  // 使用K线数据Hook (暂时关闭自动刷新)
  const {
    klines,
    isLoading,
    error,
    stats,
    selectedSymbol,
    selectedInterval,
    integrity,
    lastUpdate,
    refresh,
    fetchIntegrity,
  } = useKlineData({
    autoRefresh: false,        // ⚠️ 暂时关闭自动刷新
    refreshInterval: 5000,     // 保留配置，需要时改为true即可
    limit: 600,                // 最多显示600根K线
  });

  // 使用信号数据Hook
  const {
    filteredSignals,
    isLoading: isSignalLoading,
    error: signalError,
    refresh: refreshSignals,
    generateSignal,
  } = useSignalData({
    symbol: selectedSymbol,
    interval: selectedInterval,
    autoRefresh: false,        // 暂时关闭自动刷新
    refreshInterval: 30000,    // 30秒
    limit: 20,
  });

  // 使用结构检测数据Hook
  const {
    filteredRanges,
    filteredBreakouts,
    statistics,
    isLoading: isStructureLoading,
    error: structureError,
    refresh: refreshStructure,
    updateSignalResult,
  } = useStructureData({
    symbol: selectedSymbol,
    interval: selectedInterval,
    autoRefresh: false,        // 暂时关闭自动刷新
    refreshInterval: 60000,    // 60秒
    enableRanges: true,
    enableBreakouts: true,
    enableStatistics: true,
  });

  // 使用缠论数据Hook (默认关闭)
  const {
    chanData,
    isLoading: isChanLoading,
    error: chanError,
    refresh: refreshChan,
  } = useChanData({
    symbol: selectedSymbol,
    interval: selectedInterval,
    lookback: 500,             // 回溯500根K线
    autoRefresh: false,        // 默认关闭自动刷新
    refreshInterval: 60000,    // 60秒
  });

  // 转换为TradingView格式
  const chartData = useMemo(() => {
    if (klines.length === 0) {
      return { candlesticks: [], volumes: [] };
    }
    return klineUtils.convertToTradingViewFormat(klines);
  }, [klines]);

  // 格式化大数字
  const formatLargeNumber = (num: number): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  // 拉取历史数据
  const handlePullHistory = async () => {
    Modal.confirm({
      title: '回溯补全历史数据',
      content: `确定要回溯补全 ${selectedSymbol} (${selectedInterval}) 的历史数据吗？系统将自动从数据库最早时间向前拉取1000根K线数据。`,
      okText: '确定拉取',
      cancelText: '取消',
      onOk: async () => {
        setIsPullingHistory(true);
        try {
          // 调用回溯补全接口
          const result = await historicalAPI.backfill({
            symbol: selectedSymbol,
            interval: selectedInterval,
            batch_size: 1000, // 每批拉取1000根K线
          });

          message.success(
            `${result.message}！共获取 ${result.fetched_count} 条K线数据，数据库总计 ${result.database_status.total_records} 条记录`
          );

          // 刷新当前K线数据以显示新拉取的历史数据
          await refresh();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : '未知错误';
          message.error(`拉取失败: ${errorMsg}`);
          console.error('回溯补全历史数据失败:', err);
        } finally {
          setIsPullingHistory(false);
        }
      },
    });
  };

  // 刷新信号
  const handleRefreshSignals = async () => {
    try {
      await refreshSignals();
      message.success('信号数据已刷新');
    } catch (err) {
      message.error('刷新信号失败');
    }
  };

  // 刷新结构检测数据
  const handleRefreshStructure = async () => {
    try {
      await refreshStructure();
      message.success('结构数据已刷新');
    } catch (err) {
      message.error('刷新结构数据失败');
    }
  };

  // 手动触发结构检测
  const handleTriggerDetection = async () => {
    setIsTriggeringDetection(true);
    try {
      // 注意：apiClient会自动解包data字段，所以result直接是data的内容
      const result = await structureAPI.triggerDetection(selectedSymbol, selectedInterval, false);

      if (result && typeof result === 'object' && 'detected_count' in result) {
        const { detected_count, saved_count } = result;
        if (saved_count > 0) {
          message.success(
            `检测完成！发现 ${detected_count} 个区间，保存了 ${saved_count} 个新区间`
          );
        } else {
          message.info(
            `检测完成！发现 ${detected_count} 个区间，但都已存在（无新区间）`
          );
        }
        // 触发检测后刷新数据
        await refreshStructure();
      } else {
        message.info('检测完成，未发现区间');
      }
    } catch (err: any) {
      console.error('触发检测失败:', err);
      message.error(err?.message || '触发检测失败');
    } finally {
      setIsTriggeringDetection(false);
    }
  };

  // 更新突破信号结果
  const handleUpdateSignalResult = async (breakoutId: number, result: 'win' | 'loss') => {
    try {
      await updateSignalResult(breakoutId, result);
      message.success('信号结果已更新');
    } catch (err) {
      message.error('更新信号结果失败');
    }
  };

  // 生成测试信号
  const handleGenerateSignal = async () => {
    try {
      const signal = await generateSignal();
      if (signal) {
        message.success(`生成信号成功！类型: ${signal.signal_type}, 强度: ${signal.strength}`);
      } else {
        message.info('当前市场条件不满足信号生成条件（强度过弱或中性）');
      }
    } catch (err) {
      message.error('生成信号失败');
    }
  };

  // 构建状态卡片数据
  const statusCards = useMemo((): StatusCardProps[] => {
    const cards: StatusCardProps[] = [];

    // 最新价格
    const priceChange = stats.changePercent24h;
    cards.push({
      icon: '💰',
      label: '最新价格',
      value: `$${stats.latestPrice.toFixed(2)}`,
      status: priceChange >= 0 ? 'healthy' : 'unhealthy',
      glowColor: priceChange >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)',
      index: 0
    });

    // 24H涨跌
    cards.push({
      icon: priceChange >= 0 ? '📈' : '📉',
      label: '24H涨跌',
      value: `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`,
      status: priceChange >= 0 ? 'healthy' : 'unhealthy',
      glowColor: priceChange >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)',
      index: 1
    });

    // 24H最高
    cards.push({
      icon: '⬆️',
      label: '24H最高',
      value: `$${stats.high24h.toFixed(2)}`,
      glowColor: 'rgba(16, 185, 129, 0.6)',
      index: 2
    });

    // 24H最低
    cards.push({
      icon: '⬇️',
      label: '24H最低',
      value: `$${stats.low24h.toFixed(2)}`,
      glowColor: 'rgba(239, 68, 68, 0.6)',
      index: 3
    });

    // 24H成交量
    cards.push({
      icon: '📊',
      label: '24H成交量',
      value: formatLargeNumber(stats.volume24h),
      glowColor: 'rgba(59, 130, 246, 0.6)',
      index: 4
    });

    // 数据点数
    cards.push({
      icon: '📝',
      label: '数据点数',
      value: `${klines.length} 条`,
      glowColor: 'rgba(139, 92, 246, 0.6)',
      index: 5
    });

    // 数据完整性
    if (integrity && typeof integrity.completeness_rate === 'number') {
      cards.push({
        icon: '✅',
        label: '数据完整性',
        value: `${integrity.completeness_rate.toFixed(2)}%`,
        status: integrity.completeness_rate >= 95 ? 'healthy' : integrity.completeness_rate >= 80 ? 'warning' : 'unhealthy',
        glowColor: integrity.completeness_rate >= 95
          ? 'rgba(16, 185, 129, 0.6)'
          : integrity.completeness_rate >= 80
          ? 'rgba(245, 158, 11, 0.6)'
          : 'rgba(239, 68, 68, 0.6)',
        index: 6
      });
    }

    return cards;
  }, [stats, klines.length, integrity]);

  // 最后更新时间
  const getLastUpdateText = () => {
    if (!lastUpdate) return '未更新';
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
    if (seconds < 10) return '刚刚';
    if (seconds < 60) return `${seconds}秒前`;
    return `${Math.floor(seconds / 60)}分钟前`;
  };

  return (
    <div className={styles.klinePage}>
      <PageHeader
        title="K线图表分析"
        subtitle="实时K线数据展示与技术分析"
        icon="📈"
      >
        <span className={styles.lastUpdate}>
          最后更新: {getLastUpdateText()}
        </span>
      </PageHeader>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
          closable
          className={styles.errorAlert}
        />
      )}

      {/* 控制栏 */}
      <Card className={styles.controlBar}>
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label>交易对:</label>
            <SymbolSelector />
          </div>

          <div className={styles.controlGroup}>
            <Button
              onClick={() => fetchIntegrity(1)}
              icon={integrity ? <CheckCircleOutlined /> : <WarningOutlined />}
            >
              检查数据完整性
            </Button>
            <Button
              onClick={handlePullHistory}
              icon={<DownloadOutlined />}
              loading={isPullingHistory}
            >
              回溯补全历史数据
            </Button>
            <Button
              onClick={handleRefreshSignals}
              icon={<ThunderboltOutlined />}
              loading={isSignalLoading}
            >
              刷新信号
            </Button>
            <Button
              onClick={handleRefreshStructure}
              icon={<LineChartOutlined />}
              loading={isStructureLoading}
            >
              刷新结构
            </Button>
            <Button
              onClick={handleTriggerDetection}
              icon={<LineChartOutlined />}
              loading={isTriggeringDetection}
              type="primary"
            >
              触发检测
            </Button>
            <Button
              onClick={handleGenerateSignal}
              icon={<ThunderboltOutlined />}
              loading={isSignalLoading}
              type="dashed"
            >
              生成测试信号
            </Button>
            <Button
              onClick={() => {
                setShowChan(!showChan);
                if (!showChan) {
                  refreshChan(); // 打开时刷新数据
                }
              }}
              type={showChan ? 'primary' : 'default'}
              style={{
                backgroundColor: showChan ? '#8b5cf6' : undefined,
                borderColor: showChan ? '#8b5cf6' : undefined,
              }}
            >
              {showChan ? '✅ 缠论分析' : '缠论分析'}
            </Button>
            <CoolRefreshButton
              onClick={refresh}
              loading={isLoading}
              size="small"
              iconOnly
            />
          </div>
        </div>
      </Card>

      {/* 统计信息面板 */}
      <StatusOverview cards={statusCards} className={styles.statsOverview} />

      {/* K线图表 */}
      <Card
        className={styles.chartCard}
        title={
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>{selectedSymbol}</span>
            <IntervalSelector compact />
            <div className={styles.chartToggles}>
              <Button
                size="small"
                onClick={() => setShowSignalsOnChart(!showSignalsOnChart)}
                style={{
                  fontSize: '12px',
                  backgroundColor: showSignalsOnChart ? '#3b82f6' : '#f3f4f6',
                  borderColor: showSignalsOnChart ? '#3b82f6' : '#d1d5db',
                  color: showSignalsOnChart ? '#ffffff' : '#6b7280',
                }}
              >
                信号
              </Button>
              <Button
                size="small"
                onClick={() => setShowStructureOnChart(!showStructureOnChart)}
                style={{
                  fontSize: '12px',
                  backgroundColor: showStructureOnChart ? '#3b82f6' : '#f3f4f6',
                  borderColor: showStructureOnChart ? '#3b82f6' : '#d1d5db',
                  color: showStructureOnChart ? '#ffffff' : '#6b7280',
                }}
              >
                区间
              </Button>
              <Button
                size="small"
                onClick={() => setShowChanOnChart(!showChanOnChart)}
                style={{
                  fontSize: '12px',
                  backgroundColor: showChanOnChart ? '#8b5cf6' : '#f3f4f6',
                  borderColor: showChanOnChart ? '#8b5cf6' : '#d1d5db',
                  color: showChanOnChart ? '#ffffff' : '#6b7280',
                }}
              >
                缠论
              </Button>
            </div>
          </div>
        }
      >
        {isLoading && klines.length === 0 ? (
          <div className={styles.loadingContainer}>
            <Spin size="large" tip="加载K线数据..." />
          </div>
        ) : klines.length > 0 ? (
          <TradingViewChart
            candlestickData={chartData.candlesticks}
            volumeData={chartData.volumes}
            signals={showSignalsOnChart ? filteredSignals : []}
            ranges={showStructureOnChart ? filteredRanges : []}
            breakouts={showStructureOnChart ? filteredBreakouts : []}
            fractals={showChanOnChart ? chanData?.fractals || [] : []}
            strokes={showChanOnChart ? chanData?.strokes || [] : []}
            centers={showChanOnChart ? chanData?.centers || [] : []}
            height={500}
            showVolume={true}
            showRanges={showStructureOnChart}
            showBreakouts={showStructureOnChart}
            showFractals={showChanOnChart && showFractals}
            showStrokes={showChanOnChart && showStrokes}
            showCenters={showChanOnChart && showCenters}
            theme="dark"
          />
        ) : (
          <div className={styles.noData}>
            <p>暂无K线数据</p>
            <Button type="primary" onClick={refresh}>
              重新加载
            </Button>
          </div>
        )}
      </Card>

      {/* 信号面板 */}
      <SignalPanel
        signals={filteredSignals}
        isLoading={isSignalLoading}
        onSignalClick={(signal) => {
          message.info(`点击信号: ${signal.signal_type} @ $${signal.price}`);
        }}
      />

      {/* 信号错误提示 */}
      {signalError && (
        <Alert
          message="信号数据加载失败"
          description={signalError}
          type="warning"
          showIcon
          closable
          className={styles.errorAlert}
          style={{ marginTop: '1rem' }}
        />
      )}

      {/* 结构检测面板 */}
      <StructurePanel
        ranges={filteredRanges}
        breakouts={filteredBreakouts}
        statistics={statistics}
        isLoading={isStructureLoading}
        onRangeClick={(range) => {
          message.info(`点击区间: 支撑 ${range.support} / 阻力 ${range.resistance}`);
        }}
        onBreakoutClick={(breakout) => {
          message.info(`点击突破: ${breakout.direction} @ $${breakout.breakout_price}`);
        }}
        onUpdateResult={handleUpdateSignalResult}
      />

      {/* 结构错误提示 */}
      {structureError && (
        <Alert
          message="结构数据加载失败"
          description={structureError}
          type="warning"
          showIcon
          closable
          className={styles.errorAlert}
          style={{ marginTop: '1rem' }}
        />
      )}

      {/* 缠论分析面板 (可选功能，默认关闭) */}
      {showChan && (
        <>
          <ChanPanel
            chanData={chanData}
            isLoading={isChanLoading}
            error={chanError}
            onToggleFractals={setShowFractals}
            onToggleStrokes={setShowStrokes}
            onToggleCenters={setShowCenters}
            showFractals={showFractals}
            showStrokes={showStrokes}
            showCenters={showCenters}
          />

          {/* 缠论错误提示 */}
          {chanError && (
            <Alert
              message="缠论数据加载失败"
              description={chanError.message}
              type="warning"
              showIcon
              closable
              className={styles.errorAlert}
              style={{ marginTop: '1rem' }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default KlineChart;
