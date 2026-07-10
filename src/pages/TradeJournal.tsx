import React, { useState, useEffect, useCallback } from 'react';
import { Select, InputNumber, Input, message } from 'antd';
import styles from './TradeJournal.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { CoolRefreshButton } from '../components/ui';
import {
  journalAPI,
  JournalEntry,
  JournalStats,
  JournalStatus,
  Analysis,
  AnalyzeRequest,
  TradeDirection,
  EntryAction,
  RiskReviewItem,
} from '../services/journalAPI';

const { Option } = Select;
const { TextArea } = Input;

interface TradeJournalProps {
  isSidebarCollapsed?: boolean;
}

const TIMEFRAMES = ['5m', '15m', '1h', '4h'];

const directionClass = (d: TradeDirection) => d === 'LONG' ? styles.long : styles.short;
const directionLabel = (d: TradeDirection) => d === 'LONG' ? '做多' : '做空';

const STATUS_LABEL: Record<JournalStatus, string> = {
  analyzing: '待决策',
  open: '持仓中',
  closed: '已平仓',
  dismissed: '已放弃',
  failed: '分析失败',
};

const formatPrice = (v?: number | string) => {
  if (v == null) return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '-';
  return n >= 1 ? n.toFixed(4) : n.toFixed(6);
};

const formatTime = (s?: string) => {
  if (!s) return '-';
  // 后端返回北京时间但不带时区标识，直接截取显示避免浏览器误加时区偏移
  const m = s.match(/(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}/${m[2]} ${m[3]}:${m[4]}`;
  return s.slice(0, 16).replace('T', ' ');
};

const pnlClass = (v?: number) =>
  v == null ? '' : v >= 0 ? styles.positive : styles.negative;

// 后端数值可能为字符串，统一转 number（无效返回 undefined）
const toNum = (v?: number | string | null): number | undefined => {
  if (v == null) return undefined;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? undefined : n;
};

// ── 决策清单卡片（入场评估的可执行结论）──────────────
const ACTION_META: Record<EntryAction, { label: string; cls: string }> = {
  enter: { label: '入场', cls: styles.actionEnter },
  wait: { label: '等待', cls: styles.actionWait },
  skip: { label: '跳过', cls: styles.actionSkip },
};

const DecisionCard: React.FC<{ a: Analysis }> = ({ a }) => {
  // 所有字段都可能为 null（旧记录 / AI 未返回），全空则不渲染
  const hasAny =
    a.action != null ||
    a.entry_zone_low != null || a.entry_zone_high != null ||
    a.invalidation_price != null ||
    a.target_1 != null || a.target_2 != null ||
    a.rr_ratio != null;
  if (!hasAny) return null;

  const zone =
    a.entry_zone_low != null || a.entry_zone_high != null
      ? `${formatPrice(a.entry_zone_low ?? undefined)} ~ ${formatPrice(a.entry_zone_high ?? undefined)}`
      : null;

  return (
    <div className={styles.decisionCard}>
      {a.action && ACTION_META[a.action] && (
        <span className={`${styles.actionBadge} ${ACTION_META[a.action].cls}`}>
          {ACTION_META[a.action].label}
        </span>
      )}
      <div className={styles.decisionGrid}>
        {zone && (
          <div className={styles.decisionItem}>
            <span className={styles.decisionLabel}>入场区间</span>
            <span className={styles.decisionValue}>{zone}</span>
          </div>
        )}
        {a.invalidation_price != null && (
          <div className={styles.decisionItem}>
            <span className={styles.decisionLabel}>失效价</span>
            <span className={`${styles.decisionValue} ${styles.negative}`}>{formatPrice(a.invalidation_price)}</span>
          </div>
        )}
        {a.target_1 != null && (
          <div className={styles.decisionItem}>
            <span className={styles.decisionLabel}>目标 1</span>
            <span className={`${styles.decisionValue} ${styles.positive}`}>{formatPrice(a.target_1)}</span>
          </div>
        )}
        {a.target_2 != null && (
          <div className={styles.decisionItem}>
            <span className={styles.decisionLabel}>目标 2</span>
            <span className={`${styles.decisionValue} ${styles.positive}`}>{formatPrice(a.target_2)}</span>
          </div>
        )}
        {toNum(a.rr_ratio) != null && (
          <div className={styles.decisionItem}>
            <span className={styles.decisionLabel}>R:R</span>
            <span className={styles.decisionValue}>1 : {toNum(a.rr_ratio)!.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── 风险复盘列表（再评估）──────────────────────────────
const RISK_META: Record<RiskReviewItem['status'], { label: string; cls: string }> = {
  materialized: { label: '已兑现', cls: styles.riskMaterialized },
  cleared: { label: '已解除', cls: styles.riskCleared },
  pending: { label: '待定', cls: styles.riskPending },
};

const RiskReview: React.FC<{ items?: RiskReviewItem[] | null }> = ({ items }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className={styles.riskReview}>
      <div className={styles.riskReviewTitle}>风险复盘</div>
      {items.map((r, i) => (
        <div key={i} className={styles.riskRow}>
          <span className={`${styles.riskStatus} ${RISK_META[r.status]?.cls ?? ''}`}>
            {RISK_META[r.status]?.label ?? r.status}
          </span>
          <div className={styles.riskBody}>
            <div className={styles.riskText}>{r.risk}</div>
            {r.note && <div className={styles.riskNote}>{r.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── 入场评估弹窗 ──────────────────────────────────────
interface NewEntryModalProps {
  onClose: () => void;
  onSaved: () => void;
}

const NewEntryModal: React.FC<NewEntryModalProps> = ({ onClose, onSaved }) => {
  const [form, setForm] = useState<AnalyzeRequest>({
    symbol: '',
    direction: 'LONG',
    planned_entry_price: 0,
    planned_stop_loss: 0,
    planned_take_profit: undefined,
    timeframe: '15m',
    entry_reason: '',
    end_time: undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [endTimeStr, setEndTimeStr] = useState('');

  const set = <K extends keyof AnalyzeRequest>(k: K, v: AnalyzeRequest[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleAnalyze = async () => {
    if (!form.symbol || !form.planned_entry_price || !form.planned_stop_loss) {
      message.warning('请填写币种、入场价和止损价');
      return;
    }
    setSubmitting(true);
    const endTime = endTimeStr ? new Date(endTimeStr).getTime() : undefined;
    try {
      await journalAPI.analyze({ ...form, end_time: endTime || undefined });
      message.success('评估已提交，AI 分析中');
      onSaved();
      onClose();
    } catch (e: any) {
      message.error(e.message || '提交失败');
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>📝 入场评估</div>

        <div className={styles.formGrid}>
          <div className={styles.formItem}>
            <span className={styles.formLabel}>币种</span>
            <Input
              placeholder="如 BTC"
              value={form.symbol.replace(/USDT$/, '')}
              onChange={e => set('symbol', e.target.value.toUpperCase().replace(/USDT$/, '') + 'USDT')}
              addonAfter="USDT"
            />
          </div>

          <div className={styles.formItem}>
            <span className={styles.formLabel}>方向</span>
            <Select value={form.direction} onChange={v => set('direction', v as TradeDirection)} style={{ width: '100%' }}>
              <Option value="LONG">做多 Long</Option>
              <Option value="SHORT">做空 Short</Option>
            </Select>
          </div>

          <div className={styles.formItem}>
            <span className={styles.formLabel}>入场价</span>
            <InputNumber style={{ width: '100%' }} placeholder="0.00" min={0}
              value={form.planned_entry_price || undefined} onChange={v => set('planned_entry_price', v ?? 0)} />
          </div>

          <div className={styles.formItem}>
            <span className={styles.formLabel}>止损价</span>
            <InputNumber style={{ width: '100%' }} placeholder="0.00" min={0}
              value={form.planned_stop_loss || undefined} onChange={v => set('planned_stop_loss', v ?? 0)} />
          </div>

          <div className={styles.formItem}>
            <span className={styles.formLabel}>止盈价（可选）</span>
            <InputNumber style={{ width: '100%' }} placeholder="0.00" min={0}
              value={form.planned_take_profit} onChange={v => set('planned_take_profit', v ?? undefined)} />
          </div>

          <div className={styles.formItem}>
            <span className={styles.formLabel}>时间周期</span>
            <Select value={form.timeframe} onChange={v => set('timeframe', v)} style={{ width: '100%' }}>
              {TIMEFRAMES.map(tf => <Option key={tf} value={tf}>{tf}</Option>)}
            </Select>
          </div>

          <div className={styles.formItem}>
            <span className={styles.formLabel}>截止时间（点击填充）</span>
            <Input
              placeholder="2026-06-10 15:30:00"
              value={endTimeStr}
              onClick={() => { if (!endTimeStr) setEndTimeStr(new Date().toLocaleString('sv').replace('T', ' ')); }}
              onChange={e => setEndTimeStr(e.target.value)}
            />
          </div>

          <div className={`${styles.formItem} ${styles.fullWidth}`}>
            <span className={styles.formLabel}>入场理由（帮助 AI 评估）</span>
            <TextArea rows={3} placeholder="描述技术面、市场结构等入场依据..."
              value={form.entry_reason} onChange={e => set('entry_reason', e.target.value)} />
          </div>
        </div>

        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button className={styles.submitBtn} onClick={handleAnalyze} disabled={submitting}>
            {submitting ? <><div className={styles.spinner} /> 提交中...</> : '🤖 提交评估'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── 再评估弹窗 ────────────────────────────────────────
interface ReassessModalProps {
  entry: JournalEntry;
  onClose: () => void;
  onSaved: () => void;
}

const countReassess = (d?: JournalEntry) =>
  (d?.analyses ?? []).filter(a => a.analysis_type === 'reassess').length;

const ReassessModal: React.FC<ReassessModalProps> = ({ entry, onClose, onSaved }) => {
  const [currentPrice, setCurrentPrice] = useState<number | undefined>();
  const [concern, setConcern] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // 卸载时清除轮询
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleReassess = async () => {
    if (!currentPrice) { message.warning('请填写当前价格'); return; }
    if (!concern.trim()) { message.warning('请填写关注点或疑虑'); return; }
    setLoading(true);
    try {
      // 记录提交前已有的再评估记录数作为基线
      const baseline = countReassess(await journalAPI.detail(entry.id));
      await journalAPI.reassess(entry.id, { current_price: currentPrice, concern });
      onSaved();
      // 轮询，直到出现新的 reassess 记录
      pollRef.current = setInterval(async () => {
        try {
          const detail = await journalAPI.detail(entry.id);
          const reassesses = (detail.analyses ?? []).filter(a => a.analysis_type === 'reassess');
          if (reassesses.length > baseline) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            setResult(reassesses[reassesses.length - 1]);
            setLoading(false);
            onSaved();
          }
        } catch { /* 轮询失败忽略，下次重试 */ }
      }, 3000);
    } catch (e: any) {
      message.error(e.message || '再评估失败');
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>
          🔄 持仓再评估 · {entry.symbol}
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formItem}>
            <span className={styles.formLabel}>入场价</span>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{formatPrice(entry.entry_price ?? entry.planned_entry_price)}</div>
          </div>
          <div className={styles.formItem}>
            <span className={styles.formLabel}>当前价格</span>
            <InputNumber style={{ width: '100%' }} placeholder="输入当前价格" min={0} autoFocus disabled={loading || !!result}
              onChange={v => setCurrentPrice(v ?? undefined)} />
          </div>

          <div className={`${styles.formItem} ${styles.fullWidth}`}>
            <span className={styles.formLabel}>关注点 / 疑虑</span>
            <TextArea rows={3} placeholder="如：价格到达关键阻力位，是否需要减仓？" disabled={loading || !!result}
              value={concern} onChange={e => setConcern(e.target.value)} />
          </div>

          {loading && (
            <div className={`${styles.formItem} ${styles.fullWidth}`}>
              <div className={styles.analyzing}>
                <div className={styles.spinner} />
                Claude 正在重新评估持仓...
              </div>
            </div>
          )}

          {result && (
            <div className={`${styles.formItem} ${styles.fullWidth}`}>
              <div className={styles.assessmentResult}>
                <div className={styles.assessmentResultTitle}>🤖 再评估结果</div>
                <div className={styles.assessmentResultText}>{result.claude_analysis}</div>
                <RiskReview items={result.risk_review} />
              </div>
            </div>
          )}
        </div>

        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={onClose}>{result ? '关闭' : '取消'}</button>
          {!result && (
            <button className={styles.submitBtn} onClick={handleReassess} disabled={loading}>
              {loading ? <><div className={styles.spinner} /> 评估中...</> : '🤖 再次评估'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── 主页面 ────────────────────────────────────────────
const TradeJournal: React.FC<TradeJournalProps> = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState<JournalStatus | 'all'>('all');
  // 点击统计项切换筛选：再次点击当前项则取消回到全部
  const toggleStatusFilter = (s: JournalStatus) =>
    setStatusFilter(prev => (prev === s ? 'all' : s));
  // 左栏选中的记录（右栏展示其详情）
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [reassessTarget, setReassessTarget] = useState<JournalEntry | null>(null);

  // 行内 open/dismiss 操作 loading
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // 详情缓存：展开时懒加载
  const [detailMap, setDetailMap] = useState<Record<number, JournalEntry>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);

  // 详情是否「结算」：已有分析结果，或已失败/放弃。未结算=analyzing 且还没出结果
  const isDetailPending = (d?: JournalEntry) =>
    !!d && d.status === 'analyzing' && (d.analyses?.length ?? 0) === 0;

  const loadDetail = async (id: number) => {
    try {
      const detail = await journalAPI.detail(id);
      setDetailMap(m => ({ ...m, [id]: detail }));
      return detail;
    } catch (e: any) {
      message.error('加载详情失败');
    }
  };

  // 加载某条详情。已缓存且已结算则用缓存；未结算（等 AI 结果）或 force 时重新拉
  const ensureDetailLoaded = async (id: number, force = false) => {
    const cached = detailMap[id];
    if (cached && !force && !isDetailPending(cached)) return;
    if (!cached) setDetailLoadingId(id);
    await loadDetail(id);
    setDetailLoadingId(null);
  };

  const handleSelect = async (id: number) => {
    setSelectedId(id);
    await ensureDetailLoaded(id);
  };

  // 失败后重试：重新发起一次评估，生成新 journal
  const handleRetry = async (entry: JournalEntry) => {
    setActionLoadingId(entry.id);
    try {
      await journalAPI.analyze({
        symbol: entry.symbol,
        direction: entry.direction,
        planned_entry_price: entry.planned_entry_price,
        planned_stop_loss: entry.planned_stop_loss,
        planned_take_profit: entry.planned_take_profit,
        entry_reason: entry.entry_reason,
      });
      message.success('已重新提交评估');
      handleSaved();
    } catch (e: any) {
      message.error(e.message || '重试失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  const fetchAll = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      // 始终拉全量，筛选在前端做，保证统计计数与列表口径一致
      const [list, statsData] = await Promise.all([
        journalAPI.list(),
        journalAPI.stats(),
      ]);
      setEntries(list);
      setStats(statsData);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 预加载持仓/待决策详情；并自动选中一条（优先持仓 > 待决策 > 第一条）默认填充右栏
  // 未缓存的拉一次；已缓存但仍在等 AI 结果（pending）的强制重拉，保证刷新后能拿到评估结果
  useEffect(() => {
    entries
      .filter(e => e.status === 'open' || e.status === 'analyzing')
      .forEach(e => {
        const cached = detailMap[e.id];
        if (!cached) ensureDetailLoaded(e.id);
        else if (isDetailPending(cached)) ensureDetailLoaded(e.id, true);
      });

    if (entries.length > 0 && (selectedId == null || !entries.some(e => e.id === selectedId))) {
      // 默认选中最新的历史记录（非持仓/待决策），没有则回退第一条
      const history = entries
        .filter(e => e.status !== 'open' && e.status !== 'analyzing')
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
      const first = history[0] ?? entries[0];
      if (first) handleSelect(first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const handleSaved = () => fetchAll(true);

  // 各状态计数：直接基于全量 entries，保证与下方列表一致（stats 接口口径可能不同步）
  const statusCounts = React.useMemo(() => {
    const c: Record<string, number> = { open: 0, analyzing: 0, closed: 0 };
    entries.forEach(e => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [entries]);

  // 累计盈亏金额：累加所有已平仓记录的真实盈亏（realized_pnl）
  const totalPnlAmount = React.useMemo(() => {
    let sum = 0;
    let has = false;
    entries.forEach(e => {
      const v = toNum(e.realized_pnl);
      if (v != null) { sum += v; has = true; }
    });
    return has ? sum : undefined;
  }, [entries]);

  // 全局同步持仓
  const [syncingAll, setSyncingAll] = useState(false);
  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await journalAPI.syncAll();
      message.success(`同步完成：新成交 ${res.new_trades} · 回填 ${res.filled} · 新建 ${res.created} · 平仓 ${res.closed}`);
      handleSaved();
    } catch (e: any) {
      message.error(e.message || '同步失败');
    } finally {
      setSyncingAll(false);
    }
  };

  // 单条同步
  const handleSyncOne = async (entry: JournalEntry) => {
    setActionLoadingId(entry.id);
    try {
      const res = await journalAPI.syncOne(entry.id);
      const text = res.action === 'filled' ? '已回填真实成交数据'
        : res.action === 'closed' ? '检测到平仓，已拉取盈亏并触发复盘'
        : '交易所暂无变化';
      message.success(text);
      handleSaved();
    } catch (e: any) {
      message.error(e.message || '同步失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 单条评估卡片渲染（idx 为该条在完整 analyses 中的索引，用于再评估编号）
  const renderAnalysis = (a: Analysis, idx: number) => (
    <div key={a.id} className={a.analysis_type === 'reassess' ? styles.reassessBox : styles.assessmentBox}>
      <div className={styles.overallHeader}>
        <div className={`${styles.boxTitle} ${a.analysis_type === 'reassess' ? styles.reassessTitle : styles.aiTitle}`}>
          {a.analysis_type === 'reassess' ? `🔄 第 ${idx} 次再评估` : '🤖 AI 入场评估'}
          <span style={{ marginLeft: '0.5rem', fontWeight: 400, textTransform: 'none' }}>
            {formatTime(a.created_at)}
          </span>
        </div>
        {a.confidence_score != null && (
          <div className={styles.confidenceWrap}>
            <span className={styles.confidenceLabel}>置信度</span>
            <div className={styles.confidenceBar}>
              <div className={styles.confidenceFill} style={{
                width: `${a.confidence_score}%`,
                background: a.confidence_score >= 70 ? '#10b981' : a.confidence_score >= 40 ? '#f59e0b' : '#ef4444',
              }} />
            </div>
            <span className={styles.confidenceValue}>{a.confidence_score}</span>
          </div>
        )}
      </div>
      {/* 入场评估：决策清单卡片置顶 */}
      {a.analysis_type === 'entry' && <DecisionCard a={a} />}
      {/* 再评估：风险复盘 */}
      {a.analysis_type === 'reassess' && <RiskReview items={a.risk_review} />}
      {a.overall_assessment && (
        <div className={styles.boxText} style={{ marginBottom: '0.5rem' }}>{a.overall_assessment}</div>
      )}
      {a.claude_analysis && (
        <div className={styles.boxText}>{a.claude_analysis}</div>
      )}
      {(a.risk_points?.length || a.opportunities?.length) && (
        <div className={styles.pointsRow}>
          {a.risk_points && a.risk_points.length > 0 && (
            <div className={styles.pointsBlock}>
              <div className={styles.pointsTitle}>⚠️ 风险点</div>
              {a.risk_points.map((p, pi) => <div key={pi} className={styles.pointItem}>{p}</div>)}
            </div>
          )}
          {a.opportunities && a.opportunities.length > 0 && (
            <div className={styles.pointsBlock}>
              <div className={styles.pointsTitle}>✅ 机会点</div>
              {a.opportunities.map((p, pi) => <div key={pi} className={styles.pointItem}>{p}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── 左栏：窄列表行 ──
  const renderRow = (entry: JournalEntry) => {
    const pnl = toNum(entry.pnl_pct);
    return (
      <button
        key={entry.id}
        className={`${styles.row} ${selectedId === entry.id ? styles.rowActive : ''} ${styles[`rowBorder_${entry.status}`]}`}
        onClick={() => handleSelect(entry.id)}
      >
        <div className={styles.rowTop}>
          <span className={styles.rowSymbol}>{entry.symbol.replace(/USDT$/, '')}</span>
          <span className={`${styles.dirDot} ${directionClass(entry.direction)}`}>{directionLabel(entry.direction)}</span>
          {pnl != null && (
            <span className={`${styles.rowPnl} ${pnlClass(pnl)}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%</span>
          )}
        </div>
        <div className={styles.rowBottom}>
          <span className={`${styles.rowStatus} ${styles[entry.status]}`}>{STATUS_LABEL[entry.status]}</span>
          <span className={styles.rowTime}>{formatTime(entry.created_at)}</span>
        </div>
      </button>
    );
  };

  // 左栏分组小节
  const rowSection = (title: string, icon: string, list: JournalEntry[]) =>
    list.length > 0 && (
      <div className={styles.rowGroup}>
        <div className={styles.rowGroupTitle}>{icon} {title} <span className={styles.rowGroupCount}>{list.length}</span></div>
        {list.map(renderRow)}
      </div>
    );

  // ── 右栏：选中记录的完整详情 ──
  const renderDetailPanel = () => {
    const entry = entries.find(e => e.id === selectedId);
    if (!entry) {
      return <div className={styles.detailEmpty}>从左侧选择一条记录查看详情</div>;
    }
    const detail = detailMap[entry.id];
    const analyses = detail?.analyses ?? [];
    const isActing = actionLoadingId === entry.id;
    const pnl = toNum(detail?.pnl_pct ?? entry.pnl_pct);

    return (
      <div className={styles.detailPanel}>
        {/* 头部 */}
        <div className={styles.detailHeader}>
          <div className={styles.detailTitle}>
            <span className={styles.detailSymbol}>{entry.symbol.replace(/USDT$/, '')}</span>
            <span className={`${styles.directionBadge} ${directionClass(entry.direction)}`}>{directionLabel(entry.direction)}</span>
            {entry.timeframe && <span className={styles.tfBadge}>{entry.timeframe}</span>}
            <span className={`${styles.statusBadge} ${styles[entry.status]}`}>{STATUS_LABEL[entry.status]}</span>
          </div>
          <div className={styles.detailActions}>
            {entry.status === 'open' && (
              <button className={styles.reassessBtn} onClick={() => setReassessTarget(entry)}>🔄 再评估</button>
            )}
            {(entry.status === 'open' || entry.status === 'analyzing') && (
              <button className={styles.syncBtn} onClick={() => handleSyncOne(entry)} disabled={isActing}>
                {isActing ? '同步中...' : '🔄 同步'}
              </button>
            )}
            {entry.status === 'failed' && (
              <button className={styles.retryBtn} onClick={() => handleRetry(entry)} disabled={isActing}>
                {isActing ? '提交中...' : '🔄 重新评估'}
              </button>
            )}
          </div>
        </div>

        {/* 关键价格：优先真实成交，回退计划价 */}
        {(() => {
          // 真实成交字段可能仅 detail 接口返回，优先用 detail，回退 list 的 entry
          const d = detail ?? entry;
          const entryPrice = d.entry_price ?? d.planned_entry_price;
          const realizedPnl = toNum(d.realized_pnl);
          const lev = toNum(d.leverage);
          const qty = toNum(d.qty);
          const fillPrice = toNum(d.entry_price);
          // 仓位名义价值 = 成交价 × 数量
          const notional = fillPrice != null && qty != null ? fillPrice * qty : undefined;
          return (
            <div className={styles.detailMetrics}>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>{d.entry_price != null ? '成交价' : '计划入场'}</span>
                <span className={styles.metricValue}>{formatPrice(entryPrice)}</span>
              </div>
              {d.planned_stop_loss != null && (
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>止损</span>
                  <span className={`${styles.metricValue} ${styles.negative}`}>{formatPrice(d.planned_stop_loss)}</span>
                </div>
              )}
              {d.planned_take_profit != null && (
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>止盈</span>
                  <span className={`${styles.metricValue} ${styles.positive}`}>{formatPrice(d.planned_take_profit)}</span>
                </div>
              )}
              {lev != null && (
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>杠杆</span>
                  <span className={styles.metricValue}>{lev}x</span>
                </div>
              )}
              {d.exit_price != null && (
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>平仓价</span>
                  <span className={styles.metricValue}>{formatPrice(d.exit_price)}</span>
                </div>
              )}
              {notional != null && (
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>仓位价值</span>
                  <span className={styles.metricValue}>{notional.toFixed(2)} U</span>
                </div>
              )}
              {realizedPnl != null && (
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>已实现盈亏</span>
                  <span className={`${styles.metricValue} ${pnlClass(realizedPnl)}`}>{realizedPnl >= 0 ? '+' : ''}{realizedPnl.toFixed(2)}</span>
                </div>
              )}
              {pnl != null && (
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>盈亏</span>
                  <span className={`${styles.metricValue} ${pnlClass(pnl)}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* 详情内容 */}
        <div className={styles.detailBody}>
          {detailLoadingId === entry.id && !detail && <div className={styles.detailLoading}>加载中...</div>}
          {detail && (
            <>
              {entry.entry_reason && (
                <div className={styles.assessmentBox}>
                  <div className={styles.boxTitle}>入场理由</div>
                  <div className={styles.boxText}>{entry.entry_reason}</div>
                </div>
              )}
              {analyses.map((a, i) => renderAnalysis(a, i))}
              {detail.review && (
                <div className={styles.reviewBox}>
                  <div className={`${styles.boxTitle} ${styles.reviewTitle}`}>📋 交易复盘</div>
                  {detail.review.exit_reason && (
                    <div className={styles.boxText} style={{ marginBottom: '0.5rem' }}>
                      <strong>平仓原因：</strong>{detail.review.exit_reason}
                    </div>
                  )}
                  {detail.review.ai_review && (
                    <div className={styles.boxText} style={{ marginBottom: '0.5rem' }}>{detail.review.ai_review}</div>
                  )}
                  {(detail.review.what_went_well || detail.review.what_went_wrong) && (
                    <div className={styles.pointsRow}>
                      {detail.review.what_went_well && (
                        <div className={styles.pointsBlock}>
                          <div className={styles.pointsTitle}>✅ 做得好的</div>
                          <div className={styles.pointItem}>{detail.review.what_went_well}</div>
                        </div>
                      )}
                      {detail.review.what_went_wrong && (
                        <div className={styles.pointsBlock}>
                          <div className={styles.pointsTitle}>⚠️ 需改进的</div>
                          <div className={styles.pointItem}>{detail.review.what_went_wrong}</div>
                        </div>
                      )}
                    </div>
                  )}
                  {detail.review.lessons && (
                    <div className={styles.boxText} style={{ marginTop: '0.5rem' }}>
                      <strong>经验教训：</strong>{detail.review.lessons}
                    </div>
                  )}
                </div>
              )}
              {detail.status === 'failed' && (
                <div className={styles.failedBox}>
                  <div className={styles.failedTitle}>⚠️ AI 分析失败</div>
                  <div className={styles.failedText}>重试一次后仍未成功，可点击右上「重新评估」生成新记录。</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.tradeJournal}>
      <PageHeader
        title="交易辅助"
        subtitle="AI 入场评估 · 持仓管理 · 自动复盘"
        icon="📒"
      >
        <CoolRefreshButton onClick={() => fetchAll(true)} loading={isRefreshing} />
      </PageHeader>

      {/* 统计横条 */}
      {stats && (
        <div className={styles.statBar}>
          <button
            className={`${styles.statBarItem} ${styles.statBarItemClickable} ${statusFilter === 'closed' ? styles.statBarItemActive : ''}`}
            onClick={() => toggleStatusFilter('closed')}
          >
            <span className={styles.statBarLabel}>已平仓</span>
            <span className={styles.statBarValue}>{statusCounts.closed}</span>
          </button>
          <button
            className={`${styles.statBarItem} ${styles.statBarItemClickable} ${statusFilter === 'open' ? styles.statBarItemActive : ''}`}
            onClick={() => toggleStatusFilter('open')}
          >
            <span className={styles.statBarLabel}>持仓中</span>
            <span className={`${styles.statBarValue} ${statusCounts.open > 0 ? styles.positive : ''}`}>{statusCounts.open}</span>
          </button>
          <button
            className={`${styles.statBarItem} ${styles.statBarItemClickable} ${statusFilter === 'analyzing' ? styles.statBarItemActive : ''}`}
            onClick={() => toggleStatusFilter('analyzing')}
          >
            <span className={styles.statBarLabel}>待决策</span>
            <span className={`${styles.statBarValue} ${statusCounts.analyzing > 0 ? styles.warning : ''}`}>{statusCounts.analyzing}</span>
          </button>
          <div className={styles.statBarItem}>
            <span className={styles.statBarLabel}>胜率</span>
            {(() => {
              const wr = toNum(stats.win_rate) ?? 0;
              const decided = (toNum(stats.win) ?? 0) + (toNum(stats.loss) ?? 0);
              return (
                <span className={`${styles.statBarValue} ${decided > 0 ? (wr >= 50 ? styles.positive : styles.negative) : ''}`}>
                  {decided > 0 ? `${wr.toFixed(1)}%` : '-'}
                  <span className={styles.statBarSub}>{stats.win}胜{stats.loss}负</span>
                </span>
              );
            })()}
          </div>
          <div className={styles.statBarItem}>
            <span className={styles.statBarLabel}>累计盈亏</span>
            {(() => {
              const amt = totalPnlAmount;
              return (
                <span className={`${styles.statBarValue} ${pnlClass(amt)}`}>
                  {amt != null ? `${amt >= 0 ? '+' : ''}${amt.toFixed(2)} U` : '-'}
                </span>
              );
            })()}
          </div>
          <div className={styles.statBarActions}>
            <button className={styles.syncAllBtn} onClick={handleSyncAll} disabled={syncingAll}>
              {syncingAll ? <><span className={styles.spinner} /> 同步中...</> : '同步持仓'}
            </button>
            <button className={styles.newBtn} onClick={() => setShowNewModal(true)}>+ 新建</button>
          </div>
        </div>
      )}

      {/* 两栏：左清单 / 右详情 */}
      <div className={styles.split}>
        {/* 左栏 */}
        <div className={styles.leftPane}>
          <div className={styles.rowList}>
            {loading && <div className={styles.detailLoading}>加载中...</div>}
            {error && <div className={styles.failedText}>{error}</div>}
            {!loading && !error && entries.length === 0 && (
              <div className={styles.detailEmpty}>暂无记录，点击「+ 新建」开始</div>
            )}
            {!loading && !error && entries.length > 0 && statusFilter !== 'all' && entries.filter(e => e.status === statusFilter).length === 0 && (
              <div className={styles.detailEmpty}>无「{STATUS_LABEL[statusFilter]}」记录</div>
            )}
            {!loading && !error && entries.length > 0 && (
              statusFilter !== 'all'
                ? entries.filter(e => e.status === statusFilter).map(renderRow)
                : (() => {
                    const openList = entries.filter(e => e.status === 'open');
                    const analyzingList = entries.filter(e => e.status === 'analyzing');
                    const others = entries.filter(e => e.status !== 'open' && e.status !== 'analyzing');
                    return (
                      <>
                        {rowSection('持仓中', '💼', openList)}
                        {rowSection('历史记录', '📊', others)}
                        {rowSection('待决策', '⏳', analyzingList)}
                      </>
                    );
                  })()
            )}
          </div>
        </div>

        {/* 右栏 */}
        <div className={styles.rightPane}>
          {renderDetailPanel()}
        </div>
      </div>

      {showNewModal && (
        <NewEntryModal onClose={() => setShowNewModal(false)} onSaved={handleSaved} />
      )}
      {reassessTarget && (
        <ReassessModal entry={reassessTarget} onClose={() => setReassessTarget(null)} onSaved={handleSaved} />
      )}
    </div>
  );
};

export default TradeJournal;
