/**
 * Signal配置编辑器 - Panel 4
 */

import React from 'react';
import { Button, Card, Select, Input, InputNumber, Form } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { CZSCSignalConfig } from '../../types/strategy';
import styles from './SignalConfigEditor.module.scss';

interface SignalConfigEditorProps {
  signals: CZSCSignalConfig[];
  onChange: (signals: CZSCSignalConfig[]) => void;
}

// 常用信号函数配置
const signalFunctionTemplates = [
  {
    name: 'czsc.signals.cxt.cxt_bi_base_V230228',
    display_name: '笔方向基础',
    defaultParams: { bi_init_length: 9 }
  },
  {
    name: 'czsc.signals.cxt.cxt_first_bs_V230228',
    display_name: '缠论一买一卖',
    defaultParams: {}
  },
  {
    name: 'czsc.signals.cxt.cxt_second_bs_V230228',
    display_name: '缠论二买二卖',
    defaultParams: {}
  },
  {
    name: 'czsc.signals.cxt.cxt_third_bs_V230318',
    display_name: '缠论三买三卖',
    defaultParams: {}
  },
  {
    name: 'czsc.signals.bar.bar_macd_V230101',
    display_name: 'MACD指标',
    defaultParams: { fast: 12, slow: 26, signal: 9 }
  },
  {
    name: 'czsc.signals.vol.vol_ma_V230101',
    display_name: '成交量均线',
    defaultParams: { timeperiod: 20 }
  }
];

const SignalConfigEditor: React.FC<SignalConfigEditorProps> = ({ signals, onChange }) => {
  // 添加信号函数
  const handleAddSignal = () => {
    const newSignal: CZSCSignalConfig = {
      name: signalFunctionTemplates[0].name,
      freq: '15m',
      ...signalFunctionTemplates[0].defaultParams
    };

    onChange([...signals, newSignal]);
  };

  // 删除信号函数
  const handleDeleteSignal = (index: number) => {
    const updated = signals.filter((_, i) => i !== index);
    onChange(updated);
  };

  // 更新信号函数
  const handleUpdateSignal = (index: number, updates: Partial<CZSCSignalConfig>) => {
    const updated = [...signals];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  // 切换信号函数模板
  const handleChangeSignalTemplate = (index: number, templateName: string) => {
    const template = signalFunctionTemplates.find(t => t.name === templateName);
    if (!template) return;

    // 保留freq，替换其他参数
    const currentFreq = signals[index].freq;
    handleUpdateSignal(index, {
      name: template.name,
      freq: currentFreq,
      ...template.defaultParams
    });
  };

  // 渲染参数输入
  const renderParamInputs = (signal: CZSCSignalConfig, index: number) => {
    const params = Object.keys(signal).filter(key => key !== 'name' && key !== 'freq');

    if (params.length === 0) {
      return <div className={styles.noParams}>此信号函数无需额外参数</div>;
    }

    return (
      <div className={styles.paramsList}>
        {params.map(paramKey => (
          <div key={paramKey} className={styles.paramItem}>
            <label>{paramKey}:</label>
            <InputNumber
              value={signal[paramKey] as number}
              onChange={(value) => handleUpdateSignal(index, { [paramKey]: value })}
              size="small"
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.signalConfigEditor}>
      {signals.length === 0 ? (
        <div className={styles.empty}>
          <p>还没有配置信号函数</p>
          <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddSignal}>
            添加第一个信号函数
          </Button>
        </div>
      ) : (
        <div className={styles.signalList}>
          {signals.map((signal, index) => (
            <Card key={index} className={styles.signalCard} size="small">
              <div className={styles.signalHeader}>
                <span className={styles.index}>Signal {index + 1}</span>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteSignal(index)}
                >
                  删除
                </Button>
              </div>

              <div className={styles.signalContent}>
                <Form layout="vertical" size="small">
                  <Form.Item label="信号函数">
                    <Select
                      value={signal.name}
                      onChange={(value) => handleChangeSignalTemplate(index, value)}
                      options={signalFunctionTemplates.map(t => ({
                        label: `${t.display_name} (${t.name})`,
                        value: t.name
                      }))}
                    />
                  </Form.Item>

                  <Form.Item label="周期">
                    <Select
                      value={signal.freq}
                      onChange={(value) => handleUpdateSignal(index, { freq: value })}
                      options={[
                        { label: '1分钟', value: '1m' },
                        { label: '5分钟', value: '5m' },
                        { label: '15分钟', value: '15m' },
                        { label: '30分钟', value: '30m' },
                        { label: '1小时', value: '1h' },
                        { label: '4小时', value: '4h' },
                        { label: '1天', value: '1d' }
                      ]}
                    />
                  </Form.Item>

                  <Form.Item label="函数参数">
                    {renderParamInputs(signal, index)}
                  </Form.Item>
                </Form>

                <div className={styles.preview}>
                  <div className={styles.previewLabel}>生成的信号预览:</div>
                  <div className={styles.previewContent}>
                    根据此函数配置，将生成对应周期的技术指标信号
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={handleAddSignal}
            className={styles.addButton}
          >
            添加信号函数
          </Button>
        </div>
      )}

      <div className={styles.hint}>
        💡 <strong>提示:</strong> 信号函数定义了技术指标的计算方式，配置的信号函数会生成相应的信号供Factor使用
      </div>
    </div>
  );
};

export default SignalConfigEditor;
