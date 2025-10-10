/**
 * 策略管理页面
 */

import React, { useState } from 'react';
import { Modal, Form, Input, Select, Switch, InputNumber, message } from 'antd';
import PageHeader from '../../components/ui/PageHeader';
import { useStrategyData } from '../hooks/useStrategyData';
import {
  formatStrategyType,
  formatStrategyMode,
  formatDateTime,
  STRATEGY_TYPES,
  STRATEGY_MODES,
  DEFAULT_BREAKOUT_PARAMS,
  DEFAULT_TREND_PARAMS
} from '../utils';
import { StrategyConfig } from '../types';
import styles from './StrategyManage.module.scss';

interface StrategyManageProps {
  isSidebarCollapsed?: boolean;
}

const StrategyManage: React.FC<StrategyManageProps> = ({ isSidebarCollapsed }) => {
  const {
    strategies,
    selectedStrategy,
    performance,
    isLoading,
    selectStrategy,
    createStrategy,
    modifyStrategy,
    deleteStrategy,
    toggleStrategy,
    fetchPerformance
  } = useStrategyData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [form] = Form.useForm();

  // 打开创建模态框
  const handleCreate = () => {
    setModalMode('create');
    form.resetFields();
    form.setFieldsValue({
      type: 'breakout',
      mode: 'backtest',
      enabled: false,
      parameters: DEFAULT_BREAKOUT_PARAMS
    });
    setIsModalOpen(true);
  };

  // 打开编辑模态框
  const handleEdit = (strategy: StrategyConfig) => {
    setModalMode('edit');
    selectStrategy(strategy);
    form.setFieldsValue(strategy);
    setIsModalOpen(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (modalMode === 'create') {
        await createStrategy(values);
        message.success('策略创建成功');
      } else if (selectedStrategy) {
        await modifyStrategy(selectedStrategy.id!, values);
        message.success('策略更新成功');
      }

      setIsModalOpen(false);
      form.resetFields();
      selectStrategy(null);
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  // 删除策略
  const handleDelete = async (id: number) => {
    if (!window.confirm('确定要删除这个策略吗？')) return;

    try {
      await deleteStrategy(id);
      message.success('策略删除成功');
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  // 切换策略状态
  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await toggleStrategy(id, enabled);
      message.success(enabled ? '策略已启用' : '策略已禁用');
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  // 查看性能
  const handleViewPerformance = async (strategy: StrategyConfig) => {
    selectStrategy(strategy);
    if (strategy.id) {
      await fetchPerformance(strategy.id);
    }
  };

  // 策略类型变化时更新默认参数
  const handleTypeChange = (type: string) => {
    const defaultParams = type === 'breakout' ? DEFAULT_BREAKOUT_PARAMS : DEFAULT_TREND_PARAMS;
    form.setFieldsValue({ parameters: defaultParams });
  };

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <PageHeader
        title="策略管理"
        subtitle="创建、编辑和管理您的量化交易策略"
        icon="📋"
      >
        <button className={styles.createBtn} onClick={handleCreate}>
          <span>➕</span>
          创建策略
        </button>
      </PageHeader>

      {/* 策略列表 */}
      <div className={styles.strategyGrid}>
        {isLoading ? (
          <div className={styles.loading}>加载中...</div>
        ) : strategies.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📋</span>
            <p>暂无策略</p>
            <button className={styles.primaryBtn} onClick={handleCreate}>
              创建第一个策略
            </button>
          </div>
        ) : (
          strategies.map((strategy) => (
            <div key={strategy.id} className={styles.strategyCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <span className={styles.strategyName}>{strategy.name}</span>
                  {strategy.enabled && <span className={styles.badge}>运行中</span>}
                </div>
                <Switch
                  checked={strategy.enabled}
                  onChange={(checked) => handleToggle(strategy.id!, checked)}
                  size="small"
                />
              </div>

              <div className={styles.cardBody}>
                <div className={styles.infoRow}>
                  <span className={styles.label}>类型:</span>
                  <span className={styles.value}>{formatStrategyType(strategy.type)}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>模式:</span>
                  <span className={styles.value}>{formatStrategyMode(strategy.mode)}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>创建时间:</span>
                  <span className={styles.value}>{formatDateTime(strategy.created_at!)}</span>
                </div>
                <div className={styles.description}>{strategy.description}</div>
              </div>

              <div className={styles.cardFooter}>
                <button className={styles.btn} onClick={() => handleViewPerformance(strategy)}>
                  查看性能
                </button>
                <button className={styles.btn} onClick={() => handleEdit(strategy)}>
                  编辑
                </button>
                <button className={styles.btnDanger} onClick={() => handleDelete(strategy.id!)}>
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 创建/编辑模态框 */}
      <Modal
        title={modalMode === 'create' ? '创建策略' : '编辑策略'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
          selectStrategy(null);
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="策略名称"
            name="name"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="例如: BTC突破策略" />
          </Form.Item>

          <Form.Item
            label="策略类型"
            name="type"
            rules={[{ required: true, message: '请选择策略类型' }]}
          >
            <Select options={STRATEGY_TYPES} onChange={handleTypeChange} />
          </Form.Item>

          <Form.Item
            label="运行模式"
            name="mode"
            rules={[{ required: true, message: '请选择运行模式' }]}
          >
            <Select options={STRATEGY_MODES} />
          </Form.Item>

          <Form.Item label="策略描述" name="description">
            <Input.TextArea rows={3} placeholder="简要描述策略的交易逻辑" />
          </Form.Item>

          <Form.Item label="启用策略" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StrategyManage;
