import React, { useState, useEffect, useCallback } from 'react';
import { Select, InputNumber, Tag, message, Input, Switch, Tabs } from 'antd';
import styles from './PatternScan.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, DataSection } from '../components/ui';
import { patternScanAPI, ScanResultItem, PatternResult } from '../services/patternScanAPI';

interface PatternScanProps {
  isSidebarCollapsed?: boolean;
}

const INTERVALS = [
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
];

type ScanType = 'pullback' | 'consolidation' | 'double-bottom';

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
      case 'consolidation': return '横盘震荡';
      case 'double-bottom': return '双底形态';
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

  // 渲染参数面板
  const renderParams = () => {
    switch (scanType) {
      case 'pullback': return renderPullbackParams();
      case 'consolidation': return renderConsolidationParams();
      case 'double-bottom': return renderDoubleBottomParams();
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
    { key: 'consolidation', label: '横盘震荡' },
    { key: 'double-bottom', label: '双底形态' },
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

      {/* 扫描结果 */}
      <DataSection
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
      </DataSection>
    </div>
  );
};

export default PatternScan;
