import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Table, Tag, Tooltip, Empty, Segmented, Select, Input, InputNumber, Button, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DataSection } from '../ui';
import BreakoutChartModal from './BreakoutChartModal';
import styles from './DailyBreakoutPanel.module.scss';
import {
  dailyBreakoutAPI,
  DailyBreakoutSignal,
  DailyBreakoutStatus,
  DailyBreakoutLineType,
  DailyBreakoutSort,
  DAILY_BREAKOUT_STATUS_LABELS,
  DAILY_BREAKOUT_LINE_TYPE_LABELS,
} from '../../services/dailyBreakoutAPI';

interface DailyBreakoutPanelProps {
  refreshKey: number;
  isSidebarCollapsed?: boolean;
}

interface Thresholds {
  min_volume_ratio: number | null;
  min_breakout_pct: number | null;
  min_touches: number | null;
  min_span_days: number | null;
  max_distance_pct: number | null;
}

const EMPTY_THRESHOLDS: Thresholds = {
  min_volume_ratio: null,
  min_breakout_pct: null,
  min_touches: null,
  min_span_days: null,
  max_distance_pct: null,
};

// 严选：放量 ≥1.5、突破 ≥3%、≥3 触点、跨度 ≥90 天、离线 ≤10%（还在回踩位置）
const STRICT_THRESHOLDS: Thresholds = {
  min_volume_ratio: 1.5,
  min_breakout_pct: 3,
  min_touches: 3,
  min_span_days: 90,
  max_distance_pct: 10,
};

const STATUS_COLORS: Record<DailyBreakoutStatus, string> = {
  breakout: 'green',
  retest: 'gold',
  failed: 'red',
};

const SORT_OPTIONS: { label: string; value: DailyBreakoutSort }[] = [
  { label: '突破时间', value: 'breakout_time' },
  { label: '离线距离', value: 'distance' },
  { label: '量比', value: 'volume_ratio' },
  { label: '触点数', value: 'touches' },
];

const DAYS_OPTIONS = [7, 14, 30, 60, 90].map(d => ({ label: `近 ${d} 天`, value: d }));

const stripUsdt = (s: string) => (s.toUpperCase().endsWith('USDT') ? s.slice(0, -4) : s);

const fmtPct = (v: number | null | undefined, withSign = false, digits = 2): string => {
  if (v === null || v === undefined) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
};

const fmtDate = (ms: number | null | undefined) => {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtPrice = (p: number) => (p >= 1 ? p.toFixed(4) : p.toPrecision(4));

const signClass = (v: number | null | undefined) =>
  v == null ? '' : v > 0 ? styles.up : v < 0 ? styles.down : '';

const DailyBreakoutPanel: React.FC<DailyBreakoutPanelProps> = ({ refreshKey, isSidebarCollapsed = false }) => {
  // ── 筛选 ────────────────────────────────────────────
  const [status, setStatus] = useState<DailyBreakoutStatus[]>(['breakout', 'retest']);
  const [days, setDays] = useState(30);
  const [lineType, setLineType] = useState<DailyBreakoutLineType | 'all'>('all');
  const [sort, setSort] = useState<DailyBreakoutSort>('breakout_time');
  const [keyword, setKeyword] = useState('');
  const [thresholds, setThresholds] = useState<Thresholds>(EMPTY_THRESHOLDS);
  // 数字输入防抖，避免逐键请求
  const [appliedThresholds, setAppliedThresholds] = useState<Thresholds>(EMPTY_THRESHOLDS);
  useEffect(() => {
    const t = setTimeout(() => setAppliedThresholds(thresholds), 500);
    return () => clearTimeout(t);
  }, [thresholds]);
  const setTh = (k: keyof Thresholds, v: number | null) => setThresholds(prev => ({ ...prev, [k]: v }));
  const applyThresholdsNow = (t: Thresholds) => { setThresholds(t); setAppliedThresholds(t); };

  // ── 数据 ────────────────────────────────────────────
  const [list, setList] = useState<DailyBreakoutSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartSignal, setChartSignal] = useState<DailyBreakoutSignal | null>(null);
  // 筛选连续变化时请求可能乱序返回，只认最后一次
  const reqSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const th = Object.fromEntries(
        Object.entries(appliedThresholds).filter(([, v]) => v != null)
      ) as Partial<Record<keyof Thresholds, number>>;
      const data = await dailyBreakoutAPI.getSignals({
        status,
        days,
        line_type: lineType === 'all' ? undefined : lineType,
        sort,
        limit: 1000,
        ...th,
      });
      if (seq !== reqSeq.current) return;
      setList(data ?? []);
    } catch (err) {
      if (seq !== reqSeq.current) return;
      message.error(err instanceof Error ? err.message : '加载日线突破失败');
      setList([]);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [status, days, lineType, sort, appliedThresholds]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return kw ? list.filter(s => s.symbol.toLowerCase().includes(kw)) : list;
  }, [list, keyword]);

  const isStrict = (Object.keys(STRICT_THRESHOLDS) as (keyof Thresholds)[])
    .every(k => thresholds[k] === STRICT_THRESHOLDS[k]);
  const hasThresholds = Object.values(thresholds).some(v => v != null);

  const columns: ColumnsType<DailyBreakoutSignal> = [
    {
      title: '币种',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
      fixed: 'left',
      render: (s: string, row) => <a className={styles.symbol} onClick={() => setChartSignal(row)}>{stripUsdt(s)}</a>,
    },
    {
      title: '线型',
      dataIndex: 'line_type',
      key: 'line_type',
      width: 96,
      render: (t: DailyBreakoutLineType) => (
        <span className={styles.muted}>{DAILY_BREAKOUT_LINE_TYPE_LABELS[t] ?? t}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 96,
      align: 'center',
      render: (s: DailyBreakoutStatus, row) => {
        const tip = s === 'retest'
          ? `${fmtDate(row.retest_time)} 回踩，最低 ${row.retest_low != null ? fmtPrice(row.retest_low) : '—'}（离线 ${fmtPct(row.retest_distance_pct)}）`
          : s === 'failed'
            ? `${fmtDate(row.fail_time)} 跌回线下`
            : `${fmtDate(row.breakout_time)} 突破`;
        return (
          <Tooltip title={tip}>
            <Tag color={STATUS_COLORS[s]}>{DAILY_BREAKOUT_STATUS_LABELS[s] ?? s}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '突破日',
      dataIndex: 'breakout_time',
      key: 'breakout_time',
      width: 88,
      sorter: (a, b) => a.breakout_time - b.breakout_time,
      render: (v: number) => <span className={styles.muted}>{fmtDate(v)}</span>,
    },
    {
      title: '突破幅度',
      dataIndex: 'breakout_pct',
      key: 'breakout_pct',
      width: 96,
      align: 'right',
      sorter: (a, b) => a.breakout_pct - b.breakout_pct,
      render: (v: number, row) => (
        <Tooltip title={`突破日收盘 ${fmtPrice(row.breakout_close)}，线价 ${fmtPrice(row.breakout_line_value)}`}>
          <span className={signClass(v)}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
    {
      title: '量比',
      dataIndex: 'breakout_volume_ratio',
      key: 'breakout_volume_ratio',
      width: 80,
      align: 'right',
      sorter: (a, b) => a.breakout_volume_ratio - b.breakout_volume_ratio,
      render: (v: number) => (
        <Tooltip title="突破日成交量相对均量的倍数">
          <span className={v >= 1.5 ? styles.hot : ''}>{v.toFixed(2)}x</span>
        </Tooltip>
      ),
    },
    {
      title: '触点',
      dataIndex: 'touch_count',
      key: 'touch_count',
      width: 72,
      align: 'right',
      sorter: (a, b) => a.touch_count - b.touch_count,
    },
    {
      title: '跨度',
      dataIndex: 'span_days',
      key: 'span_days',
      width: 80,
      align: 'right',
      sorter: (a, b) => a.span_days - b.span_days,
      render: (v: number) => <span className={styles.muted}>{v}天</span>,
    },
    {
      title: '深度',
      dataIndex: 'depth_pct',
      key: 'depth_pct',
      width: 84,
      align: 'right',
      sorter: (a, b) => a.depth_pct - b.depth_pct,
      render: (v: number, row) => (
        <Tooltip title={`线下方的整理深度；线斜率 ${row.slope_pct_per_day.toFixed(3)}%/天，拟合误差 ${fmtPct(row.fit_error_pct)}`}>
          <span>{fmtPct(v, false, 1)}</span>
        </Tooltip>
      ),
    },
    {
      title: '最新离线',
      dataIndex: 'last_distance_pct',
      key: 'last_distance_pct',
      width: 96,
      align: 'right',
      sorter: (a, b) => a.last_distance_pct - b.last_distance_pct,
      render: (v: number, row) => (
        <Tooltip title={`最新收盘 ${fmtPrice(row.last_close)}，线价 ${fmtPrice(row.last_line_value)}（${fmtDate(row.last_time)}）`}>
          <span className={signClass(v)}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
    {
      title: '最大涨幅',
      dataIndex: 'max_gain_pct',
      key: 'max_gain_pct',
      width: 96,
      align: 'right',
      sorter: (a, b) => a.max_gain_pct - b.max_gain_pct,
      render: (v: number) => (
        <Tooltip title="突破后的最大涨幅">
          <span className={signClass(v)}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <DataSection
        title="日线压力线突破"
        subtitle={keyword.trim() ? `${filtered.length} / ${list.length} 个` : `${list.length} 个`}
        compact
        headerActions={
          <div className={styles.filters}>
            <Input.Search
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索币种"
              allowClear
              size="small"
              style={{ width: 140 }}
            />
            <Select
              mode="multiple"
              size="small"
              value={status}
              onChange={v => setStatus(v)}
              options={(Object.keys(DAILY_BREAKOUT_STATUS_LABELS) as DailyBreakoutStatus[]).map(k => ({
                label: DAILY_BREAKOUT_STATUS_LABELS[k], value: k,
              }))}
              placeholder="全部状态"
              style={{ minWidth: 170 }}
            />
            <Segmented
              size="small"
              value={lineType}
              onChange={v => setLineType(v as DailyBreakoutLineType | 'all')}
              options={[
                { label: '全部线型', value: 'all' },
                { label: '下降线', value: 'descending' },
                { label: '盘整上沿', value: 'horizontal' },
              ]}
            />
            <Select size="small" value={days} onChange={setDays} options={DAYS_OPTIONS} style={{ width: 96 }} />
            <Select
              size="small"
              value={sort}
              onChange={setSort}
              options={SORT_OPTIONS.map(o => ({ label: `按${o.label}`, value: o.value }))}
              style={{ width: 112 }}
            />
          </div>
        }
      >
        <div className={styles.thresholds}>
          <InputNumber size="small" min={0} step={0.5} value={thresholds.min_volume_ratio}
            onChange={v => setTh('min_volume_ratio', v)} addonBefore="量比≥" style={{ width: 120 }} />
          <InputNumber size="small" min={0} step={1} value={thresholds.min_breakout_pct}
            onChange={v => setTh('min_breakout_pct', v)} addonBefore="突破≥" addonAfter="%" style={{ width: 140 }} />
          <InputNumber size="small" min={2} step={1} precision={0} value={thresholds.min_touches}
            onChange={v => setTh('min_touches', v)} addonBefore="触点≥" style={{ width: 110 }} />
          <InputNumber size="small" min={0} step={30} precision={0} value={thresholds.min_span_days}
            onChange={v => setTh('min_span_days', v)} addonBefore="跨度≥" addonAfter="天" style={{ width: 140 }} />
          <Tooltip title="最新收盘离线的最大距离，用来找还在回踩位置的">
            <InputNumber size="small" min={0} step={1} value={thresholds.max_distance_pct}
              onChange={v => setTh('max_distance_pct', v)} addonBefore="离线≤" addonAfter="%" style={{ width: 140 }} />
          </Tooltip>
          <Tooltip title="量比≥1.5、突破≥3%、触点≥3、跨度≥90天、离线≤10%，并按离线距离排序">
            <Button
              size="small"
              type={isStrict ? 'primary' : 'default'}
              onClick={() => { applyThresholdsNow(STRICT_THRESHOLDS); setSort('distance'); }}
            >
              严选
            </Button>
          </Tooltip>
          {hasThresholds && (
            <Button size="small" type="link" onClick={() => applyThresholdsNow(EMPTY_THRESHOLDS)}>清空条件</Button>
          )}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          size="small"
          onRow={row => ({ onDoubleClick: () => setChartSignal(row) })}
          pagination={{ pageSize: 30, showSizeChanger: false, showTotal: t => `共 ${t} 个` }}
          scroll={{ x: 1104 }}
          locale={{ emptyText: <Empty description={keyword.trim() ? `未匹配到「${keyword.trim()}」` : '当前条件下无突破'} /> }}
        />
      </DataSection>

      {chartSignal && (
        <BreakoutChartModal
          signal={chartSignal}
          onClose={() => setChartSignal(null)}
          isDark={document.documentElement.classList.contains('dark')}
          sidebarCollapsed={isSidebarCollapsed}
        />
      )}
    </>
  );
};

export default DailyBreakoutPanel;
