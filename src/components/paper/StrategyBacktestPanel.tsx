import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Collapse, Input, Segmented, Select, Table, Tag } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { DataSection, CoolRefreshButton } from '../ui';
import BacktestTradeModal from './BacktestTradeModal';
import styles from './Paper.module.scss';
import { fmtPrice, fmtTime, fmtU, fmtNum, fmtR, pnlClass } from './paperFormat';
import { fmtPct, fmtParam } from './backtestFormat';
import {
  strategyBacktestAPI,
  BacktestGroupRow,
  BacktestRun,
  BacktestSortKey,
  BacktestStats,
  BacktestStrategy,
  BacktestTrade,
  BacktestTradeFilters,
  BacktestTradeStatus,
} from '../../services/strategyBacktestAPI';

interface StrategyBacktestPanelProps {
  isDark: boolean;
}

const PAGE_SIZE = 50;
const RUN_KEY = 'paper.backtest.runId';

const RUN_STATUS: Record<string, { label: string; color: string }> = {
  done: { label: '已完成', color: 'success' },
  running: { label: '运行中', color: 'processing' },
  failed: { label: '失败', color: 'error' },
};

const readRunId = (): number | null => {
  try {
    const v = Number(localStorage.getItem(RUN_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
};

const Metric: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string; title?: string }> = ({ label, value, sub, tone, title }) => (
  <div className={styles.metric} title={title}>
    <span className={styles.metricLabel}>{label}</span>
    <span className={`${styles.metricValue} ${tone ?? ''}`}>{value}</span>
    {sub !== undefined && <span className={styles.metricSub}>{sub}</span>}
  </div>
);

const StrategyBacktestPanel: React.FC<StrategyBacktestPanelProps> = ({ isDark }) => {
  const [strategies, setStrategies] = useState<BacktestStrategy[]>([]);
  const [strategyId, setStrategyId] = useState<string | undefined>(undefined);
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [runId, setRunId] = useState<number | null>(readRunId);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);

  const [stats, setStats] = useState<BacktestStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // ── 交易列表筛选 ──
  const [statusFilter, setStatusFilter] = useState<BacktestTradeStatus[]>(['closed']);
  const [exitFilter, setExitFilter] = useState<string[]>([]);
  const [result, setResult] = useState<'all' | 'win' | 'loss'>('all');
  const [symbol, setSymbolState] = useState('');
  const [symbolInput, setSymbolInput] = useState('');
  const setSymbol = (v: string) => {
    setSymbolInput(v);
    setSymbolState(v);
  };
  const [sort, setSort] = useState<{ key: BacktestSortKey; order: 'asc' | 'desc' }>({ key: 'signal_time', order: 'desc' });
  const [page, setPage] = useState(1);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [total, setTotal] = useState(0);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesError, setTradesError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<number | null>(null);

  const run = runs.find((r) => r.id === runId) ?? null;
  const strategy = strategies.find((s) => s.id === run?.strategy_id) ?? null;
  const exitReasons = useMemo(() => strategy?.exit_reasons ?? {}, [strategy]);
  const reasonText = (k: string | null) => (k ? exitReasons[k] ?? k : '—');

  const filters: BacktestTradeFilters = useMemo(
    () => ({
      status: statusFilter,
      exit_reason: exitFilter,
      result: result === 'all' ? undefined : result,
      symbol: symbol.trim().toUpperCase() || undefined,
    }),
    [statusFilter, exitFilter, result, symbol]
  );

  // ── 策略与运行列表 ──
  useEffect(() => {
    strategyBacktestAPI.getStrategies().then(setStrategies).catch(() => setStrategies([]));
  }, []);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await strategyBacktestAPI.getRuns({ strategy_id: strategyId, limit: 200 });
      setRuns(res.data);
      setRunsError(null);
      // 记住的运行不在列表里（被删 / 换了策略）就选最新一次已完成的
      setRunId((cur) => {
        if (cur && res.data.some((r) => r.id === cur)) return cur;
        return (res.data.find((r) => r.status === 'done') ?? res.data[0])?.id ?? null;
      });
    } catch (err) {
      setRunsError((err as Error).message || '加载回测列表失败');
    } finally {
      setRunsLoading(false);
    }
  }, [strategyId]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  useEffect(() => {
    try {
      if (runId) localStorage.setItem(RUN_KEY, String(runId));
    } catch { /* 忽略 */ }
  }, [runId]);

  // ── 统计（只统计已平仓；按币种筛选时跟着重算） ──
  const statsSymbol = filters.symbol;
  useEffect(() => {
    if (!runId) { setStats(null); return; }
    let stale = false;
    setStatsLoading(true);
    strategyBacktestAPI
      .getStats(runId, { symbol: statsSymbol })
      .then((s) => { if (!stale) { setStats(s); setStatsError(null); } })
      .catch((err) => { if (!stale) setStatsError((err as Error).message || '加载统计失败'); })
      .finally(() => { if (!stale) setStatsLoading(false); });
    return () => { stale = true; };
  }, [runId, statsSymbol]);

  // ── 交易列表 ──
  useEffect(() => { setPage(1); }, [runId, filters, sort]);

  useEffect(() => {
    if (!runId) { setTrades([]); setTotal(0); return; }
    let stale = false;
    setTradesLoading(true);
    strategyBacktestAPI
      .getTrades(runId, { ...filters, sort: sort.key, order: sort.order, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then((res) => {
        if (stale) return;
        setTrades(res.data);
        setTotal(res.total);
        setTradesError(null);
      })
      .catch((err) => { if (!stale) setTradesError((err as Error).message || '加载交易失败'); })
      .finally(() => { if (!stale) setTradesLoading(false); });
    return () => { stale = true; };
  }, [runId, filters, sort, page]);

  const onTableChange = (
    pagination: TablePaginationConfig,
    _f: unknown,
    sorter: SorterResult<BacktestTrade> | SorterResult<BacktestTrade>[]
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const key = (s?.order ? s.columnKey : 'signal_time') as BacktestSortKey;
    const order = s?.order === 'ascend' ? 'asc' : 'desc';
    if (key !== sort.key || order !== sort.order) setSort({ key, order });
    else if (pagination.current) setPage(pagination.current);
  };

  const sortOrderOf = (key: BacktestSortKey) =>
    sort.key === key ? (sort.order === 'asc' ? ('ascend' as const) : ('descend' as const)) : null;

  // ── 列 ──
  const columns: ColumnsType<BacktestTrade> = [
    {
      title: '币种',
      dataIndex: 'symbol',
      width: 140,
      fixed: 'left',
      render: (s: string, t) => (
        <span>
          <span className={styles.symbol}>{s}</span>{' '}
          <Tag color={t.side === 'short' ? 'red' : 'green'} style={{ marginInlineEnd: 0 }}>{t.side === 'short' ? '空' : '多'}</Tag>
        </span>
      ),
    },
    {
      title: '信号时间',
      key: 'signal_time',
      dataIndex: 'signal_time',
      width: 140,
      sorter: true,
      sortOrder: sortOrderOf('signal_time'),
      render: (v) => fmtTime(v, true),
    },
    {
      title: '状态 / 出场',
      dataIndex: 'exit_reason',
      width: 170,
      render: (r: string | null, t) => (
        <span>
          {t.status === 'unfilled' ? <Tag color="gold">未成交</Tag> : null}
          <span className={t.status === 'unfilled' ? styles.dim : undefined}>{reasonText(r)}</span>
        </span>
      ),
    },
    { title: '入场价', dataIndex: 'entry_price', width: 100, render: fmtPrice },
    { title: '出场价', dataIndex: 'exit_price', width: 100, render: (v, t) => (t.status === 'closed' ? fmtPrice(v) : '—') },
    {
      title: '净盈亏',
      key: 'pnl',
      dataIndex: 'pnl',
      width: 100,
      align: 'right',
      sorter: true,
      sortOrder: sortOrderOf('pnl'),
      render: (v: number | null) => <span className={styles[pnlClass(v)]}>{fmtU(v, true)}</span>,
    },
    {
      title: '收益率',
      dataIndex: 'pnl_pct',
      width: 90,
      align: 'right',
      render: (v: number | null) => <span className={styles[pnlClass(v)]}>{fmtPct(v)}</span>,
    },
    {
      title: 'R',
      key: 'r_multiple',
      dataIndex: 'r_multiple',
      width: 80,
      align: 'right',
      sorter: true,
      sortOrder: sortOrderOf('r_multiple'),
      render: fmtR,
    },
    {
      title: 'MFE',
      key: 'mfe_pct',
      dataIndex: 'mfe_pct',
      width: 90,
      align: 'right',
      sorter: true,
      sortOrder: sortOrderOf('mfe_pct'),
      render: (v) => fmtPct(v),
    },
    {
      title: 'MAE',
      key: 'mae_pct',
      dataIndex: 'mae_pct',
      width: 90,
      align: 'right',
      sorter: true,
      sortOrder: sortOrderOf('mae_pct'),
      render: (v) => fmtPct(v),
    },
    { title: '持仓', dataIndex: 'bars_held', width: 80, align: 'right', render: (v) => (v !== null ? `${v} 根` : '—') },
  ];

  const groupColumns = (keyTitle: string, keyRender?: (k: string) => React.ReactNode): ColumnsType<BacktestGroupRow> => [
    { title: keyTitle, dataIndex: 'key', render: (k: string) => (keyRender ? keyRender(k) : k) },
    { title: '笔数', dataIndex: 'trades', width: 70, align: 'right' },
    { title: '胜率', dataIndex: 'win_rate', width: 80, align: 'right', render: (v) => fmtPct(v, false, 1) },
    {
      title: '合计',
      dataIndex: 'total_pnl',
      width: 90,
      align: 'right',
      render: (v: number) => <span className={styles[pnlClass(v)]}>{fmtU(v, true)}</span>,
    },
    {
      title: '平均',
      dataIndex: 'avg_pnl',
      width: 80,
      align: 'right',
      render: (v: number | null) => <span className={styles[pnlClass(v)]}>{fmtU(v, true)}</span>,
    },
  ];

  const s = stats?.summary;
  const axisColor = isDark ? '#6b7280' : '#94a3b8';
  const gridColor = isDark ? 'rgba(75,85,99,0.35)' : 'rgba(148,163,184,0.25)';
  const tooltipStyle = isDark ? { background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' } : undefined;

  const runLabel = (r: BacktestRun) =>
    `#${r.id} · ${r.strategy_name}${r.note ? ` · ${r.note}` : ''} · ${fmtTime(r.created_at, true)}${r.status !== 'done' ? ` · ${RUN_STATUS[r.status]?.label ?? r.status}` : ''}`;

  const paramDocs = Object.fromEntries((strategy?.param_docs ?? []).map((d) => [d.key, d.label]));

  return (
    <>
      {/* 选择回测运行 */}
      <div className={styles.statusBar}>
        <span className={styles.statusItem}>策略</span>
        <Select
          size="small"
          allowClear
          placeholder="全部策略"
          value={strategyId}
          onChange={setStrategyId}
          style={{ width: 240 }}
          options={strategies.map((st) => ({ value: st.id, label: `${st.name}（${st.timeframe}）` }))}
        />
        <span className={styles.statusItem}>回测</span>
        <Select
          size="small"
          value={runId ?? undefined}
          onChange={setRunId}
          loading={runsLoading}
          placeholder={runsError ?? '暂无回测'}
          style={{ minWidth: 320, flex: '1 1 320px', maxWidth: 560 }}
          options={runs.map((r) => ({ value: r.id, label: runLabel(r) }))}
        />
        <CoolRefreshButton onClick={loadRuns} loading={runsLoading} size="small" iconOnly />
        {run && (
          <span className={`${styles.statusRight} ${styles.dim}`}>
            <Tag color={RUN_STATUS[run.status]?.color}>{RUN_STATUS[run.status]?.label ?? run.status}</Tag>
            数据 {fmtTime(run.data_from, true).slice(0, 10)} ~ {fmtTime(run.data_to, true).slice(0, 10)} · {run.symbols_total ?? '—'} 个币 ·
            信号 {run.signal_count ?? '—'} · 成交 {run.trade_count ?? '—'}
          </span>
        )}
      </div>

      {runsError && !runs.length ? (
        <DataSection title="策略回测" error={runsError} />
      ) : !runsLoading && !runs.length ? (
        <DataSection title="策略回测" empty emptyText="还没有回测结果（由服务器脚本 run_strategy_backtest 生成）" />
      ) : (
        <>
          {/* 策略说明与参数 */}
          {run && (
            <Collapse
              size="small"
              className={styles.sectionCollapse}
              items={[
                {
                  key: 'params',
                  label: (
                    <span>
                      <b>{run.strategy_name}</b>
                      <span className={styles.dim}> · v{run.strategy_version} · {run.timeframe} · 参数与规则说明</span>
                    </span>
                  ),
                  children: (
                    <>
                      {strategy?.description && <p className={styles.description}>{strategy.description}</p>}
                      <div className={styles.paramGrid}>
                        {Object.entries(run.params ?? {}).map(([k, v]) => {
                          const changed = strategy && JSON.stringify(strategy.default_params?.[k]) !== JSON.stringify(v);
                          return (
                            <span key={k} className={styles.featureTag} title={k}>
                              <span className={styles.dim}>{paramDocs[k] ?? k}</span>{' '}
                              <span className={changed ? styles.changedParam : undefined}>{fmtParam(v)}</span>
                            </span>
                          );
                        })}
                      </div>
                      {Object.keys(exitReasons).length > 0 && (
                        <div className={styles.dim} style={{ marginTop: 8 }}>
                          出场原因：{Object.entries(exitReasons).map(([k, v]) => `${v}（${k}）`).join('、')}
                        </div>
                      )}
                    </>
                  ),
                },
              ]}
            />
          )}

          {/* 汇总 */}
          <div className={styles.sectionGap}>
            <DataSection
              title={`回测统计${statsSymbol ? ` · ${statsSymbol}` : ''}`}
              subtitle="只统计已成交平仓的交易 · 每笔 10U 保证金 × 10 倍，不设止损"
              loading={statsLoading && !stats}
              error={!stats ? statsError : null}
              empty={!!stats && !s?.trades}
              emptyText="没有已平仓的交易"
            >
              {s && (
                <div className={styles.metrics}>
                  <Metric label="交易数" value={s.trades} sub={`${s.wins} 胜 · ${s.symbols ?? '—'} 个币`} />
                  <Metric label="胜率" value={fmtPct(s.win_rate, false, 1)} />
                  <Metric label="总盈亏" value={`${fmtU(s.total_pnl, true)}U`} tone={styles[pnlClass(s.total_pnl)]} sub={`平均 ${fmtU(s.avg_pnl, true)}U / 笔`} />
                  <Metric label="平均盈 / 亏" value={<span><span className={styles.pos}>{fmtU(s.avg_win)}</span> / <span className={styles.neg}>{fmtU(s.avg_loss)}</span></span>} />
                  <Metric label="盈亏比 (PF)" value={fmtNum(s.profit_factor)} sub={s.avg_r !== null ? `平均 ${fmtR(s.avg_r)}` : undefined} />
                  <Metric
                    label="t 值"
                    value={fmtNum(s.t_stat)}
                    tone={s.t_stat !== null && s.t_stat > 2 ? styles.pos : undefined}
                    sub={s.t_stat !== null ? (s.t_stat > 2 ? '显著' : '不显著（需 > 2）') : undefined}
                    title="每笔盈亏均值的 t 值，> 2 才算显著"
                  />
                  <Metric label="最大回撤" value={`${fmtU(s.max_drawdown)}U`} tone={styles.neg} sub={`最大连亏 ${s.max_consecutive_losses ?? '—'} 笔`} />
                </div>
              )}
            </DataSection>
          </div>

          {stats && (s?.trades ?? 0) > 0 && (
            <div className={`${styles.chartRow} ${styles.sectionGap}`}>
              <div className={styles.panel}>
                <div className={styles.chartTitle}>按月盈亏（U，北京时间平仓月份）</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.by_month} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="key" tick={{ fontSize: 11 }} stroke={axisColor} />
                    <YAxis tick={{ fontSize: 11 }} stroke={axisColor} width={52} />
                    <ReferenceLine y={0} stroke={axisColor} strokeDasharray="4 4" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                      formatter={(v: number) => [`${fmtU(v, true)}U`, '合计']}
                      labelFormatter={(k: string) => {
                        const m = stats.by_month.find((x) => x.key === k);
                        return m ? `${k} · ${m.trades} 笔 · 胜率 ${fmtPct(m.win_rate, false, 1)}` : k;
                      }}
                    />
                    <Bar dataKey="total_pnl" maxBarSize={28}>
                      {stats.by_month.map((m) => (
                        <Cell key={m.key} fill={m.total_pnl >= 0 ? '#16a34a' : '#dc2626'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.panel}>
                <div className={styles.chartTitle}>按出场原因</div>
                <Table
                  rowKey="key"
                  size="small"
                  pagination={false}
                  columns={groupColumns('出场原因', (k) => reasonText(k))}
                  dataSource={stats.by_exit_reason}
                />
              </div>
            </div>
          )}

          {stats?.by_symbol && stats.by_symbol.length > 0 && (
            <Collapse
              size="small"
              className={`${styles.sectionCollapse} ${styles.sectionGap}`}
              items={[
                {
                  key: 'symbols',
                  label: <span><b>按币种</b><span className={styles.dim}> · {stats.by_symbol.length} 个币，按合计盈亏排序，点币种筛选下方交易</span></span>,
                  children: (
                    <Table
                      rowKey="key"
                      size="small"
                      columns={groupColumns('币种', (k) => <a onClick={() => setSymbol(k)}>{k}</a>)}
                      dataSource={stats.by_symbol}
                      pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
                    />
                  ),
                },
              ]}
            />
          )}

          {/* 交易列表 */}
          <div className={styles.sectionGap}>
            <DataSection
              title="回测交易"
              subtitle={`共 ${total} 笔 · 点击行看K线和形态标注`}
              error={tradesError}
              headerActions={
                <div className={styles.filters}>
                  <Select
                    size="small"
                    mode="multiple"
                    allowClear
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder="全部（含未成交）"
                    style={{ minWidth: 150 }}
                    options={[
                      { value: 'closed', label: '已平仓' },
                      { value: 'unfilled', label: '未成交' },
                    ]}
                  />
                  <Select
                    size="small"
                    mode="multiple"
                    allowClear
                    value={exitFilter}
                    onChange={setExitFilter}
                    placeholder="全部出场原因"
                    style={{ minWidth: 160 }}
                    maxTagCount="responsive"
                    options={Object.entries(exitReasons).map(([k, v]) => ({ value: k, label: v }))}
                  />
                  <Segmented
                    size="small"
                    value={result}
                    onChange={(v) => setResult(v as typeof result)}
                    options={[
                      { label: '全部', value: 'all' },
                      { label: '盈利', value: 'win' },
                      { label: '亏损', value: 'loss' },
                    ]}
                  />
                  <Input.Search
                    size="small"
                    allowClear
                    placeholder="币种"
                    value={symbolInput}
                    onChange={(e) => {
                      setSymbolInput(e.target.value);
                      if (!e.target.value) setSymbolState('');
                    }}
                    onSearch={setSymbol}
                    style={{ width: 150 }}
                  />
                </div>
              }
            >
              <Table
                rowKey="id"
                size="small"
                loading={tradesLoading}
                columns={columns}
                dataSource={trades}
                scroll={{ x: 1250 }}
                onChange={onTableChange}
                onRow={(t) => ({ onClick: () => setDetailId(t.id), className: styles.clickRow })}
                locale={{ emptyText: '没有符合条件的交易' }}
                pagination={{
                  current: page,
                  pageSize: PAGE_SIZE,
                  total,
                  showSizeChanger: false,
                  hideOnSinglePage: true,
                }}
              />
            </DataSection>
          </div>
        </>
      )}

      <BacktestTradeModal
        tradeId={detailId}
        filters={filters}
        exitReasons={exitReasons}
        strategyName={run?.strategy_name}
        isDark={isDark}
        onNavigate={setDetailId}
        onClose={() => setDetailId(null)}
      />
    </>
  );
};

export default StrategyBacktestPanel;
