import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, message, Tooltip, Empty, Segmented, Switch, Input, DatePicker, Select, InputNumber } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Dayjs } from 'dayjs';
import styles from '../../pages/WatchPool.module.scss';
import { DataSection } from '../ui';
import FavStar from './FavStar';
import LimitupBadge, { usePoolLimitupMap } from './LimitupBadge';
import type { KlineOverlay, KlineOverlayMarker, KlineTarget } from './AStockKlineModal';
import { favoriteAPI } from '../../services/favoriteAPI';
import { boardGroupOf, BoardGroup } from '../../services/astockAPI';
import {
  structureScanAPI,
  BoxBreakoutItem,
  BoxBreakoutResponse,
  BoxBreakoutStage,
  BOX_BREAKOUT_STAGE_LABELS,
} from '../../services/structureScanAPI';

interface BoxBreakoutPanelProps {
  refreshKey: number;
  onLoadingChange?: (loading: boolean) => void;
  onOpenKline: (target: KlineTarget) => void;
}

// 画线配色
const C_TL = '#8b5cf6';
const C_TOP = '#3b82f6';
const C_BREAK = '#ef4444';
const C_RETEST = '#f97316';

const STAGE_COLORS: Record<BoxBreakoutStage, string> = {
  tl_break: 'purple',
  tl_retest: 'geekblue',
  box_break: 'red',
  box_retest: 'volcano',
};

const STAGE_SHORT: Record<BoxBreakoutStage, string> = {
  tl_break: '破线',
  tl_retest: '踩线',
  box_break: '破顶',
  box_retest: '踩顶',
};

const MAX_AGE_OPTIONS = [
  { label: '不限天数', value: 0 },
  { label: '1日内', value: 1 },
  { label: '3日内', value: 3 },
  { label: '5日内', value: 5 },
  { label: '10日内', value: 10 },
];

// 后端返回的已是百分比数值，直接加 % 号
const fmtPct = (v: number | null | undefined, withSign = false, digits = 1): string => {
  if (v === null || v === undefined) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
};

const retClass = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  return v > 0 ? styles.positive : v < 0 ? styles.negative : '';
};

/** 平台顶水平线 + 下降趋势线（平台顶 → 当日趋势线价位）+ 各阶段日期标记 */
const buildOverlay = (r: BoxBreakoutItem): KlineOverlay => {
  const markers: KlineOverlayMarker[] = [
    { date: r.touch_date, text: '触点', color: C_TL, position: 'aboveBar' },
  ];
  if (r.tl_break) markers.push({ date: r.tl_break, text: '破线', color: C_BREAK, position: 'belowBar' });
  if (r.tl_retest) markers.push({ date: r.tl_retest, text: '踩线', color: C_RETEST, position: 'belowBar' });
  if (r.box_break) markers.push({ date: r.box_break, text: '破顶', color: C_BREAK, position: 'belowBar' });
  if (r.box_retest) markers.push({ date: r.box_retest, text: '踩顶', color: C_RETEST, position: 'belowBar' });
  return {
    lines: [
      { from: { date: r.top_date, price: r.top }, color: C_TOP, dashed: true },
      { from: { date: r.top_date, price: r.top }, to: { date: r.trade_date, price: r.tl_line }, color: C_TL },
    ],
    markers,
    legend: [
      { color: C_TOP, label: `平台顶 ${r.top.toFixed(2)}` },
      { color: C_TL, label: `趋势线（当日 ${r.tl_line.toFixed(2)}）` },
    ],
  };
};

const BoxBreakoutPanel: React.FC<BoxBreakoutPanelProps> = ({ refreshKey, onLoadingChange, onOpenKline }) => {
  // ── 筛选条件 ────────────────────────────────────────
  const [tradeDate, setTradeDate] = useState<Dayjs | null>(null);
  const [stage, setStage] = useState<BoxBreakoutStage | 'all'>('all');
  const [eventOnly, setEventOnly] = useState(false);
  const [maxAge, setMaxAge] = useState(0);
  // 与后端默认值一致：前段涨幅 ≥50%、平台深度 ≤35%
  const [minPriorGain, setMinPriorGain] = useState<number | null>(50);
  const [maxDepth, setMaxDepth] = useState<number | null>(35);
  // 数字输入框防抖，避免逐键请求
  const [thresholds, setThresholds] = useState({ minPriorGain, maxDepth });
  useEffect(() => {
    const t = setTimeout(() => setThresholds((prev) =>
      prev.minPriorGain === minPriorGain && prev.maxDepth === maxDepth ? prev : { minPriorGain, maxDepth }
    ), 500);
    return () => clearTimeout(t);
  }, [minPriorGain, maxDepth]);
  // 接口无板块参数，前端按代码前缀过滤
  const [boardGroup, setBoardGroup] = useState<BoardGroup | 'all'>('main');
  const [keyword, setKeyword] = useState('');

  const limitupMap = usePoolLimitupMap(refreshKey);
  const [favCodes, setFavCodes] = useState<Set<string>>(new Set());
  const loadFavCodes = useCallback(async () => {
    try {
      setFavCodes(new Set(await favoriteAPI.getCodes()));
    } catch (err) {
      console.error('加载收藏列表失败:', err);
    }
  }, []);
  useEffect(() => { loadFavCodes(); }, [loadFavCodes]);
  const handleFavChange = useCallback((code: string, faved: boolean) => {
    setFavCodes((prev) => {
      const next = new Set(prev);
      if (faved) next.add(code); else next.delete(code);
      return next;
    });
  }, []);

  // ── 数据 ────────────────────────────────────────────
  const [resp, setResp] = useState<BoxBreakoutResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    try {
      setResp(await structureScanAPI.getBoxBreakout({
        trade_date: tradeDate ? tradeDate.format('YYYY-MM-DD') : undefined,
        stage: stage === 'all' ? undefined : stage,
        event_only: eventOnly || undefined,
        max_age: maxAge || undefined,
        min_prior_gain: thresholds.minPriorGain ?? 0,
        max_depth: thresholds.maxDepth ?? 100,
        // 始终带 limit：裸路径 /api/box-breakout 经外网代理实测 503
        limit: 1000,
      }));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载平台突破失败');
      setResp(null);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
    // onLoadingChange 由父级内联定义，不入依赖以免每次渲染都重新请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeDate, stage, eventOnly, maxAge, thresholds]);

  useEffect(() => { loadList(); }, [loadList, refreshKey]);

  const list = React.useMemo(() => resp?.items ?? [], [resp]);
  const filteredList = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return list.filter(
      (r) =>
        (boardGroup === 'all' || boardGroupOf(r.code) === boardGroup) &&
        (!kw || r.name?.toLowerCase().includes(kw) || r.code?.toLowerCase().includes(kw))
    );
  }, [list, keyword, boardGroup]);

  const openKline = (r: BoxBreakoutItem) => onOpenKline({ code: r.code, name: r.name, overlay: buildOverlay(r) });

  const columns: ColumnsType<BoxBreakoutItem> = [
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      width: 122,
      fixed: 'left',
      render: (code: string, row) => (
        <span className={styles.codeCell}>
          <FavStar code={code} favCodes={favCodes} onChange={handleFavChange} />
          <a className={styles.codeLink} onClick={() => openKline(row)}>{code}</a>
        </span>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 128,
      fixed: 'left',
      render: (name: string, row) => (
        <span className={styles.nameCell}>
          <a className={styles.nameLink} onClick={() => openKline(row)}>{name}</a>
          <LimitupBadge code={row.code} map={limitupMap} />
          {row.event && (
            <Tooltip title={`当日发生：${BOX_BREAKOUT_STAGE_LABELS[row.event] ?? row.event}`}>
              <span className={styles.brokeBadge}>新</span>
            </Tooltip>
          )}
        </span>
      ),
    },
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 112,
      align: 'center',
      render: (s: BoxBreakoutStage, row) => (
        <Tooltip title={`${row.stage_date} 进入该阶段`}>
          <Tag color={STAGE_COLORS[s]}>{BOX_BREAKOUT_STAGE_LABELS[s] ?? s}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '阶段天数',
      dataIndex: 'stage_age',
      key: 'stage_age',
      width: 92,
      align: 'right',
      sorter: (a, b) => a.stage_age - b.stage_age,
      render: (v: number) => (
        <Tooltip title="距当前阶段发生的交易日数，0 = 当天">
          <span className={v === 0 ? styles.positive : styles.muted}>{v === 0 ? '当天' : `${v}天`}</span>
        </Tooltip>
      ),
    },
    {
      title: '收盘',
      dataIndex: 'close',
      key: 'close',
      width: 84,
      align: 'right',
      render: (v: number) => v?.toFixed(2) ?? '—',
    },
    {
      title: '距平台顶',
      dataIndex: 'dist_to_top',
      key: 'dist_to_top',
      width: 96,
      align: 'right',
      sorter: (a, b) => a.dist_to_top - b.dist_to_top,
      render: (v: number, row) => (
        <Tooltip title={`平台顶 ${row.top.toFixed(2)}（${row.top_date}）`}>
          <span className={retClass(v)}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
    {
      title: '前段涨幅',
      dataIndex: 'prior_gain',
      key: 'prior_gain',
      width: 96,
      align: 'right',
      sorter: (a, b) => a.prior_gain - b.prior_gain,
      render: (v: number) => (
        <Tooltip title="进入平台前那段上涨的涨幅">
          <span className={`${styles.scoreVal} ${retClass(v)}`}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
    {
      title: '平台天数',
      dataIndex: 'box_days',
      key: 'box_days',
      width: 92,
      align: 'right',
      sorter: (a, b) => a.box_days - b.box_days,
      render: (v: number) => <span className={styles.muted}>{v}天</span>,
    },
    {
      title: '平台深度',
      dataIndex: 'box_depth',
      key: 'box_depth',
      width: 92,
      align: 'right',
      sorter: (a, b) => a.box_depth - b.box_depth,
      render: (v: number) => <span className={retClass(v)}>{fmtPct(v)}</span>,
    },
    {
      title: '趋势线',
      dataIndex: 'tl_line',
      key: 'tl_line',
      width: 110,
      align: 'right',
      render: (v: number, row) => (
        <Tooltip title={`平台顶 ${row.top_date} → 第二触点 ${row.touch_date}，每日斜率 ${row.slope_pct}%`}>
          <span>{v.toFixed(2)} <span className={styles.muted}>{row.slope_pct.toFixed(2)}%</span></span>
        </Tooltip>
      ),
    },
    {
      title: '各阶段日期',
      key: 'dates',
      width: 220,
      render: (_: unknown, row) => {
        const items = (['tl_break', 'tl_retest', 'box_break', 'box_retest'] as BoxBreakoutStage[])
          .filter((k) => row[k])
          .map((k) => `${STAGE_SHORT[k]} ${row[k]!.slice(5)}`);
        return <span className={styles.muted}>{items.join(' → ') || '—'}</span>;
      },
    },
  ];

  const shown = filteredList.length === list.length ? `${list.length} 只` : `${filteredList.length} / ${list.length} 只`;

  return (
    <DataSection
      className={styles.section}
      title="平台突破"
      subtitle={[resp?.trade_date, shown].filter(Boolean).join(' · ')}
      headerActions={
        <div className={styles.filters}>
          <Input.Search
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索名称/代码"
            allowClear
            size="small"
            style={{ width: 160 }}
          />
          <DatePicker
            size="small"
            value={tradeDate}
            onChange={setTradeDate}
            allowClear
            placeholder="最新交易日"
            style={{ width: 128 }}
          />
          <Segmented
            size="small"
            value={stage}
            onChange={(v) => setStage(v as BoxBreakoutStage | 'all')}
            options={[
              { label: '全部', value: 'all' },
              ...(Object.keys(STAGE_SHORT) as BoxBreakoutStage[]).map((k) => ({ label: STAGE_SHORT[k], value: k })),
            ]}
          />
          <Segmented
            size="small"
            value={boardGroup}
            onChange={(v) => setBoardGroup(v as BoardGroup | 'all')}
            options={[
              { label: '全部板块', value: 'all' },
              { label: '主板', value: 'main' },
              { label: '非主板', value: 'other' },
            ]}
          />
          <Select
            value={maxAge}
            onChange={setMaxAge}
            options={MAX_AGE_OPTIONS}
            size="small"
            style={{ width: 100 }}
          />
          <Tooltip title="平台前段涨幅下限，清空 = 不限">
            <InputNumber
              size="small"
              value={minPriorGain}
              onChange={(v) => setMinPriorGain(v)}
              min={0}
              step={10}
              addonBefore="前段涨幅≥"
              addonAfter="%"
              style={{ width: 172 }}
            />
          </Tooltip>
          <Tooltip title="平台深度上限，清空 = 不限">
            <InputNumber
              size="small"
              value={maxDepth}
              onChange={(v) => setMaxDepth(v)}
              min={0}
              max={100}
              step={5}
              addonBefore="深度≤"
              addonAfter="%"
              style={{ width: 142 }}
            />
          </Tooltip>
          <Tooltip title="只看当前阶段在所选交易日当天发生的票">
            <span className={styles.switchWrap}>
              <Switch size="small" checked={eventOnly} onChange={setEventOnly} />
              <span className={styles.switchLabel}>当日事件</span>
            </span>
          </Tooltip>
          {resp?.note && (
            <Tooltip title={resp.note}>
              <span className={`${styles.statLabel} ${styles.statLabelInfo}`}>说明 ⓘ</span>
            </Tooltip>
          )}
        </div>
      }
    >
      <Table
        rowKey={(r) => `${r.code}-${r.trade_date}`}
        columns={columns}
        dataSource={filteredList}
        loading={loading}
        size="middle"
        pagination={{ pageSize: 30, showSizeChanger: false, showTotal: (t) => `共 ${t} 只` }}
        scroll={{ x: 1364 }}
        locale={{
          emptyText: (
            <Empty description={keyword.trim() ? `未匹配到「${keyword.trim()}」` : '当前筛选条件下无数据'} />
          ),
        }}
      />
    </DataSection>
  );
};

export default BoxBreakoutPanel;
