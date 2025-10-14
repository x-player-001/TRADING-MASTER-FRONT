/**
 * 基本信息表单
 */

import React from 'react';
import { Form, Input, Select } from 'antd';
import type { StrategyWizardState } from '../../types/strategyWizard';
import styles from './BasicInfoForm.module.scss';

const { TextArea } = Input;

interface BasicInfoFormProps {
  wizardState: StrategyWizardState;
  onChange: (metadata: Partial<StrategyWizardState['metadata']>) => void;
}

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({ wizardState, onChange }) => {
  const { metadata } = wizardState;

  return (
    <div className={styles.basicInfoForm}>
      <Form layout="vertical">
        <Form.Item
          label="策略名称"
          required
          tooltip="为您的策略起一个清晰易懂的名称"
        >
          <Input
            value={metadata.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="例如：笔方向多空策略"
            size="large"
          />
        </Form.Item>

        <Form.Item
          label="策略描述"
          tooltip="简要描述策略的交易逻辑和适用场景"
        >
          <TextArea
            value={metadata.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="简要描述策略的交易逻辑和适用场景"
            rows={3}
          />
        </Form.Item>

        <div className={styles.row}>
          <Form.Item
            label="策略分类"
            required
            tooltip="策略类型，便于分类管理"
            className={styles.col}
          >
            <Select
              value={metadata.category}
              onChange={(value) => onChange({ category: value })}
              options={[
                { label: '趋势策略', value: 'trend' },
                { label: '反转策略', value: 'reversal' },
                { label: '套利策略', value: 'arbitrage' },
                { label: '多因子策略', value: 'multi_factor' },
                { label: '网格策略', value: 'grid' },
                { label: '自定义', value: 'custom' }
              ]}
            />
          </Form.Item>

          <Form.Item
            label="版本号"
            tooltip="策略版本，建议使用语义化版本号"
            className={styles.col}
          >
            <Input
              value={metadata.version}
              onChange={(e) => onChange({ version: e.target.value })}
              placeholder="1.0.0"
            />
          </Form.Item>
        </div>

        <div className={styles.row}>
          <Form.Item
            label="作者"
            tooltip="策略创建者"
            className={styles.col}
          >
            <Input
              value={metadata.author}
              onChange={(e) => onChange({ author: e.target.value })}
              placeholder="您的名字"
            />
          </Form.Item>

          <Form.Item
            label="标签"
            tooltip="多个标签用逗号分隔，便于搜索"
            className={styles.col}
          >
            <Input
              value={metadata.tags.join(', ')}
              onChange={(e) => onChange({
                tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
              })}
              placeholder="trend, bi_direction"
            />
          </Form.Item>
        </div>
      </Form>
    </div>
  );
};

export default BasicInfoForm;
