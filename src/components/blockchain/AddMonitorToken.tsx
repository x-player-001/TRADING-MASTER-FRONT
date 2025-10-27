import React, { useState } from 'react';
import { blockchainAPI } from '../../services/blockchainAPI';
import styles from './AddMonitorToken.module.scss';

interface AddMonitorTokenProps {
  onSuccess?: () => void;
}

const AddMonitorToken: React.FC<AddMonitorTokenProps> = ({ onSuccess }) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    pair_address: '',
    chain: 'bsc',
    alert_thresholds: '70,80,90',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.pair_address.trim()) {
      alert('⚠️ 请输入pair地址！');
      return;
    }

    try {
      setLoading(true);
      await blockchainAPI.addMonitorByPair({
        pair_address: formData.pair_address.trim(),
        chain: formData.chain,
        alert_thresholds: formData.alert_thresholds
      });

      alert('✅ 添加监控成功！');

      // 重置表单
      setFormData({
        pair_address: '',
        chain: 'bsc',
        alert_thresholds: '70,80,90',
      });

      // 关闭展开状态
      setExpanded(false);

      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('添加监控失败:', error);
      alert(`❌ 添加监控失败：${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.addMonitorToken}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}>➕</span>
          <span className={styles.title}>手动添加监控</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.expandIcon}>{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.body}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGrid}>
              <div className={styles.formItem}>
                <label className={styles.label}>
                  Pair地址 <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  name="pair_address"
                  value={formData.pair_address}
                  onChange={handleInputChange}
                  placeholder="输入交易对地址..."
                  className={styles.input}
                  disabled={loading}
                />
              </div>

              <div className={styles.formItem}>
                <label className={styles.label}>链名称</label>
                <select
                  name="chain"
                  value={formData.chain}
                  onChange={handleInputChange}
                  className={styles.select}
                  disabled={loading}
                >
                  <option value="bsc">BSC</option>
                  <option value="solana">Solana</option>
                  <option value="base">Base</option>
                </select>
              </div>

              <div className={styles.formItem}>
                <label className={styles.label}>报警阈值</label>
                <input
                  type="text"
                  name="alert_thresholds"
                  value={formData.alert_thresholds}
                  onChange={handleInputChange}
                  placeholder="逗号分隔，如 70,80,90"
                  className={styles.input}
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? '⏳ 中...' : '➕'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AddMonitorToken;
