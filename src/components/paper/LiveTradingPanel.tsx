import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Input, Select, Table, Tag, Tooltip as AntTooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { TopProgressBar, DataSection, CoolRefreshButton } from '../ui';
import LiveTradeModal from './LiveTradeModal';
import PnlCharts from './PnlCharts';
import styles from './Paper.module.scss';
import { fmtPrice, fmtU, fmtR, fmtRate, fmtNum, fmtTime, fmtMinutes, pnlClass } from './paperFormat';
import { liveStatusColor } from './liveFormat';
import type { PaperDailyPoint, PaperEquityPoint } from '../../services/paperTradingAPI';
import {
  liveTradingAPI,
  LivePhase,
  LiveRuntimeStatus,
  LiveStats,
  LiveSummary,
  LiveTrade,
  LiveTradeStatus,
  LIVE_STATUS_LABELS,
  LIVE_EXIT_REASON_LABELS,
  liveReasonLabel,
} from '../../services/liveTradingAPI';

interface LiveTradingPanelProps {
  isDark: boolean;
}

const STATUS_POLL_MS = 30_000;
const DATA_POLL_MS = 60_000;
const PAGE_SIZE = 50;
const ALL = 'all';

const PHASE_META: Record<LivePhase, { label: string; cls: string }> = {
  running: { label: '运行中', cls: styles.phaseGreen },
  starting: { label: '启动中', cls: styles.phaseYellow },
  reconnecting: { label: '行情重连中', cls: styles.phaseYellow },
  lagging: { label: 'K线延迟', cls: styles.phaseRed },
  offline: { label: '离线', cls: styles.phaseRed },
};

const CONTROL_META: Record<string, { label: string; cls?: string }> = {
  running: { label: '正常开仓' },
  paused: { label: '已暂停开仓', cls: styles.phaseYellow },
  flatten: { label: '一键平仓中', cls: styles.phaseRed },
};

const STATUS_OPTIONS = (Object.keys(LIVE_STATUS_LABELS) as LiveTradeStatus[]).map((s) => ({
  value: s,
  label: LIVE_STATUS_LABELS[s],
}));

const Metric: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }> = ({ label, value, sub, tone }) => (
  <div className={styles.metric}>
    <span className={styles.metricLabel}>{label}</span>
    <span className={`${styles.metricValue} ${tone ?? ''}`}>{value}</span>
    {sub !== undefined && <span className={styles.metricSub}>{sub}</span>}
  </div>
);

const exitBreakdown = (s: LiveStats) =>
  Object.entries(s.by_exit_reason ?? {})
    .map(([k, n]) => `${LIVE_EXIT_REASON_LABELS[k] ?? k} ${n}`)
    .join(' · ');

const reasonEntries = (r: Record<string, number> | undefined) =>
  Object.entries(r ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

// 实盘：币安真实下单，接口只读（暂停 / 平仓只能在服务器上操作）
const LiveTradingPanel: React.FC<LiveTradingPanelProps> = ({ isDark }) => {
  const [status, setStatus] = useState<LiveRuntimeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [strategyId, setStrategyId] = useState<string>(ALL);
  const sid = strategyId === ALL ? undefined : strategyId;

  const [equity, setEquity] = useState<PaperEquityPoint[]>([]);
  const [daily, setDaily] = useState<PaperDailyPoint[]>([]);
  const [days, setDays] = useState(90);

  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [tradesTotal, setTradesTotal] = useState(0);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LiveTradeStatus[]>([]);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<LiveTrade | null>(null);

  const strategyNames = useMemo(
    () => Object.fromEntries((summary?.strategies ?? []).map((s) => [s.strategy_id, s.name])),
    [summary]
  );

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await liveTradingAPI.getStatus());
      setStatusError(null);
    } catch (err) {
      setStatusError((err as Error).message || '状态获取失败');
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      setSummary(await liveTradingAPI.getSummary());
      setSummaryError(null);
    } catch (err) {
      setSummaryError((err as Error).message || '加载总览失败');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadCurves = useCallback(async () => {
    const [eq, dl] = await Promise.all([
      liveTradingAPI.getEquity({ strategy_id: sid }).catch(() => []),
      liveTradingAPI.getDaily({ strategy_id: sid, days }).catch(() => []),
    ]);
    setEquity(eq);
    setDaily(dl);
  }, [sid, days]);

  const loadTrades = useCallback(async () => {
    setTradesLoading(true);
    try {
      const res = await liveTradingAPI.getTrades({
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
  const mode = status?.mode ?? rt?.mode;
  const control = CONTROL_META[status?.control ?? rt?.control ?? ''];
  const todayPnl = status?.today_pnl ?? null;
  const lossLimit = status?.daily_loss_limit ?? null;
  const nearLimit = todayPnl !== null && lossLimit ? todayPnl <= -lossLimit * 0.7 : false;

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
      {mode && (
        <AntTooltip title={mode === 'live' ? '真实下单' : '影子模式：只记录计划，不真实下单'}>
          <span className={`${styles.modeBadge} ${mode === 'live' ? styles.modeLive : styles.modeShadow}`}>
            {mode === 'live' ? '实盘' : '影子'}
          </span>
        </AntTooltip>
      )}
      {control && <span className={`${styles.statusItem} ${control.cls ?? ''}`}><b>{control.label}</b></span>}
      {status && (
        <>
          <AntTooltip title="当前时间 − 最新已处理 5m K线收盘时间">
            <span className={styles.statusItem}>
              数据延迟
              <b className={status.data_lag_minutes !== null && status.data_lag_minutes > 15 ? styles.neg : undefined}>
                {fmtMinutes(status.data_lag_minutes)}
              </b>
            </span>
          </AntTooltip>
          {rt && (
            <>
              <span className={styles.statusItem}>
                行情 <b className={rt.market_ws ? undefined : styles.neg}>{rt.market_ws ? '✓' : '断开'}</b>
                账户 <b className={rt.user_ws ? undefined : styles.neg}>{rt.user_ws ? '✓' : '断开'}</b>
              </span>
              <span className={styles.statusItem}>余额 <b>{fmtU(rt.balance)}</b> / 可用 <b>{fmtU(rt.available)}</b></span>
              <span className={styles.statusItem}>进行中 <b>{rt.active_trades}</b></span>
              {rt.error_trades > 0 && <span className={`${styles.statusItem} ${styles.neg}`}>待处理 <b>{rt.error_trades}</b></span>}
            </>
          )}
          <AntTooltip title="北京时间今日已平仓净盈亏 / 当日亏损上限，达到上限后当天不再开仓">
            <span className={styles.statusItem}>
              今日
              <b className={nearLimit ? styles.neg : styles[pnlClass(todayPnl)]}>{fmtU(todayPnl, true)}</b>
              {lossLimit ? <span className={styles.dim}>/ -{lossLimit}</span> : null}
            </span>
          </AntTooltip>
          <span className={`${styles.statusItem} ${styles.dim}`}>已运行 {fmtMinutes(status.uptime_minutes)}</span>
        </>
      )}
      <span className={`${styles.statusRight} ${styles.dim}`}>只读 · 暂停 / 平仓请在服务器执行</span>
      <CoolRefreshButton onClick={refreshAll} loading={summaryLoading} size="small" iconOnly />
    </div>
  );

  // ── 总览 ──
  const group = sid ? summary?.strategies.find((s) => s.strategy_id === sid) : summary?.total;
  const st = group?.stats;
  const cfg = summary?.config;
  const cancelReasons = reasonEntries(group?.cancel_reasons);
  const skipReasons = reasonEntries(group?.skip_reasons);

  // ── 表格列 ──
  const baseColumns: ColumnsType<LiveTrade> = [
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
    { title: '策略', dataIndex: 'strategy_id', width: 150, render: (id: string) => strategyNames[id] ?? id },
  ];

  const statusColumn: ColumnsType<LiveTrade>[number] = {
    title: '状态',
    dataIndex: 'status',
    width: 180,
    render: (s: LiveTradeStatus, t) => {
      const reason =
        s === 'closed'
          ? LIVE_EXIT_REASON_LABELS[t.exit_reason ?? ''] ?? t.exit_reason
          : s === 'error'
            ? t.error_msg
            : liveReasonLabel(t.cancel_reason);
      return (
        <span>
          <Tag color={liveStatusColor(s)}>{LIVE_STATUS_LABELS[s] ?? s}</Tag>
          {reason && <span className={s === 'error' ? styles.neg : styles.dim}>{reason}</span>}
        </span>
      );
    },
  };

  const positionColumns: ColumnsType<LiveTrade> = [
    ...baseColumns,
    { title: '成交时间', dataIndex: 'fill_time', width: 110, render: (v) => fmtTime(v) },
    { title: '成交价', dataIndex: 'fill_price', width: 100, render: fmtPrice },
    { title: '最新价', dataIndex: 'last_price', width: 100, render: fmtPrice },
    { title: '止损', dataIndex: 'stop_price', width: 100, render: fmtPrice },
    { title: '止盈', dataIndex: 'take_profit', width: 100, render: fmtPrice },
    { title: '数量', dataIndex: 'filled_qty', width: 90 },
    {
      title: '浮动盈亏',
      dataIndex: 'unrealized_pnl',
      width: 140,
      render: (v: number | null, t) => <span className={styles[pnlClass(v)]}>{fmtU(v, true)}U · {fmtR(t.unrealized_r)}</span>,
    },
    { title: '到期平仓', dataIndex: 'max_hold_until', width: 110, render: (v) => fmtTime(v) },
  ];

  const activeColumns: ColumnsType<LiveTrade> = [
    ...baseColumns,
    statusColumn,
    { title: '挂单时间', dataIndex: 'signal_time', width: 110, render: (v) => fmtTime(v) },
    { title: '触发价', dataIndex: 'entry_trigger', width: 100, render: fmtPrice },
    { title: 'IOC 限价', dataIndex: 'entry_limit', width: 100, render: fmtPrice },
    { title: '新高（撤单线）', dataIndex: 'base_stop', width: 120, render: fmtPrice },
    { title: '计划数量', dataIndex: 'planned_qty', width: 90 },
    { title: '失效时间', dataIndex: 'expire_at', width: 110, render: (v) => fmtTime(v) },
  ];

  const tradeColumns: ColumnsType<LiveTrade> = [
    ...baseColumns,
    { title: '周期', dataIndex: 'timeframe', width: 60 },
    statusColumn,
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
    { title: '手续费', dataIndex: 'fees', width: 80, align: 'right', render: (v) => fmtU(v) },
    { title: '资金费', dataIndex: 'funding', width: 80, align: 'right', render: (v) => fmtU(v, true) },
  ];

  const rowProps = (t: LiveTrade) => ({ onClick: () => setDetail(t), className: styles.clickRow });

  return (
    <>
      <TopProgressBar isVisible={summaryLoading || tradesLoading} progress={70} absolute />

      {statusBar}

      {/* 待人工处理：程序无法自动处理，期间不开新仓 */}
      {summary && summary.error_trades.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${summary.error_trades.length} 笔交易需要人工处理，处理前不会开新仓`}
          description={
            <div className={styles.reasonList}>
              {summary.error_trades.map((t) => (
                <a key={t.id} onClick={() => setDetail(t)}>
                  #{t.id} {t.symbol} {t.error_msg ? `· ${t.error_msg}` : ''}
                </a>
              ))}
            </div>
          }
        />
      )}

      <DataSection
        title={sid ? `总览 · ${strategyNames[sid] ?? sid}` : '总览 · 全部策略'}
        subtitle={
          cfg
            ? `每笔风险 ${cfg.risk_per_trade_usdt}U · 名义上限 ${cfg.max_notional_usdt}U · 杠杆 ≤${cfg.max_leverage}x · 同时 ≤${cfg.max_active_trades} 笔 · 日亏上限 ${cfg.daily_loss_limit_usdt}U`
            : undefined
        }
        loading={summaryLoading && !summary}
        error={!summary ? summaryError : null}
      >
        {st && (
          <div className={styles.metrics}>
            <Metric label="已平仓" value={st.closed} sub={`${st.wins} 胜 / ${st.losses} 负`} />
            <Metric label="胜率" value={fmtRate(st.win_rate)} sub={exitBreakdown(st) || '—'} />
            <Metric
              label="累计净盈亏"
              value={`${fmtU(st.total_pnl, true)}U`}
              tone={styles[pnlClass(st.total_pnl)]}
              sub={`手续费 ${fmtU(st.total_fees)}U${!sid && summary ? ` · 资金费 ${fmtU(summary.total.total_funding, true)}U` : ''}`}
            />
            <Metric label="累计 R" value={fmtR(st.total_r)} tone={styles[pnlClass(st.total_r)]} sub={`平均 ${fmtR(st.avg_r)}`} />
            <Metric label="盈亏比 (PF)" value={fmtNum(st.profit_factor)} sub={`最好 ${fmtR(st.best_r)} · 最差 ${fmtR(st.worst_r)}`} />
            <Metric label="最大回撤" value={`${fmtU(st.max_drawdown)}U`} tone={st.max_drawdown > 0 ? styles.neg : undefined} />
            {!sid && summary && (
              <Metric
                label="浮动盈亏"
                value={`${fmtU(summary.unrealized_pnl, true)}U`}
                tone={styles[pnlClass(summary.unrealized_pnl)]}
                sub={`${summary.open_positions.length} 持仓 · ${summary.pending_orders.length} 进行中`}
              />
            )}
          </div>
        )}
        {(cancelReasons.length > 0 || skipReasons.length > 0) && (
          <div className={styles.sectionGap}>
            {cancelReasons.length > 0 && (
              <div className={styles.reasonList}>
                <span className={styles.dim}>撤单原因：</span>
                {cancelReasons.map(([k, n]) => <span key={k}>{liveReasonLabel(k)} <b>{n}</b></span>)}
              </div>
            )}
            {skipReasons.length > 0 && (
              <div className={styles.reasonList} style={{ marginTop: 4 }}>
                <span className={styles.dim}>跳过原因：</span>
                {skipReasons.map(([k, n]) => <span key={k}>{liveReasonLabel(k)} <b>{n}</b></span>)}
              </div>
            )}
          </div>
        )}
      </DataSection>

      {/* 策略卡片：点击切换曲线和交易列表 */}
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
                title={active ? '再次点击取消筛选' : '只看该策略的统计、曲线和交易'}
              >
                <span className={styles.strategyHead}>
                  <span>{s.name}</span>
                  <Tag style={{ marginInlineEnd: 0 }}>{s.timeframe}</Tag>
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
                  <span>跳过 {c.skipped ?? 0}</span>
                  {(c.error ?? 0) > 0 && <span className={styles.neg}>异常 {c.error}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.sectionGap}>
        <DataSection
          title="当前持仓"
          subtitle={summary ? `${summary.open_positions.length} 笔 · 止损止盈都挂在交易所 · 点击行看K线` : undefined}
          empty={!!summary && summary.open_positions.length === 0}
          emptyText="暂无持仓"
          compact
        >
          <Table rowKey="id" size="small" columns={positionColumns} dataSource={summary?.open_positions ?? []} pagination={false} scroll={{ x: 1100 }} onRow={rowProps} />
        </DataSection>
      </div>
      <div className={styles.sectionGap}>
        <DataSection
          title="进行中订单"
          subtitle={summary ? `${summary.pending_orders.length} 笔 · 下单中 / 挂单中 / 挂保护单 / 平仓中` : undefined}
          empty={!!summary && summary.pending_orders.length === 0}
          emptyText="暂无进行中的订单"
          compact
        >
          <Table rowKey="id" size="small" columns={activeColumns} dataSource={summary?.pending_orders ?? []} pagination={false} scroll={{ x: 1100 }} onRow={rowProps} />
        </DataSection>
      </div>

      <PnlCharts isDark={isDark} equity={equity} daily={daily} days={days} onDaysChange={setDays} />

      <div className={styles.sectionGap}>
        <DataSection
          title="交易记录"
          subtitle={`共 ${tradesTotal} 笔 · 点击行看K线、执行流水和模拟盘对比`}
          error={tradesError}
          headerActions={
            <div className={styles.filters}>
              <Select
                size="small"
                value={strategyId}
                onChange={setStrategyId}
                style={{ width: 170 }}
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
              <Input.Search size="small" allowClear placeholder="币种" onSearch={setSymbolFilter} style={{ width: 150 }} />
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

      <LiveTradeModal
        trade={detail}
        strategyName={detail ? strategyNames[detail.strategy_id] : undefined}
        isDark={isDark}
        onClose={() => setDetail(null)}
      />
    </>
  );
};

export default LiveTradingPanel;
