import React, { useState, useEffect, useCallback, useRef } from 'react';
import { message, Tooltip, Empty, Segmented } from 'antd';
// 网格卡片高度固定，空状态统一用紧凑版
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from 'recharts';
import styles from './MarketSentiment.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, CoolRefreshButton } from '../components/ui';
import AStockKlineModal from '../components/astock/AStockKlineModal';
import {
  hotspotAPI,
  HotspotOverview,
  HotspotSentiment,
  HotspotLadderTier,
  HotspotLimitUp,
  HotspotTheme,
  HotspotConcept,
  HotspotHotStock,
  phaseTheme,
} from '../services/hotspotAPI';
import { sentimentAPI, SentimentTrendPoint, SentimentPhase } from '../services/sentimentAPI';

interface MarketSentimentProps {
  isSidebarCollapsed?: boolean;
}

const REFRESH_MS = 60_000;

// ── 工具函数 ───────────────────────────────────────────
const fmtPct = (v: number | null | undefined, withSign = false): string => {
  if (v === null || v === undefined) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

const fmtRate = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  return `${(v * 100).toFixed(1)}%`;
};

const fmtNum = (v: number | null | undefined, digits = 1): string => {
  if (v === null || v === undefined) return '—';
  return v.toFixed(digits);
};

const fmtMoney = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}亿`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  return v.toFixed(0);
};

const retClass = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  return v > 0 ? styles.up : v < 0 ? styles.down : '';
};

const MarketSentiment: React.FC<MarketSentimentProps> = ({ isSidebarCollapsed = false }) => {
  const [hotKind, setHotKind] = useState<'hot' | 'skyrocket'>('hot');

  const [overview, setOverview] = useState<HotspotOverview | null>(null);
  const [live, setLive] = useState<HotspotSentiment | null>(null);
  const [ladder, setLadder] = useState<HotspotLadderTier[]>([]);
  const [limitup, setLimitup] = useState<HotspotLimitUp[]>([]);
  const [hotList, setHotList] = useState<HotspotHotStock[]>([]);
  const [upstreamDown, setUpstreamDown] = useState(false);

  const [trend, setTrend] = useState<SentimentTrendPoint[]>([]);
  const [phases, setPhases] = useState<SentimentPhase[]>([]);

  const [loading, setLoading] = useState(true);
  const [klineStock, setKlineStock] = useState<{ code: string; name?: string } | null>(null);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  // ── 实时数据（必须串行，见注释）──────────────────────
  const loadLive = useCallback(async (silent = false) => {
    // 串行一轮约十几秒，60 秒轮询正常不会重叠；上游变慢时防止重入堆积
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!silent) setLoading(true);

    // ⚠️ 必须串行。后端对上游是共享缓存+单锁，并发不会变快反而互相排队：
    // 实测单发各约 2 秒，四个并发时变成 6s→14s→27s→32s，最后一个直接超时。
    // 顺序按首屏优先排，主视觉先出。
    let failed = 0;

    try { setLive(await hotspotAPI.getSentiment()); } catch { failed++; }
    if (!silent) setLoading(false);

    try { setLadder((await hotspotAPI.getLadder(1)) ?? []); } catch { failed++; }

    try {
      const ov = await hotspotAPI.getOverview({ top_concepts: 14, top_themes: 10 });
      setOverview(ov);
      setHotList(ov?.hot ?? []);
    } catch { failed++; }

    try { setLimitup((await hotspotAPI.getLimitUp({ limit: 60 })) ?? []); } catch { failed++; }

    setUpstreamDown(failed > 0);
    if (failed && !silent) message.warning(`部分实时数据源暂不可用（${failed}/4）`);
    inFlightRef.current = false;
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([sentimentAPI.getTrend(60), sentimentAPI.getPhases()]);
      setTrend(t ?? []);
      setPhases(p ?? []);
    } catch (err) {
      console.error('加载情绪历史失败:', err);
    }
  }, []);

  useEffect(() => { loadLive(); }, [loadLive]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (hotKind === 'hot') { setHotList(overview?.hot ?? []); return; }
    hotspotAPI.getHot('skyrocket').then((d) => setHotList(d ?? [])).catch(() => setHotList([]));
  }, [hotKind, overview]);

  useEffect(() => {
    timerRef.current = window.setInterval(() => loadLive(true), REFRESH_MS);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [loadLive]);

  const themes: HotspotTheme[] = overview?.themes ?? [];
  const concepts: HotspotConcept[] = overview?.concepts ?? [];
  const pt = phaseTheme(live?.phase);
  const prevPt = phaseTheme(live?.prev_phase);
  const phaseChanged = !!live?.prev_phase && live.prev_phase !== live.phase;

  // 收盘后/开盘前实时计数会全部归零（prev_* 仍保留昨日值），
  // 此时展示 0 家涨停、0% 晋级率会误导，标记为「非交易时段」并改用昨收口径
  const isIdle = !!live && live.zt_count === 0 && (live.prev_zt_count ?? 0) > 0;

  const advPct = Math.max(0, Math.min(1, (live?.advance_rate ?? 0) / 0.4));
  const ARC = 220;

  // 家数普遍只差 1~2，按「家数 × 最高板」加权才能区分出有高标的题材
  const maxTheme = Math.max(1, ...themes.map((t) => t.count * Math.max(1, t.max_boards)));
  const maxLadder = Math.max(1, ...ladder.map((t) => t.count));
  const sortedLadder = [...ladder].sort((a, b) => b.boards - a.boards);
  const currentPhase = phases.find((p) => p.phase === live?.phase);

  const openK = (code?: string, name?: string) => code && setKlineStock({ code, name });

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <TopProgressBar isVisible={loading} />

      {/* PageHeader 为项目统一规范，此页压缩其占高以腾出看板空间 */}
      <div className={styles.headerSlot}>
        <PageHeader title="市场情绪" subtitle="盘中实时题材与连板梯队 · 60秒自动刷新" icon="🔥">
          <div className={styles.headerRight}>
            <span className={`${styles.liveDot} ${isIdle ? styles.liveDotIdle : ''}`} />
            <span className={styles.asOf}>{live?.as_of?.slice(11) ?? '—'}</span>
            {isIdle && (
              <Tooltip title="当前非交易时段，实时涨停计数已归零；下方标注「昨」的为昨收数据">
                <span className={styles.idleChip}>非交易时段</span>
              </Tooltip>
            )}
            {upstreamDown && <span className={styles.downChip}>数据源部分不可用</span>}
            <CoolRefreshButton onClick={() => loadLive()} loading={loading} iconOnly />
          </div>
        </PageHeader>
      </div>

      {/* ══ 核心读数一行排完 ═══════════════════════════ */}
      <div className={styles.topBar}>
        <div className={styles.topStats}>
          {[
            { k: '涨停', v: live?.zt_count, c: '#ef4444', sub: live?.prev_zt_count != null ? `昨${live.prev_zt_count}` : '' },
            { k: '跌停', v: live?.dt_count, c: '#10b981', sub: '' },
            { k: '涨跌比', v: fmtNum(live?.zt_dt_ratio, 2), sub: '' },
            { k: '最高板', v: live?.height, sub: live?.prev_height != null ? `昨${live.prev_height}` : '' },
            { k: '首板', v: live?.first_board, sub: '' },
            { k: '≥2板', v: live?.ge2, sub: '' },
            { k: '≥3板', v: live?.ge3, sub: '' },
          ].map((s) => (
            <div key={s.k} className={styles.topStat}>
              <span className={styles.topStatVal} style={s.c ? { color: s.c } : undefined}>
                {s.v ?? '—'}
              </span>
              <span className={styles.topStatKey}>
                {s.k}
                {s.sub && <i className={styles.topStatSub}>{s.sub}</i>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Bento 网格 ═════════════════════════════════ */}
      <div className={styles.bento}>
        {/* ── 阶段 + 晋级率（主视觉）────────────────── */}
        <section
          className={`${styles.card} ${styles.cardPhase}`}
          style={{ '--pc': pt.color, '--pg': pt.glow } as React.CSSProperties}
        >
          <div className={styles.phaseGlow} />
          <div className={styles.phaseBody}>
            <div className={styles.phaseLeft}>
              {phaseChanged && (
                <Tooltip title={`昨收「${live!.prev_phase}」，阶段已切换。实测切换点信号比持续处于某阶段更强`}>
                  <div className={styles.switchChip}>
                    <span style={{ color: prevPt.color }}>{live!.prev_phase}</span>
                    <span className={styles.arrow}>→</span>
                    <span style={{ color: pt.color }}>{live!.phase}</span>
                  </div>
                </Tooltip>
              )}
              <div className={styles.phaseName}>{live?.phase ?? '—'}</div>
              <div className={styles.phaseStance}>{live?.stance ?? ''}</div>
            </div>

            {/* 横幅中段：该阶段的历史后续表现 */}
            <div className={styles.phaseHist}>
              <Tooltip title={`历史上处于「${live?.phase}」的 ${live?.phase_hist_days} 个交易日，其后 T+5 平均表现。这组数字用于风险规避，不代表该阶段适合打板`}>
                <span className={styles.phaseHistK}>历史T+5</span>
              </Tooltip>
              <span className={`${styles.phaseHistV} ${retClass(live?.phase_hist_ret5)}`}>
                {fmtPct(live?.phase_hist_ret5, true)}
              </span>
              <span className={styles.phaseHistK}>超额</span>
              <span className={`${styles.phaseHistV} ${retClass(live?.phase_hist_excess5)}`}>
                {fmtPct(live?.phase_hist_excess5, true)}
              </span>
              <span className={styles.phaseHistD}>{live?.phase_hist_days ?? '—'}天样本</span>
            </div>

            <div className={styles.gauge}>
              <svg viewBox="0 0 180 100" className={styles.gaugeSvg}>
                <path d="M18,90 A72,72 0 0,1 162,90" fill="none"
                  stroke="rgba(148,163,184,0.2)" strokeWidth="12" strokeLinecap="round" />
                <path d="M18,90 A72,72 0 0,1 162,90" fill="none"
                  stroke={pt.color} strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${advPct * ARC} ${ARC}`} className={styles.gaugeArc} />
              </svg>
              <div className={styles.gaugeIn}>
                <span className={`${styles.gaugeV} ${isIdle ? styles.gaugeVIdle : ''}`}>
                  {isIdle ? '休市' : fmtRate(live?.advance_rate)}
                </span>
                <Tooltip title={isIdle
                  ? '非交易时段，实时晋级率已归零，待开盘后重新计算'
                  : '昨日连板池今日续板比例，判断情绪最核心的指标'}>
                  <span className={styles.gaugeK}>晋级率</span>
                </Tooltip>
              </div>
            </div>
          </div>
        </section>

        {/* ── 连板天梯 ──────────────────────────────── */}
        <section className={`${styles.card} ${styles.cardLadder}`}>
          <h3 className={styles.cardTitle}>连板天梯<i>次日封板标红</i></h3>
          <div className={styles.ladder}>
            {sortedLadder.length ? sortedLadder.map((t) => (
              <div key={t.boards} className={styles.ladderRow}>
                <span className={styles.ladderB}>{t.boards}板</span>
                <div className={styles.ladderBar} style={{ width: `${Math.max(10, (t.count / maxLadder) * 100)}%` }}>
                  <span>{t.count}</span>
                </div>
                <div className={styles.chips}>
                  {(t.names ?? []).slice(0, 12).map((n, i) => (
                    <Tooltip key={t.codes?.[i] ?? n} title={t.seal_nextday?.[i] ? '次日封板 ✓' : '次日未封板'}>
                      <a className={`${styles.chip} ${t.seal_nextday?.[i] ? styles.chipSealed : ''}`}
                        onClick={() => openK(t.codes?.[i], n)}>{n}</a>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={upstreamDown ? '数据源不可用' : isIdle ? '非交易时段' : '暂无'} />}
          </div>
        </section>

        {/* ── 今日主线 ──────────────────────────────── */}
        <section className={`${styles.card} ${styles.cardThemes}`}>
          <h3 className={styles.cardTitle}>今日主线<i>涨停原因聚合 · 条长=家数×最高板</i></h3>
          <div className={styles.themes}>
            {themes.length ? themes.map((t, i) => (
              <div key={t.theme} className={styles.themeRow}>
                <span className={`${styles.themeRank} ${i < 3 ? styles.rankTop : ''}`}>{i + 1}</span>
                <span className={styles.themeName} title={t.theme}>{t.theme}</span>
                <div className={styles.themeTrack}>
                  <div className={styles.themeFill}
                    style={{ width: `${Math.max(8, (t.count * Math.max(1, t.max_boards) / maxTheme) * 100)}%` }} />
                </div>
                <span className={styles.themeN}>{t.count}</span>
                <span className={`${styles.themeB} ${t.max_boards >= 3 ? styles.themeBHot : ''}`}>{t.max_boards}板</span>
              </div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={upstreamDown ? '数据源不可用' : isIdle ? '非交易时段' : '暂无'} />}
          </div>
        </section>

        {/* ── 情绪趋势（日频）────────────────────────── */}
        <section className={`${styles.card} ${styles.cardTrend}`}>
          <h3 className={styles.cardTitle}>
            情绪趋势<i>日频 · 近60日</i>
            {currentPhase && (
              <span className={styles.phasePill} style={{ '--pc': pt.color } as React.CSSProperties}>
                {currentPhase.phase} 占比{fmtNum(currentPhase.pct, 0)}%
              </span>
            )}
          </h3>
          <div className={styles.trendChart}>
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 4, right: 2, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ztG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="advG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="trade_date" tick={{ fontSize: 9 }} minTickGap={40} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="l" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={34} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9 }} tickLine={false}
                    axisLine={false} width={30} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <ReTooltip
                    contentStyle={{ borderRadius: 8, fontSize: 11, padding: '4px 8px' }}
                    labelFormatter={(l: any) => {
                      const p = trend.find((t) => t.trade_date === l);
                      return `${l}${p?.phase ? ` · ${p.phase}` : ''}`;
                    }}
                    formatter={(v: any, n: any) =>
                      n === '晋级率' ? [`${(Number(v) * 100).toFixed(1)}%`, n] : [Number(v), n]}
                  />
                  <Bar yAxisId="l" dataKey="zt_count" name="涨停数" fill="url(#ztG)" radius={[2, 2, 0, 0]} />
                  <Area yAxisId="r" type="monotone" dataKey="advance_rate" name="晋级率"
                    stroke="#38bdf8" strokeWidth={1.6} fill="url(#advG)" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" />}
          </div>
        </section>

        {/* ── 涨停池 ────────────────────────────────── */}
        <section className={`${styles.card} ${styles.cardLimitup}`}>
          <h3 className={styles.cardTitle}>实时涨停池<i>{limitup.length}只 · 早封更强</i></h3>
          <div className={styles.luScroll}>
            {limitup.length ? (
              <table className={styles.luTable}>
                <tbody>
                  {[...limitup].sort((a, b) => b.boards - a.boards).map((r) => (
                    <tr key={r.code}>
                      <td className={styles.luName}>
                        <a onClick={() => openK(r.code, r.name)}>{r.name}</a>
                        {r.is_st && <i className={styles.stTag}>ST</i>}
                      </td>
                      <td>
                        <span className={`${styles.bd} ${r.boards >= 4 ? styles.bdHot : r.boards >= 2 ? styles.bdWarm : ''}`}>
                          {r.boards}板
                        </span>
                      </td>
                      <td className={r.limit_up_time && r.limit_up_time <= '09:31' ? styles.early : styles.dim}>
                        {r.limit_up_time ?? '—'}
                      </td>
                      <td className={styles.luSeal}>{fmtMoney(r.seal_money)}</td>
                      <td className={styles.luTheme} title={r.reason ?? ''}>
                        {(r.themes ?? []).slice(0, 2).join(' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={upstreamDown ? '数据源不可用' : isIdle ? '非交易时段' : '暂无'} />}
          </div>
        </section>

        {/* ── 概念板块 ──────────────────────────────── */}
        <section className={`${styles.card} ${styles.cardConcepts}`}>
          <h3 className={styles.cardTitle}>概念板块<i>涨幅+放量才是真资金</i></h3>
          <div className={styles.conceptWrap}>
            {concepts.length ? concepts.map((c) => (
              <div key={c.thscode} className={styles.conceptItem}>
                <span className={styles.conceptN} title={c.name}>{c.name}</span>
                <span className={`${styles.conceptP} ${retClass(c.pct_chg)}`}>{fmtPct(c.pct_chg, true)}</span>
                <span className={styles.conceptT}>{fmtMoney(c.turnover)}</span>
              </div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={upstreamDown ? '数据源不可用' : isIdle ? '非交易时段' : '暂无'} />}
          </div>
        </section>

        {/* ── 人气榜 ────────────────────────────────── */}
        <section className={`${styles.card} ${styles.cardHot}`}>
          <h3 className={styles.cardTitle}>
            人气榜
            <Segmented size="small" value={hotKind} className={styles.seg}
              onChange={(v) => setHotKind(v as 'hot' | 'skyrocket')}
              options={[{ label: '人气', value: 'hot' }, { label: '飙升', value: 'skyrocket' }]} />
          </h3>
          <div className={styles.hotWrap}>
            {hotList.length ? hotList.slice(0, 10).map((h) => (
              <div key={h.code} className={styles.hotRow}>
                <span className={`${styles.hotR} ${h.rank <= 3 ? styles.rankTop : ''}`}>{h.rank}</span>
                <a className={styles.hotN} onClick={() => openK(h.code, h.name)}>{h.name}</a>
                <span className={`${styles.hotT} ${h.rank_trend === 'up' ? styles.up : h.rank_trend === 'down' ? styles.down : ''}`}>
                  {h.rank_trend === 'up' ? `▲${Math.abs(h.rank_change ?? 0)}`
                    : h.rank_trend === 'down' ? `▼${Math.abs(h.rank_change ?? 0)}` : '—'}
                </span>
              </div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={upstreamDown ? '数据源不可用' : isIdle ? '非交易时段' : '暂无'} />}
          </div>
        </section>
      </div>

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

export default MarketSentiment;
