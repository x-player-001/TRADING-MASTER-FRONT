import React, { useState, useEffect } from 'react';
import { Tooltip } from 'antd';
import styles from '../../pages/WatchPool.module.scss';
import {
  poolLimitupAPI,
  PoolLimitupItem,
  POOL_LABELS,
} from '../../services/poolLimitupAPI';

// 今日池内涨停：code -> 明细。三个池子共用一份，避免各自重复请求。
export type LimitupMap = Map<string, PoolLimitupItem>;

/**
 * 拉一次当日池内涨停，返回 code->明细 的 Map，渲染时 O(1) 查表。
 * 盘中会变，60 秒静默刷新一次。
 */
export function usePoolLimitupMap(refreshKey: number): LimitupMap {
  const [map, setMap] = useState<LimitupMap>(new Map());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await poolLimitupAPI.getList({ since_days: 30 });
        if (cancelled) return;
        setMap(new Map((rows ?? []).map((r) => [r.code, r])));
      } catch (err) {
        // 拿不到就不标记，不影响列表本身
        console.error('加载池内涨停失败:', err);
      }
    };
    load();
    const t = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [refreshKey]);

  return map;
}

interface LimitupBadgeProps {
  code: string;
  map: LimitupMap;
}

/**
 * 今日涨停标记。两种状态必须分开：
 *   封着  —— 当前仍封在板上，红底
 *   炸板  —— 今天摸过板但没封住，黄底
 * open_times 非零时附带显示，封着的票也可能炸过（封→炸→再封）。
 */
const LimitupBadge: React.FC<LimitupBadgeProps> = ({ code, map }) => {
  const hit = map.get(code);
  if (!hit) return null;

  const sealed = hit.is_sealed_now;
  const pools = (hit.pools ?? []).map((p) => POOL_LABELS[p] ?? p).join('、');

  return (
    <Tooltip
      title={
        <div>
          <div>{sealed ? '当前封板' : '今日炸板'} · {hit.boards}板</div>
          {hit.open_times > 0 && <div>今日炸板 {hit.open_times} 次</div>}
          {hit.first_seal_time && <div>首封 {hit.first_seal_time}</div>}
          {pools && <div>命中：{pools}</div>}
          {hit.limit_up_reason && <div>{hit.limit_up_reason}</div>}
        </div>
      }
    >
      <span className={`${styles.ltBadge} ${sealed ? styles.ltSealed : styles.ltBroken}`}>
        {sealed ? '封' : '炸'}
        {hit.boards > 1 && <span className={styles.ltBoards}>{hit.boards}</span>}
      </span>
    </Tooltip>
  );
};

export default LimitupBadge;
