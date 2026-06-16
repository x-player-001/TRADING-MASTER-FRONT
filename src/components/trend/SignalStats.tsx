import React, { useState, useEffect, useCallback } from 'react';
import { Segmented, Switch, Select, Input, message } from 'antd';
import styles from './SignalStats.module.scss';
import { DataSection } from '../ui';
import {
  trendFollowAPI,
  StopMode,
  OutcomeStatRow,
  TriggerStatRow,
  TriggerEvent,
  TriggerOutcome,
  AlertWithOutcome,
} from '../../services/trendFollowAPI';
import { journalAPI, CalibrationBucket } from '../../services/journalAPI';

const { Option } = Select;

// 数值兜底：null/undefined 显示 -
const num = (v?: number | null, suffix = '', digits = 1) =>
  v == null ? '-' : `${v.toFixed(digits)}${suffix}`;

const SIGNAL_KEYS: Array<{ key: keyof OutcomeStatRow; label: string }> = [
  { key: 'volume_shrink', label: '缩量' },
  { key: 'reversal_signal', label: '反转' },
  { key: 'ema20_support', label: 'EMA20' },
];

const signalCombo = (row: OutcomeStatRow) =>
  SIGNAL_KEYS.filter(s => row[s.key]).map(s => s.label).join('+') || '无';

const MIN_SAMPLES = 30;

const OUTCOME_META: Record<TriggerOutcome, { label: string; cls: string }> = {
  win: { label: '盈', cls: styles.positive },
  loss: { label: '亏', cls: styles.negative },
  open: { label: '持仓中', cls: styles.muted },
  unevaluated: { label: '待验证', cls: styles.muted },
};

const fmtPrice = (v?: number | null) => {
  if (v == null) return '-';
  return v >= 1 ? v.toFixed(4) : v.toFixed(6);
};

const fmtTriggerTime = (ms?: number) => {
  if (!ms) return '-';
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 报警逐条结果着色 + 文案
const outcomeBadge = (o: 'win' | 'loss' | 'open' | null) => {
  if (o === 'win') return { label: '盈', cls: styles.positive };
  if (o === 'loss') return { label: '亏', cls: styles.negative };
  if (o === 'open') return { label: '持仓中', cls: styles.muted };
  return { label: '待验证', cls: styles.muted };
};

// 报警自带信号标签
const ALERT_SIGNALS: Array<{ key: 'volume_shrink' | 'reversal_signal' | 'ema20_support'; label: string }> = [
  { key: 'volume_shrink', label: '缩量' },
  { key: 'reversal_signal', label: '反转' },
  { key: 'ema20_support', label: 'EMA20' },
];

const SignalStats: React.FC = () => {
  const [stop, setStop] = useState<StopMode>('low');
  const [bySignals, setBySignals] = useState(false);

  // 报警事后区视图：detail=逐条明细 / agg=聚合统计
  const [alertView, setAlertView] = useState<'detail' | 'agg'>('detail');
  const [onlyEvaluated, setOnlyEvaluated] = useState(false);
  const [alertRows, setAlertRows] = useState<AlertWithOutcome[]>([]);

  const [outcome, setOutcome] = useState<OutcomeStatRow[]>([]);
  const [trigger, setTrigger] = useState<TriggerStatRow[]>([]);
  const [calibration, setCalibration] = useState<CalibrationBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 扳机事件流
  const [triggers, setTriggers] = useState<TriggerEvent[]>([]);
  const [trigSymbol, setTrigSymbol] = useState('');
  const [trigTimeframe, setTrigTimeframe] = useState<string | undefined>();
  const [trigOutcome, setTrigOutcome] = useState<TriggerOutcome | undefined>();

  const fetchOutcome = useCallback(async () => {
    try {
      const data = await trendFollowAPI.getOutcomeStats({ stop, by_signals: bySignals || undefined });
      setOutcome(data);
    } catch {
      message.error('加载报警统计失败');
    }
  }, [stop, bySignals]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tg, cal] = await Promise.all([
        trendFollowAPI.getTriggerStats(),
        journalAPI.calibration(),
      ]);
      setTrigger(tg);
      setCalibration(cal);
      await fetchOutcome();
    } catch (e: any) {
      setError(e.message || '加载统计失败');
    } finally {
      setLoading(false);
    }
  }, [fetchOutcome]);

  const fetchTriggers = useCallback(async () => {
    try {
      const data = await trendFollowAPI.getTriggers({
        symbol: trigSymbol.trim() ? trigSymbol.trim().toUpperCase() : undefined,
        parent_timeframe: trigTimeframe,
        outcome: trigOutcome,
        limit: 50,
      });
      setTriggers(data);
    } catch {
      // 静默：扳机流是次要数据，失败不打断主统计
    }
  }, [trigSymbol, trigTimeframe, trigOutcome]);

  const fetchAlertRows = useCallback(async () => {
    try {
      const data = await trendFollowAPI.getAlertsWithOutcome({
        only_evaluated: onlyEvaluated || undefined,
        limit: 10,
      });
      setAlertRows(data);
    } catch {
      // 静默
    }
  }, [onlyEvaluated]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  // stop / by_signals 变化时只刷 outcome
  useEffect(() => { fetchOutcome(); }, [fetchOutcome]);
  // 逐条报警明细
  useEffect(() => { fetchAlertRows(); }, [fetchAlertRows]);

  // 扳机筛选变化时刷新（symbol 输入防抖 400ms）
  useEffect(() => {
    const t = setTimeout(fetchTriggers, 400);
    return () => clearTimeout(t);
  }, [fetchTriggers]);

  // 扳机流 30s 轮询
  useEffect(() => {
    const timer = setInterval(fetchTriggers, 30000);
    return () => clearInterval(timer);
  }, [fetchTriggers]);

  return (
    <DataSection
      title="信号统计"
      subtitle="报警事后表现 · 扳机入场对比 · AI 置信度校准"
      loading={loading}
      error={error}
      collapsible
      defaultCollapsed
      compact
    >
      {/* 报警事后区：逐条 / 聚合 切换 */}
      <div className={styles.alertBlock}>
        <div className={styles.alertBlockHead}>
          <div className={styles.tableTitle}>📊 报警事后表现</div>
          <div className={styles.viewSwitch}>
            <button
              className={`${styles.viewBtn} ${alertView === 'detail' ? styles.viewBtnActive : ''}`}
              onClick={() => setAlertView('detail')}
            >
              逐条明细
            </button>
            <button
              className={`${styles.viewBtn} ${alertView === 'agg' ? styles.viewBtnActive : ''}`}
              onClick={() => setAlertView('agg')}
            >
              聚合统计
            </button>
          </div>
        </div>

        {/* 视图内控制栏 */}
        <div className={styles.controls}>
          {alertView === 'detail' ? (
            <div className={styles.controlItem}>
              <span className={styles.controlLabel}>只看已出结果</span>
              <Switch size="small" checked={onlyEvaluated} onChange={setOnlyEvaluated} />
            </div>
          ) : (
            <>
              <div className={styles.controlItem}>
                <span className={styles.controlLabel}>止损口径</span>
                <Segmented
                  size="small"
                  value={stop}
                  onChange={v => setStop(v as StopMode)}
                  options={[{ label: '回调低点', value: 'low' }, { label: '波段起点', value: 'wave' }]}
                />
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlLabel}>按信号组合细分</span>
                <Switch size="small" checked={bySignals} onChange={setBySignals} />
              </div>
            </>
          )}
        </div>

        {/* 逐条明细 */}
        {alertView === 'detail' && (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>结果</th>
                    <th>币种</th>
                    <th>周期/等级</th>
                    <th>信号</th>
                    <th>入场</th>
                    <th>目标</th>
                    <th>盈亏比</th>
                    <th>MFE</th>
                    <th>MAE</th>
                    <th>用时</th>
                  </tr>
                </thead>
                <tbody>
                  {alertRows.length === 0 && (
                    <tr><td colSpan={10} className={styles.empty}>暂无报警数据</td></tr>
                  )}
                  {alertRows.map((r, i) => {
                    const oc = r.outcome;
                    // 当前止损口径对应的结果
                    const result = oc ? (stop === 'low' ? oc.outcome_low : oc.outcome_wave) : null;
                    const rr = oc ? (stop === 'low' ? oc.rr_low : oc.rr_wave) : null;
                    const bars = oc ? (stop === 'low' ? oc.bars_to_exit_low : oc.bars_to_exit_wave) : null;
                    const badge = outcomeBadge(result);
                    const sig = ALERT_SIGNALS.filter(s => (r as any)[s.key]).map(s => s.label).join('+') || '—';
                    return (
                      <tr key={r.id ?? i}>
                        <td><span className={`${styles.outcomeBadge} ${badge.cls}`}>{badge.label}</span></td>
                        <td>{r.symbol}</td>
                        <td>{r.timeframe} L{r.alert_level}</td>
                        <td>{sig}</td>
                        <td>{oc ? fmtPrice(oc.entry_price) : '-'}</td>
                        <td className={styles.positive}>{oc ? fmtPrice(oc.target_price) : '-'}</td>
                        <td>{rr != null ? rr.toFixed(2) : '-'}</td>
                        <td className={styles.positive}>{oc?.mfe_pct != null ? `${oc.mfe_pct.toFixed(1)}%` : '-'}</td>
                        <td className={styles.negative}>{oc?.mae_pct != null ? `${oc.mae_pct.toFixed(1)}%` : '-'}</td>
                        <td className={styles.muted}>{bars != null ? `${bars}根` : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={styles.tableHint}>最近 10 条报警 · 结果按所选止损口径（{stop === 'low' ? '回调低点' : '波段起点'}）· 待验证需评估器回填</div>
          </>
        )}

        {/* 聚合统计 */}
        {alertView === 'agg' && (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>周期</th>
                    <th>等级</th>
                    {bySignals && <th>信号</th>}
                    <th>样本</th>
                    <th>胜率</th>
                    <th>盈亏比</th>
                    <th>MFE</th>
                    <th>MAE</th>
                  </tr>
                </thead>
                <tbody>
                  {outcome.length === 0 && (
                    <tr><td colSpan={bySignals ? 8 : 7} className={styles.empty}>暂无数据</td></tr>
                  )}
                  {outcome.map((r, i) => (
                    <tr key={i}>
                      <td>{r.timeframe}</td>
                      <td>L{r.alert_level}</td>
                      {bySignals && <td>{signalCombo(r)}</td>}
                      <td>
                        {r.samples}
                        <span className={styles.subCount}>（{r.wins}/{r.losses}/{r.opens}）</span>
                      </td>
                      <td className={winClass(r.win_rate)}>{num(r.win_rate, '%')}</td>
                      <td>{num(r.avg_rr, '', 2)}</td>
                      <td className={styles.positive}>{num(r.avg_mfe_pct, '%')}</td>
                      <td className={styles.negative}>{num(r.avg_mae_pct, '%')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.tableHint}>样本列：总数（胜/负/持仓中），胜率不计持仓中</div>
          </>
        )}
      </div>

      <div className={styles.tablesRow}>
        {/* 扳机统计 */}
        <div className={styles.tableBlock}>
          <div className={styles.tableTitle}>🎯 扳机统计（5m 确认入场）</div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>母级周期</th>
                  <th>母级等级</th>
                  <th>样本</th>
                  <th>胜率</th>
                  <th>盈亏比</th>
                  <th>MFE</th>
                  <th>未评估</th>
                </tr>
              </thead>
              <tbody>
                {trigger.length === 0 && (
                  <tr><td colSpan={7} className={styles.empty}>暂无数据</td></tr>
                )}
                {trigger.map((r, i) => (
                  <tr key={i}>
                    <td>{r.parent_timeframe}</td>
                    <td>L{r.parent_alert_level}</td>
                    <td>
                      {r.samples}
                      <span className={styles.subCount}>（{r.wins}/{r.losses}/{r.opens}）</span>
                    </td>
                    <td className={winClass(r.win_rate)}>{num(r.win_rate, '%')}</td>
                    <td>{num(r.avg_rr, '', 2)}</td>
                    <td className={styles.positive}>{num(r.avg_mfe_pct, '%')}</td>
                    <td className={styles.muted}>{r.unevaluated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI 置信度校准 */}
        <div className={styles.tableBlock}>
          <div className={styles.tableTitle}>🤖 AI 置信度校准</div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>置信度区间</th>
                  <th>样本</th>
                  <th>胜率</th>
                  <th>平均盈亏</th>
                </tr>
              </thead>
              <tbody>
                {calibration.length === 0 && (
                  <tr><td colSpan={4} className={styles.empty}>暂无数据</td></tr>
                )}
                {calibration.map((r, i) => (
                  <tr key={i}>
                    <td>{r.bucket}</td>
                    <td>
                      {r.samples}
                      {r.samples < MIN_SAMPLES && (
                        <span className={styles.warnHint}>样本不足</span>
                      )}
                    </td>
                    <td className={winClass(r.win_rate)}>{num(r.win_rate, '%')}</td>
                    <td className={r.avg_pnl_pct != null ? (r.avg_pnl_pct >= 0 ? styles.positive : styles.negative) : ''}>
                      {r.avg_pnl_pct != null ? `${r.avg_pnl_pct >= 0 ? '+' : ''}${r.avg_pnl_pct.toFixed(2)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableHint}>样本 &lt; {MIN_SAMPLES} 时仅供参考</div>
        </div>
      </div>

      {/* 扳机事件流 */}
      <div className={styles.triggerBlock}>
        <div className={styles.triggerHeader}>
          <div className={styles.tableTitle}>⚡ 扳机事件流</div>
          <div className={styles.triggerFilters}>
            <Input
              size="small"
              placeholder="币种"
              allowClear
              value={trigSymbol}
              onChange={e => setTrigSymbol(e.target.value)}
              style={{ width: 110 }}
            />
            <Select
              size="small"
              placeholder="母级周期"
              allowClear
              value={trigTimeframe}
              onChange={v => setTrigTimeframe(v)}
              style={{ width: 100 }}
            >
              <Option value="1h">1h</Option>
              <Option value="4h">4h</Option>
            </Select>
            <Select
              size="small"
              placeholder="结果"
              allowClear
              value={trigOutcome}
              onChange={v => setTrigOutcome(v)}
              style={{ width: 110 }}
            >
              <Option value="win">盈</Option>
              <Option value="loss">亏</Option>
              <Option value="open">持仓中</Option>
              <Option value="unevaluated">待验证</Option>
            </Select>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>结果</th>
                <th>币种</th>
                <th>母级</th>
                <th>确认时间</th>
                <th>入场</th>
                <th>止损</th>
                <th>目标</th>
                <th>R:R</th>
                <th>MFE</th>
                <th>MAE</th>
                <th>用时</th>
              </tr>
            </thead>
            <tbody>
              {triggers.length === 0 && (
                <tr><td colSpan={11} className={styles.empty}>暂无扳机事件</td></tr>
              )}
              {triggers.map(t => {
                const meta = OUTCOME_META[t.outcome ?? 'unevaluated'];
                return (
                  <tr key={t.id}>
                    <td>
                      <span className={`${styles.outcomeBadge} ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td>{t.symbol}</td>
                    <td>{t.parent_timeframe} L{t.parent_alert_level}</td>
                    <td>{fmtTriggerTime(t.kline_time)}</td>
                    <td>{fmtPrice(t.confirm_price)}</td>
                    <td className={styles.negative}>{fmtPrice(t.trigger_stop)}</td>
                    <td className={styles.positive}>{fmtPrice(t.target_price)}</td>
                    <td>{t.rr_ratio != null ? t.rr_ratio.toFixed(1) : '-'}</td>
                    <td className={styles.positive}>{t.mfe_pct != null ? `${t.mfe_pct.toFixed(1)}%` : '-'}</td>
                    <td className={styles.negative}>{t.mae_pct != null ? `${t.mae_pct.toFixed(1)}%` : '-'}</td>
                    <td className={styles.muted}>{t.bars_to_exit != null ? `${t.bars_to_exit}根` : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.tableHint}>用时 = 多少根 5m 后分出胜负 · 每 30s 自动刷新</div>
      </div>
    </DataSection>
  );
};

// 胜率着色：>=55 绿，<45 红，中间默认
function winClass(v?: number | null): string {
  if (v == null) return '';
  if (v >= 55) return styles.positive;
  if (v < 45) return styles.negative;
  return '';
}

export default SignalStats;
