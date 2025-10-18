/**
 * 策略管理页面（重构版）
 * 对接CZSC Position策略系统
 */

import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Tag, message, Space, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../../components/ui/PageHeader';
import CreateStrategyWizard from '../components/CreateStrategyWizard';
import { strategyAPI } from '../services/strategyAPI';
import type { CZSCStrategyListItem, CZSCStrategy } from '../types/strategy';
import { formatDateTime, formatPercent } from '../utils';
import styles from './StrategyManage.module.scss';

interface StrategyManageProps {
  isSidebarCollapsed?: boolean;
}

const StrategyManage: React.FC<StrategyManageProps> = ({ isSidebarCollapsed }) => {
  const [strategies, setStrategies] = useState<CZSCStrategyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 创建/编辑策略向导
  const [wizardVisible, setWizardVisible] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<CZSCStrategy | null>(null);

  // 加载策略列表
  const loadStrategies = async () => {
    try {
      setIsLoading(true);
      const response = await strategyAPI.getStrategies({ limit: 100 });
      setStrategies(response.strategies);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || '加载策略列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, []);

  // 编辑策略
  const handleEdit = async (strategyId: string) => {
    try {
      setIsLoading(true);
      const strategy = await strategyAPI.getStrategy(strategyId);
      setEditingStrategy(strategy);
      setWizardVisible(true);
    } catch (error: any) {
      message.error(error.message || '加载策略详情失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 删除策略
  const handleDelete = async (strategyId: string, name: string) => {
    try {
      await strategyAPI.deleteStrategy(strategyId);
      message.success(`策略「${name}」已删除`);
      loadStrategies();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 关闭向导
  const handleCloseWizard = () => {
    setWizardVisible(false);
    setEditingStrategy(null);
  };

  // 向导成功回调
  const handleWizardSuccess = () => {
    setWizardVisible(false);
    setEditingStrategy(null);
    loadStrategies();
  };

  // 表格列定义
  const columns: ColumnsType<CZSCStrategyListItem> = [
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      width: 200
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category?: string) => category ? <Tag color="blue">{category}</Tag> : '-'
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time: string) => formatDateTime(time)
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record.strategy_id)}>
            编辑
          </Button>
          <Popconfirm
            title={`确定删除策略「${record.name}」吗？`}
            onConfirm={() => handleDelete(record.strategy_id, record.name)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className={`${styles.page} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      {!wizardVisible ? (
        <>
          {/* 策略列表视图 */}
          <PageHeader
            title="策略管理"
            subtitle="管理您的CZSC Position交易策略"
            icon="📋"
          >
            <Button type="primary" onClick={() => setWizardVisible(true)}>
              + 创建策略
            </Button>
          </PageHeader>

          <Table
            columns={columns}
            dataSource={strategies}
            rowKey="strategy_id"
            loading={isLoading}
            pagination={{
              pageSize: 20,
              showTotal: (total) => `共 ${total} 条`
            }}
          />
        </>
      ) : (
        <>
          {/* 创建/编辑策略向导视图 */}
          <CreateStrategyWizard
            editingStrategy={editingStrategy}
            onClose={handleCloseWizard}
            onSuccess={handleWizardSuccess}
          />
        </>
      )}
    </div>
  );
};

export default StrategyManage;
