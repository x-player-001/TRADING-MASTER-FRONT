import React, { useState, useCallback, useEffect } from 'react';
import { Select, InputNumber, Tag, Progress, Popconfirm, message, Input, Modal } from 'antd';
import styles from './PatternScan.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, DataSection, CoolRefreshButton } from '../components/ui';
import { patternScanAPI, PatternScanTask, PatternResult, PatternType } from '../services/patternScanAPI';

interface PatternScanProps {
  isSidebarCollapsed?: boolean;
}

const INTERVALS = [
  { value: '1m', label: '1分钟' },
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '30m', label: '30分钟' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: '1d', label: '1天' },
];

const PatternScan: React.FC<PatternScanProps> = () => {
  // 状态
  const [tasks, setTasks] = useState<PatternScanTask[]>([]);
  const [results, setResults] = useState<PatternResult[]>([]);
  const [patternTypes, setPatternTypes] = useState<PatternType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 扫描参数
  const [scanInterval, setScanInterval] = useState('1h');
  const [lookbackBars, setLookbackBars] = useState(100);

  // 筛选参数
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0);

  // 黑名单
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blacklistModalVisible, setBlacklistModalVisible] = useState(false);
  const [newBlacklistSymbol, setNewBlacklistSymbol] = useState('');

  // 数据加载
  const fetchData = useCallback(async () => {
    try {
      const [tasksData, resultsData, typesData, blacklistData] = await Promise.all([
        patternScanAPI.getTasks({ limit: 10 }),
        patternScanAPI.getLatestResults({ limit: 500 }),
        patternScanAPI.getPatternTypes(),
        patternScanAPI.getBlacklist()
      ]);
      setTasks(tasksData);
      setResults(resultsData);
      setPatternTypes(typesData);
      setBlacklist(blacklistData);
      setError(null);
    } catch (err) {
      setError('加载数据失败');
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 轮询正在运行的任务
  useEffect(() => {
    const runningTask = tasks.find(t => t.status === 'running' || t.status === 'pending');
    if (!runningTask) return;

    const timer = setInterval(async () => {
      try {
        const status = await patternScanAPI.getTaskStatus(runningTask.id);
        setTasks(prev => prev.map(t =>
          t.id === status.id ? status : t
        ));
        if (status.status === 'completed') {
          fetchData();
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [tasks, fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  // 启动扫描
  const handleStartScan = async () => {
    setIsScanning(true);
    try {
      const task = await patternScanAPI.startScan({
        interval_type: scanInterval,
        lookback_bars: lookbackBars
      });
      setTasks(prev => [task, ...prev]);
    } catch (err) {
      setError('启动扫描失败');
    } finally {
      setIsScanning(false);
    }
  };

  // 删除所有扫描结果
  const handleDeleteAll = async () => {
    try {
      const result = await patternScanAPI.deleteAll();
      message.success(`已删除 ${result.deleted_results} 个结果和 ${result.deleted_tasks} 个任务`);
      setTasks([]);
      setResults([]);
    } catch (err) {
      message.error('删除失败');
    }
  };

  // 添加到黑名单
  const handleAddToBlacklist = async (symbol?: string) => {
    const targetSymbol = symbol || newBlacklistSymbol.trim().toUpperCase();
    if (!targetSymbol) {
      message.warning('请输入币种名称');
      return;
    }
    try {
      await patternScanAPI.addToBlacklist(targetSymbol);
      message.success(`已将 ${targetSymbol} 加入黑名单`);
      setBlacklist(prev => [...prev, targetSymbol]);
      setNewBlacklistSymbol('');
    } catch (err) {
      message.error('添加失败');
    }
  };

  // 从黑名单移除
  const handleRemoveFromBlacklist = async (symbol: string) => {
    try {
      await patternScanAPI.removeFromBlacklist(symbol);
      message.success(`已将 ${symbol} 从黑名单移除`);
      setBlacklist(prev => prev.filter(s => s !== symbol));
    } catch (err) {
      message.error('移除失败');
    }
  };

  // 筛选结果
  const filteredResults = results.filter(r => {
    if (filterType && r.pattern_type !== filterType) return false;
    if (filterSymbol && !r.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false;
    if (minScore > 0 && r.score < minScore) return false;
    return true;
  });

  // 格式化时间
  const formatTime = (timestamp: string | number) => {
    const ts = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
    return new Date(ts).toLocaleString('zh-CN');
  };

  // 根据pattern_type判断方向
  const getPatternDirection = (patternType: string): 'bullish' | 'bearish' | 'neutral' => {
    if (patternType.includes('BULLISH') || patternType.includes('ASCENDING')) return 'bullish';
    if (patternType.includes('BEARISH') || patternType.includes('DESCENDING')) return 'bearish';
    return 'neutral';
  };

  // 获取方向颜色
  const getDirectionColor = (patternType: string) => {
    const direction = getPatternDirection(patternType);
    switch (direction) {
      case 'bullish': return 'green';
      case 'bearish': return 'red';
      default: return 'default';
    }
  };

  // 获取方向文本
  const getDirectionText = (patternType: string) => {
    const direction = getPatternDirection(patternType);
    switch (direction) {
      case 'bullish': return '看涨';
      case 'bearish': return '看跌';
      default: return '中性';
    }
  };

  // 格式化形态名称
  const formatPatternName = (patternType: string) => {
    const names: Record<string, string> = {
      'BULLISH_FLAG': '牛旗形态',
      'BEARISH_FLAG': '熊旗形态',
      'ASCENDING_TRIANGLE': '上升三角形',
      'DESCENDING_TRIANGLE': '下降三角形',
      'SYMMETRIC_TRIANGLE': '对称三角形',
      'DOUBLE_TOP': '双顶',
      'DOUBLE_BOTTOM': '双底',
      'HEAD_SHOULDERS': '头肩顶',
      'INV_HEAD_SHOULDERS': '头肩底',
      'WEDGE_UP': '上升楔形',
      'WEDGE_DOWN': '下降楔形',
    };
    return names[patternType] || patternType;
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'processing';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'running': return '扫描中';
      case 'pending': return '等待中';
      case 'failed': return '失败';
      default: return status;
    }
  };

  if (error && !results.length) {
    return (
      <div className={styles.patternScan}>
        <div className={styles.error}>
          <div className={styles.content}>
            <div className={styles.icon}>&#x26A0;&#xFE0F;</div>
            <div className={styles.text}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.patternScan}>
      <TopProgressBar
        isVisible={isRefreshing || loading || isScanning}
        progress={loading ? 50 : 85}
        absolute
      />

      <PageHeader
        title="形态扫描"
        subtitle="自动识别K线形态，发现交易机会"
        icon="&#128269;"
      />

      {/* 扫描控制 */}
      <div className={styles.scanControl}>
        <div className={styles.controlRow}>
          <div className={styles.controlItem}>
            <label className={styles.controlLabel}>周期</label>
            <Select
              value={scanInterval}
              onChange={setScanInterval}
              options={INTERVALS}
              style={{ width: 120 }}
            />
          </div>
          <div className={styles.controlItem}>
            <label className={styles.controlLabel}>回溯K线数</label>
            <InputNumber
              min={50}
              max={500}
              value={lookbackBars}
              onChange={v => setLookbackBars(v || 100)}
              style={{ width: 100 }}
            />
          </div>
          <button
            className={styles.scanButton}
            onClick={handleStartScan}
            disabled={isScanning}
          >
            {isScanning ? '扫描中...' : '开始扫描'}
          </button>
          <Popconfirm
            title="确定删除所有扫描结果和任务？"
            description="此操作不可恢复"
            onConfirm={handleDeleteAll}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <button className={styles.deleteAllButton}>
              清空记录
            </button>
          </Popconfirm>
          <button
            className={styles.blacklistButton}
            onClick={() => setBlacklistModalVisible(true)}
          >
            黑名单 ({blacklist.length})
          </button>
          <CoolRefreshButton
            onClick={handleRefresh}
            loading={isRefreshing}
            size="small"
            iconOnly
          />
        </div>
      </div>

      {/* 任务状态 */}
      {tasks.length > 0 && (
        <div className={styles.taskSection}>
          <h3 className={styles.sectionTitle}>最近任务</h3>
          <div className={styles.taskList}>
            {tasks.slice(0, 5).map(task => (
              <div key={task.id} className={styles.taskItem}>
                <div className={styles.taskInfo}>
                  <Tag color={getStatusColor(task.status)}>
                    {getStatusText(task.status)}
                  </Tag>
                  <span className={styles.taskInterval}>{task.interval_type}</span>
                  <span className={styles.taskBars}>{task.lookback_bars}根K线</span>
                  <span className={styles.taskTime}>{formatTime(task.created_at)}</span>
                  {task.found_patterns !== undefined && (
                    <span className={styles.taskPatterns}>发现 {task.found_patterns} 个形态</span>
                  )}
                </div>
                {(task.status === 'running' || task.status === 'pending') && task.total_symbols && task.scanned_symbols !== undefined && (
                  <Progress
                    percent={Math.round((task.scanned_symbols / task.total_symbols) * 100)}
                    size="small"
                    status="active"
                    style={{ width: 150 }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 筛选器 */}
      <div className={styles.filterSection}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>形态类型</label>
            <Select
              value={filterType}
              onChange={setFilterType}
              allowClear
              placeholder="全部类型"
              style={{ width: 180 }}
              options={patternTypes.map(t => ({ value: t.type, label: t.name }))}
            />
          </div>
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
              style={{ width: 100 }}
            />
          </div>
          <div className={styles.resultCount}>
            共 {filteredResults.length} 个形态
          </div>
        </div>
      </div>

      {/* 扫描结果 */}
      <DataSection
        title="扫描结果"
        subtitle="识别到的K线形态"
        loading={loading && !results.length}
        error={null}
        empty={!loading && filteredResults.length === 0}
        emptyText="暂无扫描结果"
      >
        <div className={styles.resultGrid}>
          {filteredResults.map((result) => (
            <div key={result.id} className={styles.resultCard}>
              <div className={styles.cardHeader}>
                <span className={styles.symbol}>{result.symbol}</span>
                <Tag color={getDirectionColor(result.pattern_type)}>
                  {getDirectionText(result.pattern_type)}
                </Tag>
              </div>
              <div className={styles.patternName}>{formatPatternName(result.pattern_type)}</div>
              <div className={styles.description}>{result.description}</div>
              <div className={styles.cardFooter}>
                <span className={styles.intervalTag}>{result.kline_interval}</span>
                <span className={styles.detectedTime}>{formatTime(result.detected_at)}</span>
                {!blacklist.includes(result.symbol) && (
                  <button
                    className={styles.blockBtn}
                    onClick={() => handleAddToBlacklist(result.symbol)}
                    title="加入黑名单"
                  >
                    屏蔽
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DataSection>

      {/* 形态类型说明 */}
      {patternTypes.length > 0 && (
        <div className={styles.patternTypesSection}>
          <h3 className={styles.sectionTitle}>支持的形态类型</h3>
          <div className={styles.patternTypeGrid}>
            {patternTypes.map(type => (
              <div key={type.type} className={styles.patternTypeCard}>
                <div className={styles.typeName}>{type.name}</div>
                <Tag color={
                  type.category === 'reversal' ? 'orange' :
                  type.category === 'continuation' ? 'blue' : 'purple'
                }>
                  {type.category === 'reversal' ? '反转' :
                   type.category === 'continuation' ? '持续' : '双向'}
                </Tag>
                <div className={styles.typeDesc}>{type.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 黑名单管理弹窗 */}
      <Modal
        title="黑名单管理"
        open={blacklistModalVisible}
        onCancel={() => setBlacklistModalVisible(false)}
        footer={null}
        width={500}
      >
        <div className={styles.blacklistModal}>
          <div className={styles.blacklistAdd}>
            <Input
              placeholder="输入币种名称，如 BTCUSDT"
              value={newBlacklistSymbol}
              onChange={e => setNewBlacklistSymbol(e.target.value)}
              onPressEnter={() => handleAddToBlacklist()}
              style={{ flex: 1 }}
            />
            <button
              className={styles.addBlacklistBtn}
              onClick={() => handleAddToBlacklist()}
            >
              添加
            </button>
          </div>
          <div className={styles.blacklistInfo}>
            黑名单中的币种将不会出现在扫描结果中
          </div>
          <div className={styles.blacklistList}>
            {blacklist.length === 0 ? (
              <div className={styles.emptyBlacklist}>暂无黑名单币种</div>
            ) : (
              blacklist.map(symbol => (
                <div key={symbol} className={styles.blacklistItem}>
                  <span className={styles.blacklistSymbol}>{symbol}</span>
                  <button
                    className={styles.removeBlacklistBtn}
                    onClick={() => handleRemoveFromBlacklist(symbol)}
                  >
                    移除
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PatternScan;
