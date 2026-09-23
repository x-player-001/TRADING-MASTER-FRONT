import React, { useState, useEffect, useCallback } from 'react';
import { DatePicker, Table, Tag, Drawer, message, Tooltip, Empty, Segmented, Switch, Select, Input, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Dayjs } from 'dayjs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import styles from './WatchPool.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, DataSection, CoolRefreshButton } from '../components/ui';
import AStockKlineModal from '../components/astock/AStockKlineModal';
import LowvolPanel from '../components/astock/LowvolPanel';
import { groupByDate, withGroupHeaderColumns, groupRowClassName } from '../components/astock/dateGroup';
import PullbackPanel from '../components/astock/PullbackPanel';
import FavoritePanel from '../components/astock/FavoritePanel';
import AlertPanel from '../components/astock/AlertPanel';
import FavStar from '../components/astock/FavStar';
import LimitupBadge, { usePoolLimitupMap } from '../components/astock/LimitupBadge';
import { favoriteAPI } from '../services/favoriteAPI';
import PoolLimitupBar from '../components/astock/PoolLimitupBar';
import RotationBoard from '../components/astock/RotationBoard';
import type { BoardGroup } from '../services/astockAPI';

// 统计条暂时隐藏（代码保留）。改回 true 即恢复「池中总数 / 已报警 / 命中率…」那一行。
const SHOW_STATS_BAR = false;

import {
  watchPoolAPI,
  WatchItem,
  WatchStats,
  WatchStatus,
  WatchEntryType,
  WatchOrderBy,
  WatchTrackPoint,
  volRatioLevel,
  STATUS_LABELS,
  ENTRY_TYPE_LABELS,
  ENTRY_SCORE_LABELS,
} from '../services/watchPoolAPI';

interface WatchPoolProps {
  isSidebarCollapsed?: boolean;
}

const STATUS_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '跟踪中', value: 'watching' },
  { label: '已命中', value: 'hit' },
  { label: '已到期', value: 'expired' },
];

const ORDER_OPTIONS = [
  { label: '跟踪评分', value: 'live_score' },
  { label: '入池评分', value: 'entry_score' },
  { label: '首板日期', value: 'trigger_date' },
];

// ── 工具函数 ───────────────────────────────────────────
// 后端返回的已是百分比数值（如 2.5197 即 2.52%），直接加 % 号，不再乘100
const fmtPct = (v: number | null | undefined, withSign = false): string => {
  if (v === null || v === undefined) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

const fmtNum = (v: number | null | undefined, digits = 2): string => {
  if (v === null || v === undefined) return '—';
  return v.toFixed(digits);
};

const retClass = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  return v > 0 ? styles.positive : v < 0 ? styles.negative : '';
};

const scoreClass = (v: number): string => {
  if (v >= 0.8) return styles.scoreHigh;
  if (v >= 0.6) return styles.scoreMid;
  return styles.scoreLow;
};

const WatchPool: React.FC<WatchPoolProps> = ({ isSidebarCollapsed = false }) => {
  // ── 筛选条件 ────────────────────────────────────────
  const [status, setStatus] = useState<WatchStatus | 'all'>('watching');
  const [entryType, setEntryType] = useState<WatchEntryType | 'all'>('all');
  const [boardGroup, setBoardGroup] = useState<BoardGroup | 'all'>('main');
  const [excludeBroke, setExcludeBroke] = useState(false);
  const [since, setSince] = useState<Dayjs | null>(null);
  const [orderBy, setOrderBy] = useState<WatchOrderBy>('live_score');
  // 名称/代码模糊搜索（接口无此参数，前端在已加载的列表上过滤）
  const [keyword, setKeyword] = useState('');

  // 收藏：拉一次代码数组，渲染时 O(1) 查表
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



  // 两个池子各自独立，用 Tab 切换；since / 刷新由本页统一控制
  const [activeTab, setActiveTab] = useState('pullback');
  const [refreshKey, setRefreshKey] = useState(0);
  // 今日池内涨停标记：拉一次做 O(1) 查表
  const limitupMap = usePoolLimitupMap(refreshKey);

  const [lowvolLoading, setLowvolLoading] = useState(false);
  const [pullbackLoading, setPullbackLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);

  // ── 数据 ────────────────────────────────────────────
  const [list, setList] = useState<WatchItem[]>([]);
  const [stats, setStats] = useState<WatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── 详情抽屉 / K线弹窗 ───────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<WatchItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [klineStock, setKlineStock] = useState<{ code: string; name?: string } | null>(null);

  // ── 加载列表 ────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await watchPoolAPI.getWatchList({
        status: status === 'all' ? undefined : status,
        entry_type: entryType === 'all' ? undefined : entryType,
        board_group: boardGroup === 'all' ? undefined : boardGroup,
        exclude_broke: excludeBroke || undefined,
        since: since ? since.format('YYYY-MM-DD') : undefined,
        order_by: orderBy,
        limit: 200,
      });
      setList(data ?? []);
    } catch (err: any) {
      message.error(err?.message || '加载监控池列表失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [status, entryType, boardGroup, excludeBroke, since, orderBy]);

  // ── 加载统计 ────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      setStats(await watchPoolAPI.getWatchStats(since ? since.format('YYYY-MM-DD') : undefined));
    } catch (err) {
      console.error('加载监控池统计失败:', err);
      setStats(null);
    }
  }, [since]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);   // 触发低位放量池重新拉取
    await Promise.all([loadList(), loadStats()]);
    setIsRefreshing(false);
  };

  // ── 打开个股详情 ────────────────────────────────────
  const openDetail = async (row: WatchItem) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setDetail(await watchPoolAPI.getWatchDetail(row.code, row.trigger_date));
    } catch (err: any) {
      // 详情接口经外网代理时可能返回 503，退回列表已有数据，仅缺 track 曲线
      setDetail(row);
      setDetailError(err?.message || '加载个股详情失败，已展示列表中的数据（缺演化曲线）');
    } finally {
      setDetailLoading(false);
    }
  };

  // ── 表格列 ──────────────────────────────────────────
  const columns: ColumnsType<WatchItem> = [
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      width: 122,
      fixed: 'left',
      render: (code: string, row) => (
        <span className={styles.codeCell}>
          <FavStar code={code} favCodes={favCodes} onChange={handleFavChange} />
          <a className={styles.codeLink} onClick={() => setKlineStock({ code, name: row.name })}>{code}</a>
        </span>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 116,
      fixed: 'left',
      render: (name: string, row) => (
        <span className={styles.nameCell}>
          <a className={styles.nameLink} onClick={() => openDetail(row)}>{name}</a>
          <LimitupBadge code={row.code} map={limitupMap} />
          {row.broke_open_date && (
            <Tooltip title={`已于 ${row.broke_open_date} 跌破首板日开盘价，走弱信号`}>
              <span className={styles.brokeBadge}>破</span>
            </Tooltip>
          )}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 88,
      align: 'center',
      render: (s: WatchStatus, row) => {
        const color = s === 'hit' ? 'red' : s === 'watching' ? 'blue' : 'default';
        const tip = s === 'hit'
          ? `${row.hit_date} 再次涨停（第 ${row.hit_days} 个交易日）`
          : s === 'expired'
            ? `30日窗口已走完（${row.expire_date ?? '—'}）未再涨停`
            : `已跟踪 ${row.days_in_pool} 个交易日`;
        return <Tooltip title={tip}><Tag color={color}>{STATUS_LABELS[s]}</Tag></Tooltip>;
      },
    },
    {
      title: '类型',
      dataIndex: 'entry_type',
      key: 'entry_type',
      width: 92,
      align: 'center',
      render: (t: WatchEntryType, row) => (
        <Tooltip title={t === 'consecutive'
          ? `首板起连了 ${row.consec_boards} 个板，连板组历史命中率约为孤板的两倍`
          : '首板后未连板'}>
          <Tag color={t === 'consecutive' ? 'volcano' : 'default'}>
            {ENTRY_TYPE_LABELS[t]}{t === 'consecutive' ? ` ${row.consec_boards}` : ''}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: '首板日',
      dataIndex: 'trigger_date',
      key: 'trigger_date',
      width: 108,
      render: (d: string) => <span className={styles.muted}>{d}</span>,
    },
    {
      title: '首板收盘',
      dataIndex: 'trigger_close',
      key: 'trigger_close',
      width: 92,
      align: 'right',
      render: (v: number) => fmtNum(v),
    },
    {
      title: '放量倍数',
      dataIndex: 'trigger_vol_ratio',
      key: 'trigger_vol_ratio',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.trigger_vol_ratio - b.trigger_vol_ratio,
      render: (v: number) => {
        const level = volRatioLevel(v);
        const tip = level === 'danger'
          ? '≥6倍：历史命中率仅 18.8%，多为一日游资金对倒'
          : level === 'warn'
            ? '4~6倍：历史命中率 32.6%，偏高'
            : level === 'good'
              ? '<2倍：历史命中率 43.1%，最优区间'
              : '2~4倍：历史命中率 40.2%';
        return (
          <Tooltip title={tip}>
            <span className={`${styles.volRatio} ${styles[level]}`}>{v.toFixed(2)}x</span>
          </Tooltip>
        );
      },
    },
    {
      title: '距低点',
      dataIndex: 'gain_from_low',
      key: 'gain_from_low',
      width: 92,
      align: 'right',
      sorter: (a, b) => a.gain_from_low - b.gain_from_low,
      render: (v: number) => (
        <Tooltip title="距过去120个交易日最低收盘价的涨幅，越小越低位">
          <span>{fmtPct(v)}</span>
        </Tooltip>
      ),
    },
    {
      title: '跟踪评分',
      dataIndex: 'live_score',
      key: 'live_score',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.live_score - b.live_score,
      render: (v: number) => (
        <Tooltip title="随行情更新：连板加分、跌破首板开盘价打折">
          <span className={`${styles.scoreVal} ${scoreClass(v)}`}>{(v * 100).toFixed(1)}</span>
        </Tooltip>
      ),
    },
    {
      title: '入池评分',
      dataIndex: 'entry_score',
      key: 'entry_score',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.entry_score - b.entry_score,
      render: (v: number) => (
        <Tooltip title="仅用首板当天的信息算出，入池后不再变化">
          <span className={styles.scoreMuted}>{(v * 100).toFixed(1)}</span>
        </Tooltip>
      ),
    },
    {
      title: '最新涨跌',
      dataIndex: 'last_ret_since',
      key: 'last_ret_since',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.last_ret_since - b.last_ret_since,
      render: (v: number) => (
        <Tooltip title="最新一天相对首板日收盘价的累计涨跌幅">
          <span className={retClass(v)}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
    {
      title: '量比',
      dataIndex: 'last_amount_ratio',
      key: 'last_amount_ratio',
      width: 84,
      align: 'right',
      render: (v: number) => (
        <Tooltip title="最新一天成交额 / 首板日成交额">
          <span>{fmtNum(v)}x</span>
        </Tooltip>
      ),
    },
    {
      title: '横盘',
      dataIndex: 'flat_days',
      key: 'flat_days',
      width: 78,
      align: 'right',
      render: (v: number | null) => (
        <Tooltip title="低位横盘天数，仅作展示，与命中率相关性接近于 0">
          <span className={styles.muted}>{v == null ? '—' : `${v}天`}</span>
        </Tooltip>
      ),
    },
    {
      title: '池龄',
      dataIndex: 'days_in_pool',
      key: 'days_in_pool',
      width: 78,
      align: 'right',
      render: (v: number | null) => <span className={styles.muted}>{v == null ? '—' : `${v}天`}</span>,
    },
    {
      title: '板块',
      dataIndex: 'board_group',
      key: 'board_group',
      width: 84,
      align: 'center',
      render: (g: BoardGroup) => <span className={styles.muted}>{g === 'main' ? '主板' : '非主板'}</span>,
    },
  ];

  // ── 关键词过滤（名称 / 代码）────────────────────────
  const filteredList = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter(
      (r) => r.name?.toLowerCase().includes(kw) || r.code?.toLowerCase().includes(kw)
    );
  }, [list, keyword]);

  // ── 详情演化曲线数据 ────────────────────────────────
  const track: WatchTrackPoint[] = detail?.track ?? [];
  const limitUpPoints = track.filter((p) => p.is_limit_up);

  // ── 低位首板池 Tab 内容 ─────────────────────────────
  const watchTab = (
    <>
      {/* ── 统计条 ───────────────────────────────────── */}
      {SHOW_STATS_BAR && stats && (
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>池中总数</span>
            <span className={styles.statValue}>{stats.total}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>跟踪中</span>
            <span className={`${styles.statValue} ${styles.statWatching}`}>{stats.watching}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>已命中</span>
            <span className={`${styles.statValue} ${styles.statHit}`}>{stats.hit}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>已到期</span>
            <span className={styles.statValue}>{stats.expired}</span>
          </div>

          <div className={styles.statDivider} />

          <div className={styles.statItem}>
            <Tooltip title="30日窗口内再次涨停的比例，按入池类型分组，比总体粗命中率可信">
              <span className={styles.statLabel}>连板组命中</span>
            </Tooltip>
            <span className={`${styles.statValue} ${styles.statHit}`}>
              {fmtPct(stats.by_entry_type?.consecutive)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>孤板组命中</span>
            <span className={styles.statValue}>{fmtPct(stats.by_entry_type?.solo)}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>平均命中天数</span>
            <span className={styles.statValue}>{fmtNum(stats.avg_hit_days, 1)}天</span>
          </div>
          <div className={styles.statItem}>
            <Tooltip title="hit/(hit+expired)，新入池的票一旦命中就立刻结算进分母，存在幸存者偏差；只统计30日窗口走完的世代真实值约 33.9%。对外展示请用上面的分组命中率。">
              <span className={`${styles.statLabel} ${styles.statLabelInfo}`}>粗命中率 ⓘ</span>
            </Tooltip>
            <span className={`${styles.statValue} ${styles.statBiased}`}>{fmtPct(stats.hit_rate)}</span>
          </div>

          {stats.benchmark_hint && (
            <div className={styles.benchmarkHint}>{stats.benchmark_hint}</div>
          )}
        </div>
      )}

      {/* ── 列表 ─────────────────────────────────────── */}
      <DataSection
        className={styles.section}
        title="监控池列表"
        subtitle={keyword.trim() ? `${filteredList.length} / ${list.length} 只` : `${list.length} 只`}
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
            <Segmented
              size="small"
              value={status}
              onChange={(v) => setStatus(v as WatchStatus | 'all')}
              options={STATUS_OPTIONS}
            />
            <Segmented
              size="small"
              value={entryType}
              onChange={(v) => setEntryType(v as WatchEntryType | 'all')}
              options={[
                { label: '全类型', value: 'all' },
                { label: '连板', value: 'consecutive' },
                { label: '孤板', value: 'solo' },
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
              value={orderBy}
              onChange={(v) => setOrderBy(v as WatchOrderBy)}
              options={ORDER_OPTIONS}
              size="small"
              style={{ width: 112 }}
            />
            <Tooltip title="剔除已跌破首板日开盘价的票：这批命中率约 34%，未跌破的约 51%">
              <span className={styles.switchWrap}>
                <Switch size="small" checked={excludeBroke} onChange={setExcludeBroke} />
                <span className={styles.switchLabel}>剔除破位</span>
              </span>
            </Tooltip>
          </div>
        }
      >
        <Table
          rowKey={(r: any) => (r.__groupDate ? `g-${r.__groupDate}` : `${r.code}-${r.trigger_date}`)}
          columns={withGroupHeaderColumns<WatchItem>(columns, '首板日')}
          dataSource={groupByDate(filteredList, 'trigger_date')}
          loading={loading}
          size="middle"
          pagination={{ pageSize: 30, showSizeChanger: false, showTotal: (t) => `共 ${t} 只` }}
          scroll={{ x: 1386 }}
          rowClassName={groupRowClassName<WatchItem>((row) => (row.broke_open_date ? styles.rowBroke : ''))}
          locale={{
            emptyText: (
              <Empty description={keyword.trim() ? `未匹配到「${keyword.trim()}」` : '当前筛选条件下无数据'} />
            ),
          }}
        />
      </DataSection>
    </>
  );

  return (
    <div className={`${styles.watchPool} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <TopProgressBar isVisible={loading || isRefreshing || lowvolLoading || pullbackLoading || favLoading || alertLoading} />

      <PageHeader
        title="监控池"
        subtitle="回踩池 / 低位首板池 / 低位放量池 / 盘中预警 / 我的收藏"
        icon="🎣"
      >
        <div className={styles.headerActions}>
          <DatePicker
            value={since}
            onChange={setSince}
            allowClear
            placeholder="触发日起始"
          />
          <CoolRefreshButton onClick={handleRefresh} loading={isRefreshing} />
        </div>
      </PageHeader>

      {/* 板块轮动看板 */}
      <RotationBoard refreshKey={refreshKey} />

      {/* 当天池内涨停状态栏 */}
      <PoolLimitupBar refreshKey={refreshKey} onOpenKline={setKlineStock} />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'pullback',
            label: '回踩池',
            children: (
              <PullbackPanel
                since={since}
                refreshKey={refreshKey}
                onLoadingChange={setPullbackLoading}
                onOpenKline={setKlineStock}
              />
            ),
          },
          { key: 'watch', label: '低位首板池', children: watchTab },
          {
            key: 'lowvol',
            label: '低位放量池',
            children: (
              <LowvolPanel
                since={since}
                refreshKey={refreshKey}
                onLoadingChange={setLowvolLoading}
                onOpenKline={setKlineStock}
              />
            ),
          },
          {
            key: 'alerts',
            label: '盘中预警',
            children: (
              <AlertPanel
                refreshKey={refreshKey}
                onLoadingChange={setAlertLoading}
                onOpenKline={setKlineStock}
              />
            ),
          },
          {
            key: 'favorite',
            label: '我的收藏',
            children: (
              <FavoritePanel
                refreshKey={refreshKey}
                onLoadingChange={setFavLoading}
                onOpenKline={setKlineStock}
              />
            ),
          },
        ]}
      />

      {/* ── 个股详情抽屉 ─────────────────────────────── */}
      <Drawer
        title={detail ? `${detail.name} ${detail.code}` : '个股详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={720}
        loading={detailLoading}
      >
        {detail && (
          <div className={styles.detail}>
            {detailError && <div className={styles.detailWarn}>{detailError}</div>}

            <div className={styles.detailMeta}>
              <Tag color={detail.status === 'hit' ? 'red' : detail.status === 'watching' ? 'blue' : 'default'}>
                {STATUS_LABELS[detail.status]}
              </Tag>
              <Tag color={detail.entry_type === 'consecutive' ? 'volcano' : 'default'}>
                {ENTRY_TYPE_LABELS[detail.entry_type]}
                {detail.entry_type === 'consecutive' ? ` ${detail.consec_boards}板` : ''}
              </Tag>
              <Tag>{detail.board_group === 'main' ? '主板' : '非主板'}</Tag>
              {detail.broke_open_date && <Tag color="orange">{detail.broke_open_date} 破首板开盘</Tag>}
              <a className={styles.klineLink} onClick={() => setKlineStock({ code: detail.code, name: detail.name })}>
                查看K线 →
              </a>
            </div>

            {/* 关键字段 */}
            <div className={styles.detailGrid}>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>首板日</span>
                <span className={styles.detailValue}>{detail.trigger_date}</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>首板收盘</span>
                <span className={styles.detailValue}>{fmtNum(detail.trigger_close)}</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>首板涨幅</span>
                <span className={`${styles.detailValue} ${retClass(detail.trigger_pct)}`}>
                  {fmtPct(detail.trigger_pct, true)}
                </span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>放量倍数</span>
                <span className={`${styles.detailValue} ${styles[volRatioLevel(detail.trigger_vol_ratio)]}`}>
                  {fmtNum(detail.trigger_vol_ratio)}x
                </span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>距120日低点</span>
                <span className={styles.detailValue}>{fmtPct(detail.gain_from_low)}</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>低位横盘</span>
                <span className={styles.detailValue}>{detail.flat_days} 天</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>已跟踪</span>
                <span className={styles.detailValue}>{detail.days_in_pool} 个交易日</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>
                  {detail.status === 'hit' ? '命中日' : '窗口末日'}
                </span>
                <span className={styles.detailValue}>
                  {detail.status === 'hit'
                    ? `${detail.hit_date}（第${detail.hit_days}日）`
                    : detail.expire_date ?? '窗口未走满'}
                </span>
              </div>
            </div>

            {/* 入池评分分项 */}
            <div className={styles.detailSectionTitle}>
              入池评分 <span className={styles.scoreTotal}>{(detail.entry_score * 100).toFixed(1)}</span>
              <span className={styles.detailSectionHint}>· 跟踪评分 {(detail.live_score * 100).toFixed(1)}</span>
            </div>
            {/* 两种形态的评分分项不同，按实际返回的键渲染 */}
            <div className={styles.factorList}>
              {Object.entries(detail.entry_scores ?? {}).map(([key, raw]) => {
                const val = (raw ?? 0) * 100;
                const pct = Math.max(0, Math.min(100, val));
                return (
                  <div key={key} className={styles.factorRow}>
                    <span className={styles.factorLabel}>{ENTRY_SCORE_LABELS[key] ?? key}</span>
                    <div className={styles.factorBarTrack}>
                      <div className={styles.factorBarFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.factorVal}>{val.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>

            {/* 演化曲线 */}
            <div className={styles.detailSectionTitle}>
              入池后演化（{track.length} 个交易日）
              {limitUpPoints.length > 0 && (
                <span className={styles.detailSectionHint}>· 涨停 {limitUpPoints.length} 次</span>
              )}
            </div>
            {track.length > 0 ? (
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={track} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="trade_date" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}x`} />
                    <ReTooltip
                      formatter={(value: any, name: any) =>
                        name === '相对首板涨跌' ? `${Number(value).toFixed(2)}%` : `${Number(value).toFixed(2)}x`
                      }
                      labelFormatter={(label: any) => {
                        const p = track.find((t) => t.trade_date === label);
                        return `${label}${p?.is_limit_up ? ' · 涨停' : ''}（第${p?.days_since ?? '—'}日）`;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine yAxisId="left" y={0} stroke="#9ca3af" strokeDasharray="4 4" />
                    {limitUpPoints.map((p) => (
                      <ReferenceLine
                        key={p.trade_date}
                        yAxisId="left"
                        x={p.trade_date}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                      />
                    ))}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="ret_since"
                      name="相对首板涨跌"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="amount_ratio"
                      name="成交额比"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="无跟踪记录" />
            )}

            {/* 逐日明细 */}
            {track.length > 0 && (
              <>
                <div className={styles.detailSectionTitle}>逐日明细</div>
                <div className={styles.trackList}>
                  {track.map((p) => (
                    <div key={p.trade_date} className={`${styles.trackRow} ${p.is_limit_up ? styles.trackLimitUp : ''}`}>
                      <span className={styles.trackDate}>{p.trade_date}</span>
                      <span className={styles.trackDay}>D{p.days_since}</span>
                      <span className={styles.trackClose}>{fmtNum(p.close)}</span>
                      <span className={`${styles.trackCell} ${retClass(p.pct_chg)}`}>{fmtPct(p.pct_chg, true)}</span>
                      <span className={`${styles.trackCell} ${retClass(p.ret_since)}`}>{fmtPct(p.ret_since, true)}</span>
                      <span className={styles.trackAmount}>{fmtNum(p.amount_ratio)}x</span>
                      {p.is_limit_up && <Tag color="red">涨停</Tag>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>

      {/* K线弹窗 */}
      {klineStock && (
        <AStockKlineModal
          code={klineStock.code}
          name={klineStock.name}
          isDark={document.documentElement.classList.contains('dark')}
          sidebarCollapsed={isSidebarCollapsed}
          onClose={() => setKlineStock(null)}
        />
      )}
    </div>
  );
};

export default WatchPool;
