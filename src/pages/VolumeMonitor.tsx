import React, { useState, useCallback, useEffect } from 'react';
import { Input, InputNumber, Switch, Modal, message, Popconfirm } from 'antd';
import styles from './VolumeMonitor.module.scss';
import PageHeader from '../components/ui/PageHeader';
import { TopProgressBar, DataSection, CoolRefreshButton } from '../components/ui';
import { volumeMonitorAPI, VolumeMonitorSymbol, VolumeAlert } from '../services/volumeMonitorAPI';

interface VolumeMonitorProps {
  isSidebarCollapsed?: boolean;
}

const VolumeMonitor: React.FC<VolumeMonitorProps> = () => {
  // 状态
  const [symbols, setSymbols] = useState<VolumeMonitorSymbol[]>([]);
  const [alerts, setAlerts] = useState<VolumeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 添加币种弹窗
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newMultiplier, setNewMultiplier] = useState<number>(2.5);
  const [newLookback, setNewLookback] = useState<number>(20);
  const [newMinVolume, setNewMinVolume] = useState<number>(100000);

  // 编辑弹窗
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSymbol, setEditingSymbol] = useState<VolumeMonitorSymbol | null>(null);
  const [editMultiplier, setEditMultiplier] = useState<number>(2.5);
  const [editLookback, setEditLookback] = useState<number>(20);
  const [editMinVolume, setEditMinVolume] = useState<number>(100000);

  // 数据加载
  const fetchData = useCallback(async () => {
    try {
      const [symbolsData, alertsData] = await Promise.all([
        volumeMonitorAPI.getSymbols(),
        volumeMonitorAPI.getAlerts({ limit: 100 })
      ]);
      setSymbols(symbolsData);
      setAlerts(alertsData);
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
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  // 添加币种
  const handleAddSymbol = async () => {
    if (!newSymbol.trim()) {
      message.warning('请输入币种名称');
      return;
    }
    try {
      await volumeMonitorAPI.addSymbol({
        symbol: newSymbol.toUpperCase(),
        volume_multiplier: newMultiplier,
        lookback_bars: newLookback,
        min_volume_usdt: newMinVolume
      });
      message.success('添加成功');
      setAddModalVisible(false);
      setNewSymbol('');
      fetchData();
    } catch (err) {
      message.error('添加失败');
    }
  };

  // 删除币种
  const handleDeleteSymbol = async (symbol: string) => {
    try {
      await volumeMonitorAPI.deleteSymbol(symbol);
      message.success('删除成功');
      fetchData();
    } catch (err) {
      message.error('删除失败');
    }
  };

  // 切换启用状态
  const handleToggleSymbol = async (symbol: string) => {
    try {
      await volumeMonitorAPI.toggleSymbol(symbol);
      fetchData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  // 编辑配置
  const handleEditSymbol = (item: VolumeMonitorSymbol) => {
    setEditingSymbol(item);
    setEditMultiplier(item.volume_multiplier);
    setEditLookback(item.lookback_bars);
    setEditMinVolume(item.min_volume_usdt);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSymbol) return;
    try {
      await volumeMonitorAPI.updateSymbol(editingSymbol.symbol, {
        volume_multiplier: editMultiplier,
        lookback_bars: editLookback,
        min_volume_usdt: editMinVolume
      });
      message.success('更新成功');
      setEditModalVisible(false);
      fetchData();
    } catch (err) {
      message.error('更新失败');
    }
  };

  // 筛选
  const filteredSymbols = symbols.filter(s =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAlerts = alerts.filter(a =>
    a.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 格式化时间 (后端返回的时间已经是UTC+8，去掉Z后缀避免二次转换)
  const formatTime = (timestamp: string) => {
    // 如果是ISO格式带Z后缀，去掉Z直接解析为本地时间
    const ts = timestamp.endsWith('Z') ? timestamp.slice(0, -1) : timestamp;
    return new Date(ts).toLocaleString('zh-CN');
  };

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  if (error && !symbols.length) {
    return (
      <div className={styles.volumeMonitor}>
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
    <div className={styles.volumeMonitor}>
      <TopProgressBar
        isVisible={isRefreshing || loading}
        progress={loading ? 50 : 85}
        absolute
      />

      <PageHeader
        title="成交量监控"
        subtitle="实时监控币种成交量变化，异常放量预警"
        icon="&#128200;"
      />

      {/* 筛选器 */}
      <div className={styles.filterSection}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>搜索：</label>
            <Input
              placeholder="输入币种名称..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              allowClear
              style={{ width: 200 }}
            />
          </div>

          <div className={styles.filterItem}>
            <CoolRefreshButton
              onClick={handleRefresh}
              loading={isRefreshing}
              size="small"
              iconOnly
            />
          </div>

          <div className={styles.filterItem}>
            <button className={styles.addButton} onClick={() => setAddModalVisible(true)}>
              + 添加监控
            </button>
          </div>

          <div className={styles.statusInfo}>
            <span className={styles.statusItem}>
              <span className={styles.statusLabel}>监控币种:</span>
              <span className={styles.statusValue}>{symbols.length}</span>
            </span>
            <span className={styles.statusItem}>
              <span className={styles.statusLabel}>启用数量:</span>
              <span className={styles.statusValue}>{symbols.filter(s => s.enabled).length}</span>
            </span>
            <span className={styles.statusItem}>
              <span className={styles.statusLabel}>报警数量:</span>
              <span className={styles.statusValue}>{alerts.length}</span>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* 监控列表 */}
        <DataSection
          title="监控列表"
          subtitle={`共 ${filteredSymbols.length} 个币种`}
          loading={loading && !symbols.length}
          error={null}
          empty={!loading && filteredSymbols.length === 0}
          emptyText="暂无监控币种"
        >
          <div className={styles.symbolList}>
            {filteredSymbols.map(item => (
              <div key={item.symbol} className={styles.symbolCard}>
                <div className={styles.symbolHeader}>
                  <span className={styles.symbolName}>{item.symbol}</span>
                  <Switch
                    checked={item.enabled}
                    onChange={() => handleToggleSymbol(item.symbol)}
                    size="small"
                  />
                </div>
                <div className={styles.symbolConfig}>
                  <div className={styles.configItem}>
                    <span className={styles.configLabel}>倍数</span>
                    <span className={styles.configValue}>{item.volume_multiplier}x</span>
                  </div>
                  <div className={styles.configItem}>
                    <span className={styles.configLabel}>回溯</span>
                    <span className={styles.configValue}>{item.lookback_bars}根</span>
                  </div>
                  <div className={styles.configItem}>
                    <span className={styles.configLabel}>最小量</span>
                    <span className={styles.configValue}>{formatNumber(item.min_volume_usdt)}</span>
                  </div>
                </div>
                <div className={styles.symbolActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => handleEditSymbol(item)}
                  >
                    编辑
                  </button>
                  <Popconfirm
                    title="确定删除该监控？"
                    onConfirm={() => handleDeleteSymbol(item.symbol)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <button className={styles.deleteBtn}>删除</button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        </DataSection>

        {/* 报警记录 */}
        <DataSection
          title="报警记录"
          subtitle={`共 ${filteredAlerts.length} 条记录`}
          loading={loading && !alerts.length}
          error={null}
          empty={!loading && filteredAlerts.length === 0}
          emptyText="暂无报警记录"
        >
          <div className={styles.alertList}>
            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`${styles.alertItem} ${alert.direction === 'UP' ? styles.spike : styles.drop}`}
              >
                <div className={styles.alertHeader}>
                  <span className={styles.alertSymbol}>{alert.symbol}</span>
                  <span className={`${styles.alertType} ${alert.direction === 'UP' ? styles.spike : styles.drop}`}>
                    {alert.direction === 'UP' ? '放量上涨' : '放量下跌'}
                  </span>
                  <span className={styles.alertTime}>{formatTime(alert.created_at)}</span>
                </div>
                <div className={styles.alertContent}>
                  <div className={styles.alertMetric}>
                    <span className={styles.metricLabel}>量比</span>
                    <span className={styles.metricValue}>{alert.volume_ratio.toFixed(2)}x</span>
                  </div>
                  <div className={styles.alertMetric}>
                    <span className={styles.metricLabel}>当前成交量</span>
                    <span className={styles.metricValue}>{formatNumber(alert.current_volume)}</span>
                  </div>
                  <div className={styles.alertMetric}>
                    <span className={styles.metricLabel}>平均成交量</span>
                    <span className={styles.metricValue}>{formatNumber(alert.avg_volume)}</span>
                  </div>
                  <div className={styles.alertMetric}>
                    <span className={styles.metricLabel}>当前价格</span>
                    <span className={styles.metricValue}>${alert.current_price.toFixed(4)}</span>
                  </div>
                  <div className={styles.alertMetric}>
                    <span className={styles.metricLabel}>价格变化</span>
                    <span className={`${styles.metricValue} ${alert.price_change_pct > 0 ? styles.positive : styles.negative}`}>
                      {alert.price_change_pct > 0 ? '+' : ''}{alert.price_change_pct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DataSection>
      </div>

      {/* 添加弹窗 */}
      <Modal
        title="添加监控币种"
        open={addModalVisible}
        onOk={handleAddSymbol}
        onCancel={() => setAddModalVisible(false)}
        okText="添加"
        cancelText="取消"
      >
        <div className={styles.modalForm}>
          <div className={styles.formItem}>
            <label>币种名称</label>
            <Input
              placeholder="例如: BTCUSDT"
              value={newSymbol}
              onChange={e => setNewSymbol(e.target.value)}
            />
          </div>
          <div className={styles.formItem}>
            <label>成交量倍数</label>
            <InputNumber
              min={1}
              max={100}
              step={0.5}
              value={newMultiplier}
              onChange={v => setNewMultiplier(v || 2.5)}
              style={{ width: '100%' }}
              addonAfter="x"
            />
          </div>
          <div className={styles.formItem}>
            <label>回溯K线数</label>
            <InputNumber
              min={5}
              max={200}
              value={newLookback}
              onChange={v => setNewLookback(v || 20)}
              style={{ width: '100%' }}
              addonAfter="根"
            />
          </div>
          <div className={styles.formItem}>
            <label>最小成交量 (USDT)</label>
            <InputNumber
              min={0}
              max={100000000}
              step={10000}
              value={newMinVolume}
              onChange={v => setNewMinVolume(v || 100000)}
              style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number(v?.replace(/,/g, '') || 0)}
            />
          </div>
        </div>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title={`编辑 ${editingSymbol?.symbol}`}
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <div className={styles.modalForm}>
          <div className={styles.formItem}>
            <label>成交量倍数</label>
            <InputNumber
              min={1}
              max={100}
              step={0.5}
              value={editMultiplier}
              onChange={v => setEditMultiplier(v || 2.5)}
              style={{ width: '100%' }}
              addonAfter="x"
            />
          </div>
          <div className={styles.formItem}>
            <label>回溯K线数</label>
            <InputNumber
              min={5}
              max={200}
              value={editLookback}
              onChange={v => setEditLookback(v || 20)}
              style={{ width: '100%' }}
              addonAfter="根"
            />
          </div>
          <div className={styles.formItem}>
            <label>最小成交量 (USDT)</label>
            <InputNumber
              min={0}
              max={100000000}
              step={10000}
              value={editMinVolume}
              onChange={v => setEditMinVolume(v || 100000)}
              style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number(v?.replace(/,/g, '') || 0)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VolumeMonitor;
