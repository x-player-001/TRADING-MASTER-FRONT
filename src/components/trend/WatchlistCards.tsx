import React from 'react';
import { Tooltip } from 'antd';
import styles from './WatchlistCards.module.scss';
import {
  WatchlistItem,
  WatchlistDetail,
  WatchStage,
  WATCH_STAGE_LABELS,
  SCORE_TAG_VALUES,
} from '../../services/trendFollowAPI';

/** 打开K线弹窗需要的最小信息 */
export interface KlineTarget {
  id: number;
  symbol: string;
  timeframe: string;
}

interface WatchlistCardsProps {
  items: WatchlistItem[];
  onOpenKline: (target: KlineTarget) => void;
}

const STAGE_CLASS: Record<WatchStage, string> = {
  RISING: styles.stageRising,
  PULLBACK: styles.stagePullback,
  IN_ZONE: styles.stageInZone,
  DEEP: styles.stageDeep,
};
const CARD_STAGE_CLASS: Record<WatchStage, string> = {
  RISING: styles.cardRising,
  PULLBACK: styles.cardPullback,
  IN_ZONE: styles.cardInZone,
  DEEP: styles.cardDeep,
};
const TF_ORDER = ['5m', '15m', '1h', '4h'];

const stripUsdt = (s: string) => (s.toUpperCase().endsWith('USDT') ? s.slice(0, -4) : s);

// 字段偶尔为 null（实测 volume_ratio），格式化统一兜底成「—」，避免整页崩
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const fx = (v: number | null | undefined, digits: number) => (isNum(v) ? v.toFixed(digits) : '—');

const fmtPrice = (p: number | null | undefined) => {
  if (!isNum(p)) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
};

const fmtVolume = (v: number | null | undefined) => {
  if (!isNum(v) || !v) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

/** 第一波涨幅分档：同一种绿色由浅到深，幅度越大越醒目 */
const WAVE_TIERS: { min: number; cls: string; label: string }[] = [
  { min: 40, cls: styles.wave4, label: '≥ 40%' },
  { min: 20, cls: styles.wave3, label: '20% ~ 40%' },
  { min: 10, cls: styles.wave2, label: '10% ~ 20%' },
  { min: -Infinity, cls: styles.wave1, label: '< 10%' },
];
const waveTier = (v: number | null | undefined) => WAVE_TIERS.find((t) => (isNum(v) ? v : 0) >= t.min)!;

const pct = (ratio: number | null | undefined) => (isNum(ratio) ? `${(ratio * 100).toFixed(1)}%` : '—');

/** 回撤进度条：0 = 第一波高点，100% = 回到起点；标出当前位置和最深位置 */
const RetraceBar: React.FC<{ stage: WatchStage; now: number; max: number }> = ({ stage, now, max }) => {
  const clamp = (v: number) => (isNum(v) ? Math.min(Math.max(v, 0), 1) * 100 : 0);
  return (
    <div className={styles.retraceBar}>
      {/* 0.382 ~ 0.618 常用回撤区，淡色底 */}
      <span className={styles.retraceZone} style={{ left: '38.2%', width: '23.6%' }} />
      <span className={`${styles.retraceFill} ${STAGE_CLASS[stage] ?? ''}`} style={{ width: `${clamp(now)}%` }} />
      {max > now && <span className={styles.retraceMaxMark} style={{ left: `${clamp(max)}%` }} />}
    </div>
  );
};

const DetailChip: React.FC<{ symbol: string; d: WatchlistDetail; onOpenKline: WatchlistCardsProps['onOpenKline'] }> = ({
  symbol,
  d,
  onOpenKline,
}) => (
  <Tooltip
    title={
      <div className={styles.tip}>
        <div>{d.timeframe} · {d.state === 'ALERTED' ? '已报警' : '观察中'} · {WATCH_STAGE_LABELS[d.stage] ?? d.stage}</div>
        <div>波段 {fmtPrice(d.wave_start_price)} → {fmtPrice(d.wave_end_price)}（+{fx(d.wave_amplitude_pct, 2)}%）</div>
        <div>回撤 {pct(d.retrace_now)}，最深 {pct(d.retrace_max)}</div>
        <div>量比 {fx(d.volume_ratio, 2)}{d.volume_shrink ? '（缩量）' : ''}</div>
        <div>已回调 {d.pullback_bar_count} / 上限 {d.max_pullback_bars} 根{d.stale ? '（临近超时）' : ''}</div>
        {d.remark && <div>备注：{d.remark}</div>}
        <div className={styles.tipHint}>点击查看 {d.timeframe} K线</div>
      </div>
    }
  >
    <button
      type="button"
      className={`${styles.detailChip} ${d.state === 'ALERTED' ? styles.detailAlerted : ''}`}
      onClick={() => onOpenKline({ id: d.id, symbol, timeframe: d.timeframe })}
    >
      <b>{d.timeframe}</b>
      {d.retrace_now < 0 ? '破高' : pct(d.retrace_now)}
      {d.last_alert_level ? <span className={styles.chipLevel}>L{d.last_alert_level}</span> : null}
    </button>
  </Tooltip>
);

const Card: React.FC<{ it: WatchlistItem; onOpenKline: WatchlistCardsProps['onOpenKline'] }> = ({ it, onOpenKline }) => {
  const primary = it.details.find((d) => d.timeframe === it.primary_timeframe) ?? it.details[0];
  const tfs = [...it.timeframes].sort((a, b) => TF_ORDER.indexOf(a) - TF_ORDER.indexOf(b));
  const details = [...it.details].sort((a, b) => TF_ORDER.indexOf(b.timeframe) - TF_ORDER.indexOf(a.timeframe));
  const scoreCls =
    it.score >= 3 ? styles.scoreHigh : it.score > 0 ? styles.scoreMid : it.score < 0 ? styles.scoreNeg : styles.scoreLow;
  const wave = waveTier(it.wave_amplitude_pct);

  return (
    // 卡片主色调由阶段决定（蓝/琥珀/绿/红），负分卡片整体淡化
    <div className={`${styles.card} ${CARD_STAGE_CLASS[it.stage] ?? ''} ${it.score < 0 ? styles.cardCold : ''}`}>
      {/* 头部：币种 + 周期 + 评分 */}
      <div className={styles.head}>
        <span
          className={styles.symbol}
          onClick={() => primary && onOpenKline({ id: primary.id, symbol: it.symbol, timeframe: primary.timeframe })}
          title={`查看 ${it.primary_timeframe} K线`}
        >
          {stripUsdt(it.symbol)}
        </span>
        <span className={styles.tfs}>
          {tfs.map((tf) => (
            <span
              key={tf}
              className={`${styles.tf} ${tf === it.primary_timeframe ? styles.tfPrimary : ''}`}
              title={tf === it.primary_timeframe ? '主周期：卡片上的指标取自该周期' : undefined}
            >
              {tf}
            </span>
          ))}
        </span>
        <span className={`${styles.score} ${scoreCls}`}>{it.score > 0 ? '+' : ''}{it.score}</span>
      </div>

      {/* 阶段 + 回撤 */}
      <div className={styles.stageRow}>
        <span className={`${styles.stageBadge} ${STAGE_CLASS[it.stage] ?? ''}`}>{WATCH_STAGE_LABELS[it.stage] ?? it.stage}</span>
        {it.retrace_now < 0 ? (
          <Tooltip title="现价已超过第一波高点（按第一波幅度计）">
            <span className={styles.retraceNow}>破前高 +{pct(-it.retrace_now)}</span>
          </Tooltip>
        ) : (
          <span className={styles.retraceNow}>回撤 {pct(it.retrace_now)}</span>
        )}
        {it.retrace_max - Math.max(it.retrace_now, 0) > 0.005 && <span className={styles.dim}>最深 {pct(it.retrace_max)}</span>}
      </div>
      <RetraceBar stage={it.stage} now={it.retrace_now} max={it.retrace_max} />

      {/* 指标 */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.label}>第一波</span>
          <Tooltip title={`第一波涨幅 ${wave.label}`}>
            <span className={`${styles.wave} ${wave.cls}`}>+{fx(it.wave_amplitude_pct, 1)}%</span>
          </Tooltip>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>距高点</span>
          <span>{it.pullback_bar_count} 根</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>24h 量</span>
          <span>{fmtVolume(it.quote_volume_24h)}</span>
        </div>
      </div>

      {/* 加减分标签 */}
      {it.score_tags.length > 0 && (
        <div className={styles.tags}>
          {it.score_tags.map((t) => {
            const v = SCORE_TAG_VALUES[t];
            const cls = v === undefined ? '' : v > 0 ? styles.tagPos : v < 0 ? styles.tagNeg : '';
            return (
              <Tooltip key={t} title={v === undefined ? undefined : `${v > 0 ? '+' : ''}${v} 分`}>
                <span className={`${styles.tag} ${cls}`}>{t}</span>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* 各周期明细：点击看对应周期K线 */}
      <div className={styles.details}>
        {details.map((d) => <DetailChip key={d.id} symbol={it.symbol} d={d} onOpenKline={onOpenKline} />)}
      </div>
    </div>
  );
};

/** 合并观察列表：一个币一张卡片，按后端 score 从高到低（保持接口顺序） */
const WatchlistCards: React.FC<WatchlistCardsProps> = ({ items, onOpenKline }) => (
  <div className={styles.grid}>
    {items.map((it) => <Card key={it.symbol} it={it} onOpenKline={onOpenKline} />)}
  </div>
);

export default WatchlistCards;
