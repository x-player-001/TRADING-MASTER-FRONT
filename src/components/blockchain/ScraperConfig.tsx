import React, { useState, useEffect } from 'react';
import { blockchainAPI } from '../../services/blockchainAPI';
import type { ScraperConfig as ScraperConfigType } from '../../types/blockchain';
import styles from './ScraperConfig.module.scss';

const ScraperConfig: React.FC = () => {
  const [config, setConfig] = useState<ScraperConfigType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState({
    top_n_per_chain: 0,
    scrape_interval_min: 0,
    scrape_interval_max: 0,
    enabled_chains: '',
    enabled: false,
    min_market_cap: 50000,
    min_liquidity: 20000,
    max_token_age_days: 30,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await blockchainAPI.getScraperConfig();
      setConfig(data);
      setFormData({
        top_n_per_chain: data.top_n_per_chain,
        scrape_interval_min: data.scrape_interval_min,
        scrape_interval_max: data.scrape_interval_max,
        enabled_chains: data.enabled_chains,
        enabled: data.enabled,
        min_market_cap: data.min_market_cap || 50000,
        min_liquidity: data.min_liquidity || 20000,
        max_token_age_days: data.max_token_age_days || 30,
      });
    } catch (err: any) {
      console.error('获取爬虫配置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updateData = {
        top_n_per_chain: formData.top_n_per_chain,
        scrape_interval_min: formData.scrape_interval_min,
        scrape_interval_max: formData.scrape_interval_max,
        enabled_chains: formData.enabled_chains,
        enabled: formData.enabled ? 1 : 0,
        min_market_cap: formData.min_market_cap,
        min_liquidity: formData.min_liquidity,
        max_token_age_days: formData.max_token_age_days,
      };
      const data = await blockchainAPI.updateScraperConfig(updateData);
      setConfig(data);
      alert('✅ 配置保存成功！');
    } catch (err: any) {
      console.error('保存爬虫配置失败:', err);
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
          <span className={styles.icon}>⚙️</span>
          <h3>爬虫配置</h3>
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
              <label>每链TOP排名</label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.top_n_per_chain}
                onChange={(e) => setFormData({ ...formData, top_n_per_chain: parseInt(e.target.value) })}
              />
              <span className={styles.hint}>1-50</span>
            </div>

            <div className={styles.formItem}>
              <label>最小间隔(分钟)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={formData.scrape_interval_min}
                onChange={(e) => setFormData({ ...formData, scrape_interval_min: parseInt(e.target.value) })}
              />
              <span className={styles.hint}>1-60</span>
            </div>

            <div className={styles.formItem}>
              <label>最大间隔(分钟)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={formData.scrape_interval_max}
                onChange={(e) => setFormData({ ...formData, scrape_interval_max: parseInt(e.target.value) })}
              />
              <span className={styles.hint}>1-60</span>
            </div>

            <div className={styles.formItem}>
              <label>启用的链</label>
              <input
                type="text"
                value={formData.enabled_chains}
                onChange={(e) => setFormData({ ...formData, enabled_chains: e.target.value })}
                placeholder="如: bsc,solana"
              />
              <span className={styles.hint}>逗号分隔</span>
            </div>

            <div className={styles.formItem}>
              <label>最小市值(USD)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.min_market_cap}
                onChange={(e) => setFormData({ ...formData, min_market_cap: parseInt(e.target.value) })}
                placeholder="50000"
              />
              <span className={styles.hint}>默认 50k</span>
            </div>

            <div className={styles.formItem}>
              <label>最小流动性(USD)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.min_liquidity}
                onChange={(e) => setFormData({ ...formData, min_liquidity: parseInt(e.target.value) })}
                placeholder="20000"
              />
              <span className={styles.hint}>默认 20k</span>
            </div>

            <div className={styles.formItem}>
              <label>代币最大年龄(天)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={formData.max_token_age_days}
                onChange={(e) => setFormData({ ...formData, max_token_age_days: parseInt(e.target.value) })}
                placeholder="30"
              />
              <span className={styles.hint}>默认 30 天</span>
            </div>

            <div className={styles.formItem}>
              <label className={styles.toggleLabel}>
                <span>启用爬虫</span>
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

export default ScraperConfig;
