import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Drawer, message, Tooltip, Empty, Segmented, Switch, Input } from 'antd';
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
import styles from '../../pages/WatchPool.module.scss';
import { DataSection } from '../ui';
import FavStar from './FavStar';
import LimitupBadge, { usePoolLimitupMap } from './LimitupBadge';
import { favoriteAPI } from '../../services/favoriteAPI';
import { groupByDate, withGroupHeaderColumns, groupRowClassName } from './dateGroup';
import {
  pullbackAPI,
  PullbackItem,
  PullbackStats,
  PullbackStatus,
  PullbackEntryKind,
  PullbackRhythm,
  PullbackTrackPoint,
  PULLBACK_STATUS_LABELS,
  PULLBACK_STATUS_HINTS,
  ENTRY_KIND_LABELS,
  distLevel,
} from '../../services/pullbackAPI';
import type { BoardGroup } from '../../services/astockAPI';

interface PullbackPanelProps {
  since: Dayjs | null;
  refreshKey: number;
  onLoadingChange?: (loading: boolean) => void;
  onOpenKline: (stock: { code: string; name?: string }) => void;
}

// 状态机已拆细，这里只放常用的几个；armed/triggered 的区分正是
// 「第一波登记 vs 第二波报警」
const STATUS_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '待回踩', value: 'armed' },
  { label: '已报警', value: 'triggered' },
  { label: '已命中', value: 'hit' },
  { label: '已结算', value: 'settled' },
];

// 后端返回的已是百分比数值，直接加 % 号
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

// 距均线偏离：贴近均线说明回踩到位
const distClass = (v: number | null | undefined): string => {
  const lv = distLevel(v);
  return lv === 'near' ? styles.good : lv === 'mid' ? styles.normal : styles.warn;
};

const PullbackPanel: React.FC<PullbackPanelProps> = ({ since, refreshKey, onLoadingChange, onOpenKline }) => {
  // ── 筛选条件 ────────────────────────────────────────
  // 用新状态名：旧的 watching 已废弃（后端虽有别名映射但语义不准）
  const [status, setStatus] = useState<PullbackStatus | 'all'>('triggered');
  const [entryKind, setEntryKind] = useState<PullbackEntryKind | 'all'>('all');
  const [boardGroup, setBoardGroup] = useState<BoardGroup | 'all'>('main');
  const [excludeBroke, setExcludeBroke] = useState(false);
  const [onlyHot, setOnlyHot] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [keyword, setKeyword] = useState('');

  // 收藏：拉一次代码数组，渲染时 O(1) 查表

  // 今日池内涨停标记：拉一次做 O(1) 查表
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
  const [list, setList] = useState<PullbackItem[]>([]);
  const [stats, setStats] = useState<PullbackStats | null>(null);
  const [loading, setLoading] = useState(true);

  // ── 详情抽屉 ────────────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PullbackItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const data = await pullbackAPI.getList({
        status: status === 'all' ? undefined : status,
        entry_kind: entryKind === 'all' ? undefined : entryKind,
        board_group: boardGroup === 'all' ? undefined : boardGroup,
        exclude_broke: excludeBroke || undefined,
        only_hot: onlyHot || undefined,
        only_fav: onlyFav || undefined,
        since: since ? since.format('YYYY-MM-DD') : undefined,
        limit: 200,
      });
      setList(data ?? []);
    } catch (err: any) {
      message.error(err?.message || '加载回踩池失败');
      setList([]);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
    // onLoadingChange 由父级内联定义，不入依赖以免每次渲染都重新请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, entryKind, boardGroup, excludeBroke, onlyHot, onlyFav, since]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await pullbackAPI.getStats(since ? since.format('YYYY-MM-DD') : undefined));
    } catch (err) {
      console.error('加载回踩池统计失败:', err);
      setStats(null);
    }
  }, [since]);

  useEffect(() => { loadList(); }, [loadList, refreshKey]);
  useEffect(() => { loadStats(); }, [loadStats, refreshKey]);

  const openDetail = async (row: PullbackItem) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const d = await pullbackAPI.getDetail(row.code);
      // ⚠️ /api/pullback/{code} 不接受日期参数，同一只票有多条回踩记录时
      // 它只返回其中一条，可能不是点开的这行（实测 600969 有 3 条）。
      // 对不上就以行数据为准，只借用详情里的 track 序列。
      const sameRecord =
        d?.breakout_date === row.breakout_date && d?.pullback_date === row.pullback_date;
      if (sameRecord) {
        setDetail(d);
      } else {
        setDetail({ ...row, track: d?.track ?? [] });
        setDetailError(
          `该票有多条回踩记录，详情接口返回的是突破日 ${d?.breakout_date ?? '—'} 那条；` +
          '下方字段已按你点击的这条展示，跟踪曲线来自接口返回的记录，可能不对应'
        );
      }
    } catch (err: any) {
      // 详情接口经外网代理时可能返回 503，退回列表已有数据，仅缺跟踪曲线
      setDetail(row);
      setDetailError(err?.message || '加载个股详情失败，已展示列表中的数据（缺跟踪曲线）');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredList = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter(
      (r) => r.name?.toLowerCase().includes(kw) || r.code?.toLowerCase().includes(kw)
    );
  }, [list, keyword]);

  const columns: ColumnsType<PullbackItem> = [
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      width: 122,
      fixed: 'left',
      render: (code: string, row) => (
        <span className={styles.codeCell}>
          <FavStar code={code} favCodes={favCodes} onChange={handleFavChange} />
          <a className={styles.codeLink} onClick={() => onOpenKline({ code, name: row.name })}>{code}</a>
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
          {row.broke_date && (
            <Tooltip title={`已于 ${row.broke_date} 跌破关键位，走弱信号`}>
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
      render: (s: PullbackStatus, row) => {
        const color =
          s === 'hit' ? 'red'
            : s === 'triggered' ? 'volcano'
              : s === 'armed' ? 'blue'
                : s === 'settled' ? 'green'
                  : s === 'missed' || s === 'failed' ? 'orange'
                    : 'default';
        const extra = s === 'hit'
          ? `：${row.hit_date}（第 ${row.hit_days} 个交易日）`
          : s === 'armed' && row.armed_date
            ? `：${row.armed_date} 登记`
            : s === 'settled' && row.expire_date
              ? `：${row.expire_date} 结算`
              : '';
        return (
          <Tooltip title={(PULLBACK_STATUS_HINTS[s] ?? s) + extra}>
            <Tag color={color}>{PULLBACK_STATUS_LABELS[s] ?? s}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '入池方式',
      dataIndex: 'entry_kind',
      key: 'entry_kind',
      width: 100,
      align: 'center',
      render: (k: PullbackEntryKind, row) => (
        <Tooltip title={k === 'limitup'
          ? `涨停突破入池${row.breakout_boards ? `（${row.breakout_boards}板）` : ''}`
          : `连涨 ${row.streak_days} 天累计 ${fmtPct(row.streak_gain)} 后入池`}>
          <Tag color={k === 'limitup' ? 'volcano' : 'geekblue'}>
            {ENTRY_KIND_LABELS[k] ?? k}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: '节奏',
      dataIndex: 'rhythm',
      key: 'rhythm',
      width: 72,
      align: 'center',
      render: (r: PullbackRhythm | null) => {
        if (!r) return <span className={styles.muted}>—</span>;
        const hint =
          r === '急' ? '若涨停预计 T+1~T+2（实测快速涨停 11.90%，总命中 26.58%）'
            : r === '中' ? '若涨停预计一周内（实测快速涨停 3.58%，总命中 12.49%）'
              : '不具备急涨特征——是排除法的结果，非"预计慢慢涨"。总命中仅 8.19%，多数根本不涨';
        return (
          <Tooltip title={`${hint}。仅用于设定持有预期，不要拿它筛票`}>
            <Tag color={r === '急' ? 'red' : r === '中' ? 'orange' : 'default'}>{r}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '热度',
      dataIndex: 'hot_score',
      key: 'hot_score',
      width: 148,
      sorter: (a, b) => (a.hot_score ?? -1) - (b.hot_score ?? -1),
      render: (v: number | null, row) => {
        if (v === null || v === undefined) return <span className={styles.muted}>—</span>;
        const concepts = row.hot_concepts ?? [];
        return (
          <Tooltip
            title={
              concepts.length
                ? `热门概念：${concepts.join('、')}${
                    row.top_concept_pct != null ? `；龙头概念当日 ${fmtPct(row.top_concept_pct, true)}` : ''
                  }`
                : '命中热门概念'
            }
          >
            <span className={styles.hotCell}>
              <span className={styles.hotScore}>{fmtNum(v, 1)}</span>
              {concepts[0] && <span className={styles.hotConcept}>{concepts[0]}</span>}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '突破日',
      dataIndex: 'breakout_date',
      key: 'breakout_date',
      width: 106,
      render: (d: string) => <span className={styles.muted}>{d}</span>,
    },
    {
      title: '回踩日',
      dataIndex: 'pullback_date',
      key: 'pullback_date',
      width: 106,
      render: (d: string) => d,
    },
    {
      title: '回踩价',
      dataIndex: 'pullback_close',
      key: 'pullback_close',
      width: 88,
      align: 'right',
      render: (v: number) => fmtNum(v),
    },
    {
      title: '距高点',
      dataIndex: 'drawdown_from_peak',
      key: 'drawdown_from_peak',
      width: 94,
      align: 'right',
      sorter: (a, b) => (a.drawdown_from_peak ?? 0) - (b.drawdown_from_peak ?? 0),
      render: (v: number, row) => (
        <Tooltip title={`高点 ${fmtNum(row.peak_close)}，已回撤 ${fmtPct(v)}`}>
          <span className={styles.negative}>{fmtPct(v)}</span>
        </Tooltip>
      ),
    },
    {
      title: '距MA5',
      dataIndex: 'dist_ma5',
      key: 'dist_ma5',
      width: 88,
      align: 'right',
      sorter: (a, b) => Math.abs(a.dist_ma5 ?? 99) - Math.abs(b.dist_ma5 ?? 99),
      render: (v: number) => (
        <Tooltip title="距 MA5 的偏离，越接近 0 说明回踩到位">
          <span className={distClass(v)}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
    {
      title: '距MA10',
      dataIndex: 'dist_ma10',
      key: 'dist_ma10',
      width: 92,
      align: 'right',
      sorter: (a, b) => Math.abs(a.dist_ma10 ?? 99) - Math.abs(b.dist_ma10 ?? 99),
      render: (v: number) => (
        <Tooltip title="距 MA10 的偏离，越接近 0 说明回踩到位">
          <span className={distClass(v)}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
    },
    {
      title: '连涨',
      key: 'streak',
      width: 104,
      align: 'right',
      sorter: (a, b) => (a.streak_gain ?? 0) - (b.streak_gain ?? 0),
      render: (_, row) => (
        <Tooltip title={`连涨 ${row.streak_days} 天，累计 ${fmtPct(row.streak_gain)}`}>
          <span>
            <span className={styles.muted}>{row.streak_days}天</span>{' '}
            <span className={retClass(row.streak_gain)}>{fmtPct(row.streak_gain)}</span>
          </span>
        </Tooltip>
      ),
    },
    {
      title: '缩量',
      dataIndex: 'pullback_vol_ratio',
      key: 'pullback_vol_ratio',
      width: 84,
      align: 'right',
      render: (v: number) => (
        <Tooltip title="回踩日成交量 / 突破日成交量，缩量回踩更健康">
          <span className={v < 1 ? styles.good : styles.normal}>{fmtNum(v)}x</span>
        </Tooltip>
      ),
    },
    {
      title: '最大收益',
      dataIndex: 'max_ret',
      key: 'max_ret',
      width: 96,
      align: 'right',
      sorter: (a, b) => (a.max_ret ?? 0) - (b.max_ret ?? 0),
      render: (v: number | null) => <span className={retClass(v)}>{fmtPct(v, true)}</span>,
    },
    {
      title: '最新',
      dataIndex: 'last_ret_since',
      key: 'last_ret_since',
      width: 92,
      align: 'right',
      sorter: (a, b) => (a.last_ret_since ?? 0) - (b.last_ret_since ?? 0),
      render: (v: number | null) => (
        <Tooltip title="相对回踩日收盘价的累计涨跌">
          <span className={retClass(v)}>{fmtPct(v, true)}</span>
        </Tooltip>
      ),
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

  const track: PullbackTrackPoint[] = detail?.track ?? [];
  const limitUpPoints = track.filter((p) => p.is_limit_up);

  return (
    <>
      {/* ── 统计条 ─────────────────────────────────── */}
      {stats && (
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>池中总数</span>
            <span className={styles.statValue}>{stats.total}</span>
          </div>
          {/* stats 的 watching/expired 是旧状态名遗留字段，值其实是
              triggered/settled，标签按真实语义写，优先用 by_status */}
          <div className={styles.statItem}>
            <Tooltip title={PULLBACK_STATUS_HINTS.triggered}>
              <span className={`${styles.statLabel} ${styles.statLabelInfo}`}>已报警</span>
            </Tooltip>
            <span className={`${styles.statValue} ${styles.statWatching}`}>
              {stats.by_status?.triggered ?? stats.watching}
            </span>
          </div>
          {stats.by_status?.armed !== undefined && (
            <div className={styles.statItem}>
              <Tooltip title={PULLBACK_STATUS_HINTS.armed}>
                <span className={`${styles.statLabel} ${styles.statLabelInfo}`}>待回踩</span>
              </Tooltip>
              <span className={styles.statValue}>{stats.by_status.armed}</span>
            </div>
          )}
          <div className={styles.statItem}>
            <Tooltip title={PULLBACK_STATUS_HINTS.hit}>
              <span className={`${styles.statLabel} ${styles.statLabelInfo}`}>已命中</span>
            </Tooltip>
            <span className={`${styles.statValue} ${styles.statHit}`}>
              {stats.by_status?.hit ?? stats.hit}
            </span>
          </div>
          <div className={styles.statItem}>
            <Tooltip title={PULLBACK_STATUS_HINTS.settled}>
              <span className={`${styles.statLabel} ${styles.statLabelInfo}`}>已结算</span>
            </Tooltip>
            <span className={styles.statValue}>
              {stats.by_status?.settled ?? stats.expired}
            </span>
          </div>

          <div className={styles.statDivider} />

          <div className={styles.statItem}>
            <Tooltip title="本形态尚未回测验证，该数字无历史基准可比，不能当作策略胜率">
              <span className={`${styles.statLabel} ${styles.statLabelInfo}`}>命中率 ⓘ</span>
            </Tooltip>
            <span className={`${styles.statValue} ${styles.statBiased}`}>{fmtPct(stats.hit_rate)}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>平均命中天数</span>
            <span className={styles.statValue}>{fmtNum(stats.avg_hit_days, 1)}天</span>
          </div>
          <div className={styles.statItem}>
            <Tooltip title="跟踪期内触及的最大收益（非可实现收益）">
              <span className={styles.statLabel}>平均最大收益</span>
            </Tooltip>
            <span className={`${styles.statValue} ${retClass(stats.avg_max_ret)}`}>
              {fmtPct(stats.avg_max_ret, true)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>平均T+5</span>
            <span className={`${styles.statValue} ${retClass(stats.avg_ret5)}`}>
              {fmtPct(stats.avg_ret5, true)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>平均T+10</span>
            <span className={`${styles.statValue} ${retClass(stats.avg_ret10)}`}>
              {fmtPct(stats.avg_ret10, true)}
            </span>
          </div>

          {stats.by_entry_kind && (
            <>
              <div className={styles.statDivider} />
              {(Object.keys(ENTRY_KIND_LABELS) as PullbackEntryKind[]).map((k) =>
                stats.by_entry_kind?.[k] === undefined ? null : (
                  <div key={k} className={styles.statItem}>
                    <span className={styles.statLabel}>{ENTRY_KIND_LABELS[k]}命中</span>
                    <span className={styles.statValue}>{fmtPct(stats.by_entry_kind[k])}</span>
                  </div>
                )
              )}
            </>
          )}

          {/* 后端给的口径提醒原样展示——本形态尚未回测验证 */}
          {stats.note && <div className={styles.noticeHint}>⚠️ {stats.note}</div>}
        </div>
      )}

      {/* ── 列表 ───────────────────────────────────── */}
      <DataSection
        className={styles.section}
        title="回踩池"
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
              onChange={(v) => setStatus(v as PullbackStatus | 'all')}
              options={STATUS_OPTIONS}
            />
            <Segmented
              size="small"
              value={entryKind}
              onChange={(v) => setEntryKind(v as PullbackEntryKind | 'all')}
              options={[
                { label: '全方式', value: 'all' },
                { label: '涨停突破', value: 'limitup' },
                { label: '连涨突破', value: 'streak' },
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
            <Tooltip title="只看已收藏的票">
              <span className={styles.switchWrap}>
                <Switch size="small" checked={onlyFav} onChange={setOnlyFav} />
                <span className={styles.switchLabel}>只看收藏</span>
              </span>
            </Tooltip>
            <Tooltip title="只看命中当日热门概念/题材的票（hot_score 非空）">
              <span className={styles.switchWrap}>
                <Switch size="small" checked={onlyHot} onChange={setOnlyHot} />
                <span className={styles.switchLabel}>只看热门</span>
              </span>
            </Tooltip>
            <Tooltip title="剔除已跌破关键位的票">
              <span className={styles.switchWrap}>
                <Switch size="small" checked={excludeBroke} onChange={setExcludeBroke} />
                <span className={styles.switchLabel}>剔除破位</span>
              </span>
            </Tooltip>
          </div>
        }
      >
        <Table
          rowKey={(r: any) =>
            r.__groupDate ? `g-${r.__groupDate}` : `${r.code}-${r.breakout_date}-${r.pullback_date}`}
          columns={withGroupHeaderColumns<PullbackItem>(columns, '回踩日')}
          dataSource={groupByDate(filteredList, 'pullback_date')}
          loading={loading}
          size="middle"
          pagination={{ pageSize: 30, showSizeChanger: false, showTotal: (t) => `共 ${t} 只` }}
          scroll={{ x: 1726 }}
          rowClassName={groupRowClassName<PullbackItem>((row) => (row.broke_date ? styles.rowBroke : ''))}
          locale={{
            emptyText: (
              <Empty description={keyword.trim() ? `未匹配到「${keyword.trim()}」` : '当前筛选条件下无数据'} />
            ),
          }}
        />
      </DataSection>

      {/* ── 详情抽屉 ───────────────────────────────── */}
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
              <Tooltip title={PULLBACK_STATUS_HINTS[detail.status] ?? ''}>
                <Tag
                  color={
                    detail.status === 'hit' ? 'red'
                      : detail.status === 'triggered' ? 'volcano'
                        : detail.status === 'armed' ? 'blue'
                          : detail.status === 'settled' ? 'green'
                            : detail.status === 'missed' || detail.status === 'failed' ? 'orange'
                              : 'default'
                  }
                >
                  {PULLBACK_STATUS_LABELS[detail.status] ?? detail.status}
                </Tag>
              </Tooltip>
              <Tag color={detail.entry_kind === 'limitup' ? 'volcano' : 'geekblue'}>
                {ENTRY_KIND_LABELS[detail.entry_kind] ?? detail.entry_kind}
              </Tag>
              <Tag>{detail.board_group === 'main' ? '主板' : '非主板'}</Tag>
              {detail.first_board && <Tag color="red">首板</Tag>}
              {detail.broke_date && <Tag color="orange">{detail.broke_date} 破位</Tag>}
              {(detail.hot_concepts ?? []).map((c) => (
                <Tag key={c} color="gold">{c}</Tag>
              ))}
              <a className={styles.klineLink} onClick={() => onOpenKline({ code: detail.code, name: detail.name })}>
                查看K线 →
              </a>
            </div>

            {/* 突破段 */}
            <div className={styles.detailSectionTitle}>
              突破段
              <span className={styles.detailSectionHint}>· 回踩的起点</span>
            </div>
            <div className={styles.detailGrid}>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>突破日</span>
                <span className={styles.detailValue}>{detail.breakout_date}</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>突破收盘</span>
                <span className={styles.detailValue}>{fmtNum(detail.breakout_close)}</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>突破涨幅</span>
                <span className={`${styles.detailValue} ${retClass(detail.breakout_pct)}`}>
                  {fmtPct(detail.breakout_pct, true)}
                </span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>放量倍数</span>
                <span className={styles.detailValue}>{fmtNum(detail.breakout_vol_ratio)}x</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>连涨</span>
                <span className={styles.detailValue}>
                  {detail.streak_days}天 {fmtPct(detail.streak_gain)}
                </span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>距低点</span>
                <span className={styles.detailValue}>{fmtPct(detail.gain_from_low)}</span>
              </div>
            </div>

            {/* 回踩段 */}
            <div className={styles.detailSectionTitle}>
              回踩段
              <span className={styles.detailSectionHint}>· 距均线越近回踩越到位</span>
            </div>
            <div className={styles.detailGrid}>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>回踩日</span>
                <span className={styles.detailValue}>{detail.pullback_date}</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>回踩价</span>
                <span className={styles.detailValue}>{fmtNum(detail.pullback_close)}</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>距高点</span>
                <span className={`${styles.detailValue} ${styles.negative}`}>
                  {fmtPct(detail.drawdown_from_peak)}
                </span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>回踩天数</span>
                <span className={styles.detailValue}>{detail.pullback_days} 天</span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>距MA5</span>
                <span className={`${styles.detailValue} ${distClass(detail.dist_ma5)}`}>
                  {fmtPct(detail.dist_ma5, true)}
                </span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>距MA10</span>
                <span className={`${styles.detailValue} ${distClass(detail.dist_ma10)}`}>
                  {fmtPct(detail.dist_ma10, true)}
                </span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>距MA20</span>
                <span className={`${styles.detailValue} ${distClass(detail.dist_ma20)}`}>
                  {fmtPct(detail.dist_ma20, true)}
                </span>
              </div>
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>缩量</span>
                <span className={styles.detailValue}>{fmtNum(detail.pullback_vol_ratio)}x</span>
              </div>
            </div>

            {/* 结算 */}
            <div className={styles.detailSectionTitle}>收益结算</div>
            <div className={styles.detailGrid}>
              {([['ret1', 'T+1'], ['ret3', 'T+3'], ['ret5', 'T+5'], ['ret10', 'T+10']] as const).map(
                ([key, label]) => (
                  <div key={key} className={styles.detailCell}>
                    <span className={styles.detailLabel}>{label}</span>
                    <span className={`${styles.detailValue} ${retClass(detail[key])}`}>
                      {fmtPct(detail[key], true)}
                    </span>
                  </div>
                )
              )}
              <div className={styles.detailCell}>
                <span className={styles.detailLabel}>最大收益</span>
                <span className={`${styles.detailValue} ${retClass(detail.max_ret)}`}>
                  {fmtPct(detail.max_ret, true)}
                </span>
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

            {/* 跟踪曲线 */}
            <div className={styles.detailSectionTitle}>
              回踩后跟踪（{track.length} 个交易日）
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
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <ReTooltip
                      formatter={(value: any, name: any) => [`${Number(value).toFixed(2)}%`, name]}
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
                      name="相对回踩日涨跌"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="dist_ma10"
                      name="距MA10"
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
    </>
  );
};

export default PullbackPanel;
