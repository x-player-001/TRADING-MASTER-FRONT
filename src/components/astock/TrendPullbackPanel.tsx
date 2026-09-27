import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, message, Tooltip, Empty, Segmented, Switch, Input, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Dayjs } from 'dayjs';
import styles from '../../pages/WatchPool.module.scss';
import { DataSection } from '../ui';
import FavStar from './FavStar';
import LimitupBadge, { usePoolLimitupMap } from './LimitupBadge';
import type { KlineOverlay, KlineTarget } from './AStockKlineModal';
import { favoriteAPI } from '../../services/favoriteAPI';
import { boardGroupOf, BoardGroup } from '../../services/astockAPI';
import {
  structureScanAPI,
  TrendPullbackItem,
  TrendPullbackResponse,
  TrendPullbackState,
  TREND_PULLBACK_STATE_LABELS,
} from '../../services/structureScanAPI';

interface TrendPullbackPanelProps {
  refreshKey: number;
  onLoadingChange?: (loading: boolean) => void;
  onOpenKline: (target: KlineTarget) => void;
}

// 画线配色
const C_LEG = '#8b5cf6';
const C_REF = '#3b82f6';
const C_FAKE = '#9ca3af';
const C_BREAK = '#ef4444';

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

/** 上涨段 + 箱体上沿 + 假突破/突破日标记 */
const buildOverlay = (r: TrendPullbackItem): KlineOverlay => ({
  lines: [
    { from: { date: r.leg_low_date, price: r.leg_low }, to: { date: r.peak_date, price: r.peak }, color: C_LEG },
    { from: { date: r.peak_date, price: r.ref }, color: C_REF, dashed: true },
  ],
  markers: [
    { date: r.leg_low_date, text: '起', color: C_LEG, position: 'belowBar' },
    { date: r.peak_date, text: '高', color: C_LEG, position: 'aboveBar' },
    ...(r.fake_breaks ?? []).map((d) => ({ date: d, text: '假突', color: C_FAKE, position: 'aboveBar' as const })),
    ...(r.breakout_date ? [{ date: r.breakout_date, text: '突破', color: C_BREAK, position: 'belowBar' as const }] : []),
  ],
  legend: [
    { color: C_LEG, label: '上涨段' },
    { color: C_REF, label: `箱体上沿 ${r.ref.toFixed(2)}` },
  ],
});

const TrendPullbackPanel: React.FC<TrendPullbackPanelProps> = ({ refreshKey, onLoadingChange, onOpenKline }) => {
  // ── 筛选条件 ────────────────────────────────────────
  const [tradeDate, setTradeDate] = useState<Dayjs | null>(null);
  const [fineOnly, setFineOnly] = useState(true);
  const [state, setState] = useState<TrendPullbackState | 'all'>('all');
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
  const [resp, setResp] = useState<TrendPullbackResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    try {
      setResp(await structureScanAPI.getTrendPullback({
        trade_date: tradeDate ? tradeDate.format('YYYY-MM-DD') : undefined,
        fine: fineOnly,
        state: state === 'all' ? undefined : state,
        // 始终带 limit：裸路径经外网代理有 503 风险
        limit: 1000,
      }));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载趋势回调失败');
      setResp(null);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
    // onLoadingChange 由父级内联定义，不入依赖以免每次渲染都重新请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeDate, fineOnly, state]);

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

  const openKline = (r: TrendPullbackItem) => onOpenKline({ code: r.code, name: r.name, overlay: buildOverlay(r) });

  const columns: ColumnsType<TrendPullbackItem> = [
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
          {!fineOnly && row.is_fine && (
            <Tooltip title="精选口径">
              <span className={styles.brokeBadge}>精</span>
            </Tooltip>
          )}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 96,
      align: 'center',
      render: (s: TrendPullbackState, row) => {
        const fakes = row.fake_breaks?.length ?? 0;
        const tip = s === 'breakout'
          ? `${row.breakout_date} 突破箱体上沿（突破后 3 日内）`
          : `${row.pb_start} 起回调`;
        return (
          <Tooltip title={fakes ? `${tip}；假突破 ${fakes} 次：${row.fake_breaks.join('、')}` : tip}>
            <Tag color={s === 'breakout' ? 'red' : 'blue'}>
              {TREND_PULLBACK_STATE_LABELS[s] ?? s}{fakes ? ` ·假${fakes}` : ''}
            </Tag>
          </Tooltip>
        );
      },
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
      title: '上涨段涨幅',
      dataIndex: 'leg_gain',
      key: 'leg_gain',
      width: 108,
      align: 'right',
      sorter: (a, b) => a.leg_gain - b.leg_gain,
      render: (v: number, row) => (
        <Tooltip title={`${row.leg_low_date} ${row.leg_low} → ${row.peak_date} ${row.peak}，${row.leg_days} 个交易日`}>
          <span className={`${styles.scoreVal} ${retClass(v)}`}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
    {
      title: '段内涨停',
      dataIndex: 'leg_limitups',
      key: 'leg_limitups',
      width: 92,
      align: 'right',
      sorter: (a, b) => a.leg_limitups - b.leg_limitups,
      render: (v: number) => <span className={v > 0 ? styles.positive : styles.muted}>{v}</span>,
    },
    {
      title: '站上MA10',
      dataIndex: 'leg_above_ma10',
      key: 'leg_above_ma10',
      width: 96,
      align: 'right',
      sorter: (a, b) => a.leg_above_ma10 - b.leg_above_ma10,
      render: (v: number, row) => (
        <Tooltip title={`上涨段收盘站上 MA10 的天数占比；K线重叠度 ${(row.leg_overlap * 100).toFixed(0)}%（越小越流畅）`}>
          <span>{(v * 100).toFixed(0)}%</span>
        </Tooltip>
      ),
    },
    {
      title: '回调天数',
      dataIndex: 'pb_days',
      key: 'pb_days',
      width: 92,
      align: 'right',
      sorter: (a, b) => a.pb_days - b.pb_days,
      render: (v: number) => <span className={styles.muted}>{v}天</span>,
    },
    {
      title: '最大回撤',
      dataIndex: 'max_dd',
      key: 'max_dd',
      width: 96,
      align: 'right',
      sorter: (a, b) => a.max_dd - b.max_dd,
      render: (v: number) => <span className={retClass(v)}>{fmtPct(v)}</span>,
    },
    {
      title: '回撤比',
      dataIndex: 'retrace',
      key: 'retrace',
      width: 84,
      align: 'right',
      sorter: (a, b) => a.retrace - b.retrace,
      render: (v: number) => (
        <Tooltip title="回撤幅度占上涨段涨幅的比例">
          <span>{fmtPct(v)}</span>
        </Tooltip>
      ),
    },
    {
      title: '量比',
      dataIndex: 'amt_ratio',
      key: 'amt_ratio',
      width: 80,
      align: 'right',
      sorter: (a, b) => a.amt_ratio - b.amt_ratio,
      render: (v: number) => (
        <Tooltip title="回调期日均成交额 / 上涨段日均成交额，<1 为缩量">
          <span className={v < 1 ? styles.good : styles.muted}>{v.toFixed(2)}x</span>
        </Tooltip>
      ),
    },
    {
      title: '跌破MA20',
      dataIndex: 'pb_below_ma20',
      key: 'pb_below_ma20',
      width: 92,
      align: 'right',
      render: (v: number) => (
        <Tooltip title="回调期收盘跌破 MA20 的天数">
          <span className={v > 0 ? styles.warn : styles.muted}>{v}天</span>
        </Tooltip>
      ),
    },
    {
      title: '距上沿',
      dataIndex: 'dist_to_ref',
      key: 'dist_to_ref',
      width: 88,
      align: 'right',
      sorter: (a, b) => a.dist_to_ref - b.dist_to_ref,
      render: (v: number, row) => (
        <Tooltip title={`收盘距箱体上沿 ${row.ref.toFixed(2)} 的距离`}>
          <span className={retClass(v)}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
  ];

  const shown = filteredList.length === list.length ? `${list.length} 只` : `${filteredList.length} / ${list.length} 只`;

  return (
    <DataSection
      className={styles.section}
      title="趋势回调"
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
            value={state}
            onChange={(v) => setState(v as TrendPullbackState | 'all')}
            options={[
              { label: '全部', value: 'all' },
              { label: '回调中', value: 'pullback' },
              { label: '已突破', value: 'breakout' },
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
          <Tooltip title="关掉看宽松口径全量，精选的会标「精」">
            <span className={styles.switchWrap}>
              <Switch size="small" checked={fineOnly} onChange={setFineOnly} />
              <span className={styles.switchLabel}>只看精选</span>
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
        scroll={{ x: 1258 }}
        locale={{
          emptyText: (
            <Empty description={keyword.trim() ? `未匹配到「${keyword.trim()}」` : '当前筛选条件下无数据'} />
          ),
        }}
      />
    </DataSection>
  );
};

export default TrendPullbackPanel;
