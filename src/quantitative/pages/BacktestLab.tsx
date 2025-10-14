/**
 * 回测实验室页面
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Form, Select, DatePicker, InputNumber, Button, Table, Modal, Progress, message } from 'antd';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import PageHeader from '../../components/ui/PageHeader';
import TradingViewChart from '../../components/charts/TradingViewChart';
import { useBacktest } from '../hooks/useBacktest';
import { backtestAPI, strategyAPI } from '../services';
import { klineAPI, klineUtils } from '../../services/klineAPI';
import { BacktestRequest, BacktestResult, TaskProgress, Trade } from '../types';
import type { CandlestickData } from '../../types/kline';
import type { Signal } from '../../services/signalAPI';
import type { CZSCStrategyListItem } from '../types/strategy';
import {
  formatCurrency,
  formatPercent,
  formatDateTime,
  formatNumber,
  INTERVALS,
  SYMBOLS,
  DEFAULT_BACKTEST_CONFIG
} from '../utils';
import styles from './BacktestLab.module.scss';

const { RangePicker } = DatePicker;

interface BacktestLabProps {
  isSidebarCollapsed?: boolean;
}

const BacktestLab: React.FC<BacktestLabProps> = ({ isSidebarCollapsed }) => {
  const {
    backtests,
    selectedBacktest,
    backtestTrades,
    isRunning,
    selectBacktest,
    runBacktest,
    fetchBacktests,
    fetchBacktestDetail,
    fetchBacktestTrades
  } = useBacktest();

  const [form] = Form.useForm();
  const [showResults, setShowResults] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // K线图表数据
  const [klineData, setKlineData] = useState<CandlestickData[]>([]);
  const [isLoadingKline, setIsLoadingKline] = useState(false);

  // 策略列表
  const [strategies, setStrategies] = useState<CZSCStrategyListItem[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);

  // 加载策略列表
  useEffect(() => {
    const loadStrategies = async () => {
      try {
        setIsLoadingStrategies(true);
        const response = await strategyAPI.getStrategies({ limit: 100 });
        setStrategies(response.strategies);
      } catch (error) {
        console.error('加载策略列表失败:', error);
      } finally {
        setIsLoadingStrategies(false);
      }
    };

    loadStrategies();
  }, []);

  // 清理轮询
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
  // 运行回测（同步模式 - CZSC直接返回结果）
  const handleRunBacktest = async () => {
    try {
      const values = await form.validateFields();
      const [startDate, endDate] = values.dateRange;

      const request: BacktestRequest = {
        strategy_id: values.strategy_id, // 使用选中的策略ID
        symbol: values.symbol,
        interval: values.interval,
        start_time: startDate.valueOf(),
        end_time: endDate.valueOf(),
        initial_capital: values.initial_capital,
        commission_rate: values.commission_rate,
      };

      message.loading('正在运行回测...', 0);

      // 直接调用回测API，CZSC系统同步返回结果
      const result = await runBacktest(request);

      message.destroy();
      message.success('回测完成！');

      // 显示结果
      selectBacktest(result);
      setShowResults(true);

      // 加载K线数据
      await loadKlineData(values.symbol, values.interval, startDate.valueOf(), endDate.valueOf());

    } catch (err: any) {
      message.destroy();
      message.error(err.message || '回测执行失败');
    }
  };

  // 加载K线数据
  const loadKlineData = async (symbol: string, interval: string, startTime: number, endTime: number) => {
    try {
      setIsLoadingKline(true);

      // 使用 getKlinesByRange API按时间范围查询
      const response = await klineAPI.getKlinesByRange(symbol, interval, startTime, endTime, 2000);

      // 转换为TradingView格式
      const chartData = klineUtils.convertToTradingViewFormat(response.klines);
      setKlineData(chartData.candlesticks);
    } catch (error) {
      console.error('加载K线数据失败:', error);
      message.error('加载K线数据失败');
    } finally {
      setIsLoadingKline(false);
    }
  };

  // 打开历史记录弹窗
  const handleOpenHistory = async () => {
    await fetchBacktests();
    setHistoryModalVisible(true);
  };

  // 查看历史回测
  const handleViewBacktest = async (backtest: BacktestResult) => {
    try {
      // 如果有task_id，通过详情接口获取完整数据
      if (backtest.task_id) {
        await fetchBacktestDetail(backtest.task_id);
      } else {
        // 降级方案：使用列表数据
        selectBacktest(backtest);
      }
      setShowResults(true);
      setHistoryModalVisible(false);

      // 加载K线数据
      const startTime = new Date(backtest.start_time).getTime();
      const endTime = new Date(backtest.end_time).getTime();
      await loadKlineData(backtest.symbol, backtest.interval, startTime, endTime);
    } catch (error) {
      message.error('获取回测详情失败');
    }
  };

  // 历史记录表格列
  const historyColumns = [
    {
      title: '币种',
      dataIndex: 'symbol',
      key: 'symbol',
    },
    {
      title: '周期',
      dataIndex: 'interval',
      key: 'interval',
    },
    {
      title: '总收益',
      dataIndex: 'total_return',
      key: 'total_return',
      render: (ret: any) => {
        const value = typeof ret === 'number' ? ret : parseFloat(ret) || 0;
        return (
          <span className={value >= 0 ? styles.positive : styles.negative}>
            {formatPercent(value)}
          </span>
        );
      },
    },
    {
      title: '夏普比',
      dataIndex: 'sharpe_ratio',
      key: 'sharpe_ratio',
      render: (ratio: any) => {
        const value = typeof ratio === 'number' ? ratio : parseFloat(ratio) || 0;
        return value.toFixed(2);
      },
    },
    {
      title: '胜率',
      dataIndex: 'win_rate',
      key: 'win_rate',
      render: (rate: any) => {
        const value = typeof rate === 'number' ? rate : parseFloat(rate) || 0;
        return formatPercent(value);
      },
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: BacktestResult) => (
        <Button type="link" onClick={() => handleViewBacktest(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  // 资金曲线数据
  const equityData = selectedBacktest?.performance_data.equity_curve.map((point) => ({
    time: new Date(point.time).toLocaleDateString(),
    value: point.value,
  })) || [];

  // 回撤曲线数据
  const drawdownData = selectedBacktest?.performance_data.drawdown_curve.map((point) => ({
    time: new Date(point.time).toLocaleDateString(),
    drawdown: point.drawdown,
  })) || [];

  // 月度收益数据
  const monthlyData = selectedBacktest
    ? Object.entries(selectedBacktest.performance_data.monthly_returns).map(([month, ret]) => ({
        month,
        return: ret,
      }))
    : [];

  // 将交易明细转换为K线图标记格式
  const tradeMarkers = useMemo(() => {
    if (!backtestTrades || backtestTrades.length === 0) {
      return [];
    }

    const markers: Signal[] = [];

    backtestTrades.forEach((trade) => {
      // 开仓标记
      markers.push({
        id: `entry_${trade.id}`,
        symbol: trade.symbol,
        signal_type: trade.direction === 'long' ? 'BUY' : 'SELL',
        signal_name: '开仓',
        timestamp: new Date(trade.entry_time).getTime(),
        price: trade.entry_price,
        strength: 'HIGH',
        confidence: 100,
        metadata: { trade_id: trade.id }
      });

      // 平仓标记
      markers.push({
        id: `exit_${trade.id}`,
        symbol: trade.symbol,
        signal_type: trade.direction === 'long' ? 'SELL' : 'BUY',
        signal_name: '平仓',
        timestamp: new Date(trade.exit_time).getTime(),
        price: trade.exit_price,
        strength: 'MEDIUM',
        confidence: 100,
        metadata: { trade_id: trade.id, profit: trade.profit }
      });
    });

    return markers;
  }, [backtestTrades]);

  // 交易表格列
  const columns = [
    {
      title: '币种',
      dataIndex: 'symbol',
      key: 'symbol',
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      render: (direction: string) => (
        <span className={direction === 'long' ? styles.long : styles.short}>
          {direction === 'long' ? '做多' : '做空'}
        </span>
      ),
    },
    {
      title: '入场价',
      dataIndex: 'entry_price',
      key: 'entry_price',
      render: (price: any) => {
        const value = typeof price === 'number' ? price : parseFloat(price) || 0;
        return formatCurrency(value);
      },
    },
    {
      title: '出场价',
      dataIndex: 'exit_price',
      key: 'exit_price',
      render: (price: any) => {
        const value = typeof price === 'number' ? price : parseFloat(price) || 0;
        return formatCurrency(value);
      },
    },
    {
      title: '盈亏',
      dataIndex: 'profit',
      key: 'profit',
      render: (profit: any) => {
        const value = typeof profit === 'number' ? profit : parseFloat(profit) || 0;
        return (
          <span className={value >= 0 ? styles.positive : styles.negative}>
            {formatCurrency(value)}
          </span>
        );
      },
    },
    {
      title: '盈亏%',
      dataIndex: 'profit_rate',
      key: 'profit_rate',
      render: (percent: any) => {
        const value = typeof percent === 'number' ? percent : parseFloat(percent) || 0;
        return (
          <span className={value >= 0 ? styles.positive : styles.negative}>
            {formatPercent(value)}
          </span>
        );
      },
    },
    {
      title: '入场时间',
      dataIndex: 'entry_time',
      key: 'entry_time',
      render: (time: string) => formatDateTime(time),
    },
  ];

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="回测实验室"
        subtitle="测试策略历史表现，分析风险收益指标"
        icon="🧪"
      >
        <button className={styles.historyBtn} onClick={handleOpenHistory}>
          <span>📜</span>
          查看历史
        </button>
      </PageHeader>

      {/* 历史记录弹窗 */}
      <Modal
        title="回测历史记录"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={1000}
      >
        <Table
          dataSource={backtests}
          columns={historyColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Modal>

      <div className={styles.mainGrid}>
        {/* 回测配置 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>回测配置</h2>
          </div>
          <div className={`${styles.cardBody} ${styles.configForm}`}>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                strategy_id: undefined,
                symbol: 'BTCUSDT',
                interval: '15m',
                initial_capital: DEFAULT_BACKTEST_CONFIG.initial_capital,
                commission_rate: DEFAULT_BACKTEST_CONFIG.commission_rate,
                dateRange: [dayjs().subtract(30, 'day'), dayjs()],
              }}
            >
              <Form.Item
                label="选择策略"
                name="strategy_id"
                rules={[{ required: true, message: '请选择策略' }]}
              >
                <Select
                  placeholder="选择要回测的策略"
                  loading={isLoadingStrategies}
                  showSearch
                  optionFilterProp="children"
                >
                  {strategies.map((strategy) => (
                    <Select.Option key={strategy.strategy_id} value={strategy.strategy_id}>
                      {strategy.name} ({strategy.category})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="交易币种"
                name="symbol"
                rules={[{ required: true, message: '请选择币种' }]}
              >
                <Select placeholder="选择交易币种">
                  {SYMBOLS.map((symbol) => (
                    <Select.Option key={symbol} value={symbol}>
                      {symbol}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="时间周期"
                name="interval"
                rules={[{ required: true, message: '请选择时间周期' }]}
              >
                <Select options={INTERVALS} />
              </Form.Item>

              <Form.Item
                label="初始资金"
                name="initial_capital"
                rules={[{ required: true, message: '请输入初始资金' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1000}
                  max={1000000}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>

              <Form.Item
                label="手续费率 (%)"
                name="commission_rate"
                rules={[{ required: true, message: '请输入手续费率' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={1}
                  step={0.001}
                  precision={3}
                />
              </Form.Item>

              <Form.Item
                label="回测时间范围"
                name="dateRange"
                className="ant-form-item-time-range"
                rules={[{ required: true, message: '请选择时间范围' }]}
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item className="ant-form-item-submit">
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={isRunning || !!taskProgress}
                  onClick={handleRunBacktest}
                >
                  {taskProgress ? '回测中...' : '🚀 开始回测'}
                </Button>

                {/* 进度条 */}
                {taskProgress && (
                  <div style={{ marginTop: '1rem' }}>
                    <Progress
                      percent={progressPercent}
                      status="active"
                      strokeColor={{
                        '0%': '#3b82f6',
                        '100%': '#10b981',
                      }}
                    />
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div>K线进度: {taskProgress.current_kline} / {taskProgress.total_klines}</div>
                      <div>交易数量: {taskProgress.trades_count}</div>
                      <div>已用时间: {taskProgress.elapsed_seconds}秒</div>
                    </div>
                  </div>
                )}
              </Form.Item>
            </Form>
          </div>
        </div>

        {/* 回测结果 */}
        <div>
          {!showResults || !selectedBacktest ? (
            <div className={styles.placeholder}>
              <span className={styles.icon}>🧪</span>
              <p>配置参数后点击"开始回测"</p>
              <p className={styles.tip}>或从历史记录中选择查看</p>
            </div>
          ) : (
            <>
              {/* 性能指标 */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>总收益率</div>
                  <div className={`${styles.metricValue} ${(selectedBacktest.total_return || 0) >= 0 ? styles.positive : styles.negative}`}>
                    {formatPercent(typeof selectedBacktest.total_return === 'number' ? selectedBacktest.total_return : parseFloat(selectedBacktest.total_return as any) || 0)}
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>年化收益</div>
                  <div className={styles.metricValue}>
                    {formatPercent(typeof selectedBacktest.annual_return === 'number' ? selectedBacktest.annual_return : parseFloat(selectedBacktest.annual_return as any) || 0)}
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>夏普比率</div>
                  <div className={styles.metricValue}>
                    {(typeof selectedBacktest.sharpe_ratio === 'number' ? selectedBacktest.sharpe_ratio : parseFloat(selectedBacktest.sharpe_ratio as any) || 0).toFixed(2)}
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>最大回撤</div>
                  <div className={`${styles.metricValue} ${styles.negative}`}>
                    {formatPercent(typeof selectedBacktest.max_drawdown === 'number' ? selectedBacktest.max_drawdown : parseFloat(selectedBacktest.max_drawdown as any) || 0)}
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>总交易数</div>
                  <div className={styles.metricValue}>
                    {selectedBacktest.total_trades || 0}
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>胜率</div>
                  <div className={styles.metricValue}>
                    {formatPercent(typeof selectedBacktest.win_rate === 'number' ? selectedBacktest.win_rate : parseFloat(selectedBacktest.win_rate as any) || 0)}
                  </div>
                </div>
              </div>

              {/* 资金曲线 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>资金曲线</h3>
                </div>
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={equityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" name="资金" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 回撤曲线 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>回撤曲线</h3>
                </div>
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={drawdownData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="回撤%" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 交易明细 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>交易明细（{backtestTrades.length} 笔交易，{tradeMarkers.length} 个标记）</h3>
                </div>
                <Table
                  dataSource={backtestTrades}
                  columns={columns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </div>

              {/* K线图表（带交易标记） */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    K线图表与交易标记
                    {isLoadingKline && <span style={{ marginLeft: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>加载中...</span>}
                    {!isLoadingKline && klineData.length === 0 && <span style={{ marginLeft: '1rem', fontSize: '0.875rem', color: '#ef4444' }}>K线数据加载失败</span>}
                    {!isLoadingKline && klineData.length > 0 && <span style={{ marginLeft: '1rem', fontSize: '0.875rem', color: '#10b981' }}>已加载 {klineData.length} 根K线</span>}
                  </h3>
                </div>
                <div className={styles.chartContainer}>
                  {klineData.length > 0 ? (
                    <TradingViewChart
                      candlestickData={klineData}
                      signals={tradeMarkers}
                      height={500}
                      showVolume={true}
                      theme="dark"
                    />
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      {isLoadingKline ? '正在加载K线数据...' : '暂无K线数据'}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BacktestLab;
