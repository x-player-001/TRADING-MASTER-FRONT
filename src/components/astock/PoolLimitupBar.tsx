import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tooltip, Segmented } from 'antd';
import styles from './PoolLimitupBar.module.scss';
import {
  poolLimitupAPI,
  PoolLimitupItem,
  PoolLimitupStats,
  PoolName,
  POOL_LABELS,
} from '../../services/poolLimitupAPI';

interface PoolLimitupBarProps {
  refreshKey: number;
  onOpenKline: (stock: { code: string; name?: string }) => void;
}

const REFRESH_MS = 60_000;

const fmtMoney = (v: number | null): string => {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  return v.toFixed(0);
};

const PoolLimitupBar: React.FC<PoolLimitupBarProps> = ({ refreshKey, onOpenKline }) => {
  const [list, setList] = useState<PoolLimitupItem[]>([]);
  const [stats, setStats] = useState<PoolLimitupStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'sealed' | 'broken'>('all');
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const [l, s] = await Promise.allSettled([
      poolLimitupAPI.getList({ since_days: 30 }),
      poolLimitupAPI.getStats({ since_days: 30 }),
    ]);
    if (l.status === 'fulfilled') setList(l.value ?? []);
    if (s.status === 'fulfilled') setStats(s.value);
    setFailed(l.status === 'rejected' && s.status === 'rejected');
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  // 盘中数据会变，静默轮询
  useEffect(() => {
    timerRef.current = window.setInterval(load, REFRESH_MS);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [load]);

  const shown = React.useMemo(() => {
    if (filter === 'sealed') return list.filter((r) => r.is_sealed_now);
    if (filter === 'broken') return list.filter((r) => !r.is_sealed_now);
    return list;
  }, [list, filter]);

  if (failed) {
    return <div className={styles.bar}><span className={styles.dim}>池内涨停数据暂不可用</span></div>;
  }
  if (!stats && !list.length) return null;

  return (
    <div className={styles.bar}>
      {/* ── 左侧：数量总览 ── */}
      <div className={styles.summary}>
        <span className={styles.title}>池内涨停</span>

        {stats?.is_stale && (
          <Tooltip title={`数据非当日（快照 ${stats.trade_date}），不要当成今天的涨停看`}>
            <span className={styles.staleChip}>非当日 {stats.trade_date}</span>
          </Tooltip>
        )}

        <Tooltip title="当前仍封在涨停板上">
          <span className={styles.metric}>
            <b className={styles.sealed}>{stats?.sealed ?? '—'}</b>
            <span className={styles.metricKey}>封着</span>
          </span>
        </Tooltip>

        <Tooltip title="今天摸过板但没封住">
          <span className={styles.metric}>
            <b className={styles.broken}>{stats?.broken ?? '—'}</b>
            <span className={styles.metricKey}>炸板</span>
          </span>
        </Tooltip>

        <span className={styles.divider} />

        <Tooltip title={`全市场 ${stats?.total_limitup ?? '—'} 只涨停/摸板，其中 ${stats?.in_pools ?? '—'} 只在池内`}>
          <span className={styles.metric}>
            <b>{stats?.in_pools ?? '—'}</b>
            <span className={styles.metricKey}>/ {stats?.total_limitup ?? '—'} 全市场</span>
          </span>
        </Tooltip>

        {stats?.by_pool && (
          <span className={styles.byPool}>
            {(Object.keys(POOL_LABELS) as PoolName[]).map((k) =>
              stats.by_pool[k] === undefined ? null : (
                <span key={k} className={styles.poolChip}>
                  {POOL_LABELS[k]} {stats.by_pool[k]}
                </span>
              )
            )}
          </span>
        )}

        {stats?.snapshot_at && (
          <span className={styles.snapshot}>{stats.snapshot_at.slice(11, 16)}</span>
        )}
      </div>

      {/* ── 右侧：个股 ── */}
      <div className={styles.listWrap}>
        <Segmented
          size="small"
          value={filter}
          onChange={(v) => setFilter(v as 'all' | 'sealed' | 'broken')}
          options={[
            { label: `全部 ${list.length}`, value: 'all' },
            { label: `封着 ${list.filter((r) => r.is_sealed_now).length}`, value: 'sealed' },
            { label: `炸板 ${list.filter((r) => !r.is_sealed_now).length}`, value: 'broken' },
          ]}
        />
        <div className={styles.stocks}>
          {shown.length === 0 && <span className={styles.dim}>无</span>}
          {shown.map((r) => (
            <Tooltip
              key={r.code}
              title={
                <div className={styles.tip}>
                  <div>{r.name} {r.code} · {r.boards}板</div>
                  <div>{r.is_sealed_now ? '当前封板' : '已炸板'}
                    {r.open_times > 0 && ` · 今日炸板 ${r.open_times} 次`}</div>
                  {r.first_seal_time && <div>首封 {r.first_seal_time}</div>}
                  {r.seal_amount !== null && <div>封单 {fmtMoney(r.seal_amount)}</div>}
                  <div>命中：{(r.pools ?? []).map((p) => POOL_LABELS[p] ?? p).join('、')}</div>
                  {r.limit_up_reason && <div className={styles.tipReason}>{r.limit_up_reason}</div>}
                </div>
              }
            >
              <span
                className={`${styles.stock} ${r.is_sealed_now ? styles.stockSealed : styles.stockBroken}`}
                onClick={() => onOpenKline({ code: r.code, name: r.name })}
              >
                {r.in_favorite && <span className={styles.favMark}>★</span>}
                <span className={styles.stockName}>{r.name}</span>
                <span className={styles.boards}>{r.boards}</span>
                {/* 炸板次数是判断封板结不结实的关键，封着也可能非零 */}
                {r.open_times > 0 && (
                  <span className={styles.openTimes}>炸{r.open_times}</span>
                )}
              </span>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PoolLimitupBar;
