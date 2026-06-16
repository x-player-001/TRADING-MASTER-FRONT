import React, { useState, useEffect, useCallback } from 'react';
import { Select, InputNumber, Input, message } from 'antd';
import styles from './TradeJournal.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { DataSection, CoolRefreshButton } from '../components/ui';
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
    size: undefined,
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
            <span className={styles.formLabel}>仓位大小（可选）</span>
            <InputNumber style={{ width: '100%' }} placeholder="USDT" min={0}
              value={form.size} onChange={v => set('size', v ?? undefined)} />
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

const ReassessModal: React.FC<ReassessModalProps> = ({ entry, onClose, onSaved }) => {
  const [currentPrice, setCurrentPrice] = useState<number | undefined>();
  const [concern, setConcern] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleReassess = async () => {
    if (!currentPrice) { message.warning('请填写当前价格'); return; }
    if (!concern.trim()) { message.warning('请填写关注点或疑虑'); return; }
    setLoading(true);
    try {
      const res = await journalAPI.reassess(entry.id, { current_price: currentPrice, concern });
      setResult(res.assessment);
      onSaved();
    } catch (e: any) {
      message.error(e.message || '再评估失败');
    } finally {
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
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{formatPrice(entry.planned_entry_price)}</div>
          </div>
          <div className={styles.formItem}>
            <span className={styles.formLabel}>当前价格</span>
            <InputNumber style={{ width: '100%' }} placeholder="输入当前价格" min={0} autoFocus disabled={!!result}
              onChange={v => setCurrentPrice(v ?? undefined)} />
          </div>

          <div className={`${styles.formItem} ${styles.fullWidth}`}>
            <span className={styles.formLabel}>关注点 / 疑虑</span>
            <TextArea rows={3} placeholder="如：价格到达关键阻力位，是否需要减仓？" disabled={!!result}
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
                <div className={styles.assessmentResultText}>{result}</div>
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

// ── 平仓弹窗 ──────────────────────────────────────────
interface CloseModalProps {
  entry: JournalEntry;
  onClose: () => void;
  onSaved: () => void;
}

const CloseModal: React.FC<CloseModalProps> = ({ entry, onClose, onSaved }) => {
  const [exitPrice, setExitPrice] = useState<number | undefined>();
  const [exitReason, setExitReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = async () => {
    if (!exitPrice) { message.warning('请填写平仓价格'); return; }
    setSaving(true);
    try {
      await journalAPI.close(entry.id, { actual_exit_price: exitPrice, exit_reason: exitReason || undefined });
      message.success('已平仓，AI 复盘生成中');
      onSaved();
      onClose();
    } catch (e: any) {
      message.error(e.message || '平仓失败');
    } finally {
      setSaving(false);
    }
  };

  const rrRatio = exitPrice && entry.planned_entry_price && entry.planned_stop_loss
    ? Math.abs(exitPrice - entry.planned_entry_price) / Math.abs(entry.planned_entry_price - entry.planned_stop_loss)
    : null;

  const estPnlPct = exitPrice && entry.planned_entry_price
    ? (exitPrice - entry.planned_entry_price) / entry.planned_entry_price * 100 * (entry.direction === 'SHORT' ? -1 : 1)
    : null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>
          平仓 · {entry.symbol}
          <span className={`${styles.directionBadge} ${directionClass(entry.direction)}`} style={{ marginLeft: '0.5rem' }}>
            {directionLabel(entry.direction)}
          </span>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formItem}>
            <span className={styles.formLabel}>入场价</span>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{formatPrice(entry.planned_entry_price)}</div>
          </div>
          <div className={styles.formItem}>
            <span className={styles.formLabel}>止损价</span>
            <div style={{ fontSize: '1rem', color: '#ef4444', fontWeight: 600 }}>{formatPrice(entry.planned_stop_loss)}</div>
          </div>

          <div className={`${styles.formItem} ${styles.fullWidth}`}>
            <span className={styles.formLabel}>平仓价格</span>
            <InputNumber style={{ width: '100%' }} placeholder="输入实际平仓价" min={0} autoFocus
              onChange={v => setExitPrice(v ?? undefined)} />
          </div>

          {estPnlPct != null && (
            <div className={`${styles.formItem} ${styles.fullWidth}`}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <span>预计盈亏：<strong className={estPnlPct >= 0 ? styles.positive : styles.negative}>{estPnlPct >= 0 ? '+' : ''}{estPnlPct.toFixed(2)}%</strong></span>
                {rrRatio != null && <span>风险收益比：<strong>1 : {rrRatio.toFixed(2)}</strong></span>}
              </div>
            </div>
          )}

          <div className={`${styles.formItem} ${styles.fullWidth}`}>
            <span className={styles.formLabel}>出场原因（可选，帮助 AI 复盘）</span>
            <TextArea rows={2} placeholder="如：止盈离场 / 止损离场 / 趋势反转..." value={exitReason}
              onChange={e => setExitReason(e.target.value)} />
          </div>
        </div>

        <div className={styles.formActions}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button className={styles.closeBtn} onClick={handleClose} disabled={saving}>
            {saving ? '处理中...' : '确认平仓'}
          </button>
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [reassessTarget, setReassessTarget] = useState<JournalEntry | null>(null);
  const [closeTarget, setCloseTarget] = useState<JournalEntry | null>(null);

  // 行内 open/dismiss 操作 loading
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // 详情缓存：展开时懒加载
  const [detailMap, setDetailMap] = useState<Record<number, JournalEntry>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const pollingRef = React.useRef<Record<number, ReturnType<typeof setInterval>>>({});

  const stopPolling = (id: number) => {
    if (pollingRef.current[id]) {
      clearInterval(pollingRef.current[id]);
      delete pollingRef.current[id];
    }
  };

  // 分析终态：有结果 或 已失败，都不再轮询
  const isDetailSettled = (d?: JournalEntry) =>
    !!d && ((d.analyses?.length ?? 0) > 0 || d.status === 'failed');

  const loadDetail = async (id: number) => {
    try {
      const detail = await journalAPI.detail(id);
      setDetailMap(m => ({ ...m, [id]: detail }));
      if (isDetailSettled(detail)) stopPolling(id);
      return detail;
    } catch (e: any) {
      message.error('加载详情失败');
    }
  };

  const handleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (isDetailSettled(detailMap[id])) return; // 已是终态，用缓存
    setDetailLoadingId(id);
    const detail = await loadDetail(id);
    setDetailLoadingId(null);
    // 未到终态才轮询
    if (!isDetailSettled(detail) && !pollingRef.current[id]) {
      pollingRef.current[id] = setInterval(() => loadDetail(id), 3000);
    }
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
        size: entry.size,
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

  // 组件卸载时清除所有轮询
  useEffect(() => {
    const ref = pollingRef.current;
    return () => { Object.values(ref).forEach(clearInterval); };
  }, []);

  const fetchAll = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [list, statsData] = await Promise.all([
        journalAPI.list(statusFilter === 'all' ? undefined : statusFilter),
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
  }, [statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaved = () => fetchAll(true);

  const handleOpen = async (entry: JournalEntry) => {
    setActionLoadingId(entry.id);
    try {
      await journalAPI.open(entry.id);
      message.success('已确认开仓');
      handleSaved();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDismiss = async (entry: JournalEntry) => {
    setActionLoadingId(entry.id);
    try {
      await journalAPI.dismiss(entry.id);
      message.info('已放弃该机会');
      handleSaved();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusFilterOptions: Array<{ value: JournalStatus | 'all'; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'analyzing', label: '待决策' },
    { value: 'open', label: '持仓中' },
    { value: 'closed', label: '已平仓' },
    { value: 'dismissed', label: '已放弃' },
    { value: 'failed', label: '分析失败' },
  ];

  return (
    <div className={styles.tradeJournal}>
      <PageHeader
        title="交易辅助"
        subtitle="AI 入场评估 · 持仓管理 · 自动复盘"
        icon="📒"
      >
        <CoolRefreshButton onClick={() => fetchAll(true)} loading={isRefreshing} />
      </PageHeader>

      {/* 统计卡片 */}
      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>总记录数</span>
            <span className={styles.statValue}>{stats.total}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>待决策</span>
            <span className={`${styles.statValue} ${(stats.analyzing ?? 0) > 0 ? styles.warning : ''}`}>{stats.analyzing ?? '-'}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>持仓中</span>
            <span className={`${styles.statValue} ${(stats.open ?? 0) > 0 ? styles.positive : ''}`}>{stats.open ?? '-'}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>胜率</span>
            {(() => {
              const wr = toNum(stats.win_rate) ?? 0;
              const decided = (toNum(stats.win) ?? 0) + (toNum(stats.loss) ?? 0);
              return (
                <span className={`${styles.statValue} ${wr >= 50 ? styles.positive : styles.negative}`}>
                  {decided > 0 ? wr.toFixed(1) : '-'}%
                </span>
              );
            })()}
            <span className={styles.statSub}>{stats.win}胜 {stats.loss}负</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>累计盈亏</span>
            {(() => {
              const pnl = toNum(stats.total_pnl);
              return (
                <span className={`${styles.statValue} ${pnlClass(pnl)}`}>
                  {pnl != null ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%` : '-'}
                </span>
              );
            })()}
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className={styles.toolbar}>
        <Select value={statusFilter} onChange={v => setStatusFilter(v)} style={{ width: 110 }}>
          {statusFilterOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
        </Select>
        <div className={styles.toolbarRight}>
          <button className={styles.newBtn} onClick={() => setShowNewModal(true)}>
            + 新建评估
          </button>
        </div>
      </div>

      {/* 列表 */}
      <DataSection
        loading={loading}
        error={error}
        empty={!loading && !error && entries.length === 0}
        emptyText="暂无记录，点击「新建评估」开始"
        emptyIcon="📒"
      >
        <div className={styles.entryList}>
          {entries.map(entry => {
            const isExpanded = expandedId === entry.id;
            const isActing = actionLoadingId === entry.id;
            return (
              <div key={entry.id} className={styles.entryCard}>
                <div
                  className={styles.entryHeader}
                  onClick={() => handleExpand(entry.id)}
                >
                  <span className={styles.entrySymbol}>{entry.symbol}</span>
                  <span className={`${styles.directionBadge} ${directionClass(entry.direction)}`}>
                    {directionLabel(entry.direction)}
                  </span>
                  <span className={`${styles.statusBadge} ${styles[entry.status]}`}>
                    {STATUS_LABEL[entry.status]}
                  </span>

                  <div className={styles.entryMeta}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>入场价</span>
                      <span className={styles.metaValue}>{formatPrice(entry.planned_entry_price)}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>止损</span>
                      <span className={`${styles.metaValue} ${styles.negative}`}>{formatPrice(entry.planned_stop_loss)}</span>
                    </div>
                    {entry.planned_take_profit && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>止盈</span>
                        <span className={`${styles.metaValue} ${styles.positive}`}>{formatPrice(entry.planned_take_profit)}</span>
                      </div>
                    )}
                    {entry.timeframe && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>周期</span>
                        <span className={styles.metaValue}>{entry.timeframe}</span>
                      </div>
                    )}
                    {toNum(entry.pnl_pct) != null && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>盈亏</span>
                        <span className={`${styles.metaValue} ${pnlClass(toNum(entry.pnl_pct))}`}>
                          {toNum(entry.pnl_pct)! >= 0 ? '+' : ''}{toNum(entry.pnl_pct)!.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <span className={styles.entryTime}>{formatTime(entry.created_at)}</span>
                  <span className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}>▼</span>
                </div>

                {isExpanded && (
                  <div className={styles.entryDetail}>
                    {detailLoadingId === entry.id && (
                      <div className={styles.detailLoading}>加载中...</div>
                    )}
                    {detailMap[entry.id] && (() => {
                      const detail = detailMap[entry.id];
                      const analyses = detail.analyses ?? [];
                      return (
                        <>
                          {/* 评估历史 */}
                          {analyses.map((a: Analysis, i: number) => (
                            <div key={a.id} className={a.analysis_type === 'reassess' ? styles.reassessBox : styles.assessmentBox}>
                              <div className={styles.overallHeader}>
                                <div className={`${styles.boxTitle} ${a.analysis_type === 'reassess' ? styles.reassessTitle : styles.aiTitle}`}>
                                  {a.analysis_type === 'reassess' ? `🔄 第 ${i + 1} 次再评估` : '🤖 AI 入场评估'}
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
                          ))}

                          {/* 复盘 */}
                          {detail.review && (
                            <div className={styles.reviewBox}>
                              <div className={`${styles.boxTitle} ${styles.reviewTitle}`}>📋 交易复盘</div>
                              <div className={styles.boxText}>{detail.review}</div>
                            </div>
                          )}

                          {/* 分析失败提示 */}
                          {detail.status === 'failed' && (
                            <div className={styles.failedBox}>
                              <div className={styles.failedTitle}>⚠️ AI 分析失败</div>
                              <div className={styles.failedText}>重试一次后仍未成功，可点击下方「重新评估」生成新记录。</div>
                            </div>
                          )}

                          {/* 入场理由（无评估时降级显示） */}
                          {entry.entry_reason && analyses.length === 0 && detail.status !== 'failed' && (
                            <div className={styles.assessmentBox}>
                              <div className={styles.boxTitle}>入场理由</div>
                              <div className={styles.boxText}>{entry.entry_reason}</div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* 操作区 */}
                    <div className={styles.closeAction}>
                      {entry.status === 'analyzing' && (
                        <>
                          <button className={styles.openBtn} onClick={() => handleOpen(entry)} disabled={isActing}>
                            {isActing ? '处理中...' : '✅ 确认开仓'}
                          </button>
                          <button className={styles.dismissBtn} onClick={() => handleDismiss(entry)} disabled={isActing}>
                            {isActing ? '处理中...' : '放弃机会'}
                          </button>
                        </>
                      )}
                      {entry.status === 'open' && (
                        <>
                          <button className={styles.reassessBtn} onClick={() => setReassessTarget(entry)}>
                            🔄 再评估
                          </button>
                          <button className={styles.closeBtn} onClick={() => setCloseTarget(entry)}>
                            平仓
                          </button>
                          <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                            平仓后 AI 将自动生成复盘
                          </span>
                        </>
                      )}
                      {entry.status === 'closed' && entry.actual_exit_price && (
                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                          平仓价：{formatPrice(entry.actual_exit_price)} · {formatTime(entry.closed_at)}
                        </span>
                      )}
                      {entry.status === 'failed' && (
                        <button className={styles.retryBtn} onClick={() => handleRetry(entry)} disabled={isActing}>
                          {isActing ? '提交中...' : '🔄 重新评估'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DataSection>

      {showNewModal && (
        <NewEntryModal onClose={() => setShowNewModal(false)} onSaved={handleSaved} />
      )}
      {reassessTarget && (
        <ReassessModal entry={reassessTarget} onClose={() => setReassessTarget(null)} onSaved={handleSaved} />
      )}
      {closeTarget && (
        <CloseModal entry={closeTarget} onClose={() => setCloseTarget(null)} onSaved={handleSaved} />
      )}
    </div>
  );
};

export default TradeJournal;
