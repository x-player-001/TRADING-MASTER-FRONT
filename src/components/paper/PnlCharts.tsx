import React from 'react';
import { Segmented } from 'antd';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import styles from './Paper.module.scss';
import { fmtU, fmtR, fmtTime } from './paperFormat';

// 模拟盘 / 实盘共用：已实现资金曲线 + 每日盈亏（两边接口返回结构相同）

export interface EquityPoint {
  time: number;
  trade_id: number;
  symbol: string;
  pnl: number;
  equity: number;
  drawdown: number;
}

export interface DailyPoint {
  date: string; // 'YYYY-MM-DD'（北京时间，按平仓日）
  trades: number;
  wins: number;
  pnl: number;
  r: number;
  equity: number;
}

interface PnlChartsProps {
  isDark: boolean;
  equity: EquityPoint[];
  daily: DailyPoint[];
  days: number;
  onDaysChange: (days: number) => void;
}

const DAY_OPTIONS = [
  { label: '30天', value: 30 },
  { label: '90天', value: 90 },
  { label: '365天', value: 365 },
];

const PnlCharts: React.FC<PnlChartsProps> = ({ isDark, equity, daily, days, onDaysChange: setDays }) => {
  const equityData = equity.map((p, i) => ({ ...p, idx: i + 1 }));
  const axisColor = isDark ? '#6b7280' : '#94a3b8';
  const gridColor = isDark ? 'rgba(75,85,99,0.35)' : 'rgba(148,163,184,0.25)';
  const tooltipStyle = isDark
    ? { background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }
    : undefined;

  return (
    <div className={`${styles.chartRow} ${styles.sectionGap}`}>
      <div className={styles.panel}>
        <div className={styles.chartTitle}>已实现资金曲线（U，按平仓顺序）</div>
        {equityData.length === 0 ? (
          <div className={styles.chartEmpty}>还没有平仓的交易</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={equityData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="idx" tick={{ fontSize: 11 }} stroke={axisColor} />
              <YAxis tick={{ fontSize: 11 }} stroke={axisColor} width={52} />
              <ReferenceLine y={0} stroke={axisColor} strokeDasharray="4 4" />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(idx: number) => {
                  const p = equityData[idx - 1];
                  return p ? `第 ${idx} 笔 · ${p.symbol} · ${fmtTime(p.time)}` : '';
                }}
                formatter={(v: number, name: string) => [
                  `${fmtU(v, name !== 'equity')}U`,
                  name === 'equity' ? '累计' : name === 'drawdown' ? '回撤' : '本笔',
                ]}
              />
              <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={equityData.length < 60 ? { r: 2 } : false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className={styles.panel}>
        <div className={styles.chartTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>每日盈亏（北京时间，按平仓日）</span>
          <Segmented size="small" value={days} onChange={(v) => setDays(Number(v))} options={DAY_OPTIONS} />
        </div>
        {daily.length === 0 ? (
          <div className={styles.chartEmpty}>所选区间内没有平仓</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={daily} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke={axisColor} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} stroke={axisColor} width={52} />
              <ReferenceLine y={0} stroke={axisColor} strokeDasharray="4 4" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [`${fmtU(v, name === 'pnl')}U`, name === 'pnl' ? '当日' : '累计']}
                labelFormatter={(d: string) => {
                  const p = daily.find((x) => x.date === d);
                  return p ? `${d} · ${p.trades} 笔 ${p.wins} 胜 · ${fmtR(p.r)}` : d;
                }}
              />
              <Bar dataKey="pnl" maxBarSize={18}>
                {daily.map((d) => (
                  <Cell key={d.date} fill={d.pnl >= 0 ? '#16a34a' : '#dc2626'} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default PnlCharts;
