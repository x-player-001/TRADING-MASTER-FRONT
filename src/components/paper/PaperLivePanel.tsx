import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Input, Select, Table, Tag, Tooltip as AntTooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { TopProgressBar, DataSection, CoolRefreshButton } from '../ui';
import PaperTradeModal from './PaperTradeModal';
import PnlCharts from './PnlCharts';
import styles from './Paper.module.scss';
import {
  fmtPrice,
  fmtU,
  fmtR,
  fmtRate,
  fmtNum,
  fmtTime,
  fmtMinutes,
  pnlClass,
  statusColor,
} from './paperFormat';
import {
  paperTradingAPI,
  PaperDailyPoint,
  PaperEquityPoint,
  PaperPhase,
  PaperRuntimeStatus,
  PaperStats,
  PaperSummary,
  PaperTrade,
  PaperTradeStatus,
  PAPER_STATUS_LABELS,
  PAPER_EXIT_REASON_LABELS,
  PAPER_CANCEL_REASON_LABELS,
} from '../../services/paperTradingAPI';

interface PaperLivePanelProps {
  isDark: boolean;
}

const STATUS_POLL_MS = 30_000;
const DATA_POLL_MS = 60_000;
const PAGE_SIZE = 50;
const ALL = 'all';

const PHASE_META: Record<PaperPhase, { label: string; cls: string }> = {
  running: { label: '运行中', cls: styles.phaseGreen },
  starting: { label: '启动预热中', cls: styles.phaseYellow },
  reconnecting: { label: '行情重连中', cls: styles.phaseYellow },
  lagging: { label: '数据滞后', cls: styles.phaseRed },
  offline: { label: '离线', cls: styles.phaseRed },
};

const STATUS_OPTIONS = (Object.keys(PAPER_STATUS_LABELS) as PaperTradeStatus[]).map((s) => ({
  value: s,
  label: PAPER_STATUS_LABELS[s],
}));

const Metric: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }> = ({ label, value, sub, tone }) => (
  <div className={styles.metric}>
    <span className={styles.metricLabel}>{label}</span>
    <span className={`${styles.metricValue} ${tone ?? ''}`}>{value}</span>
    {sub !== undefined && <span className={styles.metricSub}>{sub}</span>}
  </div>
);

const exitBreakdown = (s: PaperStats) =>
  Object.entries(s.by_exit_reason ?? {})
    .map(([k, n]) => `${PAPER_EXIT_REASON_LABELS[k] ?? k} ${n}`)
    .join(' · ');

// 实时模拟盘：运行状态、总览、持仓挂单、资金曲线、交易记录
const PaperLivePanel: React.FC<PaperLivePanelProps> = ({ isDark }) => {
  // ── 运行状态 ──
  const [status, setStatus] = useState<PaperRuntimeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // ── 总览 ──
  const [summary, setSummary] = useState<PaperSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ── 策略筛选（曲线 / 每日 / 交易列表共用） ──
  const [strategyId, setStrategyId] = useState<string>(ALL);
  const sid = strategyId === ALL ? undefined : strategyId;

  // ── 曲线 ──
  const [equity, setEquity] = useState<PaperEquityPoint[]>([]);
  const [daily, setDaily] = useState<PaperDailyPoint[]>([]);
  const [days, setDays] = useState(90);

  // ── 交易列表 ──
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [tradesTotal, setTradesTotal] = useState(0);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaperTradeStatus[]>([]);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<PaperTrade | null>(null);

  const strategyNames = useMemo(
    () => Object.fromEntries((summary?.strategies ?? []).map((s) => [s.strategy_id, s.name])),
    [summary]
  );

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await paperTradingAPI.getStatus());
      setStatusError(null);
    } catch (err) {
      setStatusError((err as Error).message || '状态获取失败');
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      setSummary(await paperTradingAPI.getSummary());
      setSummaryError(null);
    } catch (err) {
      setSummaryError((err as Error).message || '加载总览失败');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadCurves = useCallback(async () => {
    const [eq, dl] = await Promise.all([
      paperTradingAPI.getEquity({ strategy_id: sid }).catch(() => []),
      paperTradingAPI.getDaily({ strategy_id: sid, days }).catch(() => []),
    ]);
    setEquity(eq);
    setDaily(dl);
  }, [sid, days]);

  const loadTrades = useCallback(async () => {
    setTradesLoading(true);
    try {
      const res = await paperTradingAPI.getTrades({
        status: statusFilter,
        strategy_id: sid,
        symbol: symbolFilter.trim().toUpperCase() || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setTrades(res.data);
      setTradesTotal(res.total);
      setTradesError(null);
    } catch (err) {
      setTradesError((err as Error).message || '加载交易失败');
    } finally {
      setTradesLoading(false);
    }
  }, [statusFilter, sid, symbolFilter, page]);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [loadStatus]);

  useEffect(() => {
    loadSummary();
    const timer = setInterval(loadSummary, DATA_POLL_MS);
    return () => clearInterval(timer);
  }, [loadSummary]);

  useEffect(() => {
    loadCurves();
    const timer = setInterval(loadCurves, DATA_POLL_MS);
    return () => clearInterval(timer);
  }, [loadCurves]);

  useEffect(() => {
    loadTrades();
    const timer = setInterval(loadTrades, DATA_POLL_MS);
    return () => clearInterval(timer);
  }, [loadTrades]);

  // 筛选变了回到第一页
  useEffect(() => { setPage(1); }, [statusFilter, sid, symbolFilter]);

  const refreshAll = () => {
    loadStatus();
    loadSummary();
    loadCurves();
    loadTrades();
  };

  // ── 状态条 ──
  const phase = status ? PHASE_META[status.phase] ?? PHASE_META.offline : null;
  const rt = status?.status;
  const statusBar = (
    <div className={styles.statusBar}>
      {phase ? (
        <span className={`${styles.phase} ${phase.cls}`}>
          <span className={styles.dot} />
          {phase.label}
        </span>
      ) : (
        <span className={styles.dim}>{statusError ?? '获取运行状态…'}</span>
      )}
      {status && (
        <>
          <AntTooltip title="当前时间 − 最新已处理 5m K线收盘时间，正常 0~5 分钟">
            <span className={styles.statusItem}>
              数据延迟
              <b className={status.data_lag_minutes !== null && status.data_lag_minutes > 15 ? styles.neg : undefined}>
                {fmtMinutes(status.data_lag_minutes)}
              </b>
            </span>
          </AntTooltip>
          {rt && (
            <>
              <span className={styles.statusItem}>行情 <b>{rt.ws_connected ? '已连接' : '断开'}</b></span>
              <span className={styles.statusItem}>监控 <b>{rt.symbols}</b> 个币</span>
              <span className={styles.statusItem}>挂单 <b>{rt.pending}</b></span>
              <span className={styles.statusItem}>持仓 <b>{rt.open_positions}</b></span>
              <span className={styles.statusItem}>最新K线 <b>{fmtTime(rt.last_bar_time)}</b></span>
            </>
          )}
          <span className={`${styles.statusItem} ${styles.dim}`}>已运行 {fmtMinutes(status.uptime_minutes)}</span>
        </>
      )}
      <span className={`${styles.statusRight} ${styles.dim}`}>交易由服务器按实时行情自动产生，本页只读</span>
      <CoolRefreshButton onClick={refreshAll} loading={summaryLoading} size="small" iconOnly />
    </div>
  );

  // ── 总览指标 ──
  const total = summary?.total;
  const selectedStats = sid ? summary?.strategies.find((s) => s.strategy_id === sid)?.stats : total;

  // ── 表格列 ──
  const baseColumns: ColumnsType<PaperTrade> = [
    {
      title: '币种',
      dataIndex: 'symbol',
      width: 130,
      fixed: 'left',
      render: (s: string, t) => (
        <span>
          <span className={styles.symbol}>{s}</span>{' '}
          <Tag color={t.side === 'short' ? 'red' : 'green'} style={{ marginInlineEnd: 0 }}>{t.side === 'short' ? '空' : '多'}</Tag>
        </span>
      ),
    },
    {
      title: '策略',
      dataIndex: 'strategy_id',
      width: 170,
      render: (id: string) => <span>{strategyNames[id] ?? id}</span>,
    },
  ];

  const positionColumns: ColumnsType<PaperTrade> = [
    ...baseColumns,
    { title: '成交时间', dataIndex: 'fill_time', width: 110, render: (v) => fmtTime(v) },
    { title: '成交价', dataIndex: 'fill_price', width: 100, render: fmtPrice },
    { title: '最新价', dataIndex: 'last_price', width: 100, render: fmtPrice },
    { title: '止损', dataIndex: 'stop_price', width: 100, render: fmtPrice },
    { title: '止盈', dataIndex: 'take_profit', width: 100, render: fmtPrice },
    {
      title: '浮动盈亏',
      dataIndex: 'unrealized_pnl',
      width: 140,
      render: (v: number | null, t) => (
        <span className={styles[pnlClass(v)]}>{fmtU(v, true)}U · {fmtR(t.unrealized_r)}</span>
      ),
    },
    { title: '到期平仓', dataIndex: 'max_hold_until', width: 110, render: (v) => fmtTime(v) },
  ];

  const pendingColumns: ColumnsType<PaperTrade> = [
    ...baseColumns,
    { title: '挂单时间', dataIndex: 'signal_time', width: 110, render: (v) => fmtTime(v) },
    { title: '触发价', dataIndex: 'entry_trigger', width: 100, render: fmtPrice },
    { title: '新高（撤单线）', dataIndex: 'base_stop', width: 120, render: fmtPrice },
    { title: '失效时间', dataIndex: 'expire_at', width: 110, render: (v) => fmtTime(v) },
  ];

  const tradeColumns: ColumnsType<PaperTrade> = [
    ...baseColumns,
    { title: '周期', dataIndex: 'timeframe', width: 60 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 150,
      render: (s: PaperTradeStatus, t) => {
        const reason =
          s === 'closed'
            ? PAPER_EXIT_REASON_LABELS[t.exit_reason ?? ''] ?? t.exit_reason
            : t.cancel_reason
              ? PAPER_CANCEL_REASON_LABELS[t.cancel_reason] ?? t.cancel_reason
              : null;
        return (
          <span>
            <Tag color={statusColor(s)}>{PAPER_STATUS_LABELS[s] ?? s}</Tag>
            {reason && <span className={styles.dim}>{reason}</span>}
          </span>
        );
      },
    },
    { title: '挂单时间', dataIndex: 'signal_time', width: 110, render: (v) => fmtTime(v) },
    { title: '触发价', dataIndex: 'entry_trigger', width: 100, render: fmtPrice },
    { title: '成交价', dataIndex: 'fill_price', width: 100, render: fmtPrice },
    { title: '平仓价', dataIndex: 'exit_price', width: 100, render: fmtPrice },
    { title: '平仓时间', dataIndex: 'exit_time', width: 110, render: (v) => fmtTime(v) },
    {
      title: '净盈亏',
      dataIndex: 'pnl',
      width: 90,
      align: 'right',
      render: (v: number | null, t) => {
        const val = t.status === 'open' ? t.unrealized_pnl : v;
        return <span className={styles[pnlClass(val)]}>{fmtU(val, true)}</span>;
      },
    },
    {
      title: 'R',
      dataIndex: 'r_multiple',
      width: 80,
      align: 'right',
      render: (v: number | null, t) => {
        const val = t.status === 'open' ? t.unrealized_r : v;
        return <span className={styles[pnlClass(val)]}>{fmtR(val)}</span>;
      },
    },
    {
      title: 'MFE / MAE',
      width: 120,
      render: (_, t) => (t.mfe_r !== null || t.mae_r !== null ? `${fmtR(t.mfe_r)} / ${fmtR(t.mae_r)}` : '—'),
    },
  ];

  const rowProps = (t: PaperTrade) => ({ onClick: () => setDetail(t), className: styles.clickRow });


  return (
    <>
      <TopProgressBar isVisible={summaryLoading || tradesLoading} progress={70} absolute />

      {statusBar}

      {/* 总览 */}
      <DataSection
        title={sid ? `总览 · ${strategyNames[sid] ?? sid}` : '总览 · 全部策略'}
        subtitle={summary ? `每笔固定风险 ${summary.account.risk_per_trade_usdt}U · 手续费单边 ${(summary.account.fee_rate * 100).toFixed(2)}%` : undefined}
        loading={summaryLoading && !summary}
        error={!summary ? summaryError : null}
      >
        {selectedStats && (
          <div className={styles.metrics}>
            <Metric label="已平仓" value={selectedStats.closed} sub={`${selectedStats.wins} 胜 / ${selectedStats.losses} 负`} />
            <Metric label="胜率" value={fmtRate(selectedStats.win_rate)} sub={exitBreakdown(selectedStats) || '—'} />
            <Metric
              label="累计净盈亏"
              value={`${fmtU(selectedStats.total_pnl, true)}U`}
              tone={styles[pnlClass(selectedStats.total_pnl)]}
              sub={`手续费 ${fmtU(selectedStats.total_fees)}U`}
            />
            <Metric label="累计 R" value={fmtR(selectedStats.total_r)} tone={styles[pnlClass(selectedStats.total_r)]} sub={`平均 ${fmtR(selectedStats.avg_r)}`} />
            <Metric label="盈亏比 (PF)" value={fmtNum(selectedStats.profit_factor)} sub={`最好 ${fmtR(selectedStats.best_r)} · 最差 ${fmtR(selectedStats.worst_r)}`} />
            <Metric label="最大回撤" value={`${fmtU(selectedStats.max_drawdown)}U`} tone={selectedStats.max_drawdown > 0 ? styles.neg : undefined} />
            {!sid && summary && (
              <Metric
                label="浮动盈亏"
                value={`${fmtU(summary.unrealized_pnl, true)}U`}
                tone={styles[pnlClass(summary.unrealized_pnl)]}
                sub={`${summary.open_positions.length} 持仓 · ${summary.pending_orders.length} 挂单`}
              />
            )}
          </div>
        )}
      </DataSection>

      {/* 策略卡片：点击切换下面的曲线和交易列表 */}
      {summary && summary.strategies.length > 0 && (
        <div className={`${styles.strategyGrid} ${styles.sectionGap}`}>
          {summary.strategies.map((s) => {
            const active = s.strategy_id === sid;
            const c = s.status_counts;
            return (
              <button
                key={s.strategy_id}
                type="button"
                className={`${styles.strategyCard} ${active ? styles.strategyActive : ''}`}
                onClick={() => setStrategyId(active ? ALL : s.strategy_id)}
                aria-pressed={active}
                title={active ? '再次点击取消筛选' : '只看该策略的曲线和交易'}
              >
                <span className={styles.strategyHead}>
                  <span>{s.name}</span>
                  {!s.enabled && <Tag>已停用</Tag>}
                </span>
                <span className={styles.strategyStats}>
                  <span className={styles.statCell}><span className={styles.dim}>笔数</span>{s.stats.closed}</span>
                  <span className={styles.statCell}><span className={styles.dim}>胜率</span>{fmtRate(s.stats.win_rate)}</span>
                  <span className={styles.statCell}>
                    <span className={styles.dim}>累计</span>
                    <span className={styles[pnlClass(s.stats.total_pnl)]}>{fmtU(s.stats.total_pnl, true)}</span>
                  </span>
                  <span className={styles.statCell}>
                    <span className={styles.dim}>平均 R</span>
                    <span className={styles[pnlClass(s.stats.avg_r)]}>{fmtR(s.stats.avg_r)}</span>
                  </span>
                  <span className={styles.statCell}><span className={styles.dim}>回撤</span>{fmtU(s.stats.max_drawdown)}</span>
                  <span className={styles.statCell}><span className={styles.dim}>PF</span>{fmtNum(s.stats.profit_factor)}</span>
                </span>
                <span className={styles.counts}>
                  <span>持仓 {c.open ?? 0}</span>
                  <span>挂单 {c.pending ?? 0}</span>
                  <span>撤单 {c.cancelled ?? 0}</span>
                  <span>过期 {c.expired ?? 0}</span>
                  <span>跳过 {c.skipped ?? 0}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 当前持仓 / 挂单（全部策略） */}
      <div className={styles.sectionGap}>
        <DataSection
          title="当前持仓"
          subtitle={summary ? `${summary.open_positions.length} 笔 · 点击行看K线` : undefined}
          empty={!!summary && summary.open_positions.length === 0}
          emptyText="暂无持仓"
          compact
        >
          <Table
            rowKey="id"
            size="small"
            columns={positionColumns}
            dataSource={summary?.open_positions ?? []}
            pagination={false}
            scroll={{ x: 1000 }}
            onRow={rowProps}
          />
        </DataSection>
      </div>
      <div className={styles.sectionGap}>
        <DataSection
          title="挂单中"
          subtitle={summary ? `${summary.pending_orders.length} 笔 · 价格跌破触发价成交，先破新高则撤单` : undefined}
          empty={!!summary && summary.pending_orders.length === 0}
          emptyText="暂无挂单"
          compact
        >
          <Table
            rowKey="id"
            size="small"
            columns={pendingColumns}
            dataSource={summary?.pending_orders ?? []}
            pagination={false}
            scroll={{ x: 800 }}
            onRow={rowProps}
          />
        </DataSection>
      </div>

      {/* 资金曲线 / 每日盈亏 */}
      <PnlCharts isDark={isDark} equity={equity} daily={daily} days={days} onDaysChange={setDays} />

      {/* 交易列表 */}
      <div className={styles.sectionGap}>
        <DataSection
          title="交易记录"
          subtitle={`共 ${tradesTotal} 笔 · 点击行看K线`}
          error={tradesError}
          headerActions={
            <div className={styles.filters}>
              <Select
                size="small"
                value={strategyId}
                onChange={setStrategyId}
                style={{ width: 200 }}
                options={[
                  { value: ALL, label: '全部策略' },
                  ...(summary?.strategies ?? []).map((s) => ({ value: s.strategy_id, label: s.name })),
                ]}
              />
              <Select
                size="small"
                mode="multiple"
                allowClear
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
                placeholder="全部状态"
                style={{ minWidth: 160 }}
                maxTagCount="responsive"
              />
              <Input.Search
                size="small"
                allowClear
                placeholder="币种，如 ARKUSDT"
                onSearch={setSymbolFilter}
                style={{ width: 170 }}
              />
            </div>
          }
        >
          <Table
            rowKey="id"
            size="small"
            loading={tradesLoading && trades.length === 0}
            columns={tradeColumns}
            dataSource={trades}
            scroll={{ x: 1500 }}
            onRow={rowProps}
            locale={{ emptyText: '暂无交易' }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: tradesTotal,
              showSizeChanger: false,
              hideOnSinglePage: true,
              onChange: setPage,
            }}
          />
        </DataSection>
      </div>

      <PaperTradeModal
        trade={detail}
        strategyName={detail ? strategyNames[detail.strategy_id] : undefined}
        isDark={isDark}
        onClose={() => setDetail(null)}
      />
    </>
  );
};

export default PaperLivePanel;
