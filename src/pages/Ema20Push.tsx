import React, { useState, useCallback, useEffect } from 'react';
import { Input, Select, InputNumber, Popconfirm, message } from 'antd';
import styles from './Ema20Push.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, DataSection, CoolRefreshButton } from '../components/ui';
import {
  ema20PushAPI,
  Ema20PushContext,
  Ema20PushRecord,
} from '../services/ema20PushAPI';

const { Option } = Select;
const TIMEFRAMES = ['5m', '15m', '1h', '4h'];

interface Ema20PushProps {
  isSidebarCollapsed?: boolean;
}

const Ema20Push: React.FC<Ema20PushProps> = () => {
  const [contexts, setContexts] = useState<Ema20PushContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 筛选
  const [searchTerm, setSearchTerm] = useState('');
  const [timeframeFilter, setTimeframeFilter] = useState<string | undefined>();
  const [minPushCount, setMinPushCount] = useState<number>(2);

  // 展开记录
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [recordsMap, setRecordsMap] = useState<Map<string, Ema20PushRecord[]>>(new Map());
  const [recordsLoading, setRecordsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await ema20PushAPI.getContexts({
        timeframe: timeframeFilter,
        min_push_count: minPushCount,
        limit: 200,
      });
      setContexts(data);
      setError(null);
    } catch {
      setError('加载数据失败');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeframeFilter, minPushCount]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);
  useEffect(() => {
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleRefresh = useCallback(() => { setIsRefreshing(true); fetchData(); }, [fetchData]);

  const handleToggleRecords = async (symbol: string, timeframe: string) => {
    const key = `${symbol}:${timeframe}`;
    if (expandedKey === key) { setExpandedKey(null); return; }
    setExpandedKey(key);
    if (recordsMap.has(key)) return;
    setRecordsLoading(true);
    try {
      const data = await ema20PushAPI.getRecords(symbol, timeframe);
      setRecordsMap(prev => new Map(prev).set(key, data));
    } catch {
      message.error('加载记录失败');
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleDelete = async (symbol: string, timeframe: string) => {
    try {
      await ema20PushAPI.deleteContext(symbol, timeframe);
      message.success('已删除');
      setContexts(prev => prev.filter(c => !(c.symbol === symbol && c.timeframe === timeframe)));
      const key = `${symbol}:${timeframe}`;
      if (expandedKey === key) setExpandedKey(null);
    } catch {
      message.error('删除失败');
    }
  };

  const formatPrice = (p: number) => {
    if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  const stripUsdt = (s: string) =>
    s.toUpperCase().endsWith('USDT') ? s.slice(0, -4) : s;

  const pushCountClass = (n: number) =>
    n >= 5 ? styles.high : n >= 3 ? styles.mid : '';

  const filtered = contexts.filter(c =>
    !searchTerm || c.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error && !contexts.length) {
    return (
      <div className={styles.ema20Push}>
        <div className={styles.error}>
          <div className={styles.content}>
            <div className={styles.icon}>⚠️</div>
            <div className={styles.text}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ema20Push}>
      <TopProgressBar isVisible={isRefreshing || loading} progress={loading ? 50 : 85} absolute />

      <PageHeader
        title="EMA20 推送监控"
        subtitle="追踪价格多次触碰 EMA20 的币种，捕捉趋势支撑机会"
        icon="📉"
      />

      {/* 筛选器 */}
      <div className={styles.filterSection}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>币种：</label>
            <Input
              placeholder="输入币种名称..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              allowClear
              style={{ width: 160 }}
            />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>周期：</label>
            <Select
              placeholder="全部周期"
              value={timeframeFilter}
              onChange={v => setTimeframeFilter(v)}
              allowClear
              style={{ width: 110 }}
            >
              {TIMEFRAMES.map(tf => <Option key={tf} value={tf}>{tf}</Option>)}
            </Select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>最小推送次数：</label>
            <InputNumber
              min={1}
              max={20}
              value={minPushCount}
              onChange={v => setMinPushCount(v ?? 2)}
              style={{ width: 70 }}
            />
          </div>
          <div className={styles.filterItem}>
            <CoolRefreshButton onClick={handleRefresh} loading={isRefreshing} size="small" iconOnly />
          </div>
          <div className={styles.statusInfo}>
            <span className={styles.statusItem}>
              <span className={styles.statusLabel}>币种数：</span>
              <span className={styles.statusValue}>{filtered.length}</span>
            </span>
            <span className={styles.statusItem}>
              <span className={styles.statusLabel}>≥5次：</span>
              <span className={styles.statusValue}>{filtered.filter(c => c.push_count >= 5).length}</span>
            </span>
          </div>
        </div>
      </div>

      <DataSection
        title="EMA20 推送列表"
        subtitle={`共 ${filtered.length} 个币种，按推送次数倒序`}
        loading={loading && !contexts.length}
        error={null}
        empty={!loading && filtered.length === 0}
        emptyText="暂无数据"
        compact
      >
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>币种</th>
                <th>推送次数</th>
                <th>最近推送</th>
                <th>创建时间</th>
                <th>当前价</th>
                <th>EMA20</th>
                <th>偏离幅度</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ctx => {
                const key = `${ctx.symbol}:${ctx.timeframe}`;
                const isExpanded = expandedKey === key;
                const records = recordsMap.get(key) ?? [];
                const deviation = ctx.current_price && ctx.ema20
                  ? (ctx.current_price - ctx.ema20) / ctx.ema20 * 100
                  : null;
                return (
                  <React.Fragment key={key}>
                    <tr className={isExpanded ? styles.expanded : ''}>
                      <td>
                        <span
                          className={styles.symbolCell}
                          onClick={() => handleToggleRecords(ctx.symbol, ctx.timeframe)}
                        >
                          {stripUsdt(ctx.symbol)}
                          <span className={styles.tfBadge}>{ctx.timeframe}</span>
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.pushCount} ${pushCountClass(ctx.push_count)}`}>
                          {ctx.push_count}
                        </span>
                      </td>
                      <td className={styles.timeCell}>
                        {ctx.last_push_time ? formatTime(ctx.last_push_time) : '—'}
                      </td>
                      <td className={styles.timeCell}>
                        {ctx.created_at
                          ? new Date(ctx.created_at.endsWith('Z') ? ctx.created_at.slice(0, -1) : ctx.created_at)
                              .toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className={styles.numCell}>{formatPrice(ctx.current_price)}</td>
                      <td className={`${styles.numCell} ${styles.recordEma}`}>{formatPrice(ctx.ema20)}</td>
                      <td className={styles.numCell}>
                        {deviation !== null ? (
                          <span className={deviation >= 0 ? styles.positive : styles.negative}>
                            {deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <Popconfirm
                          title={`删除 ${stripUsdt(ctx.symbol)} (${ctx.timeframe}) 的记录？`}
                          onConfirm={() => handleDelete(ctx.symbol, ctx.timeframe)}
                          okText="删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                        >
                          <button className={styles.deleteBtn}>删除</button>
                        </Popconfirm>
                      </td>
                    </tr>
                    {/* 推送记录展开行 */}
                    <tr className={styles.recordRow}>
                      <td colSpan={8}>
                        <div className={`${styles.recordSlider} ${isExpanded ? styles.open : ''}`}>
                          <div className={styles.recordSliderInner}>
                            <div className={styles.recordPanel}>
                              <div className={styles.recordTitle}>
                                推送记录（{records.length} 条）
                                {recordsLoading && ' 加载中...'}
                              </div>
                              <div className={styles.recordList}>
                                {records.map((r, i) => (
                                  <div key={r.id ?? i} className={styles.recordItem}>
                                    <span className={styles.recordPrice}>{formatPrice(r.current_price)}</span>
                                    <span className={styles.recordEma}>EMA {formatPrice(r.ema20)}</span>
                                    <span className={styles.recordTime}>{formatTime(r.push_time)}</span>
                                  </div>
                                ))}
                                {records.length === 0 && !recordsLoading && (
                                  <span className={styles.recordTime}>暂无记录</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataSection>
    </div>
  );
};

export default Ema20Push;
