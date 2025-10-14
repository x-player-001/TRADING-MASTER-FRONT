/**
 * 回测参数表单 - Panel 5
 */

import React from 'react';
import { Form, Select, InputNumber } from 'antd';
import type { StrategyWizardState } from '../../types/strategyWizard';
import styles from './BacktestParamsForm.module.scss';

interface BacktestParamsFormProps {
  wizardState: StrategyWizardState;
  onChange: (params: Partial<StrategyWizardState['backtestParams']>) => void;
}

const BacktestParamsForm: React.FC<BacktestParamsFormProps> = ({
  wizardState,
  onChange
}) => {
  const { backtestParams } = wizardState;

  return (
    <div className={styles.backtestParamsForm}>
      <Form layout="vertical">
        <div className={styles.row}>
          <Form.Item
            label="集成方法"
            tooltip="多个Position策略的集成方法"
            className={styles.col}
          >
            <Select
              value={backtestParams.ensemble_method}
              onChange={(value) => onChange({ ensemble_method: value })}
              options={[
                { label: '均值法 (mean) - 权重平均', value: 'mean' },
                { label: '投票法 (vote) - 投票表决', value: 'vote' },
                { label: '最大值 (max) - 取最大值', value: 'max' }
              ]}
            />
          </Form.Item>

          <Form.Item
            label="手续费率"
            tooltip="单边手续费率，0.0002表示0.02%"
            className={styles.col}
          >
            <InputNumber
              value={backtestParams.fee_rate}
              onChange={(value) => onChange({ fee_rate: value || 0.0002 })}
              min={0}
              max={0.01}
              step={0.0001}
              precision={4}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="权重小数位数"
            tooltip="策略权重的小数位数"
            className={styles.col}
          >
            <InputNumber
              value={backtestParams.digits}
              onChange={(value) => onChange({ digits: value || 2 })}
              min={0}
              max={6}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </div>
      </Form>

      <div className={styles.info}>
        <div className={styles.infoTitle}>📊 回测参数说明</div>
        <ul className={styles.infoList}>
          <li>
            <strong>集成方法:</strong> 当配置多个Position时，如何合并它们的信号
            <ul>
              <li>均值法 (mean): 计算所有Position权重的平均值</li>
              <li>投票法 (vote): 根据多数Position的信号决策</li>
              <li>最大值 (max): 使用权重最大的Position信号</li>
            </ul>
          </li>
          <li>
            <strong>手续费率:</strong> 影响回测的收益计算，建议根据实际交易平台设置
          </li>
          <li>
            <strong>权重小数位数:</strong> 控制策略权重的精度
          </li>
        </ul>
      </div>
    </div>
  );
};

export default BacktestParamsForm;
