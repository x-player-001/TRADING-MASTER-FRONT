import React, { useState, useEffect } from 'react';
import { blockchainAPI } from '../../services/blockchainAPI';
import type { MonitorConfig as MonitorConfigType } from '../../types/blockchain';
import styles from './ScraperConfig.module.scss';

const MonitorConfig: React.FC = () => {
  const [config, setConfig] = useState<MonitorConfigType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState({
    min_monitor_market_cap: null as number | null,
    min_monitor_liquidity: null as number | null,
    update_interval_minutes: 5,
    enabled: false,
    max_retry_count: 3,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await blockchainAPI.getMonitorConfig();
      setConfig(data);
      setFormData({
        min_monitor_market_cap: data.min_monitor_market_cap,
        min_monitor_liquidity: data.min_monitor_liquidity,
        update_interval_minutes: data.update_interval_minutes,
        enabled: data.enabled === 1,
        max_retry_count: data.max_retry_count,
      });
    } catch (err: any) {
      console.error('获取监控配置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updateData = {
        min_monitor_market_cap: formData.min_monitor_market_cap,
        min_monitor_liquidity: formData.min_monitor_liquidity,
        update_interval_minutes: formData.update_interval_minutes,
        enabled: formData.enabled ? 1 : 0,
        max_retry_count: formData.max_retry_count,
      };

      await blockchainAPI.updateMonitorConfig(updateData);
      await fetchConfig(); // 重新获取以更新显示
      alert('✅ 配置保存成功！');
    } catch (err: any) {
      console.error('保存监控配置失败:', err);
      alert(`❌ 保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.configCard}>
        <div className={styles.loading}>⏳ 加载配置中...</div>
      </div>
    );
  }

  return (
    <div className={styles.configCard}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.title}>
          <span className={styles.icon}>📊</span>
          <h3>监控配置</h3>
          <span className={`${styles.status} ${config?.enabled ? styles.enabled : styles.disabled}`}>
            {config?.enabled ? '运行中' : '已停止'}
          </span>
        </div>
        <button className={styles.toggleBtn}>
          {expanded ? '▲ 收起' : '▼ 展开'}
        </button>
      </div>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.formGrid}>
            <div className={styles.formItem}>
              <label>最小市值(USD)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.min_monitor_market_cap ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  min_monitor_market_cap: e.target.value ? parseInt(e.target.value) : null
                })}
                placeholder="不限制"
              />
              <span className={styles.hint}>低于此值自动移除</span>
            </div>

            <div className={styles.formItem}>
              <label>最小流动性(USD)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.min_monitor_liquidity ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  min_monitor_liquidity: e.target.value ? parseInt(e.target.value) : null
                })}
                placeholder="不限制"
              />
              <span className={styles.hint}>低于此值自动移除</span>
            </div>

            <div className={styles.formItem}>
              <label>更新间隔(分钟)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={formData.update_interval_minutes}
                onChange={(e) => setFormData({ ...formData, update_interval_minutes: parseInt(e.target.value) })}
              />
              <span className={styles.hint}>1-60</span>
            </div>

            <div className={styles.formItem}>
              <label>最大重试次数</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.max_retry_count}
                onChange={(e) => setFormData({ ...formData, max_retry_count: parseInt(e.target.value) })}
              />
              <span className={styles.hint}>1-10</span>
            </div>

            <div className={styles.formItem}>
              <label className={styles.toggleLabel}>
                <span>启用监控</span>
                <div className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                  <span className={styles.slider}></span>
                </div>
              </label>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '⏳ 保存中...' : '💾 保存配置'}
            </button>
            <button
              className={styles.refreshBtn}
              onClick={fetchConfig}
              disabled={loading}
            >
              🔄 刷新
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitorConfig;
