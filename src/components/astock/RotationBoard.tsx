import React, { useState, useEffect, useCallback } from 'react';
import { Tooltip, Segmented, Empty } from 'antd';
import styles from './RotationBoard.module.scss';
import {
  rotationAPI,
  RotationBoard as RotationBoardData,
  RotationConcept,
  RotationStage,
  STAGE_COLORS,
  STAGE_HINTS,
} from '../../services/rotationAPI';

interface RotationBoardProps {
  refreshKey: number;
}

const fmtPct = (v: number | null | undefined, withSign = true): string => {
  if (v === null || v === undefined) return '—';
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

const retClass = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  return v > 0 ? styles.up : v < 0 ? styles.down : '';
};

// 用 series 画条迷你趋势：8 个点太少，折线比柱子更能看出方向
const Spark: React.FC<{ c: RotationConcept }> = ({ c }) => {
  const pts = (c.series ?? []).map((p) => p.pct_chg).filter((v): v is number => v !== null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts, 0);
  const max = Math.max(...pts, 0);
  const span = max - min || 1;
  const W = 52;
  const H = 16;
  const d = pts
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * W},${H - ((v - min) / span) * H}`)
    .join(' ');
  const zeroY = H - ((0 - min) / span) * H;
  const color = STAGE_COLORS[c.stage as RotationStage] ?? '#94a3b8';
  return (
    <svg width={W} height={H} className={styles.spark}>
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(148,163,184,0.35)" strokeWidth="1" strokeDasharray="2 2" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" />
    </svg>
  );
};

const RotationBoardPanel: React.FC<RotationBoardProps> = ({ refreshKey }) => {
  const [data, setData] = useState<RotationBoardData | null>(null);
  const [stage, setStage] = useState<RotationStage | 'all'>('all');
  const [collapsed, setCollapsed] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await rotationAPI.getBoard({ limit: 20 }));
      setFailed(false);
    } catch (err) {
      console.error('加载板块轮动失败:', err);
      setFailed(true);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (failed) {
    return <div className={styles.board}><span className={styles.dim}>板块轮动数据暂不可用</span></div>;
  }
  if (!data) return null;

  const concepts = stage === 'all'
    ? data.concepts
    : data.concepts.filter((c) => c.stage === stage);

  const stageKeys = Object.keys(data.stage_counts ?? {}) as RotationStage[];

  return (
    <div className={styles.board}>
      {/* ── 第一行：标题 + 阶段分布 ── */}
      <div className={styles.head}>
        <Tooltip title={data.note ?? '按近期涨幅与成交额占比变化给概念打轮动阶段标签'}>
          <span className={styles.title}>板块轮动</span>
        </Tooltip>
        <span className={styles.meta}>
          {data.trade_date} · 回看 {data.window} 日
          {data.days_available < data.window && `（实际 ${data.days_available} 日）`}
        </span>

        {data.median_delta !== null && (
          <Tooltip title="全市场中位涨幅，stage_reason 里的「相对全市场」以此为参照">
            <span className={styles.median}>中位 {fmtPct(data.median_delta)}</span>
          </Tooltip>
        )}

        {stageKeys.length > 0 && (
          <span className={styles.stageCounts}>
            {stageKeys.map((k) => (
              <Tooltip key={k} title={STAGE_HINTS[k] ?? k}>
                <span
                  className={styles.stageChip}
                  style={{ '--sc': STAGE_COLORS[k] ?? '#94a3b8' } as React.CSSProperties}
                >
                  {k} {data.stage_counts[k]}
                </span>
              </Tooltip>
            ))}
          </span>
        )}

        <button className={styles.toggle} onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? '展开 ▾' : '收起 ▴'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* ── 概念 ── */}
          <div className={styles.filterRow}>
            <Segmented
              size="small"
              value={stage}
              onChange={(v) => setStage(v as RotationStage | 'all')}
              options={[
                { label: `全部 ${data.concepts.length}`, value: 'all' },
                ...stageKeys
                  .filter((k) => data.concepts.some((c) => c.stage === k))
                  .map((k) => ({
                    label: `${k} ${data.concepts.filter((c) => c.stage === k).length}`,
                    value: k,
                  })),
              ]}
            />
          </div>

          <div className={styles.grid}>
            {concepts.length === 0 && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该阶段暂无概念" />
            )}
            {concepts.map((c) => (
              <Tooltip
                key={c.thscode}
                title={
                  <div className={styles.tip}>
                    <div><b>{c.name}</b> · {c.stage}</div>
                    {c.stage_reason && <div>{c.stage_reason}</div>}
                    <div>近3日均 {fmtPct(c.avg3)}，前3日均 {fmtPct(c.avg_prev3)}</div>
                    <div>
                      成交占比 {c.turnover_share !== null ? `${(c.turnover_share * 100).toFixed(2)}%` : '—'}
                      {c.share_trend !== null && `（趋势 ${c.share_trend > 0 ? '+' : ''}${(c.share_trend * 100).toFixed(2)}pp）`}
                    </div>
                    <div>窗口内涨 {c.up_days ?? '—'} 天，单日最大 {fmtPct(c.max_day_pct)}</div>
                    {c.peer_count > 0 && (
                      <div className={styles.tipPeers}>已合并同源：{c.peers.join('、')}</div>
                    )}
                  </div>
                }
              >
                <div
                  className={styles.card}
                  style={{ '--sc': STAGE_COLORS[c.stage as RotationStage] ?? '#94a3b8' } as React.CSSProperties}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.name}>{c.name}</span>
                    <span className={styles.stageTag}>{c.stage}</span>
                  </div>
                  <div className={styles.cardBody}>
                    <span className={`${styles.pct} ${retClass(c.pct_chg)}`}>{fmtPct(c.pct_chg)}</span>
                    <Spark c={c} />
                  </div>
                  <div className={styles.cardFoot}>
                    <span>3日 {fmtPct(c.avg3)}</span>
                    {c.rank_pct !== null && <span className={styles.rank}>#{c.rank_pct}</span>}
                    {c.peer_count > 0 && <span className={styles.peer}>+{c.peer_count}</span>}
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>

          {/* ── 今日题材（涨停原因聚合，与概念是两个维度）── */}
          {data.themes?.length > 0 && (
            <div className={styles.themeRow}>
              <span className={styles.themeLabel}>今日题材</span>
              {data.themes.map((t) => (
                <Tooltip
                  key={t.theme}
                  title={`涨停 ${t.zt_count} 只，最高 ${t.max_boards} 板，连续上榜 ${t.consec_days} 天`}
                >
                  <span className={`${styles.themeChip} ${t.is_new ? styles.themeNew : ''}`}>
                    {t.theme}
                    <i>{t.zt_count}</i>
                    {t.is_new && <em>新</em>}
                  </span>
                </Tooltip>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RotationBoardPanel;
