import React, { useEffect, useState } from 'react';
import { Segmented } from 'antd';
import SymbolWatchlist, { SymbolGroup } from './SymbolWatchlist';
import { trendFollowAPI, WatchlistItem, WATCH_STAGE_LABELS } from '../../services/trendFollowAPI';
import { leaderAPI, LeaderBoard, LeaderBoardItem } from '../../services/leaderAPI';
import styles from './MarketSidebar.module.scss';

type Tab = 'fav' | 'watch' | 'leader';

interface MarketSidebarProps {
  favorites: string[];
  current: string;
  onSelect: (symbol: string) => void;
  onRemoveFavorite: (symbol: string) => void;
  /** 每个列表最多订阅多少个币的实时价（WS 单连接最多 30 条流） */
  maxRows: number;
}

const TAB_KEY = 'liveMarket.sidebarTab';
/** 观察列表与趋势跟随页同频；龙头榜每根 15m 才更新一次 */
const WATCH_POLL_MS = 30_000;
const LEADER_POLL_MS = 120_000;

const readTab = (): Tab => {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === 'fav' || v === 'watch' || v === 'leader') return v;
  } catch { /* 忽略 */ }
  return 'fav';
};

const leaderMeta = (it: LeaderBoardItem) => {
  const parts = [`#${it.rank}`, `量×${it.rvol.toFixed(1)}`];
  if (it.episode) parts.push(it.episode.phase_label);
  return (
    <>
      {parts.join(' · ')}
      {it.resonance && <b className={styles.resonance}> · 共振</b>}
    </>
  );
};

/** 切到哪个页签才拉哪个列表、订阅哪些币，其余页签不占 WS 流 */
const MarketSidebar: React.FC<MarketSidebarProps> = ({ favorites, current, onSelect, onRemoveFavorite, maxRows }) => {
  const [tab, setTab] = useState<Tab>(readTab);
  const [watch, setWatch] = useState<WatchlistItem[] | null>(null);
  const [boards, setBoards] = useState<LeaderBoard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changeTab = (t: Tab) => {
    setTab(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* 忽略 */ }
  };

  useEffect(() => {
    if (tab === 'fav') return;
    let disposed = false;
    const load = () => {
      const task =
        tab === 'watch'
          ? trendFollowAPI.getWatchlist().then((rows) => { if (!disposed) setWatch(rows); })
          : Promise.all([leaderAPI.getBoard('24h'), leaderAPI.getBoard('4h')]).then((b) => { if (!disposed) setBoards(b); });
      task
        .then(() => { if (!disposed) setError(null); })
        .catch((err: Error) => { if (!disposed) setError(err.message || '加载失败'); });
    };
    load();
    const timer = window.setInterval(load, tab === 'watch' ? WATCH_POLL_MS : LEADER_POLL_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [tab]);

  let groups: SymbolGroup[] = [];
  let emptyText: React.ReactNode = null;
  let note: string | null = null;
  if (tab === 'fav') {
    groups = [{ rows: favorites.map((symbol) => ({ symbol })) }];
    emptyText = '点工具栏的 ☆ 把当前币种加入自选';
  } else if (tab === 'watch') {
    // 后端已按评分从高到低排好
    const rows = watch ?? [];
    groups = [{
      rows: rows.slice(0, maxRows).map((w) => ({
        symbol: w.symbol,
        meta: `${w.timeframes.join('/')} · ${WATCH_STAGE_LABELS[w.stage] ?? w.stage} · ${w.score}分`,
      })),
    }];
    emptyText = watch === null ? '加载中…' : '观察列表为空';
    if (rows.length > maxRows) note = `共 ${rows.length} 个，按评分显示前 ${maxRows} 个`;
  } else {
    const titles: Record<string, string> = { '24h': '24h 主榜', '4h': '4h 刚启动' };
    groups = (boards ?? [])
      .filter((b) => b.items.length > 0)
      .map((b) => ({ title: titles[b.window] ?? b.window, rows: b.items.map((it) => ({ symbol: it.symbol, meta: leaderMeta(it) })) }));
    emptyText = boards === null ? '加载中…' : '当前榜单为空（门槛：成交额 ≥20M 且相对量 ≥3）';
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        <Segmented
          block
          size="small"
          value={tab}
          onChange={(v) => changeTab(v as Tab)}
          options={[
            { value: 'fav', label: '自选' },
            { value: 'watch', label: '观察' },
            { value: 'leader', label: '龙头' },
          ]}
        />
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {note && <div className={styles.note}>{note}</div>}
      <div className={styles.list}>
        <SymbolWatchlist
          groups={groups}
          current={current}
          onSelect={onSelect}
          onRemove={tab === 'fav' ? onRemoveFavorite : undefined}
          emptyText={emptyText}
        />
      </div>
    </div>
  );
};

export default MarketSidebar;
