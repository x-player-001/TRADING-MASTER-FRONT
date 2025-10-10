/**
 * 币种配置管理页面 - 表格展示版
 * 支持查看、启用/禁用、删除等基本操作
 */

import React, { useState, useEffect } from 'react';
import { Button, message, Modal, Switch, Table, Tag, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../components/ui/PageHeader';
import { StatusOverview, StatusCardProps, CoolRefreshButton } from '../components/ui';
import {
  symbolConfigAPI,
  symbolConfigUtils,
  TopSymbolConfig,
  SymbolStatistics,
} from '../services/symbolConfigAPI';
import SymbolFormModal from '../components/symbols/SymbolFormModal';
import styles from './SymbolConfig.module.scss';

const SymbolConfig: React.FC = () => {
  const [symbols, setSymbols] = useState<TopSymbolConfig[]>([]);
  const [statistics, setStatistics] = useState<SymbolStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 表单弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingSymbol, setEditingSymbol] = useState<TopSymbolConfig | null>(null);

  // 加载数据
  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      // 获取币种列表
      let symbolsData: TopSymbolConfig[] = [];
      try {
        const result = await symbolConfigAPI.getAllSymbols();
        symbolsData = Array.isArray(result) ? result : [];
      } catch (symbolErr) {
        const errMsg = symbolErr instanceof Error ? symbolErr.message : '';
        if (errMsg.includes('Symbol not found') || errMsg.includes('not found')) {
          console.info('数据库中暂无币种配置，显示空状态');
          symbolsData = [];
        } else {
          throw symbolErr;
        }
      }

      setSymbols(symbolsData);

      // 计算统计信息
      const safeSymbols = Array.isArray(symbolsData) ? symbolsData : [];
      const enabledCount = safeSymbols.filter(s => s.enabled).length;
      const totalIntervals = new Set(
        safeSymbols.flatMap(s => s.subscription_intervals || [])
      ).size;
      const totalStreams = safeSymbols.reduce(
        (sum, s) => sum + (s.subscription_intervals?.length || 0),
        0
      );

      setStatistics({
        total_symbols: safeSymbols.length,
        enabled_symbols: enabledCount,
        disabled_symbols: safeSymbols.length - enabledCount,
        total_intervals: totalIntervals,
        total_streams: totalStreams,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载数据失败';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 刷新数据
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(false);
  };

  // 启用/禁用币种
  const handleToggle = async (record: TopSymbolConfig, enabled: boolean) => {
    try {
      await symbolConfigAPI.toggleSymbol(record.symbol, enabled);
      message.success(`${enabled ? '启用' : '禁用'}成功`);
      loadData(false);
    } catch (err) {
      message.error(`操作失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  // 删除币种
  const handleDelete = (record: TopSymbolConfig) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除币种 ${record.symbol} (${record.display_name}) 吗？此操作不可恢复。`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await symbolConfigAPI.deleteSymbol(record.symbol);
          message.success('删除成功');
          loadData(false);
        } catch (err) {
          message.error(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
        }
      },
    });
  };

  // 打开添加模态框
  const openAddModal = () => {
    setModalMode('add');
    setEditingSymbol(null);
    setModalVisible(true);
  };

  // 打开编辑模态框
  const openEditModal = (record: TopSymbolConfig) => {
    setModalMode('edit');
    setEditingSymbol(record);
    setModalVisible(true);
  };

  // 处理表单提交
  const handleFormSubmit = async (values: any) => {
    try {
      if (modalMode === 'add') {
        await symbolConfigAPI.createSymbol(values);
        message.success('添加成功');
      } else {
        await symbolConfigAPI.updateSymbol(editingSymbol!.symbol, values);
        message.success('更新成功');
      }
      setModalVisible(false);
      loadData(false);
    } catch (err) {
      message.error(`操作失败: ${err instanceof Error ? err.message : '未知错误'}`);
      throw err; // 抛出错误以阻止模态框关闭
    }
  };

  // 关闭模态框
  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingSymbol(null);
  };

  // 格式化时间
  const formatTime = (time: string) => {
    return new Date(time).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 表格列定义
  const columns: ColumnsType<TopSymbolConfig> = [
    {
      title: '排序',
      dataIndex: 'rank_order',
      key: 'rank_order',
      width: 80,
      align: 'center',
      sorter: (a, b) => a.rank_order - b.rank_order,
      defaultSortOrder: 'ascend',
      render: (rank) => (
        <div className={styles.rankBadge}>{rank}</div>
      ),
    },
    {
      title: '币种代码',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 150,
      render: (symbol) => (
        <span className={styles.symbolName}>{symbol}</span>
      ),
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150,
    },
    {
      title: '订阅周期',
      dataIndex: 'subscription_intervals',
      key: 'subscription_intervals',
      render: (intervals: string[]) => (
        <Space size={[0, 4]} wrap>
          {intervals?.map((interval) => (
            <Tag key={interval} color="blue">
              {symbolConfigUtils.formatInterval(interval)}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      align: 'center',
      filters: [
        { text: '已启用', value: true },
        { text: '已禁用', value: false },
      ],
      onFilter: (value, record) => record.enabled === value,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggle(record, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time) => formatTime(time),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (time) => formatTime(time),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 构建统计卡片
  const statsCards: StatusCardProps[] = statistics
    ? [
        {
          icon: '📊',
          label: '总币种数',
          value: statistics.total_symbols.toString(),
          status: 'healthy',
        },
        {
          icon: '✅',
          label: '已启用',
          value: statistics.enabled_symbols.toString(),
          status: 'healthy',
        },
        {
          icon: '⏸️',
          label: '已禁用',
          value: statistics.disabled_symbols.toString(),
          status: statistics.disabled_symbols > 0 ? 'warning' : 'healthy',
        },
        {
          icon: '🔄',
          label: '订阅流',
          value: statistics.total_streams.toString(),
          status: 'healthy',
        },
      ]
    : [];

  if (loading) {
    return (
      <div className={styles.symbolConfig}>
        <PageHeader title="币种配置" subtitle="管理交易币种和订阅配置" icon="⚙️" />
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
        </div>
      </div>
    );
  }

  if (error && (!symbols || symbols.length === 0)) {
    return (
      <div className={styles.symbolConfig}>
        <PageHeader title="币种配置" subtitle="管理交易币种和订阅配置" icon="⚙️" />
        <div className={styles.error}>
          <div className={styles.errorContent}>
            <div className={styles.errorIcon}>⚠️</div>
            <div className={styles.errorText}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.symbolConfig}>
      <PageHeader title="币种配置" subtitle="管理交易币种和订阅配置" icon="⚙️">
        <CoolRefreshButton onClick={handleRefresh} loading={isRefreshing} size="small" iconOnly />
      </PageHeader>

      {/* 统计概览 */}
      {statistics && <StatusOverview cards={statsCards} />}

      {/* 操作栏 */}
      <div className={styles.actionsBar}>
        <div className={styles.leftActions}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAddModal}
          >
            添加币种
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isRefreshing}>
            刷新
          </Button>
        </div>
        <div className={styles.rightActions}>
          <span className={styles.totalCount}>
            共 {symbols?.length || 0} 个币种
          </span>
        </div>
      </div>

      {/* 币种表格 */}
      <div className={styles.tableContainer}>
        <Table
          columns={columns}
          dataSource={symbols}
          rowKey="id"
          loading={isRefreshing}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📭</div>
                <div className={styles.emptyTitle}>暂无币种配置</div>
                <div className={styles.emptyDescription}>点击上方"添加币种"按钮开始配置</div>
              </div>
            ),
          }}
        />
      </div>

      {/* 添加/编辑表单弹窗 */}
      <SymbolFormModal
        visible={modalVisible}
        mode={modalMode}
        initialData={editingSymbol}
        maxRankOrder={symbols.reduce((max, s) => Math.max(max, s.rank_order), 0)}
        onOk={handleFormSubmit}
        onCancel={handleModalCancel}
      />
    </div>
  );
};

export default SymbolConfig;
