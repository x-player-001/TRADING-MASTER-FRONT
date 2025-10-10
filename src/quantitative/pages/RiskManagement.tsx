/**
 * 风险管理页面
 */

import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Select, Button, message } from 'antd';
import PageHeader from '../../components/ui/PageHeader';
import { useStrategyData } from '../hooks/useStrategyData';
import { useRiskCheck } from '../hooks/useRiskCheck';
import { formatCurrency, formatPercent, SYMBOLS } from '../utils';
import styles from './RiskManagement.module.scss';

interface RiskManagementProps {
  isSidebarCollapsed?: boolean;
}

const RiskManagement: React.FC<RiskManagementProps> = ({ isSidebarCollapsed }) => {
  const { strategies } = useStrategyData();
  const { config, exposure, fetchConfig, updateConfig, fetchExposure } = useRiskCheck();
  const [form] = Form.useForm();
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);

  useEffect(() => {
    if (strategies.length > 0 && !selectedStrategyId) {
      const firstId = strategies[0].id!;
      setSelectedStrategyId(firstId);
      fetchConfig(firstId);
      fetchExposure({ strategy_id: firstId, total_capital: 10000 });
    }
  }, [strategies]);

  useEffect(() => {
    if (config) {
      form.setFieldsValue(config);
    }
  }, [config, form]);

  const handleStrategyChange = (strategyId: number) => {
    setSelectedStrategyId(strategyId);
    fetchConfig(strategyId);
    fetchExposure({ strategy_id: strategyId, total_capital: 10000 });
  };

  const handleSubmit = async () => {
    if (!selectedStrategyId) return;

    try {
      const values = await form.validateFields();
      await updateConfig(selectedStrategyId, values);
      message.success('风控配置更新成功');
    } catch (err: any) {
      message.error(err.message || '更新失败');
    }
  };

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="风险管理"
        subtitle="配置风控参数，监控风险敞口"
        icon="⚠️"
      />

      <div className={styles.mainGrid}>
        {/* 风险敞口 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>风险敞口</h2>
          </div>
          <div className={styles.cardBody}>
            {exposure ? (
              <>
                <div className={styles.exposureGrid}>
                  <div className={styles.exposureItem}>
                    <div className={styles.label}>总持仓数</div>
                    <div className={styles.value}>{exposure.total_positions}</div>
                  </div>
                  <div className={styles.exposureItem}>
                    <div className={styles.label}>总风险金额</div>
                    <div className={styles.value}>{formatCurrency(exposure.total_risk_amount)}</div>
                  </div>
                  <div className={styles.exposureItem}>
                    <div className={styles.label}>总风险占比</div>
                    <div className={styles.value}>{formatPercent(exposure.total_risk_percent)}</div>
                  </div>
                  <div className={styles.exposureItem}>
                    <div className={styles.label}>可用资金</div>
                    <div className={styles.value}>{formatCurrency(exposure.available_capital)}</div>
                  </div>
                  <div className={styles.exposureItem}>
                    <div className={styles.label}>当日盈亏</div>
                    <div className={`${styles.value} ${exposure.daily_pnl >= 0 ? styles.positive : styles.negative}`}>
                      {formatCurrency(exposure.daily_pnl)}
                    </div>
                  </div>
                  <div className={styles.exposureItem}>
                    <div className={styles.label}>当日盈亏%</div>
                    <div className={`${styles.value} ${exposure.daily_pnl_percent >= 0 ? styles.positive : styles.negative}`}>
                      {formatPercent(exposure.daily_pnl_percent)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.empty}>暂无数据</div>
            )}
          </div>
        </div>

        {/* 风控配置 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>风控配置</h2>
          </div>
          <div className={styles.cardBody}>
            <div style={{ marginBottom: '1rem' }}>
              <label>选择策略：</label>
              <Select
                style={{ width: '100%', marginTop: '0.5rem' }}
                value={selectedStrategyId}
                onChange={handleStrategyChange}
              >
                {strategies.map((s) => (
                  <Select.Option key={s.id} value={s.id}>
                    {s.name}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <Form form={form} layout="vertical">
              <Form.Item label="最大持仓数" name="max_positions">
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="单笔仓位占比 (%)" name="max_position_size_percent">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="总风险敞口 (%)" name="max_total_risk_percent">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="止损百分比 (%)" name="stop_loss_percent">
                <InputNumber min={0.1} max={20} step={0.1} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="止盈百分比 (%)" name="take_profit_percent">
                <InputNumber min={0.1} max={50} step={0.1} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="最大日亏损 (%)" name="max_daily_loss_percent">
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>

              <Button type="primary" size="large" block onClick={handleSubmit}>
                保存配置
              </Button>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskManagement;
