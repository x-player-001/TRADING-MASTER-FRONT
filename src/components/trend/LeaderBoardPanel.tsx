import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Checkbox, Empty, Segmented, Spin, Switch, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  leaderAPI,
  LeaderBoard,
  LeaderBoardItem,
  LeaderEpisode,
  LeaderPhase,
  LeaderTier,
  LeaderWatchlistBrief,
  LeaderWindow,
  LEADER_PHASE_LABELS,
} from '../../services/leaderAPI';
import type { LeaderRanks } from './LeaderBadge';
import styles from './LeaderBoardPanel.module.scss';

interface LeaderBoardPanelProps {
  onOpenKline: (symbol: string) => void;
  /** 两个窗口的在榜币种排名，给观察区打「龙头」标签 */
  onRanksChange?: (ranks: LeaderRanks) => void;
  /** 外部刷新按钮 */
  refreshKey?: number;
}

type View = 'board' | 'episodes';
type EpisodeWindow = LeaderWindow | 'all';

const PREFS_KEY = 'trend.leaders';
/** 榜单每根 15m 收盘后约 90 秒算完，2 分钟轮询足够 */
const POLL_MS = 120_000;

const PHASE_COLORS: Record<LeaderPhase, string> = {
  first_wave: 'volcano',
  relisted: 'magenta',
  pullback: 'blue',
  second_wave: 'green',
  expired: 'default',
};
const TIER_META: Record<LeaderTier, { label: string; color: string }> = {
  high: { label: '高', color: 'green' },
  mid: { label: '中', color: 'gold' },
  low: { label: '低', color: 'default' },
};
const STAGE_LABELS: Record<string, string> = {
  RISING: '上涨中',
  PULLBACK: '回调中',
  IN_ZONE: '回撤到位',
};
const EPISODE_PHASES: LeaderPhase[] = ['relisted', 'first_wave', 'pullback', 'second_wave'];

interface Prefs {
  collapsed: boolean;
  view: View;
  boardWindow: LeaderWindow;
  episodeWindow: EpisodeWindow;
  phases: LeaderPhase[];
  resonanceOnly: boolean;
}
const DEFAULT_PREFS: Prefs = {
  collapsed: false,
  view: 'board',
  boardWindow: '24h',
  episodeWindow: '24h',
  phases: EPISODE_PHASES,
  resonanceOnly: false,
};
const readPrefs = (): Prefs => {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
};

const stripUsdt = (s: string) => (s.toUpperCase().endsWith('USDT') ? s.slice(0, -4) : s);

/** 小数比例 → 百分比文字 */
const pct = (v: number | null | undefined, withSign = true, digits = 1) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const p = v * 100;
  return `${withSign && p > 0 ? '+' : ''}${p.toFixed(digits)}%`;
};

const money = (v: number | null | undefined) => {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
};

const price = (p: number | null | undefined) => (p == null ? '—' : p >= 1 ? p.toFixed(4) : p.toPrecision(4));

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const mdhm = (ms: number | null | undefined) => {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hhmm(ms)}`;
};

const signClass = (v: number | null | undefined) =>
  v == null ? '' : v > 0 ? styles.up : v < 0 ? styles.down : '';

const ResonanceBadge: React.FC<{ watchlist: LeaderWatchlistBrief | null }> = ({ watchlist }) => (
  <Tooltip
    title={watchlist ? (
      <div>
        <div>同时在趋势跟随观察列表</div>
        <div>周期：{watchlist.timeframes.join(' / ')}</div>
        <div>阶段：{STAGE_LABELS[watchlist.stage] ?? watchlist.stage}
          {watchlist.retrace_now != null && `（回撤 ${(watchlist.retrace_now * 100).toFixed(0)}%）`}
        </div>
        {watchlist.score_tags.length > 0 && <div>评分 {watchlist.score}：{watchlist.score_tags.join('、')}</div>}
      </div>
    ) : '同时在趋势跟随观察列表'}
  >
    <span className={styles.resonance}>共振</span>
  </Tooltip>
);

const TagList: React.FC<{ tags?: string[]; risks?: string[] }> = ({ tags = [], risks = [] }) => (
  <span className={styles.tagList}>
    {tags.map(t => <span key={t} className={styles.goodTag}>{t}</span>)}
    {risks.map(t => <span key={t} className={styles.riskTag}>{t}</span>)}
  </span>
);

const EpisodeTooltip: React.FC<{ ep: LeaderEpisode }> = ({ ep }) => {
  const ev = ep.evaluation;
  const rows: [string, React.ReactNode][] = [
    ['首次进榜', `${mdhm(ep.first_entry_time)} @ ${price(ep.entry_price)}（进榜时 24h ${pct(ep.entry_change_24h)}，相对量 ${ep.entry_rvol.toFixed(1)}）`],
    ['本轮进榜', mdhm(ep.streak_start_time)],
    ['最近在榜', mdhm(ep.last_listed_time)],
    ['第一波高点', `${price(ep.peak_price)}（${mdhm(ep.peak_time)}）`],
    ['掉榜确认', mdhm(ep.dropout_time)],
    ['回撤低点', price(ep.pullback_low)],
    ['掉榜后最高', price(ep.max_high_after)],
    ['第二波', mdhm(ep.second_wave_time)],
    ['最大相对量', ep.rvol_max.toFixed(1)],
    ['拉升前 30 天', pct(ep.pre_trend30)],
    ['OI 第一波 / 峰后', `${pct(ev.oi_wave)} / ${pct(ev.oi_pull)}`],
    ['资金费率', ev.funding_rate == null ? '—' : `${(ev.funding_rate * 100).toFixed(4)}%`],
    ['再次上榜', `${ep.relist_count} 次`],
  ];
  return (
    <div className={styles.tip}>
      {rows.map(([k, v]) => (
        <div key={k} className={styles.tipRow}><span className={styles.tipLabel}>{k}</span><span>{v}</span></div>
      ))}
    </div>
  );
};

const LeaderBoardPanel: React.FC<LeaderBoardPanelProps> = ({ onOpenKline, onRanksChange, refreshKey = 0 }) => {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const updatePrefs = (patch: Partial<Prefs>) =>
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
      return next;
    });
  const { collapsed, view, boardWindow, episodeWindow, phases, resonanceOnly } = prefs;

  // 两个窗口都拉：切换不用等，观察区标签也要两个窗口
  const [boards, setBoards] = useState<Partial<Record<LeaderWindow, LeaderBoard>>>({});
  const board = boards[boardWindow] ?? null;
  const onRanksChangeRef = useRef(onRanksChange);
  onRanksChangeRef.current = onRanksChange;
  const [episodes, setEpisodes] = useState<LeaderEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    try {
      // 观察区数量显示在 Tab 上，榜单和事件都拉
      const [b24, b4, eps] = await Promise.all([
        leaderAPI.getBoard('24h'),
        leaderAPI.getBoard('4h'),
        leaderAPI.getEpisodes({ window: episodeWindow, phase: phases, resonance_only: resonanceOnly }),
      ]);
      if (id !== seq.current) return;
      setBoards({ '24h': b24, '4h': b4 });
      setEpisodes(eps ?? []);
      const ranks: LeaderRanks = new Map();
      for (const b of [b24, b4]) {
        for (const it of b?.items ?? []) ranks.set(it.symbol, { ...ranks.get(it.symbol), [b.window]: it.rank });
      }
      onRanksChangeRef.current?.(ranks);
      setError(null);
    } catch (err) {
      if (id !== seq.current) return;
      setError(err instanceof Error ? err.message : '加载龙头榜失败');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [episodeWindow, phases, resonanceOnly]);

  // 收起时也轮询：观察区的「龙头」标签依赖榜单
  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  const pullbackCount = useMemo(() => episodes.filter(e => e.phase === 'pullback').length, [episodes]);

  const columns: ColumnsType<LeaderEpisode> = [
    {
      title: '币种',
      dataIndex: 'symbol',
      width: 130,
      fixed: 'left',
      render: (s: string, ep) => (
        <span className={styles.symbolCell}>
          <a className={styles.symbol} onClick={() => onOpenKline(s)}>{stripUsdt(s)}</a>
          {ep.resonance && <ResonanceBadge watchlist={ep.watchlist} />}
        </span>
      ),
    },
    ...(episodeWindow === 'all' ? [{
      title: '窗口',
      dataIndex: 'window',
      width: 60,
      render: (w: LeaderWindow) => <span className={styles.muted}>{w}</span>,
    }] : []),
    {
      title: '阶段',
      dataIndex: 'phase',
      width: 100,
      render: (p: LeaderPhase, ep) => (
        <Tooltip title={<EpisodeTooltip ep={ep} />} overlayClassName={styles.tipOverlay}>
          <Tag color={PHASE_COLORS[p]}>{ep.phase_label || LEADER_PHASE_LABELS[p]}</Tag>
        </Tooltip>
      ),
    },
    {
      title: <Tooltip title="第二波参考档位，只在回撤观察阶段给出。研究中最低档实际约 11%、最高档约 55%，基础概率约 30%">档位</Tooltip>,
      key: 'tier',
      width: 70,
      render: (_, ep) => {
        const t = ep.evaluation?.tier;
        return t ? <Tooltip title={`打分 ${ep.evaluation.score ?? '—'}`}><Tag color={TIER_META[t].color}>{TIER_META[t].label}</Tag></Tooltip> : <span className={styles.muted}>—</span>;
      },
    },
    {
      title: <Tooltip title="当前价距第一波高点">距峰</Tooltip>,
      key: 'dd',
      width: 80,
      align: 'right',
      render: (_, ep) => <span className={signClass(ep.evaluation?.drawdown_from_peak)}>{pct(ep.evaluation?.drawdown_from_peak)}</span>,
    },
    {
      title: '峰后',
      key: 'hsp',
      width: 70,
      align: 'right',
      render: (_, ep) => {
        const h = ep.evaluation?.hours_since_peak;
        return h == null ? '—' : h >= 48 ? `${(h / 24).toFixed(1)}d` : `${h.toFixed(0)}h`;
      },
    },
    {
      title: '掉榜',
      key: 'dsd',
      width: 70,
      align: 'right',
      render: (_, ep) => {
        const d = ep.evaluation?.days_since_dropout;
        return d == null ? <span className={styles.muted}>在榜</span> : `${d.toFixed(1)}d`;
      },
    },
    {
      title: <Tooltip title="当前 24h 成交额 ÷ 在榜期间最大 24h 成交额">量能</Tooltip>,
      key: 'vd',
      width: 70,
      align: 'right',
      render: (_, ep) => pct(ep.evaluation?.volume_decay, false, 0),
    },
    {
      title: '进榜以来',
      dataIndex: 'change_since_entry',
      width: 90,
      align: 'right',
      render: (v: number | null) => <span className={signClass(v)}>{pct(v)}</span>,
    },
    {
      title: '24h额',
      dataIndex: 'last_rolling_qv',
      width: 80,
      align: 'right',
      render: (v: number) => money(v),
    },
    {
      title: '标签',
      key: 'tags',
      render: (_, ep) => <TagList tags={ep.evaluation?.tags} risks={ep.evaluation?.risk_tags} />,
    },
  ];

  const renderCard = (item: LeaderBoardItem) => {
    const ep = item.episode;
    const ev = ep?.evaluation;
    return (
      <div key={item.symbol} className={`${styles.card} ${item.resonance ? styles.cardResonance : ''}`}>
        <div className={styles.cardHead}>
          <span className={styles.rank}>#{item.rank}</span>
          <a className={styles.symbol} onClick={() => onOpenKline(item.symbol)}>{stripUsdt(item.symbol)}</a>
          {item.resonance && <ResonanceBadge watchlist={item.watchlist} />}
          {ep && (
            <Tooltip title={<EpisodeTooltip ep={ep} />} overlayClassName={styles.tipOverlay}>
              <Tag className={styles.phaseTag} color={PHASE_COLORS[ep.phase]}>{ep.phase_label || LEADER_PHASE_LABELS[ep.phase]}</Tag>
            </Tooltip>
          )}
        </div>
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>相对量</span>
            <span className={styles.metricValue}>×{item.rvol.toFixed(1)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>{boardWindow}额</span>
            <span className={styles.metricValue}>{money(item.rolling_qv)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>24h</span>
            <span className={`${styles.metricValue} ${signClass(item.change_24h)}`}>{pct(item.change_24h)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>进榜以来</span>
            <span className={`${styles.metricValue} ${signClass(ep?.change_since_entry)}`}>{pct(ep?.change_since_entry)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>距峰</span>
            <span className={`${styles.metricValue} ${signClass(ev?.drawdown_from_peak)}`}>{pct(ev?.drawdown_from_peak)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>本轮在榜</span>
            <span className={styles.metricValue}>{ep ? `${ep.listed_hours.toFixed(0)}h` : '—'}</span>
          </div>
        </div>
        {ev && (ev.tags.length > 0 || ev.risk_tags.length > 0) && <TagList tags={ev.tags} risks={ev.risk_tags} />}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button className={styles.titleBtn} onClick={() => updatePrefs({ collapsed: !collapsed })}>
          <span className={styles.caret}>{collapsed ? '▸' : '▾'}</span>
          <span className={styles.title}>🐉 龙头榜</span>
        </button>
        <Tooltip
          title={(
            <div>
              进榜时 24h 中位已涨 28%，按进榜价持有中位数亏损（1/5/20 天 -5%/-11%/-17%）。
              掉榜后 20 天内约 30% 出现第二波，突破前通常先回撤约 25%。
            </div>
          )}
        >
          <span className={styles.hint}>榜单告诉你钱在哪，不是入场点 ⓘ</span>
        </Tooltip>

        {!collapsed && (
          <div className={styles.controls}>
            <Segmented
              size="small"
              value={view}
              onChange={v => updatePrefs({ view: v as View })}
              options={[
                { value: 'board', label: `当前榜单${board ? ` ${board.items.length}` : ''}` },
                { value: 'episodes', label: `第二波观察区${episodes.length ? ` ${episodes.length}` : ''}` },
              ]}
            />
            {view === 'board' ? (
              <>
                <Segmented
                  size="small"
                  value={boardWindow}
                  onChange={v => updatePrefs({ boardWindow: v as LeaderWindow })}
                  options={[
                    { value: '24h', label: <Tooltip title="滚动 24h 成交额，主榜">24h 主榜</Tooltip> },
                    { value: '4h', label: <Tooltip title="滚动 4h 成交额，约提前 8 小时发现，但误报多">4h 刚启动</Tooltip> },
                  ]}
                />
                {board && <span className={styles.muted}>{hhmm(board.bar_time)} 收盘榜</span>}
              </>
            ) : (
              <>
                <Segmented
                  size="small"
                  value={episodeWindow}
                  onChange={v => updatePrefs({ episodeWindow: v as EpisodeWindow })}
                  options={[{ value: '24h', label: '24h' }, { value: '4h', label: '4h' }, { value: 'all', label: '全部' }]}
                />
                <Checkbox.Group
                  className={styles.phaseFilter}
                  value={phases}
                  onChange={v => updatePrefs({ phases: v as LeaderPhase[] })}
                  options={EPISODE_PHASES.map(p => ({ value: p, label: LEADER_PHASE_LABELS[p] }))}
                />
                <span className={styles.switchItem}>
                  <Switch size="small" checked={resonanceOnly} onChange={v => updatePrefs({ resonanceOnly: v })} />
                  只看共振
                </span>
                {pullbackCount > 0 && <span className={styles.muted}>回撤观察 {pullbackCount}</span>}
              </>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <Spin spinning={loading}>
          {error && <div className={styles.error}>{error}</div>}
          {view === 'board' ? (
            board && board.items.length > 0 ? (
              <div className={styles.cards}>{board.items.map(renderCard)}</div>
            ) : (
              !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有币达到上榜门槛（宁缺毋滥）" />
            )
          ) : (
            <Table<LeaderEpisode>
              size="small"
              rowKey="id"
              dataSource={episodes}
              columns={columns}
              pagination={false}
              // 固定高度内滚动，别把下面的观察区挤得太远
              scroll={{ x: 1000, y: 420 }}
              rowClassName={ep => (ep.resonance ? styles.rowResonance : '')}
              locale={{ emptyText: '暂无进榜事件' }}
            />
          )}
        </Spin>
      )}
    </div>
  );
};

export default LeaderBoardPanel;
