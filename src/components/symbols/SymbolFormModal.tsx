/**
 * 币种配置表单弹窗
 * 支持添加和编辑两种模式
 */

import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Checkbox, message } from 'antd';
import { TopSymbolConfig, symbolConfigUtils } from '../../services/symbolConfigAPI';

interface SymbolFormModalProps {
  visible: boolean;
  mode: 'add' | 'edit';
  initialData?: TopSymbolConfig | null;
  maxRankOrder: number; // 当前最大排序号，用于添加时自动填充
  onOk: (values: any) => Promise<void>;
  onCancel: () => void;
}

const SymbolFormModal: React.FC<SymbolFormModalProps> = ({
  visible,
  mode,
  initialData,
  maxRankOrder,
  onOk,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

  // 当弹窗打开时，填充表单数据
  useEffect(() => {
    if (visible) {
      if (mode === 'add') {
        // 添加模式：设置默认值
        form.setFieldsValue({
          symbol: '',
          display_name: '',
          rank_order: maxRankOrder + 1,
          enabled: true,
          subscription_intervals: ['1m', '5m', '15m', '1h'], // 默认订阅周期
        });
      } else if (mode === 'edit' && initialData) {
        // 编辑模式：填充现有数据
        form.setFieldsValue({
          symbol: initialData.symbol,
          display_name: initialData.display_name,
          rank_order: initialData.rank_order,
          enabled: initialData.enabled,
          subscription_intervals: initialData.subscription_intervals,
        });
      }
    }
  }, [visible, mode, initialData, maxRankOrder, form]);

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      // 验证表单
      const values = await form.validateFields();

      // 币种代码转大写
      if (values.symbol) {
        values.symbol = values.symbol.toUpperCase();
      }

      // 验证订阅周期至少选一个
      if (!values.subscription_intervals || values.subscription_intervals.length === 0) {
        message.error('请至少选择一个订阅周期');
        return;
      }

      setLoading(true);

      try {
        await onOk(values);
        form.resetFields();
      } catch (error) {
        // 错误已在父组件处理，这里不需要再处理
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.log('表单验证失败:', error);
    }
  };

  // 处理取消
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // 获取所有可用的时间周期选项
  const intervalOptions = symbolConfigUtils.getAvailableIntervals().map(interval => ({
    label: symbolConfigUtils.formatInterval(interval),
    value: interval,
  }));

  return (
    <Modal
      title={mode === 'add' ? '添加币种' : '编辑币种'}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
      okText="确定"
      cancelText="取消"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          label="币种代码"
          name="symbol"
          rules={[
            { required: true, message: '请输入币种代码' },
            {
              pattern: /^[A-Z0-9]+USDT$/,
              message: '币种代码必须以USDT结尾，且只包含大写字母和数字'
            },
            { min: 6, max: 20, message: '币种代码长度应在6-20个字符之间' },
          ]}
          extra="例如：BTCUSDT、ETHUSDT（会自动转为大写）"
        >
          <Input
            placeholder="请输入币种代码"
            disabled={mode === 'edit'} // 编辑模式下不允许修改币种代码
            maxLength={20}
            onChange={(e) => {
              // 自动转大写
              const value = e.target.value.toUpperCase();
              form.setFieldValue('symbol', value);
            }}
          />
        </Form.Item>

        <Form.Item
          label="显示名称"
          name="display_name"
          rules={[
            { required: true, message: '请输入显示名称' },
            { min: 2, max: 50, message: '显示名称长度应在2-50个字符之间' },
          ]}
          extra="例如：Bitcoin、Ethereum"
        >
          <Input
            placeholder="请输入显示名称"
            maxLength={50}
          />
        </Form.Item>

        <Form.Item
          label="排序序号"
          name="rank_order"
          rules={[
            { required: true, message: '请输入排序序号' },
            { type: 'number', min: 1, message: '排序序号必须大于0' },
          ]}
          extra="数字越小排序越靠前"
        >
          <InputNumber
            placeholder="请输入排序序号"
            min={1}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label="是否启用"
          name="enabled"
          valuePropName="checked"
        >
          <Switch
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
        </Form.Item>

        <Form.Item
          label="订阅周期"
          name="subscription_intervals"
          rules={[
            { required: true, message: '请选择至少一个订阅周期' },
          ]}
          extra="选择需要订阅K线数据的时间周期"
        >
          <Checkbox.Group
            options={intervalOptions}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SymbolFormModal;
