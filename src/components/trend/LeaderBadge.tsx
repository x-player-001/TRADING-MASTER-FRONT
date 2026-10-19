import React from 'react';
import { Tooltip } from 'antd';
import type { LeaderWindow } from '../../services/leaderAPI';
import styles from './LeaderBoardPanel.module.scss';

/** symbol → 各窗口当前排名（只含在榜的） */
export type LeaderRanks = Map<string, Partial<Record<LeaderWindow, number>>>;

const WINDOW_LABELS: Record<LeaderWindow, string> = { '24h': '24h 主榜', '4h': '4h 刚启动' };

/** 观察区里标出当前在龙头榜上的币；不在榜不渲染 */
const LeaderBadge: React.FC<{ ranks: LeaderRanks; symbol: string }> = ({ ranks, symbol }) => {
  const r = ranks.get(symbol);
  if (!r) return null;
  const entries = (['24h', '4h'] as LeaderWindow[]).filter(w => r[w] != null);
  const best = Math.min(...entries.map(w => r[w]!));
  return (
    <Tooltip title={entries.map(w => `${WINDOW_LABELS[w]} 第 ${r[w]} 名`).join('，')}>
      <span className={styles.leaderBadge}>🐉 龙头{r['24h'] == null ? '·4h' : ''} #{best}</span>
    </Tooltip>
  );
};

export default LeaderBadge;
