/**
 * 币种选择器组件
 * 支持从TOP币种列表中选择交易对
 */

import React, { useEffect, useState } from 'react';
import { Select } from 'antd';
import { useKlineStore } from '../../stores/klineStore';
import { klineAPI } from '../../services/klineAPI';
import styles from './SymbolSelector.module.scss';

const { Option } = Select;

interface SymbolOption {
  symbol: string;
  display_name: string;
  rank_order: number;
}

interface SymbolSelectorProps {
  onChange?: (symbol: string) => void;
}

const SymbolSelector: React.FC<SymbolSelectorProps> = ({ onChange }) => {
  const { selectedSymbol, setSymbol } = useKlineStore();
  const [symbols, setSymbols] = useState<SymbolOption[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * 获取TOP币种列表
   */
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        setLoading(true);
        const response = await klineAPI.getTopSymbolsOverview('1m', 20);

        // 转换为选项格式
        const options: SymbolOption[] = response.overview.map((item) => ({
          symbol: item.symbol,
          display_name: item.display_name,
          rank_order: item.rank_order,
        }));

        setSymbols(options);
      } catch (error) {
        console.error('Failed to fetch symbols:', error);
        // 失败时使用默认币种列表
        setSymbols([
          { symbol: 'BTCUSDT', display_name: 'Bitcoin', rank_order: 1 },
          { symbol: 'ETHUSDT', display_name: 'Ethereum', rank_order: 2 },
          { symbol: 'BNBUSDT', display_name: 'BNB', rank_order: 3 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSymbols();
  }, []);

  /**
   * 处理币种切换
   */
  const handleSymbolChange = (value: string) => {
    setSymbol(value);
    onChange?.(value);
  };

  return (
    <div className={styles.symbolSelector}>
      <Select
        value={selectedSymbol}
        onChange={handleSymbolChange}
        loading={loading}
        placeholder="选择交易对"
        className={styles.select}
        showSearch
        filterOption={(input, option) =>
          (option?.children as unknown as string)
            .toLowerCase()
            .includes(input.toLowerCase())
        }
        size="large"
      >
        {symbols.map((item) => (
          <Option key={item.symbol} value={item.symbol}>
            {item.symbol}
          </Option>
        ))}
      </Select>
    </div>
  );
};

export default SymbolSelector;
