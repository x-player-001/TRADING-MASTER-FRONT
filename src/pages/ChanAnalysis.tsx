import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AutoComplete, Button, Checkbox, DatePicker, InputNumber, Popover, Segmented, Select, Spin, Switch, Table, Tag, Tooltip } from 'antd';
import type { Dayjs } from 'dayjs';
import PageHeader from '../components/ui/PageHeader';
import ChanChart, { BspLevels } from '../components/chan/ChanChart';
import { CHAN_COLORS, ChanLayers } from '../components/chan/ChanPrimitive';
import { bspLabel, formatPrice, formatTime } from '../components/chan/chanFormat';
import { chanAnalyzeAPI, CHAN_INTERVALS, ChanAnalyzeResult, ChanBiMode, ChanBsp, ChanInterval } from '../services/chanAnalyzeAPI';
import { replayAPI } from '../services/replayAPI';
import styles from '../components/chan/Chan.module.scss';

interface ChanAnalysisProps {
  isSidebarCollapsed?: boolean;
}

const SETTINGS_KEY = 'chan.settings';
const INTERVAL_MS: Record<ChanInterval, number> = { '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000 };
/** 文档建议：1h/4h 用 1000，5m/15m 用 2000 */
const DEFAULT_LIMIT: Record<ChanInterval, number> = { '5m': 2000, '15m': 2000, '1h': 1000, '4h': 1000 };
const LIMIT_OPTIONS = [300, 500, 1000, 2000, 3000];
/** K线收盘后多等一会儿，留给后端入库 */
const REFRESH_DELAY_MS = 15_000;

interface Settings {
  symbol: string;
  interval: ChanInterval;
  limit: number;
  biMode: ChanBiMode;
  minBiRawBars: number;
  divergenceRatio: number;
  allowConsolidationBsp1: boolean;
  layers: ChanLayers;
  bspLevels: BspLevels;
  showMacd: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  symbol: 'BTCUSDT',
  interval: '1h',
  limit: 1000,
  biMode: 'strict',
  minBiRawBars: 5,
  divergenceRatio: 1,
  allowConsolidationBsp1: true,
  layers: { bi: true, segment: true, biCenter: true, segCenter: true, centerRange: false },
  bspLevels: { bi: true, seg: true },
  showMacd: true,
};

const readSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      layers: { ...DEFAULT_SETTINGS.layers, ...s.layers },
      bspLevels: { ...DEFAULT_SETTINGS.bspLevels, ...s.bspLevels },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

// 跟随全局明暗主题（App 在 <html> 上切换 .dark）
const useIsDark = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
};

const errorText = (err: unknown) => {
  const e = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
  return e?.response?.data?.message || e?.response?.data?.error || e?.message || '请求失败';
};

const ChanAnalysis: React.FC<ChanAnalysisProps> = () => {
  const isDark = useIsDark();
  const [settings, setSettings] = useState<Settings>(readSettings);
  const { symbol, interval, limit, biMode, minBiRawBars, divergenceRatio, allowConsolidationBsp1, layers, bspLevels, showMacd } = settings;
  const [symbolInput, setSymbolInput] = useState(settings.symbol);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  const [symbolOptions, setSymbolOptions] = useState<{ value: string; label: string }[]>([]);

  const [data, setData] = useState<ChanAnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextRefresh, setNextRefresh] = useState<number | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [focus, setFocus] = useState<{ index: number; nonce: number } | null>(null);
  const requestIdRef = useRef(0);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
      return next;
    });
  }, []);

  // 品种下拉：复用K线回放的推荐列表（币安成交额前列 + CME）
  useEffect(() => {
    replayAPI.getSymbols()
      .then((res) => {
        setSymbolOptions([
          ...res.crypto.map((c) => ({ value: c.symbol, label: c.symbol })),
          ...res.cme.map((c) => ({ value: c.symbol, label: `${c.symbol}（CME）` })),
        ]);
      })
      .catch(() => setSymbolOptions([{ value: 'BTCUSDT', label: 'BTCUSDT' }]));
  }, []);

  const commitSymbol = (value: string) => {
    const s = value.trim().toUpperCase();
    if (!s) {
      setSymbolInput(symbol);
      return;
    }
    setSymbolInput(s);
    if (s !== symbol) update({ symbol: s });
  };

  const endTimeMs = endTime ? endTime.valueOf() : undefined;

  // 拉数据：参数变化防抖 300ms（输入框逐字变化时不连发）
  useEffect(() => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      chanAnalyzeAPI.analyze({
        symbol,
        interval,
        limit,
        end_time: endTimeMs,
        bi_mode: biMode,
        min_bi_raw_bars: minBiRawBars,
        divergence_ratio: divergenceRatio,
        allow_consolidation_bsp1: allowConsolidationBsp1,
      })
        .then((res) => {
          if (id !== requestIdRef.current) return;
          setData(res);
        })
        .catch((err) => {
          if (id !== requestIdRef.current) return;
          setError(errorText(err));
        })
        .finally(() => {
          if (id === requestIdRef.current) setLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [symbol, interval, limit, endTimeMs, biMode, minBiRawBars, divergenceRatio, allowConsolidationBsp1, reloadNonce]);

  // 实时模式：下一根K线收盘后自动刷新（结构只在收盘时变化）
  useEffect(() => {
    setNextRefresh(null);
    if (endTimeMs !== undefined || !data || data.symbol !== symbol || data.interval !== interval) return;
    const ivMs = INTERVAL_MS[interval];
    // last_time 是最后一根已收盘K线的 open_time，下一根收盘 = last_time + 2 个周期
    const nextClose = data.last_time + 2 * ivMs;
    // 落后超过一根（休市、CME 数据只到某天）不再自动刷新
    if (Date.now() > nextClose + ivMs) return;
    // 后端入库稍慢时别连发，至少隔 1 分钟
    const at = Math.max(nextClose + REFRESH_DELAY_MS, Date.now() + 60_000);
    setNextRefresh(at);
    const timer = window.setTimeout(() => setReloadNonce((n) => n + 1), at - Date.now());
    return () => window.clearTimeout(timer);
  }, [data, endTimeMs, symbol, interval]);

  const bspRows = useMemo(
    () => (data?.bsp ?? [])
      .filter((p) => bspLevels[p.level])
      .slice()
      .sort((a, b) => b.time - a.time || (a.level === b.level ? 0 : a.level === 'seg' ? -1 : 1)),
    [data, bspLevels],
  );

  const viewKey = `${symbol}-${interval}-${limit}-${endTimeMs ?? 'now'}`;

  const stats = data && [
    { label: 'K线', value: `${data.kline_count}`, hint: `去包含后 ${data.merged_count} 根` },
    { label: '笔', value: data.bis.length },
    { label: '线段', value: data.segments.length },
    { label: '笔中枢', value: data.bi_centers.length },
    { label: '线段中枢', value: data.seg_centers.length },
    { label: '买卖点', value: data.bsp.length },
    { label: '最新收盘', value: formatPrice(data.last_close) },
    { label: '数据截至', value: formatTime(data.last_time) },
  ];

  const layerToggle = (key: keyof ChanLayers, label: string, color?: string) => (
    <Checkbox checked={layers[key]} onChange={(e) => update({ layers: { ...layers, [key]: e.target.checked } })}>
      {color && <span className={styles.swatch} style={{ background: color }} />}
      {label}
    </Checkbox>
  );

  const advanced = (
    <div className={styles.advanced}>
      <div className={styles.advRow}>
        <Tooltip title="离开段 MACD 面积 < 进入段 × 该值视为背驰，越小越严">
          <span className={styles.label}>背驰系数</span>
        </Tooltip>
        <InputNumber
          size="small"
          min={0.1}
          max={2}
          step={0.1}
          value={divergenceRatio}
          onChange={(v) => v !== null && update({ divergenceRatio: v })}
        />
      </div>
      <div className={styles.advRow}>
        <Tooltip title="仅新笔生效：一笔至少包含的原始K线数">
          <span className={styles.label}>新笔最少K线</span>
        </Tooltip>
        <InputNumber
          size="small"
          min={3}
          max={20}
          value={minBiRawBars}
          disabled={biMode !== 'loose'}
          onChange={(v) => v !== null && update({ minBiRawBars: v })}
        />
      </div>
      <div className={styles.advRow}>
        <span className={styles.label}>盘整背驰一类点</span>
        <Switch size="small" checked={allowConsolidationBsp1} onChange={(v) => update({ allowConsolidationBsp1: v })} />
      </div>
      <Button size="small" type="link" onClick={() => update({ divergenceRatio: 1, minBiRawBars: 5, allowConsolidationBsp1: true })}>
        恢复默认
      </Button>
    </div>
  );

  return (
    <div className={styles.page}>
      <PageHeader title="缠论分析" subtitle="笔、线段、中枢、一二三类买卖点结构划分，人工核对用" icon="☯️">
        <div className={styles.headerExtra}>
          {nextRefresh && <span className={styles.dim}>下次刷新 {formatTime(nextRefresh).slice(11)}</span>}
          <Button size="small" loading={loading} onClick={() => setReloadNonce((n) => n + 1)}>刷新</Button>
        </div>
      </PageHeader>

      <div className={styles.toolbar}>
        <div className={styles.field}>
          <span className={styles.label}>品种</span>
          <AutoComplete
            className={styles.symbolInput}
            options={symbolOptions}
            value={symbolInput}
            onChange={(v) => setSymbolInput(v.toUpperCase())}
            onSelect={commitSymbol}
            onBlur={() => commitSymbol(symbolInput)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitSymbol(symbolInput); }}
            filterOption={(input, opt) => (opt?.value ?? '').toUpperCase().includes(input.toUpperCase())}
            placeholder="BTCUSDT / ES / GC"
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>周期</span>
          <Segmented
            options={CHAN_INTERVALS}
            value={interval}
            onChange={(v) => update({ interval: v as ChanInterval, limit: DEFAULT_LIMIT[v as ChanInterval] })}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>根数</span>
          <Select
            className={styles.limitSelect}
            value={limit}
            options={LIMIT_OPTIONS.map((n) => ({ value: n, label: n }))}
            onChange={(v) => update({ limit: v })}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>笔</span>
          <Segmented
            options={[{ value: 'strict', label: '老笔' }, { value: 'loose', label: '新笔' }]}
            value={biMode}
            onChange={(v) => update({ biMode: v as ChanBiMode })}
          />
        </div>
        <div className={styles.field}>
          <Tooltip title="只用该时刻前已收盘的K线，回看当时接口会给出什么结构">
            <span className={styles.label}>历史时刻</span>
          </Tooltip>
          <DatePicker
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
            value={endTime}
            onChange={(v) => setEndTime(v)}
            placeholder="实时"
            allowClear
          />
        </div>
        <Popover content={advanced} title="引擎参数" trigger="click" placement="bottomRight">
          <Button>高级参数</Button>
        </Popover>
      </div>

      <div className={styles.toggles}>
        {layerToggle('bi', '笔', CHAN_COLORS.bi)}
        {layerToggle('segment', '线段', CHAN_COLORS.segment)}
        {layerToggle('biCenter', '笔中枢', CHAN_COLORS.biCenter)}
        {layerToggle('segCenter', '线段中枢', CHAN_COLORS.segCenter)}
        {layerToggle('centerRange', '中枢 GG/DD')}
        <span className={styles.divider} />
        <Checkbox checked={bspLevels.bi} onChange={(e) => update({ bspLevels: { ...bspLevels, bi: e.target.checked } })}>
          笔级买卖点
        </Checkbox>
        <Checkbox checked={bspLevels.seg} onChange={(e) => update({ bspLevels: { ...bspLevels, seg: e.target.checked } })}>
          线段级买卖点
        </Checkbox>
        <span className={styles.divider} />
        <Checkbox checked={showMacd} onChange={(e) => update({ showMacd: e.target.checked })}>MACD</Checkbox>
      </div>

      {error && <Alert className={styles.alert} type="error" showIcon message={`加载失败：${error}`} />}

      {stats && (
        <div className={styles.stats}>
          {stats.map((s) => (
            <div key={s.label} className={styles.stat} title={s.hint}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.main}>
        <Spin spinning={loading} wrapperClassName={styles.chartSpin}>
          <ChanChart
            data={data}
            layers={layers}
            bspLevels={bspLevels}
            showMacd={showMacd}
            isDark={isDark}
            focus={focus}
            viewKey={viewKey}
          />
        </Spin>

        <div className={styles.bspPanel}>
          <div className={styles.panelTitle}>
            买卖点 <span className={styles.dim}>点击定位 · 共 {bspRows.length}</span>
          </div>
          <Table<ChanBsp>
            size="small"
            rowKey={(p) => `${p.level}-${p.type}-${p.side}-${p.time}`}
            dataSource={bspRows}
            pagination={false}
            scroll={{ y: 520 }}
            onRow={(p) => ({
              onClick: () => setFocus({ index: p.raw_index, nonce: Date.now() }),
              className: styles.bspRow,
            })}
            columns={[
              { title: '时间', dataIndex: 'time', width: 104, render: (t: number) => <span className={styles.mono}>{formatTime(t).slice(5)}</span> },
              {
                title: '类型',
                width: 78,
                render: (_, p) => (
                  <Tag color={p.side === 'buy' ? 'green' : 'red'} className={p.is_confirmed ? undefined : styles.unconfirmed}>
                    {p.level === 'seg' ? '段' : '笔'}{bspLabel(p)}
                  </Tag>
                ),
              },
              { title: '价格', dataIndex: 'price', align: 'right', render: (v: number) => <span className={styles.mono}>{formatPrice(v)}</span> },
              {
                title: '',
                width: 28,
                render: (_, p) => {
                  const tips = [
                    p.is_confirmed ? '已确认' : '未确认，可能消失',
                    p.divergence_type && (p.divergence_type === 'trend' ? '趋势背驰' : '盘整背驰'),
                    p.area_ratio !== undefined && `MACD 面积比 ${p.area_ratio.toFixed(2)}`,
                  ].filter(Boolean).join(' · ');
                  return <Tooltip title={tips}><span className={styles.dim}>{p.is_confirmed ? '✓' : '?'}</span></Tooltip>;
                },
              },
            ]}
            locale={{ emptyText: '暂无买卖点' }}
          />
        </div>
      </div>
    </div>
  );
};

export default ChanAnalysis;
