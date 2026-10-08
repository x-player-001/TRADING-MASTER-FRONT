import React, { useState, useEffect, useCallback } from 'react';
import { Tooltip } from 'antd';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import styles from './Dashboard.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, CoolRefreshButton } from '../components/ui';
import { liveTradingAPI, LiveRuntimeStatus, LiveSummary } from '../services/liveTradingAPI';
import { paperTradingAPI, PaperRuntimeStatus, PaperSummary, PaperDailyPoint } from '../services/paperTradingAPI';
import { trendFollowAPI, WatchlistItem, TrendAlert, WATCH_STAGE_LABELS } from '../services/trendFollowAPI';
import {
  dailyBreakoutAPI,
  DailyBreakoutSignal,
  DAILY_BREAKOUT_STATUS_LABELS,
  DAILY_BREAKOUT_LINE_TYPE_LABELS,
} from '../services/dailyBreakoutAPI';
import { replayAPI, ReplaySessionRow } from '../services/replayAPI';
import { sentimentAPI, SentimentToday, SentimentTrendPoint, PHASE_COLORS } from '../services/sentimentAPI';
import { watchPoolAPI, WatchItem, WatchStats } from '../services/watchPoolAPI';

// 首页看板：汇总侧边栏 5 个入口的核心数据，每块各自加载、各自报错，互不拖累
// 配色：加密货币盈利绿 / 亏损红；A股涨红 / 跌绿

interface DashboardProps {
  isSidebarCollapsed?: boolean;
}

const REFRESH_MS = 60_000;
const DAILY_DAYS = 14;

// 每个数据源的加载结果：undefined = 加载中，Error = 失败
type Slot<T> = T | Error | undefined;

interface DashboardData {
  liveStatus: Slot<LiveRuntimeStatus>;
  liveSummary: Slot<LiveSummary>;
  liveDaily: Slot<PaperDailyPoint[]>;
  paperStatus: Slot<PaperRuntimeStatus>;
  paperSummary: Slot<PaperSummary>;
  paperDaily: Slot<PaperDailyPoint[]>;
  watchlist: Slot<WatchlistItem[]>;
  alerts: Slot<TrendAlert[]>;
  breakouts: Slot<DailyBreakoutSignal[]>;
  sessions: Slot<ReplaySessionRow[]>;
  sentiment: Slot<SentimentToday>;
  sentimentTrend: Slot<SentimentTrendPoint[]>;
  poolStats: Slot<WatchStats>;
  poolTop: Slot<WatchItem[]>;
}

const EMPTY: DashboardData = {
  liveStatus: undefined,
  liveSummary: undefined,
  liveDaily: undefined,
  paperStatus: undefined,
  paperSummary: undefined,
  paperDaily: undefined,
  watchlist: undefined,
  alerts: undefined,
  breakouts: undefined,
  sessions: undefined,
  sentiment: undefined,
  sentimentTrend: undefined,
  poolStats: undefined,
  poolTop: undefined,
};

const ok = <T,>(s: Slot<T>): s is T => s !== undefined && !(s instanceof Error);

// ── 格式化 ─────────────────────────────────────────────
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const fmtU = (v: number | null | undefined, withSign = false): string => {
  if (!isNum(v)) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}`;
};

const fmtPct = (v: number | null | undefined, withSign = false, digits = 2): string => {
  if (!isNum(v)) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
};

const fmtTime = (ms: number | null | undefined): string => {
  if (!isNum(ms)) return '—';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const fmtDay = (ms: number | null | undefined): string => {
  if (!isNum(ms)) return '—';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// 加密货币：盈利绿、亏损红
const cryptoClass = (v: number | null | undefined): string =>
  !isNum(v) || v === 0 ? '' : v > 0 ? styles.gain : styles.loss;

// A股：涨红、跌绿
const astockClass = (v: number | null | undefined): string =>
  !isNum(v) || v === 0 ? '' : v > 0 ? styles.up : styles.down;

const PHASE_LABEL: Record<string, string> = {
  running: '运行中',
  starting: '启动中',
  reconnecting: '重连中',
  lagging: '数据延迟',
  offline: '离线',
};

// ── 小组件 ─────────────────────────────────────────────
const Card: React.FC<{
  title: string;
  icon: string;
  href?: string;
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, icon, href, extra, className, children }) => (
  <section className={`${styles.card} ${className ?? ''}`}>
    <header className={styles.cardHead}>
      <span className={styles.cardTitle}>
        <span className={styles.cardIcon}>{icon}</span>
        {title}
      </span>
      {extra}
      {href && (
        <a className={styles.more} href={href}>
          查看 →
        </a>
      )}
    </header>
    <div className={styles.cardBody}>{children}</div>
  </section>
);

// 统一处理加载中 / 失败 / 空数据
function SlotView<T>({
  slot,
  empty,
  isEmpty,
  children,
}: {
  slot: Slot<T>;
  empty?: string;
  isEmpty?: (v: T) => boolean;
  children: (v: T) => React.ReactNode;
}) {
  if (slot === undefined) return <div className={styles.placeholder}>加载中…</div>;
  if (slot instanceof Error) return <div className={`${styles.placeholder} ${styles.error}`}>加载失败：{slot.message}</div>;
  if (isEmpty?.(slot)) return <div className={styles.placeholder}>{empty ?? '暂无数据'}</div>;
  return <>{children(slot)}</>;
}

const Stat: React.FC<{ label: string; value: React.ReactNode; className?: string; hint?: string }> = ({
  label,
  value,
  className,
  hint,
}) => (
  <div className={styles.stat}>
    <span className={styles.statLabel}>
      {hint ? (
        <Tooltip title={hint}>
          <span className={styles.hinted}>{label}</span>
        </Tooltip>
      ) : (
        label
      )}
    </span>
    <span className={`${styles.statValue} ${className ?? ''}`}>{value}</span>
  </div>
);

const PhaseDot: React.FC<{ phase?: string; online?: boolean }> = ({ phase, online }) => {
  const cls = !online ? styles.dotOff : phase === 'running' ? styles.dotOn : styles.dotWarn;
  return (
    <span className={styles.phase}>
      <span className={`${styles.dot} ${cls}`} />
      {online ? PHASE_LABEL[phase ?? ''] ?? phase : '离线'}
    </span>
  );
};

// ── 页面 ───────────────────────────────────────────────
const Dashboard: React.FC<DashboardProps> = () => {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const tasks: { [K in keyof DashboardData]: Promise<Exclude<DashboardData[K], Error | undefined>> } = {
      liveStatus: liveTradingAPI.getStatus(),
      liveSummary: liveTradingAPI.getSummary(),
      liveDaily: liveTradingAPI.getDaily({ days: DAILY_DAYS }),
      paperStatus: paperTradingAPI.getStatus(),
      paperSummary: paperTradingAPI.getSummary(),
      paperDaily: paperTradingAPI.getDaily({ days: DAILY_DAYS }),
      watchlist: trendFollowAPI.getWatchlist(),
      alerts: trendFollowAPI.getRecentAlerts({ limit: 5 }),
      breakouts: dailyBreakoutAPI.getSignals({ days: 7, sort: 'breakout_time', limit: 5 }),
      sessions: replayAPI.listSessions({ status: 'active', limit: 3 }),
      sentiment: sentimentAPI.getToday(),
      sentimentTrend: sentimentAPI.getTrend(30),
      poolStats: watchPoolAPI.getWatchStats(),
      poolTop: watchPoolAPI.getWatchList({ status: 'watching', order_by: 'live_score', limit: 10 }),
    };
    const keys = Object.keys(tasks) as (keyof DashboardData)[];
    const results = await Promise.allSettled(keys.map((k) => tasks[k]));
    const next = { ...EMPTY } as Record<keyof DashboardData, unknown>;
    results.forEach((r, i) => {
      next[keys[i]] =
        r.status === 'fulfilled' ? r.value : r.reason instanceof Error ? r.reason : new Error(String(r.reason));
    });
    setData(next as unknown as DashboardData);
    setUpdatedAt(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // 实盘 / 模拟盘逐日盈亏按日期合并
  const dailyRows = (() => {
    const map = new Map<string, { date: string; live?: number; paper?: number }>();
    const put = (rows: Slot<PaperDailyPoint[]>, key: 'live' | 'paper') => {
      if (!ok(rows)) return;
      for (const r of rows) {
        const row = map.get(r.date) ?? { date: r.date };
        row[key] = r.pnl;
        map.set(r.date, row);
      }
    };
    put(data.liveDaily, 'live');
    put(data.paperDaily, 'paper');
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-DAILY_DAYS);
  })();

  const sumPnl = (rows: Slot<PaperDailyPoint[]>) => (ok(rows) ? rows.reduce((s, r) => s + (r.pnl ?? 0), 0) : null);

  const topWatch = ok(data.watchlist) ? [...data.watchlist].sort((a, b) => b.score - a.score).slice(0, 15) : data.watchlist;

  return (
    <div className={styles.page}>
      <TopProgressBar isVisible={loading} />

      {/* PageHeader 为项目统一规范，此页压缩其占高以便一屏排完 */}
      <div className={styles.headerSlot}>
        <PageHeader title="首页" subtitle="加密货币与 A股核心数据一览 · 60 秒自动刷新" icon="🏠">
          <div className={styles.headerRight}>
            <span className={styles.asOf}>{updatedAt ? `更新于 ${fmtTime(updatedAt).slice(6)}` : ''}</span>
            <CoolRefreshButton onClick={load} loading={loading} iconOnly />
          </div>
        </PageHeader>
      </div>

      <div className={styles.columns}>
        {/* ══ 加密货币 ══════════════════════════════════ */}
        <div className={styles.column}>
          <div className={styles.columnTitle}>加密货币</div>

          <Card title="策略交易" icon="🧪" href="#paper-trading">
            <div className={styles.accounts}>
              <div className={styles.account}>
                <div className={styles.accountHead}>
                  <span className={styles.accountName}>实盘</span>
                  {ok(data.liveStatus) && <PhaseDot phase={data.liveStatus.phase} online={data.liveStatus.online} />}
                </div>
                <SlotView slot={data.liveStatus}>
                  {(s) => (
                    <div className={styles.statGrid}>
                      <Stat label="余额 U" value={fmtU(s.status?.balance)} />
                      <Stat
                        label="今日盈亏"
                        value={fmtU(s.today_pnl, true)}
                        className={cryptoClass(s.today_pnl)}
                        hint={isNum(s.daily_loss_limit) ? `日亏损上限 ${s.daily_loss_limit} U` : undefined}
                      />
                      <Stat label="持仓" value={s.status?.active_trades ?? '—'} />
                      <Stat
                        label={`近${DAILY_DAYS}日`}
                        value={fmtU(sumPnl(data.liveDaily), true)}
                        className={cryptoClass(sumPnl(data.liveDaily))}
                      />
                    </div>
                  )}
                </SlotView>
                {ok(data.liveSummary) && data.liveSummary.error_trades.length > 0 && (
                  <div className={styles.alertBar}>⚠️ {data.liveSummary.error_trades.length} 笔异常订单待处理</div>
                )}
              </div>

              <div className={styles.account}>
                <div className={styles.accountHead}>
                  <span className={styles.accountName}>模拟盘</span>
                  {ok(data.paperStatus) && <PhaseDot phase={data.paperStatus.phase} online={data.paperStatus.online} />}
                </div>
                <SlotView slot={data.paperSummary}>
                  {(s) => (
                    <div className={styles.statGrid}>
                      <Stat
                        label="累计盈亏"
                        value={fmtU(s.total.total_pnl, true)}
                        className={cryptoClass(s.total.total_pnl)}
                      />
                      <Stat label="胜率" value={isNum(s.total.win_rate) ? `${(s.total.win_rate * 100).toFixed(1)}%` : '—'} />
                      <Stat label="持仓" value={s.open_positions.length} />
                      <Stat
                        label={`近${DAILY_DAYS}日`}
                        value={fmtU(sumPnl(data.paperDaily), true)}
                        className={cryptoClass(sumPnl(data.paperDaily))}
                      />
                    </div>
                  )}
                </SlotView>
              </div>
            </div>

            {dailyRows.length > 0 && (
              <div className={styles.chart}>
                <div className={styles.chartTitle}>
                  每日盈亏（U）
                  <span className={styles.legend}>
                    <i className={styles.legendLive} />实盘
                    <i className={styles.legendPaper} />模拟盘
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={92}>
                  <BarChart data={dailyRows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    <ReTooltip formatter={(v) => (isNum(v) ? v.toFixed(2) : String(v))} />
                    <Bar dataKey="live" name="实盘" fill="#6366f1" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="paper" name="模拟盘" fill="#94a3b8" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card
            title="趋势跟踪 · 观察榜"
            icon="📈"
            href="#trend-follow"
            className={styles.fill}
            extra={ok(data.watchlist) && <span className={styles.count}>{data.watchlist.length} 个币</span>}
          >
            <SlotView slot={topWatch} isEmpty={(v) => v.length === 0} empty="暂无观察中的币">
              {(rows) => (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>币种</th>
                      <th>周期</th>
                      <th>阶段</th>
                      <th className={styles.num}>涨幅</th>
                      <th className={styles.num}>回撤</th>
                      <th className={styles.num}>评分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((w) => (
                      <tr key={w.symbol}>
                        <td className={styles.symbol}>{w.symbol.replace(/USDT$/, '')}</td>
                        <td className={styles.muted}>{w.timeframes.join(' ')}</td>
                        <td>
                          <span className={`${styles.tag} ${styles[`stage${w.stage}`] ?? ''}`}>
                            {WATCH_STAGE_LABELS[w.stage] ?? w.stage}
                          </span>
                        </td>
                        <td className={styles.num}>{fmtPct(w.wave_amplitude_pct, false, 1)}</td>
                        <td className={styles.num}>{fmtPct(w.retrace_now * 100, false, 0)}</td>
                        <td className={`${styles.num} ${styles.score}`}>{w.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SlotView>
          </Card>

          <div className={styles.pair}>
            <Card title="最新报警" icon="🔔" href="#trend-follow">
              <SlotView slot={data.alerts} isEmpty={(v) => v.length === 0} empty="暂无报警">
                {(rows) => (
                  <ul className={styles.list}>
                    {rows.map((a) => (
                      <li key={a.id}>
                        <span className={`${styles.level} ${styles[`level${a.alert_level}`] ?? ''}`}>L{a.alert_level}</span>
                        <span className={styles.symbol}>{a.symbol.replace(/USDT$/, '')}</span>
                        <span className={styles.muted}>{a.timeframe}</span>
                        <span className={styles.grow} />
                        <span className={styles.muted}>{fmtTime(a.kline_time)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SlotView>
            </Card>

            <Card title="日线突破" icon="🚀" href="#trend-follow">
              <SlotView slot={data.breakouts} isEmpty={(v) => v.length === 0} empty="近 7 天无突破">
                {(rows) => (
                  <ul className={styles.list}>
                    {rows.map((b) => (
                      <li key={b.id}>
                        <span className={styles.symbol}>{b.symbol.replace(/USDT$/, '')}</span>
                        <span className={`${styles.tag} ${styles[`bo_${b.status}`] ?? ''}`}>
                          {DAILY_BREAKOUT_STATUS_LABELS[b.status] ?? b.status}
                        </span>
                        <span className={styles.muted}>{DAILY_BREAKOUT_LINE_TYPE_LABELS[b.line_type] ?? b.line_type}</span>
                        <span className={styles.grow} />
                        <Tooltip title="最新收盘离线距离">
                          <span className={cryptoClass(b.last_distance_pct)}>{fmtPct(b.last_distance_pct, true, 1)}</span>
                        </Tooltip>
                        <span className={styles.muted}>{fmtDay(b.breakout_time)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SlotView>
            </Card>
          </div>

        </div>

        {/* ══ A股 ══════════════════════════════════════ */}
        <div className={styles.column}>
          <div className={styles.columnTitle}>A股</div>

          <Card
            title="市场情绪"
            icon="🌡️"
            href="#market-sentiment"
            extra={ok(data.sentiment) && <span className={styles.count}>{data.sentiment.trade_date}</span>}
          >
            <SlotView slot={data.sentiment}>
              {(s) => (
                <>
                  <div className={styles.phaseRow}>
                    <span className={styles.phaseBig} style={{ color: PHASE_COLORS[s.phase] ?? '#3b82f6' }}>
                      {s.phase}
                    </span>
                    <span className={styles.stance}>{s.stance}</span>
                    <Tooltip title={`该阶段历史 ${s.phase_hist_days} 天，T+5 平均收益 / 超额`}>
                      <span className={styles.hist}>
                        T+5 <b className={astockClass(s.phase_hist_ret5)}>{fmtPct(s.phase_hist_ret5, true)}</b>
                        {' / '}
                        <b className={astockClass(s.phase_hist_excess5)}>{fmtPct(s.phase_hist_excess5, true)}</b>
                      </span>
                    </Tooltip>
                  </div>
                  <div className={styles.statGrid6}>
                    <Stat label="涨停" value={s.zt_count} className={styles.up} />
                    <Stat label="炸板" value={s.zb_count} className={styles.down} />
                    <Stat label="封板率" value={fmtPct(s.seal_rate, false, 1)} />
                    <Stat label="最高板" value={s.height} />
                    <Stat label="晋级率" value={isNum(s.advance_rate) ? `${(s.advance_rate * 100).toFixed(1)}%` : '—'} />
                    <Stat
                      label="昨涨停今"
                      value={fmtPct(s.prev_zt_avg_pct, true)}
                      className={astockClass(s.prev_zt_avg_pct)}
                      hint="昨日涨停股今日平均涨幅"
                    />
                  </div>
                  {s.tiers.length > 0 && (
                    <div className={styles.tiers}>
                      {s.tiers
                        .filter((t) => t.boards >= 2)
                        .slice(0, 3)
                        .map((t) => (
                          <div key={t.boards} className={styles.tier}>
                            <span className={styles.tierBoards}>{t.boards}板</span>
                            <span className={styles.tierNames}>
                              {t.names.slice(0, 6).join('、')}
                              {t.count > 6 ? ` 等${t.count}只` : ''}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}
            </SlotView>

            {ok(data.sentimentTrend) && data.sentimentTrend.length > 0 && (
              <div className={styles.chart}>
                <div className={styles.chartTitle}>近 30 日涨停家数</div>
                <ResponsiveContainer width="100%" height={72}>
                  <AreaChart data={data.sentimentTrend} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <XAxis dataKey="trade_date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ReTooltip
                      formatter={(v) => [String(v), '涨停']}
                      labelFormatter={(l, p) => `${l} ${p?.[0]?.payload?.phase ?? ''}`}
                    />
                    <Area dataKey="zt_count" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="监控池 · 低位首板" icon="🎣" href="#watch-pool" className={styles.fill}>
            <SlotView slot={data.poolStats}>
              {(s) => (
                <div className={styles.statGrid}>
                  <Stat label="跟踪中" value={s.watching} />
                  <Stat label="已命中" value={s.hit} className={styles.up} />
                  <Stat label="命中率" value={fmtPct(s.hit_rate, false, 1)} hint={s.benchmark_hint} />
                  <Stat label="平均命中" value={isNum(s.avg_hit_days) ? `${s.avg_hit_days.toFixed(1)} 天` : '—'} />
                </div>
              )}
            </SlotView>
            <div className={styles.subTitle}>跟踪评分前 10</div>
            <SlotView slot={data.poolTop} isEmpty={(v) => v.length === 0} empty="暂无跟踪中的票">
              {(rows) => (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>首板日</th>
                      <th className={styles.num}>入池后</th>
                      <th className={styles.num}>天数</th>
                      <th className={styles.num}>评分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <span className={styles.symbol}>{w.name}</span>
                          <span className={styles.code}>{w.code}</span>
                        </td>
                        <td className={styles.muted}>{w.trigger_date?.slice(5)}</td>
                        <td className={`${styles.num} ${astockClass(w.last_ret_since)}`}>{fmtPct(w.last_ret_since, true, 1)}</td>
                        <td className={styles.num}>{w.days_in_pool}</td>
                        <td className={`${styles.num} ${styles.score}`}>{isNum(w.live_score) ? w.live_score.toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SlotView>
          </Card>

          <Card title="K线回放 · 进行中" icon="⏯️" href="#kline-replay">
            <SlotView slot={data.sessions} isEmpty={(v) => v.length === 0} empty="没有进行中的回放">
              {(rows) => (
                <ul className={styles.list}>
                  {rows.map((s) => {
                    const ret = s.initial_balance ? ((s.balance - s.initial_balance) / s.initial_balance) * 100 : null;
                    return (
                      <li key={s.id}>
                        <span className={styles.symbol}>{s.name}</span>
                        <span className={styles.grow} />
                        <span className={styles.muted}>{s.bars_stepped} 根</span>
                        <Tooltip title="已实现收益（不含未平仓）">
                          <span className={cryptoClass(ret)}>{fmtPct(ret, true)}</span>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SlotView>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
