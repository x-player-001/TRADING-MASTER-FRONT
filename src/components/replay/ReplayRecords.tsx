import React, { useEffect, useState } from 'react';
import { Tabs, Table, Select, Input, Empty, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import styles from './Replay.module.scss';
import {
  replayAPI,
  ReplayPosition,
  ReplayFill,
  ReplayStats,
  StatsResult,
  EXIT_REASON_LABELS,
} from '../../services/replayAPI';
import { fmtPrice, fmtQty, fmtUsd, fmtPct, fmtR, fmtTime, pnlSign } from './format';

interface ReplayRecordsProps {
  sessionId: number;
  /** 本地账户里的全部仓位回合 / 成交（前端撮合，实时） */
  positions: ReplayPosition[];
  fills: ReplayFill[];
  /** 完整同步成功后递增：后端统计只算已同步的数据，据此重新拉取 */
  statsKey: number;
  /** 改复盘标签 / 笔记（本地改完会同步到后端，会话结束后也能改） */
  onSaveReview: (positionClientId: string, patch: { tags?: string[]; note?: string | null }) => void;
}

type SaveReview = ReplayRecordsProps['onSaveReview'];

// 胜率直接由胜负笔数算，避免 win_rate 字段是小数还是百分数的歧义
const winRate = (s: ReplayStats): string =>
  s.trade_count > 0 ? fmtPct((s.win_count / s.trade_count) * 100, false, 1) : '—';

const fmtNum = (v: number | null | undefined, digits = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(digits);

const ACTION_LABEL: Record<string, string> = { open: '开仓', add: '加仓', reduce: '减仓', close: '平仓' };
const TRIGGER_LABEL: Record<string, string> = {
  market: '市价',
  limit: '限价',
  stop: '条件',
  stop_loss: '止损',
  take_profit: '止盈',
  manual: '手动',
  session_end: '会话结束',
};

// ── 仓位回合：标签/笔记可编辑，会话结束后也能改 ──
const PositionsTable: React.FC<{ rows: ReplayPosition[]; onSaveReview: SaveReview }> = ({ rows, onSaveReview }) => {
  const saveReview = (p: ReplayPosition, data: { tags?: string[]; note?: string | null }) => onSaveReview(p.client_id, data);

  const columns: ColumnsType<ReplayPosition> = [
    {
      title: '方向',
      dataIndex: 'direction',
      width: 60,
      render: (d, p) => (
        <span className={`${styles.dirTag} ${d === 'long' ? styles.long : styles.short}`}>
          {d === 'long' ? '多' : '空'}{p.status === 'open' ? '·持' : ''}
        </span>
      ),
    },
    { title: '开仓', dataIndex: 'open_bar_time', width: 110, render: (t) => fmtTime(t, false) },
    { title: '平仓', dataIndex: 'close_bar_time', width: 110, render: (t) => fmtTime(t, false) },
    {
      title: '入 / 出',
      width: 150,
      render: (_, p) => `${fmtPrice(p.avg_entry_price)} / ${fmtPrice(p.avg_exit_price)}`,
    },
    { title: '最大数量', dataIndex: 'max_qty', width: 90, render: fmtQty },
    {
      title: '净盈亏',
      dataIndex: 'net_pnl',
      width: 90,
      render: (v) => <span className={styles[pnlSign(v)]}>{fmtUsd(v, true)}</span>,
    },
    {
      title: 'R',
      dataIndex: 'r_multiple',
      width: 70,
      render: (v) => <span className={styles[pnlSign(v)]}>{fmtR(v)}</span>,
    },
    {
      title: 'MFE / MAE',
      width: 120,
      render: (_, p) => (
        <span>
          <span className={styles.pos}>{fmtPct(p.mfe_pct)}</span>
          {' / '}
          <span className={styles.neg}>{fmtPct(p.mae_pct)}</span>
        </span>
      ),
    },
    { title: '根数', dataIndex: 'bars_held', width: 60, render: (v) => v ?? '—' },
    {
      title: '离场',
      dataIndex: 'exit_reason',
      width: 80,
      render: (v) => (v ? EXIT_REASON_LABELS[v] ?? v : '—'),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 180,
      render: (tags: string[], p) => (
        <Select
          mode="tags"
          size="small"
          variant="borderless"
          value={tags ?? []}
          onChange={(v) => saveReview(p, { tags: v })}
          placeholder="加标签"
          style={{ width: '100%' }}
          open={false}
          tokenSeparators={[',', '，', ' ']}
        />
      ),
    },
    {
      title: '笔记',
      dataIndex: 'note',
      render: (note: string | null, p) => (
        <Input
          size="small"
          variant="borderless"
          defaultValue={note ?? ''}
          placeholder="复盘笔记"
          onBlur={(e) => {
            if (e.target.value !== (note ?? '')) saveReview(p, { note: e.target.value });
          }}
        />
      ),
    },
  ];

  return (
    <Table
      rowKey="client_id"
      size="small"
      columns={columns}
      dataSource={rows}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      scroll={{ x: 1200 }}
      locale={{ emptyText: <Empty description="还没有交易" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
    />
  );
};

// ── 成交明细 ──
const FillsTable: React.FC<{ fills: ReplayFill[] }> = ({ fills }) => {
  const columns: ColumnsType<ReplayFill> = [
    { title: '时间', dataIndex: 'bar_time', width: 130, render: (t) => fmtTime(t) },
    {
      title: '方向',
      dataIndex: 'side',
      width: 60,
      render: (s) => <span className={s === 'buy' ? styles.pos : styles.neg}>{s === 'buy' ? '买' : '卖'}</span>,
    },
    { title: '动作', dataIndex: 'action', width: 70, render: (a) => ACTION_LABEL[a] ?? a },
    { title: '触发', dataIndex: 'trigger_type', width: 80, render: (t) => TRIGGER_LABEL[t] ?? t },
    { title: '价格', dataIndex: 'price', width: 110, render: fmtPrice },
    { title: '数量', dataIndex: 'qty', width: 100, render: fmtQty },
    {
      title: '已实现',
      dataIndex: 'realized_pnl',
      width: 90,
      render: (v) => <span className={styles[pnlSign(v)]}>{fmtUsd(v, true)}</span>,
    },
    { title: '手续费', dataIndex: 'fee', width: 80, render: (v) => fmtUsd(v) },
    { title: '流动性', dataIndex: 'liquidity', width: 70, render: (v) => (v === 'maker' ? 'Maker' : 'Taker') },
  ];
  return (
    <Table
      rowKey="client_id"
      size="small"
      columns={columns}
      dataSource={[...fills].reverse().sort((a, b) => b.bar_time - a.bar_time)}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      scroll={{ x: 800 }}
      locale={{ emptyText: <Empty description="还没有成交" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
    />
  );
};

// ── 统计 ──
interface GroupRow extends ReplayStats {
  key: string;
  label: string;
}

const groupColumns: ColumnsType<GroupRow> = [
  { title: '分组', dataIndex: 'label', width: 110 },
  { title: '笔数', dataIndex: 'trade_count', width: 60 },
  { title: '胜率', width: 70, render: (_, s) => winRate(s) },
  {
    title: '净盈亏',
    dataIndex: 'total_net_pnl',
    width: 90,
    render: (v) => <span className={styles[pnlSign(v)]}>{fmtUsd(v, true)}</span>,
  },
  {
    title: '总 R',
    dataIndex: 'total_r',
    width: 70,
    render: (v) => <span className={styles[pnlSign(v)]}>{fmtR(v)}</span>,
  },
  { title: '期望 R', dataIndex: 'avg_r', width: 70, render: fmtR },
  { title: '盈亏比', dataIndex: 'payoff_ratio', width: 70, render: (v) => fmtNum(v) },
  { title: '利润因子', dataIndex: 'profit_factor', width: 80, render: (v) => fmtNum(v) },
];

const StatsView: React.FC<{ sessionId: number; statsKey: number }> = ({ sessionId, statsKey }) => {
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    replayAPI
      .getSessionStats(sessionId)
      .then((s) => alive && setStats(s))
      .catch((err) => message.error((err as Error).message || '加载统计失败'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [sessionId, statsKey]);

  if (loading && !stats) return <div className={styles.dim}>加载中…</div>;
  if (!stats || stats.overall.trade_count === 0) {
    return <Empty description="平仓并同步到后端后才有统计" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const o = stats.overall;
  const tiles: { label: string; value: string; sign?: number | null }[] = [
    { label: '交易笔数', value: `${o.trade_count}（${o.win_count}胜 ${o.loss_count}负）` },
    { label: '胜率', value: winRate(o) },
    { label: '净盈亏', value: fmtUsd(o.total_net_pnl, true), sign: o.total_net_pnl },
    { label: '总 R', value: fmtR(o.total_r), sign: o.total_r },
    { label: '期望 R', value: fmtR(o.avg_r), sign: o.avg_r },
    { label: '盈亏比', value: fmtNum(o.payoff_ratio) },
    { label: '利润因子', value: fmtNum(o.profit_factor) },
    { label: '最大回撤', value: `${fmtUsd(o.max_drawdown)}U${o.max_drawdown_pct !== null ? ` · ${fmtPct(o.max_drawdown_pct, false)}` : ''}` },
    { label: '回撤 R', value: fmtNum(o.max_drawdown_r) },
    { label: '最大连胜 / 连亏', value: `${o.max_consecutive_wins} / ${o.max_consecutive_losses}` },
    { label: '平均持仓根数', value: fmtNum(o.avg_bars_held, 1) },
    { label: 'MFE / MAE 均值', value: `${fmtPct(o.avg_mfe_pct)} / ${fmtPct(o.avg_mae_pct)}` },
    { label: '手续费合计', value: fmtUsd(o.total_fee) },
  ];

  const groupRows: GroupRow[] = [
    ...(['long', 'short'] as const)
      .filter((d) => stats.by_direction[d])
      .map((d) => ({ ...stats.by_direction[d]!, key: `dir-${d}`, label: d === 'long' ? '做多' : '做空' })),
    ...Object.entries(stats.by_tag).map(([tag, s]) => ({ ...s, key: `tag-${tag}`, label: `# ${tag}` })),
    ...Object.entries(stats.by_exit_reason).map(([r, s]) => ({
      ...s,
      key: `exit-${r}`,
      label: `离场·${EXIT_REASON_LABELS[r] ?? r}`,
    })),
  ];

  // 以 0 为起点，单笔交易也能看出方向
  const curve = [
    { idx: 0, time: '起点', pnl: 0, r: 0 as number | null },
    ...stats.equity_curve.map((p, i) => ({
      idx: i + 1,
      time: fmtTime(p.close_bar_time, false),
      pnl: Number(p.cum_net_pnl.toFixed(2)),
      r: p.cum_r,
    })),
  ];

  return (
    <div className={styles.statsWrap}>
      <div className={styles.statTiles}>
        {tiles.map((t) => (
          <div key={t.label} className={styles.statTile}>
            <span className={styles.kvLabel}>{t.label}</span>
            <span className={`${styles.statValue} ${t.sign !== undefined ? styles[pnlSign(t.sign)] : ''}`}>{t.value}</span>
          </div>
        ))}
      </div>

      <div className={styles.statsBottom}>
        <div className={styles.curveBox}>
          <div className={styles.subTitle}>累计净盈亏（按平仓顺序）</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={curve} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="idx" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={56} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
              <Tooltip
                formatter={(v: number) => [`${v > 0 ? '+' : ''}${v} U`, '累计净盈亏']}
                labelFormatter={(idx: number) => (idx === 0 ? '起点' : `第 ${idx} 笔 · ${curve[idx]?.time ?? ''}`)}
              />
              <Line type="monotone" dataKey="pnl" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.groupBox}>
          <div className={styles.subTitle}>分组统计</div>
          <Table rowKey="key" size="small" columns={groupColumns} dataSource={groupRows} pagination={false} scroll={{ x: 620 }} />
        </div>
      </div>
    </div>
  );
};

const ReplayRecords: React.FC<ReplayRecordsProps> = ({ sessionId, positions, fills, statsKey, onSaveReview }) => (
  <div className={styles.card}>
    <Tabs
      size="small"
      destroyOnHidden
      items={[
        { key: 'positions', label: `仓位回合 ${positions.length || ''}`, children: <PositionsTable rows={positions} onSaveReview={onSaveReview} /> },
        { key: 'fills', label: `成交明细 ${fills.length || ''}`, children: <FillsTable fills={fills} /> },
        { key: 'stats', label: '统计', children: <StatsView sessionId={sessionId} statsKey={statsKey} /> },
      ]}
    />
  </div>
);

export default ReplayRecords;
