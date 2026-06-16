import React, { useState, useEffect, useCallback } from 'react';
import { Select, InputNumber, Tag, message, Input, Switch, Tabs } from 'antd';
import styles from './PatternScan.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, DataSection } from '../components/ui';
import { patternScanAPI, ScanResultItem, PatternResult, Ema20PushResultItem } from '../services/patternScanAPI';

interface PatternScanProps {
  isSidebarCollapsed?: boolean;
}

const INTERVALS = [
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
];

type ScanType = 'pullback' | 'pullback-v2' | 'consolidation' | 'double-bottom' | 'surge-w-bottom' | 'ema20-push';

const PatternScan: React.FC<PatternScanProps> = () => {
  // 扫描类型
  const [scanType, setScanType] = useState<ScanType>('pullback');

  // 扫描结果
  const [results, setResults] = useState<ScanResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // 回调扫描参数
  const [pullbackInterval, setPullbackInterval] = useState('1h');
  const [pullbackLookback, setPullbackLookback] = useState(100);
  const [minSurgePct, setMinSurgePct] = useState(20);
  const [maxRetracePct, setMaxRetracePct] = useState(50);

  // 横盘震荡参数
  const [consolidationInterval, setConsolidationInterval] = useState('1h');
  const [minBars, setMinBars] = useState(20);
  const [maxRangePct, setMaxRangePct] = useState(10);
  const [requireFakeBreakdown, setRequireFakeBreakdown] = useState(false);

  // 双底参数
  const [doubleBottomInterval, setDoubleBottomInterval] = useState('1h');
  const [doubleBottomLookback, setDoubleBottomLookback] = useState(100);
  const [minBarsBetween, setMinBarsBetween] = useState(10);
  const [bottomTolerancePct, setBottomTolerancePct] = useState(2);

  // 回调V2参数
  const [pullbackV2Interval, setPullbackV2Interval] = useState('1h');
  const [pullbackV2Lookback, setPullbackV2Lookback] = useState(150);
  const [pullbackV2MinSurgePct, setPullbackV2MinSurgePct] = useState(20);
  const [pullbackV2MaxRetracePct, setPullbackV2MaxRetracePct] = useState(50);
  const [pullbackV2MaxBarsFromHigh, setPullbackV2MaxBarsFromHigh] = useState(60);
  const [pullbackV2MaxInterimRetracePct, setPullbackV2MaxInterimRetracePct] = useState(40);

  // EMA推动扫描参数
  const [ema20PushInterval, setEma20PushInterval] = useState('1h');
  const [ema20PushEmaPeriod, setEma20PushEmaPeriod] = useState(20);
  const [ema20PushLookback, setEma20PushLookback] = useState(300);
  const [ema20PushMinPushCount, setEma20PushMinPushCount] = useState(2);
  const [ema20PushSupportRange, setEma20PushSupportRange] = useState(0.05);
  const [ema20PushMinInterval, setEma20PushMinInterval] = useState(3);

  // EMA推动扫描结果（独立存储）
  const [ema20PushResults, setEma20PushResults] = useState<import('../services/patternScanAPI').Ema20PushResultItem[]>([]);

  // 上涨后W底参数
  const [surgeWBottomInterval, setSurgeWBottomInterval] = useState('1h');
  const [surgeWBottomLookback, setSurgeWBottomLookback] = useState(100);
  const [surgeWBottomMinSurgePct, setSurgeWBottomMinSurgePct] = useState(20);
  const [surgeWBottomMaxRetracePct, setSurgeWBottomMaxRetracePct] = useState(50);
  const [maxDistanceToBottomPct, setMaxDistanceToBottomPct] = useState(5);

  // 筛选
  const [filterSymbol, setFilterSymbol] = useState('');
  const [minScore, setMinScore] = useState(0);

  // 历史结果
  const [historyResults, setHistoryResults] = useState<PatternResult[]>([]);

  // 加载历史扫描结果
  const loadHistoryResults = useCallback(async () => {
    try {
      setLoading(true);
      const data = await patternScanAPI.getLatestResults({ limit: 100 });
      const resultArray = Array.isArray(data) ? data : [];
      setHistoryResults(resultArray);
    } catch (err) {
      console.error('加载历史数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 页面加载时获取历史数据
  useEffect(() => {
    loadHistoryResults();
  }, [loadHistoryResults]);

  // 执行扫描
  const handleScan = async () => {
    setIsScanning(true);
    setLoading(true);
    try {
      let data: ScanResultItem[] = [];
      switch (scanType) {
        case 'pullback':
          data = await patternScanAPI.scanPullback({
            interval: pullbackInterval,
            lookback_bars: pullbackLookback,
            min_surge_pct: minSurgePct,
            max_retrace_pct: maxRetracePct,
          });
          break;
        case 'consolidation':
          data = await patternScanAPI.scanConsolidation({
            interval: consolidationInterval,
            min_bars: minBars,
            max_range_pct: maxRangePct,
            require_fake_breakdown: requireFakeBreakdown,
          });
          break;
        case 'double-bottom':
          data = await patternScanAPI.scanDoubleBottom({
            interval: doubleBottomInterval,
            lookback_bars: doubleBottomLookback,
            min_bars_between: minBarsBetween,
            bottom_tolerance_pct: bottomTolerancePct,
          });
          break;
        case 'pullback-v2':
          data = await patternScanAPI.scanPullbackV2({
            interval: pullbackV2Interval,
            lookback_bars: pullbackV2Lookback,
            min_surge_pct: pullbackV2MinSurgePct,
            max_retrace_pct: pullbackV2MaxRetracePct,
            max_bars_from_high: pullbackV2MaxBarsFromHigh,
            max_interim_retrace_pct: pullbackV2MaxInterimRetracePct,
          });
          break;
        case 'ema20-push': {
          const emaData = await patternScanAPI.scanEma20Push({
            interval: ema20PushInterval,
            ema_period: ema20PushEmaPeriod,
            lookback_bars: ema20PushLookback,
            min_push_count: ema20PushMinPushCount,
            support_range: ema20PushSupportRange,
            min_push_interval: ema20PushMinInterval,
          });
          const emaArray = Array.isArray(emaData) ? emaData : [];
          setEma20PushResults(emaArray);
          message.success(`扫描完成，发现 ${emaArray.length} 个符合条件的币种`);
          setIsScanning(false);
          setLoading(false);
          return;
        }
        case 'surge-w-bottom':
          data = await patternScanAPI.scanSurgeWBottom({
            interval: surgeWBottomInterval,
            lookback_bars: surgeWBottomLookback,
            min_surge_pct: surgeWBottomMinSurgePct,
            max_retrace_pct: surgeWBottomMaxRetracePct,
            max_distance_to_bottom_pct: maxDistanceToBottomPct,
          });
          break;
      }
      // 确保data是数组
      const resultArray = Array.isArray(data) ? data : [];
      setResults(resultArray);
      message.success(`扫描完成，发现 ${resultArray.length} 个符合条件的币种`);
    } catch (err) {
      message.error('扫描失败');
      console.error(err);
    } finally {
      setIsScanning(false);
      setLoading(false);
    }
  };

  // 筛选结果
  const filteredResults = (results || []).filter(r => {
    if (filterSymbol && !r.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false;
    if (minScore > 0 && r.score < minScore) return false;
    return true;
  });

  // 获取扫描类型名称
  const getScanTypeName = (type: ScanType) => {
    switch (type) {
      case 'pullback': return '回调扫描';
      case 'pullback-v2': return '回调V2';
      case 'consolidation': return '横盘震荡';
      case 'double-bottom': return '双底形态';
      case 'surge-w-bottom': return '上涨后W底';
      case 'ema20-push': return 'EMA推动';
    }
  };

  // 渲染回调扫描参数
  const renderPullbackParams = () => (
    <>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>周期</label>
        <Select
          value={pullbackInterval}
          onChange={setPullbackInterval}
          options={INTERVALS}
          style={{ width: 100 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>回溯K线数</label>
        <InputNumber
          min={30}
          max={500}
          value={pullbackLookback}
          onChange={v => setPullbackLookback(v || 100)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最小上涨幅度(%)</label>
        <InputNumber
          min={5}
          max={200}
          value={minSurgePct}
          onChange={v => setMinSurgePct(v || 20)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最大回调幅度(%)</label>
        <InputNumber
          min={10}
          max={100}
          value={maxRetracePct}
          onChange={v => setMaxRetracePct(v || 50)}
          style={{ width: 80 }}
        />
      </div>
    </>
  );

  // 渲染回调V2参数
  const renderPullbackV2Params = () => (
    <>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>周期</label>
        <Select
          value={pullbackV2Interval}
          onChange={setPullbackV2Interval}
          options={INTERVALS}
          style={{ width: 100 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>回溯K线数</label>
        <InputNumber
          min={30}
          max={500}
          value={pullbackV2Lookback}
          onChange={v => setPullbackV2Lookback(v || 150)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最小上涨幅度(%)</label>
        <InputNumber
          min={5}
          max={200}
          value={pullbackV2MinSurgePct}
          onChange={v => setPullbackV2MinSurgePct(v || 20)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最大回调幅度(%)</label>
        <InputNumber
          min={10}
          max={100}
          value={pullbackV2MaxRetracePct}
          onChange={v => setPullbackV2MaxRetracePct(v || 50)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>高点距当前最多根</label>
        <InputNumber
          min={1}
          max={200}
          value={pullbackV2MaxBarsFromHigh}
          onChange={v => setPullbackV2MaxBarsFromHigh(v || 60)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>中途回撤占涨幅(%)</label>
        <InputNumber
          min={5}
          max={100}
          value={pullbackV2MaxInterimRetracePct}
          onChange={v => setPullbackV2MaxInterimRetracePct(v || 40)}
          style={{ width: 80 }}
        />
      </div>
    </>
  );

  // 渲染EMA推动参数
  const renderEma20PushParams = () => (
    <>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>周期</label>
        <Select value={ema20PushInterval} onChange={setEma20PushInterval} options={INTERVALS} style={{ width: 100 }} />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>EMA周期</label>
        <InputNumber min={5} max={200} value={ema20PushEmaPeriod} onChange={v => setEma20PushEmaPeriod(v || 20)} style={{ width: 70 }} />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>回溯K线数</label>
        <InputNumber min={50} max={1000} value={ema20PushLookback} onChange={v => setEma20PushLookback(v || 300)} style={{ width: 80 }} />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最小推动次数</label>
        <InputNumber min={1} max={20} value={ema20PushMinPushCount} onChange={v => setEma20PushMinPushCount(v || 2)} style={{ width: 70 }} />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>支撑范围</label>
        <InputNumber min={0.01} max={0.5} step={0.01} value={ema20PushSupportRange} onChange={v => setEma20PushSupportRange(v || 0.05)} style={{ width: 80 }} />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最小推动间隔(根)</label>
        <InputNumber min={1} max={50} value={ema20PushMinInterval} onChange={v => setEma20PushMinInterval(v || 3)} style={{ width: 70 }} />
      </div>
    </>
  );

  // 渲染横盘震荡参数
  const renderConsolidationParams = () => (
    <>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>周期</label>
        <Select
          value={consolidationInterval}
          onChange={setConsolidationInterval}
          options={INTERVALS}
          style={{ width: 100 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最小横盘K线数</label>
        <InputNumber
          min={10}
          max={200}
          value={minBars}
          onChange={v => setMinBars(v || 20)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最大震荡幅度(%)</label>
        <InputNumber
          min={1}
          max={50}
          value={maxRangePct}
          onChange={v => setMaxRangePct(v || 10)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>要求假突破</label>
        <Switch
          checked={requireFakeBreakdown}
          onChange={setRequireFakeBreakdown}
        />
      </div>
    </>
  );

  // 渲染双底参数
  const renderDoubleBottomParams = () => (
    <>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>周期</label>
        <Select
          value={doubleBottomInterval}
          onChange={setDoubleBottomInterval}
          options={INTERVALS}
          style={{ width: 100 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>回溯K线数</label>
        <InputNumber
          min={30}
          max={500}
          value={doubleBottomLookback}
          onChange={v => setDoubleBottomLookback(v || 100)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>两底最小间隔</label>
        <InputNumber
          min={5}
          max={100}
          value={minBarsBetween}
          onChange={v => setMinBarsBetween(v || 10)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>底部容差(%)</label>
        <InputNumber
          min={0.5}
          max={10}
          step={0.5}
          value={bottomTolerancePct}
          onChange={v => setBottomTolerancePct(v || 2)}
          style={{ width: 80 }}
        />
      </div>
    </>
  );

  // 渲染上涨后W底参数
  const renderSurgeWBottomParams = () => (
    <>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>周期</label>
        <Select
          value={surgeWBottomInterval}
          onChange={setSurgeWBottomInterval}
          options={INTERVALS}
          style={{ width: 100 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>回溯K线数</label>
        <InputNumber
          min={50}
          max={500}
          value={surgeWBottomLookback}
          onChange={v => setSurgeWBottomLookback(v || 100)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最小上涨幅度(%)</label>
        <InputNumber
          min={5}
          max={200}
          value={surgeWBottomMinSurgePct}
          onChange={v => setSurgeWBottomMinSurgePct(v || 20)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>最大回调幅度(%)</label>
        <InputNumber
          min={10}
          max={80}
          value={surgeWBottomMaxRetracePct}
          onChange={v => setSurgeWBottomMaxRetracePct(v || 50)}
          style={{ width: 80 }}
        />
      </div>
      <div className={styles.controlItem}>
        <label className={styles.controlLabel}>距W底最大距离(%)</label>
        <InputNumber
          min={1}
          max={20}
          value={maxDistanceToBottomPct}
          onChange={v => setMaxDistanceToBottomPct(v || 5)}
          style={{ width: 80 }}
        />
      </div>
    </>
  );

  // 渲染参数面板
  const renderParams = () => {
    switch (scanType) {
      case 'pullback': return renderPullbackParams();
      case 'pullback-v2': return renderPullbackV2Params();
      case 'consolidation': return renderConsolidationParams();
      case 'double-bottom': return renderDoubleBottomParams();
      case 'surge-w-bottom': return renderSurgeWBottomParams();
      case 'ema20-push': return renderEma20PushParams();
    }
  };

  // 渲染结果卡片
  const renderResultCard = (result: ScanResultItem) => {
    const keyLevels = result.key_levels || {};
    return (
      <div key={result.symbol} className={styles.resultCard}>
        <div className={styles.cardHeader}>
          <span className={styles.symbol}>{result.symbol}</span>
          <Tag color="blue">{result.score.toFixed(1)}分</Tag>
        </div>
        {result.description && (
          <div className={styles.description}>{result.description}</div>
        )}
        <div className={styles.cardContent}>
          {keyLevels.swing_low !== undefined && (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>波段低点</span>
              <span className={styles.metricValue}>
                ${keyLevels.swing_low.toFixed(4)}
              </span>
            </div>
          )}
          {keyLevels.swing_high !== undefined && (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>波段高点</span>
              <span className={styles.metricValue}>
                ${keyLevels.swing_high.toFixed(4)}
              </span>
            </div>
          )}
          {keyLevels.support !== undefined && (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>支撑位</span>
              <span className={styles.metricValue}>
                ${keyLevels.support.toFixed(4)}
              </span>
            </div>
          )}
          {keyLevels.resistance !== undefined && (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>阻力位</span>
              <span className={styles.metricValue}>
                ${keyLevels.resistance.toFixed(4)}
              </span>
            </div>
          )}
          {keyLevels.target !== undefined && (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>目标位</span>
              <span className={`${styles.metricValue} ${styles.target}`}>
                ${keyLevels.target.toFixed(4)}
              </span>
            </div>
          )}
          {keyLevels.stop_loss !== undefined && (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>止损位</span>
              <span className={`${styles.metricValue} ${styles.stopLoss}`}>
                ${keyLevels.stop_loss.toFixed(4)}
              </span>
            </div>
          )}
          {keyLevels.bottom1 !== undefined && (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>第一底</span>
              <span className={styles.metricValue}>
                ${keyLevels.bottom1.toFixed(4)}
              </span>
            </div>
          )}
          {keyLevels.bottom2 !== undefined && (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>第二底</span>
              <span className={styles.metricValue}>
                ${keyLevels.bottom2.toFixed(4)}
              </span>
            </div>
          )}
          {keyLevels.neckline !== undefined && (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>颈线位</span>
              <span className={`${styles.metricValue} ${styles.target}`}>
                ${keyLevels.neckline.toFixed(4)}
              </span>
            </div>
          )}
        </div>
        {result.kline_interval && (
          <div className={styles.cardFooter}>
            <span className={styles.intervalTag}>{result.kline_interval}</span>
            {result.detected_at && (
              <span className={styles.detectedTime}>
                {new Date(result.detected_at).toLocaleString('zh-CN')}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const tabItems = [
    { key: 'pullback', label: '回调扫描' },
    { key: 'pullback-v2', label: '回调V2' },
    { key: 'consolidation', label: '横盘震荡' },
    { key: 'double-bottom', label: '双底形态' },
    { key: 'surge-w-bottom', label: '上涨后W底' },
    { key: 'ema20-push', label: 'EMA推动' },
  ];

  return (
    <div className={styles.patternScan}>
      <TopProgressBar
        isVisible={loading || isScanning}
        progress={loading ? 50 : 85}
        absolute
      />

      <PageHeader
        title="形态扫描"
        subtitle="扫描回调、横盘震荡、双底等K线形态"
        icon="🔍"
      />

      {/* 扫描类型选择 */}
      <div className={styles.scanControl}>
        <Tabs
          activeKey={scanType}
          onChange={(key) => {
            setScanType(key as ScanType);
            setResults([]);
          }}
          items={tabItems}
          className={styles.scanTabs}
        />
        <div className={styles.controlRow}>
          {renderParams()}
          <button
            className={styles.scanButton}
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? '扫描中...' : `开始${getScanTypeName(scanType)}`}
          </button>
        </div>
      </div>

      {/* 筛选器 */}
      {results.length > 0 && (
        <div className={styles.filterSection}>
          <div className={styles.filterRow}>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>币种</label>
              <Input
                placeholder="搜索币种..."
                value={filterSymbol}
                onChange={e => setFilterSymbol(e.target.value)}
                allowClear
                style={{ width: 150 }}
              />
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>最低评分</label>
              <InputNumber
                min={0}
                max={100}
                value={minScore}
                onChange={v => setMinScore(v || 0)}
                style={{ width: 80 }}
              />
            </div>
            <div className={styles.resultCount}>
              共 {filteredResults.length} 个结果
            </div>
          </div>
        </div>
      )}

      {/* EMA推动扫描结果 */}
      {scanType === 'ema20-push' && (
        <DataSection
          title="EMA推动扫描结果"
          subtitle={`共 ${ema20PushResults.length} 个币种，按推动次数倒序`}
          loading={loading && isScanning}
          error={null}
          empty={!loading && !isScanning && ema20PushResults.length === 0}
          emptyText="点击上方按钮开始扫描"
          compact
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                  {['币种', '推动次数', '涨幅', '每次推动时间/价格'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ema20PushResults.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#3b82f6' }}>
                      {item.symbol.toUpperCase().endsWith('USDT') ? item.symbol.slice(0, -4) : item.symbol}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: '1.5rem', height: '1.5rem', padding: '0 0.375rem',
                        borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                        background: item.push_count >= 5 ? '#fee2e2' : item.push_count >= 3 ? '#fef3c7' : '#eff6ff',
                        color: item.push_count >= 5 ? '#dc2626' : item.push_count >= 3 ? '#d97706' : '#3b82f6',
                      }}>{item.push_count}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: '#10b981', fontWeight: 500 }}>
                      {item.amplitude_pct != null ? `${item.amplitude_pct.toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {(item.pushes || []).map((p, pi) => (
                          <span key={pi} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.15rem 0.5rem', background: '#f3f4f6',
                            borderRadius: '0.375rem', fontSize: '0.72rem',
                          }}>
                            <span style={{ color: '#111827', fontWeight: 500 }}>
                              {p.price != null
                                ? p.price >= 1000
                                  ? p.price.toLocaleString('en-US', { maximumFractionDigits: 2 })
                                  : p.price >= 1 ? p.price.toFixed(4) : p.price.toFixed(6)
                                : '—'}
                            </span>
                            <span style={{ color: '#f59e0b' }}>
                              {p.ema20 != null
                                ? `EMA ${p.ema20 >= 1000
                                  ? p.ema20.toLocaleString('en-US', { maximumFractionDigits: 2 })
                                  : p.ema20 >= 1 ? p.ema20.toFixed(4) : p.ema20.toFixed(6)}`
                                : ''}
                            </span>
                            {p.time != null && (
                              <span style={{ color: '#9ca3af', fontSize: '0.68rem' }}>
                                {new Date(p.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataSection>
      )}

      {/* 其他扫描结果 */}
      {scanType !== 'ema20-push' && <DataSection
        title="扫描结果"
        subtitle={`${getScanTypeName(scanType)}结果`}
        loading={loading && results.length === 0 && historyResults.length === 0}
        error={null}
        empty={!loading && !isScanning && results.length === 0 && historyResults.length === 0}
        emptyText="点击上方按钮开始扫描"
      >
        {results.length > 0 ? (
          <div className={styles.resultGrid}>
            {filteredResults.map(renderResultCard)}
          </div>
        ) : historyResults.length > 0 ? (
          <div className={styles.historySection}>
            <div className={styles.historyTitle}>历史扫描结果</div>
            <div className={styles.resultGrid}>
              {historyResults
                .filter(r => {
                  if (filterSymbol && !r.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false;
                  if (minScore > 0 && r.score < minScore) return false;
                  return true;
                })
                .map((result, index) => (
                  <div key={`${result.symbol}-${result.id || index}`} className={styles.resultCard}>
                    <div className={styles.cardHeader}>
                      <span className={styles.symbol}>{result.symbol}</span>
                      <Tag color="blue">{result.score.toFixed(1)}分</Tag>
                    </div>
                    <div className={styles.cardContent}>
                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>形态类型</span>
                        <span className={styles.metricValue}>{result.pattern_type}</span>
                      </div>
                      <div className={styles.metric}>
                        <span className={styles.metricLabel}>周期</span>
                        <span className={styles.metricValue}>{result.kline_interval}</span>
                      </div>
                      {result.key_levels?.support && (
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>支撑位</span>
                          <span className={styles.metricValue}>${result.key_levels.support.toFixed(4)}</span>
                        </div>
                      )}
                      {result.key_levels?.resistance && (
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>阻力位</span>
                          <span className={styles.metricValue}>${result.key_levels.resistance.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                    {result.description && (
                      <div className={styles.description}>{result.description}</div>
                    )}
                    <div className={styles.cardFooter}>
                      <span className={styles.detectedTime}>
                        {new Date(result.detected_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </DataSection>}
    </div>
  );
};

export default PatternScan;
