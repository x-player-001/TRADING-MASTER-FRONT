import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input, Select, message } from 'antd';
import KlineModal from '../components/trend/KlineModal';
import SignalStats from '../components/trend/SignalStats';
import styles from './TrendFollow.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, DataSection, CoolRefreshButton } from '../components/ui';
import {
  trendFollowAPI,
  WatchContext,
  TrendAlert,
  WatchContextState,
} from '../services/trendFollowAPI';

const { Option } = Select;

const TIMEFRAMES = ['5m', '15m', '1h', '4h'];
const STATE_LABELS: Record<WatchContextState, string> = {
  WATCHING: '观察中',
  ALERTED: '已报警',
  ABANDONED: '已废弃',
  DELETED: '已删除',
  BREAKTHROUGH: '已突破',
};

interface TrendFollowProps {
  isSidebarCollapsed?: boolean;
}

// 报警详情 Tooltip
const AlertTooltip: React.FC<{ alert: TrendAlert; formatPrice: (p: number) => string; formatTimeStr: (s: string) => string }> = ({ alert, formatPrice, formatTimeStr }) => (
  <div className={styles.tooltipContent}>
    <div className={styles.tooltipRow}>
      <span className={styles.tooltipLabel}>报警时间</span>
      <span className={styles.tooltipValue}>{formatTimeStr(alert.created_at)}</span>
    </div>
    <div className={styles.tooltipRow}>
      <span className={styles.tooltipLabel}>当前价格</span>
      <span className={styles.tooltipValue}>{formatPrice(alert.current_price)}</span>
    </div>
    <div className={styles.tooltipRow}>
      <span className={styles.tooltipLabel}>波段幅度</span>
      <span className={`${styles.tooltipValue} ${styles.positive}`}>+{alert.wave_amplitude_pct.toFixed(2)}%</span>
    </div>
    <div className={styles.tooltipRow}>
      <span className={styles.tooltipLabel}>回调比例</span>
      <span className={styles.tooltipValue}>{(alert.pullback_ratio * 100).toFixed(1)}%</span>
    </div>
    {alert.fib_zone && (
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>斐波那契</span>
        <span className={styles.tooltipValue}>{alert.fib_zone}</span>
      </div>
    )}
    <div className={styles.tooltipRow}>
      <span className={styles.tooltipLabel}>缩量</span>
      <span className={alert.volume_shrink ? styles.positive : styles.tooltipValue}>
        {alert.volume_shrink ? '✓ 是' : '✗ 否'}
      </span>
    </div>
    <div className={styles.tooltipRow}>
      <span className={styles.tooltipLabel}>反转信号</span>
      <span className={alert.reversal_signal ? styles.positive : styles.tooltipValue}>
        {alert.reversal_signal ? '✓ 是' : '✗ 否'}
      </span>
    </div>
  </div>
);

const TrendFollow: React.FC<TrendFollowProps> = ({ isSidebarCollapsed = false }) => {
  const [contexts, setContexts] = useState<WatchContext[]>([]);
  // alertsMap: symbol+timeframe -> 最近一条报警
  const [alertsMap, setAlertsMap] = useState<Map<string, TrendAlert>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [timeframeFilter, setTimeframeFilter] = useState<string | undefined>();
  const [stateFilter, setStateFilter] = useState<WatchContextState | undefined>();

  // tooltip 状态
  const [tooltipCtxId, setTooltipCtxId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 状态列 tooltip
  const [stateTooltipId, setStateTooltipId] = useState<number | null>(null);
  const stateTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // K线弹窗
  const [klineModalCtx, setKlineModalCtx] = useState<WatchContext | null>(null);

  // 备注展开行
  const [remarkOpenId, setRemarkOpenId] = useState<number | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [remarkSaving, setRemarkSaving] = useState(false);

  // 同币种分组的展开状态（key 为 symbol，默认折叠只显示最新一条）
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());
  const toggleSymbol = (symbol: string) =>
    setExpandedSymbols(prev => {
      const next = new Set(prev);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });

  const fetchData = useCallback(async () => {
    try {
      const [ctxData, alertData] = await Promise.all([
        trendFollowAPI.getWatchContexts({ timeframe: timeframeFilter, state: stateFilter, limit: 200 }),
        trendFollowAPI.getRecentAlerts({ timeframe: timeframeFilter, limit: 200 }),
      ]);
      setContexts(ctxData);
      // 建立 symbol+timeframe -> 最近报警 的 map
      const map = new Map<string, TrendAlert>();
      // getRecentAlerts 已按时间倒序，第一条即最新
      for (const a of alertData) {
        const key = `${a.symbol}:${a.timeframe}`;
        if (!map.has(key)) map.set(key, a);
      }
      setAlertsMap(map);
      setError(null);
    } catch (err) {
      setError('加载数据失败');
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeframeFilter, stateFilter]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);
  useEffect(() => {
    const timer = setInterval(() => fetchData(), 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleRefresh = useCallback(() => { setIsRefreshing(true); fetchData(); }, [fetchData]);

  const handleRemarkOpen = (ctx: WatchContext) => {
    if (remarkOpenId === ctx.id) {
      setRemarkOpenId(null);
      return;
    }
    setRemarkOpenId(ctx.id);
    setRemarkDraft(ctx.remark ?? '');
  };

  const handleRemarkSave = async (id: number) => {
    setRemarkSaving(true);
    try {
      const val = remarkDraft.trim() || null;
      await trendFollowAPI.updateRemark(id, val);
      setContexts(prev => prev.map(c => c.id === id ? { ...c, remark: val } : c));
      message.success('备注已保存');
      setRemarkOpenId(null);
    } catch {
      message.error('保存失败');
    } finally {
      setRemarkSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await trendFollowAPI.deleteWatchContext(id);
      message.success('已删除');
      setContexts(prev => prev.filter(c => c.id !== id));
    } catch {
      message.error('删除失败');
    }
  };

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  const formatTimeStr = (str: string) => {
    const ts = str.endsWith('Z') ? str.slice(0, -1) : str;
    return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  const formatVolume = (v: number): { text: string; highlight: boolean } => {
    if (!v) return { text: '—', highlight: false };
    if (v >= 1e9) return { text: (v / 1e9).toFixed(2) + 'B', highlight: true };
    if (v >= 1e8) return { text: (v / 1e6).toFixed(0) + 'M', highlight: true };
    if (v >= 1e6) return { text: (v / 1e6).toFixed(2) + 'M', highlight: false };
    if (v >= 1e3) return { text: (v / 1e3).toFixed(2) + 'K', highlight: false };
    return { text: v.toFixed(2), highlight: false };
  };

  const calcElapsed = (entryTimestamp: number) => {
    const mins = Math.floor((Date.now() - entryTimestamp) / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  };

  // 报警距现在多少分钟
  const alertElapsedMins = (createdAt: string) => {
    const ts = createdAt.endsWith('Z') ? createdAt.slice(0, -1) : createdAt;
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${mins}m前`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}m前` : `${h}h前`;
  };

  const calcPnl = (current: number, entry: number) => {
    if (!current || !entry) return null;
    return (current - entry) / entry * 100;
  };

  const alertLevelLabel = (level: number) => {
    const map: Record<number, string> = { 1: 'L1', 2: 'L2', 3: 'L3' };
    return map[level] ?? `L${level}`;
  };

  const stripUsdt = (symbol: string) =>
    symbol.toUpperCase().endsWith('USDT') ? symbol.slice(0, -4) : symbol;

  const filteredContexts = contexts.filter(c =>
    !searchTerm || c.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 按币种分组，每组按进入时间倒序，代表行（最新）在前
  const symbolGroups = React.useMemo(() => {
    const map = new Map<string, WatchContext[]>();
    for (const c of filteredContexts) {
      const arr = map.get(c.symbol) ?? [];
      arr.push(c);
      map.set(c.symbol, arr);
    }
    // 组内按进入时间倒序
    const groups = Array.from(map.values()).map(arr =>
      [...arr].sort((a, b) => b.watch_start_time - a.watch_start_time)
    );
    // 组间按各自最新一条的进入时间倒序
    groups.sort((a, b) => b[0].watch_start_time - a[0].watch_start_time);
    return groups;
  }, [filteredContexts]);

  const handleMouseEnter = (id: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left, y: rect.top + rect.height / 2 });
    setTooltipCtxId(id);
  };

  const handleMouseLeave = () => {
    tooltipTimer.current = setTimeout(() => setTooltipCtxId(null), 150);
  };

  if (error && !contexts.length) {
    return (
      <div className={styles.trendFollow}>
        <div className={styles.error}>
          <div className={styles.content}>
            <div className={styles.icon}>⚠️</div>
            <div className={styles.text}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.trendFollow}>
      <TopProgressBar isVisible={isRefreshing || loading} progress={loading ? 50 : 85} absolute />

      <PageHeader title="趋势跟踪" subtitle="监控回调观察区状态，跟踪趋势续涨信号" icon="📈" />

      {/* 筛选器 */}
      <div className={styles.filterSection}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>币种：</label>
            <Input
              placeholder="输入币种名称..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              allowClear
              style={{ width: 160 }}
            />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>周期：</label>
            <Select placeholder="全部周期" value={timeframeFilter} onChange={v => setTimeframeFilter(v)} allowClear style={{ width: 110 }}>
              {TIMEFRAMES.map(tf => <Option key={tf} value={tf}>{tf}</Option>)}
            </Select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>状态：</label>
            <Select placeholder="观察中/报警" value={stateFilter} onChange={v => setStateFilter(v)} allowClear style={{ width: 120 }}>
              <Option value="WATCHING">观察中</Option>
              <Option value="ALERTED">已报警</Option>
              <Option value="ABANDONED">已废弃</Option>
              <Option value="DELETED">已删除</Option>
              <Option value="BREAKTHROUGH">已突破</Option>
            </Select>
          </div>
          <div className={styles.filterItem}>
            <CoolRefreshButton onClick={handleRefresh} loading={isRefreshing} size="small" iconOnly />
          </div>
          <div className={styles.statusInfo}>
            <span className={styles.statusItem}>
              <span className={styles.statusLabel}>观察区：</span>
              <span className={styles.statusValue}>{filteredContexts.length}</span>
            </span>
            <span className={styles.statusItem}>
              <span className={styles.statusLabel}>已报警：</span>
              <span className={styles.statusValue}>{filteredContexts.filter(c => c.state === 'ALERTED').length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 信号统计（默认折叠） */}
      <div style={{ marginBottom: '1.5rem' }}>
        <SignalStats />
      </div>

      {/* 公告栏 - 仅在观察中状态下显示1h内报警滚动播报 */}
      {(!stateFilter || stateFilter === 'WATCHING') && (() => {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const activeKeys = new Set(contexts.map(c => `${c.symbol}:${c.timeframe}`));
        const recentAlerts = Array.from(alertsMap.values()).filter(a => {
          const ts = a.created_at.endsWith('Z') ? a.created_at.slice(0, -1) : a.created_at;
          return new Date(ts).getTime() > oneHourAgo && activeKeys.has(`${a.symbol}:${a.timeframe}`);
        });
        if (recentAlerts.length === 0) return null;
        const shouldScroll = recentAlerts.length > 2;
        // 滚动时重复两份保证无缝衔接，单条静态展示不重复
        const items = shouldScroll ? [...recentAlerts, ...recentAlerts] : recentAlerts;
        return (
          <div className={styles.announcementBar}>
            <span className={styles.announcementIcon}>📢</span>
            <div className={styles.announcementTrack}>
              <div
                className={styles.announcementInner}
                style={shouldScroll ? { animationDuration: `${recentAlerts.length * 12}s` } : { animation: 'none' }}
              >
                {items.map((a, i) => (
                  <span key={i} className={styles.announcementItem}>
                    <span className={`${styles.annLevel} ${
                      a.alert_level === 3 ? styles.annLevel3 :
                      a.alert_level === 2 ? styles.annLevel2 : styles.annLevel1
                    }`}>L{a.alert_level}</span>
                    <span className={styles.annSymbol}>{stripUsdt(a.symbol)}</span>
                    <span className={styles.annTf}>{a.timeframe}</span>
                    <span className={styles.annDesc}>
                      回调{(a.pullback_ratio * 100).toFixed(1)}%
                      {a.fib_zone ? ` · ${a.fib_zone}` : ''}
                      {a.volume_shrink ? ' · 缩量' : ''}
                      {a.reversal_signal ? ' · 反转' : ''}
                    </span>
                    <span className={styles.annSep}>·</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 突破滚动条 */}
      {(() => {
        const halfHourAgo = Date.now() - 30 * 60 * 1000;
        const recentBreakthroughs = contexts.filter(c => {
          if (c.state !== 'BREAKTHROUGH') return false;
          const ts = c.updated_at.endsWith('Z') ? c.updated_at.slice(0, -1) : c.updated_at;
          return new Date(ts).getTime() > halfHourAgo;
        });
        if (recentBreakthroughs.length === 0) return null;
        const shouldScroll = recentBreakthroughs.length > 2;
        const items = shouldScroll ? [...recentBreakthroughs, ...recentBreakthroughs] : recentBreakthroughs;
        return (
          <div className={`${styles.announcementBar} ${styles.breakthroughBar}`}>
            <span className={styles.announcementIcon}>🚀</span>
            <div className={styles.announcementTrack}>
              <div
                className={styles.announcementInner}
                style={shouldScroll ? { animationDuration: `${recentBreakthroughs.length * 12}s` } : { animation: 'none' }}
              >
                {items.map((c, i) => (
                  <span key={i} className={styles.announcementItem}>
                    <span className={styles.annBreakthrough}>突破</span>
                    <span className={styles.annSymbol}>{stripUsdt(c.symbol)}</span>
                    <span className={styles.annTf}>{c.timeframe}</span>
                    <span className={styles.annDesc}>
                      波段+{c.wave_amplitude_pct.toFixed(2)}%
                      {` · ${alertElapsedMins(c.updated_at)}`}
                    </span>
                    <span className={styles.annSep}>·</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 观察区表格 */}
      <DataSection
        title="观察区状态"
        subtitle={`共 ${filteredContexts.length} 个观察区`}
        loading={loading && !contexts.length}
        error={null}
        empty={!loading && filteredContexts.length === 0}
        emptyText="暂无观察区数据"
        compact
      >
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>币种</th>
                <th>24h量</th>
                <th>状态</th>
                <th>进入价</th>
                <th>进入时长</th>
                <th>当前价</th>
                <th>进入后涨跌</th>
                <th>波段K线</th>
                <th>回调K线</th>
                <th>报警级别</th>
              </tr>
            </thead>
            <tbody>
              {symbolGroups.flatMap(group => {
                const groupCount = group.length;
                const isExpanded = expandedSymbols.has(group[0].symbol);
                // 折叠时只渲染代表行（最新），展开时渲染全部
                const visible = isExpanded ? group : [group[0]];
                return visible.map((ctx, idxInGroup) => {
                const isLead = idxInGroup === 0;
                const hasMore = groupCount > 1;
                const pnl = calcPnl(ctx.current_price, ctx.wave_end_price);
                const alertKey = `${ctx.symbol}:${ctx.timeframe}`;
                const latestAlert = alertsMap.get(alertKey);
                return (
                  <React.Fragment key={ctx.id}>
                  <tr className={!isLead ? styles.groupChildRow : undefined}>
                    <td>
                      {isLead && hasMore ? (
                        <button
                          className={`${styles.groupToggle} ${isExpanded ? styles.groupToggleOpen : ''}`}
                          onClick={() => toggleSymbol(ctx.symbol)}
                          title={isExpanded ? '折叠' : `展开 ${groupCount} 条`}
                        >
                          ▶
                        </button>
                      ) : (
                        <span className={styles.groupTogglePlaceholder} />
                      )}
                      <span
                        className={styles.symbolCell}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setKlineModalCtx(ctx)}
                      >
                        {stripUsdt(ctx.symbol)}
                      </span>
                      <span className={styles.timeframeBadge} style={{ marginLeft: '0.375rem' }}>{ctx.timeframe}</span>
                      {isLead && hasMore && !isExpanded && (
                        <span className={styles.groupCountBadge}>{groupCount}</span>
                      )}
                    </td>
                    <td className={styles.numCell}>
                      {(() => { const v = formatVolume(ctx.quote_volume_24h); return <span className={v.highlight ? styles.volumeHigh : undefined}>{v.text}</span>; })()}
                    </td>
                    <td>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span
                          className={`${styles.stateBadge} ${styles.stateBadgeClickable} ${
                            ctx.state === 'WATCHING' ? styles.watching :
                            ctx.state === 'ALERTED' ? styles.alerted :
                            ctx.state === 'DELETED' ? styles.deleted :
                            ctx.state === 'BREAKTHROUGH' ? styles.breakthrough : styles.abandoned
                          }`}
                          onClick={() => handleRemarkOpen(ctx)}
                          onMouseEnter={() => {
                            if (ctx.state !== 'BREAKTHROUGH') return;
                            if (stateTooltipTimer.current) clearTimeout(stateTooltipTimer.current);
                            setStateTooltipId(ctx.id);
                          }}
                          onMouseLeave={() => {
                            stateTooltipTimer.current = setTimeout(() => setStateTooltipId(null), 150);
                          }}
                        >
                          {STATE_LABELS[ctx.state]}
                          {ctx.remark && <span className={styles.remarkDot} />}
                        </span>
                        {stateTooltipId === ctx.id && ctx.state === 'BREAKTHROUGH' && (
                          <div className={styles.tooltip}>
                            <div className={styles.tooltipContent}>
                              <div className={styles.tooltipRow}>
                                <span className={styles.tooltipLabel}>突破时间</span>
                                <span className={styles.tooltipValue}>{formatTimeStr(ctx.updated_at)}</span>
                              </div>
                              <div className={styles.tooltipRow}>
                                <span className={styles.tooltipLabel}>已突破</span>
                                <span className={styles.tooltipValue}>{calcElapsed(new Date(ctx.updated_at.endsWith('Z') ? ctx.updated_at.slice(0, -1) : ctx.updated_at).getTime())}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={styles.numCell}>{formatPrice(ctx.wave_end_price)}</td>
                    <td className={styles.numCell}>
                      <span className={styles.elapsedCell}>
                        {calcElapsed(ctx.watch_start_time)}
                        <span className={styles.elapsedTime}>{formatTime(ctx.watch_start_time)}</span>
                      </span>
                    </td>
                    <td className={styles.numCell}>{ctx.current_price ? formatPrice(ctx.current_price) : '—'}</td>
                    <td className={styles.numCell}>
                      {pnl !== null ? (
                        <span className={pnl >= 0 ? styles.positive : styles.negative}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className={styles.numCell}>
                      <span className={styles.waveBarCell}>
                        {ctx.wave_bar_count}
                        <span className={styles.waveAmp}>{ctx.wave_amplitude_pct.toFixed(2)}%</span>
                      </span>
                    </td>
                    <td className={styles.numCell}>{ctx.pullback_bar_count}</td>
                    <td>
                      {ctx.last_alert_level > 0 ? (
                        <div
                          className={styles.alertCell}
                          onMouseEnter={(e) => handleMouseEnter(ctx.id, e)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <span className={styles.levelBadge}>{alertLevelLabel(ctx.last_alert_level)}</span>
                          {latestAlert && (
                            <span className={styles.alertAgo}>{alertElapsedMins(latestAlert.created_at)}</span>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                  <tr className={styles.remarkRow}>
                    <td colSpan={10}>
                      <div className={`${styles.remarkSlider} ${remarkOpenId === ctx.id ? styles.open : ''}`}>
                        <div className={styles.remarkSliderInner}>
                          <div className={styles.remarkPanel}>
                            <textarea
                              className={styles.remarkTextarea}
                              placeholder="输入备注..."
                              value={remarkOpenId === ctx.id ? remarkDraft : (ctx.remark ?? '')}
                              onChange={e => setRemarkDraft(e.target.value)}
                              rows={2}
                            />
                            <div className={styles.remarkActions}>
                              <button
                                className={styles.remarkSaveBtn}
                                onClick={() => handleRemarkSave(ctx.id)}
                                disabled={remarkSaving}
                              >
                                {remarkSaving ? '保存中...' : '保存'}
                              </button>
                              {ctx.remark && (
                                <button
                                  className={styles.remarkClearBtn}
                                  onClick={() => setRemarkDraft('')}
                                >
                                  清空
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  </React.Fragment>
                );
                });
              })}
            </tbody>
          </table>
        </div>
      </DataSection>

      {/* 报警级别 tooltip - fixed 定位避免撑开表格 */}
      {tooltipCtxId !== null && (() => {
        const ctx = contexts.find(c => c.id === tooltipCtxId);
        const alertKey = ctx ? `${ctx.symbol}:${ctx.timeframe}` : '';
        const alert = alertsMap.get(alertKey);
        if (!ctx || !alert) return null;
        const TOOLTIP_WIDTH = 200;
        const TOOLTIP_HEIGHT = 160;
        const vh = window.innerHeight;
        let x = tooltipPos.x - TOOLTIP_WIDTH - 8;
        if (x < 8) x = tooltipPos.x + 8;
        let y = tooltipPos.y - TOOLTIP_HEIGHT / 2;
        if (y < 8) y = 8;
        if (y + TOOLTIP_HEIGHT > vh - 8) y = vh - TOOLTIP_HEIGHT - 8;
        return (
          <div
            ref={tooltipRef}
            className={styles.tooltipFixed}
            style={{ left: x, top: y }}
            onMouseEnter={() => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); }}
            onMouseLeave={handleMouseLeave}
          >
            <AlertTooltip alert={alert} formatPrice={formatPrice} formatTimeStr={formatTimeStr} />
          </div>
        );
      })()}

      {klineModalCtx && (
        <KlineModal
          ctx={klineModalCtx}
          onClose={() => setKlineModalCtx(null)}
          onDelete={handleDelete}
          isDark={document.documentElement.classList.contains('dark')}
          sidebarCollapsed={isSidebarCollapsed}
        />
      )}
    </div>
  );
};

export default TrendFollow;
