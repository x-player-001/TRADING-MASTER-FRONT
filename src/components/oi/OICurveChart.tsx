import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Brush } from 'recharts';
import { Drawer, DatePicker, Spin } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { oiAPI } from '../../services/oiAPI';
import { OICurveData, OICurveDataPoint } from '../../types';
import styles from './OICurveChart.module.scss';

interface OICurveChartProps {
  visible: boolean;
  symbol: string;
  onClose: () => void;
  initialDate?: Dayjs | null;
  firstAnomalyTime?: string | null;
  lastAnomalyTime?: string | null;
}

interface ChartDataPoint {
  index: number;
  time: string;
  oi: number;
  timestamp: number;
  price?: number;
  fundingRate?: number;
}

const OICurveChart: React.FC<OICurveChartProps> = ({
  visible,
  symbol,
  onClose,
  initialDate,
  firstAnomalyTime,
  lastAnomalyTime
}) => {
  const [loading, setLoading] = useState(false);
  const [curveData, setCurveData] = useState<OICurveData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(initialDate || dayjs());
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // 当initialDate变化时更新selectedDate
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // 获取曲线数据
  const fetchCurveData = async () => {
    if (!symbol || !selectedDate) return;

    setLoading(true);
    try {
      const data = await oiAPI.getOICurve({
        symbol: symbol,
        date: selectedDate.format('YYYY-MM-DD')
      });
      setCurveData(data);

      // 转换数据格式供图表使用，添加索引作为唯一标识
      const formatted = data.curve.map((point: OICurveDataPoint, index: number) => ({
        index: index,
        time: new Date(point.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        oi: point.open_interest,
        timestamp: point.timestamp,
        price: point.mark_price,
        fundingRate: point.funding_rate ? point.funding_rate * 100 : undefined // 转换为百分比
      }));
      setChartData(formatted);
    } catch (error) {
      console.error('获取OI曲线数据失败:', error);
      setCurveData(null);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  // 当弹窗打开、币种或日期改变时获取数据
  useEffect(() => {
    if (visible && symbol) {
      fetchCurveData();
    }
  }, [visible, symbol, selectedDate]);

  // 计算异常时间点在图表上的位置（使用索引）
  const anomalyMarkers = useMemo(() => {
    if (!chartData.length) return { firstIndex: null, lastIndex: null };

    const markers: { firstIndex: number | null; lastIndex: number | null } = { firstIndex: null, lastIndex: null };

    if (firstAnomalyTime) {
      const firstTimestamp = new Date(firstAnomalyTime).getTime();
      let closestIndex = -1;
      let minDiff = Infinity;

      chartData.forEach((point, index) => {
        const diff = Math.abs(point.timestamp - firstTimestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = index;
        }
      });

      if (closestIndex >= 0 && minDiff < 30 * 60 * 1000) {
        markers.firstIndex = closestIndex;
      }
    }

    if (lastAnomalyTime && lastAnomalyTime !== firstAnomalyTime) {
      const lastTimestamp = new Date(lastAnomalyTime).getTime();
      let closestIndex = -1;
      let minDiff = Infinity;

      chartData.forEach((point, index) => {
        const diff = Math.abs(point.timestamp - lastTimestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = index;
        }
      });

      if (closestIndex >= 0 && minDiff < 30 * 60 * 1000) {
        markers.lastIndex = closestIndex;
      }
    }

    return markers;
  }, [chartData, firstAnomalyTime, lastAnomalyTime]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={styles.tooltip}>
          <div className={styles.tooltipTime}>{data.time}</div>
          <div className={styles.tooltipValue}>
            OI: {data.oi.toLocaleString()}
          </div>
          {data.price !== undefined && data.price !== null && (
            <div className={styles.tooltipValue}>
              价格: ${data.price.toFixed(6)}
            </div>
          )}
          {data.fundingRate !== undefined && data.fundingRate !== null && (
            <div className={styles.tooltipValue}>
              资金费率: {data.fundingRate.toFixed(4)}%
            </div>
          )}
        </div>
      );
    }
    return null;
  };


  return (
    <Drawer
      title={
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>
            📈 {symbol} OI变化曲线
          </span>
          <DatePicker
            value={selectedDate}
            onChange={(date) => date && setSelectedDate(date)}
            format="YYYY-MM-DD"
            allowClear={false}
            className={styles.datePicker}
          />
        </div>
      }
      open={visible}
      onClose={onClose}
      width="50%"
      placement="right"
      className={styles.curveDrawer}
    >
      <div className={styles.chartContainer}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <Spin size="large" tip="加载数据中..." />
          </div>
        ) : chartData.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📊</div>
            <div className={styles.emptyText}>暂无数据</div>
            <div className={styles.emptyHint}>
              请选择其他日期或稍后再试
            </div>
          </div>
        ) : (
          <>
            {/* 标题信息 - 一行显示 */}
            <div className={styles.chartStats}>
              {chartData[chartData.length - 1]?.price !== undefined &&
               chartData[chartData.length - 1]?.price !== null && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>最新价格:</span>
                  <span className={styles.statValue} style={{ color: '#10B981' }}>
                    ${chartData[chartData.length - 1].price!.toFixed(6)}
                  </span>
                </div>
              )}
              {chartData[chartData.length - 1]?.fundingRate !== undefined &&
               chartData[chartData.length - 1]?.fundingRate !== null && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>资金费率:</span>
                  <span className={styles.statValue} style={{ color: '#F59E0B' }}>
                    {chartData[chartData.length - 1].fundingRate!.toFixed(4)}%
                  </span>
                </div>
              )}
              {firstAnomalyTime && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>首次异常:</span>
                  <span className={styles.statValue} style={{ color: '#EF4444' }}>
                    {new Date(firstAnomalyTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {lastAnomalyTime && lastAnomalyTime !== firstAnomalyTime && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>最后异常:</span>
                  <span className={styles.statValue} style={{ color: '#F59E0B' }}>
                    {new Date(lastAnomalyTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>

            {/* 价格和持仓量合并图表 */}
            {chartData.some(d => d.price !== undefined && d.price !== null) && (
              <div className={styles.chartSection}>
                <h3 className={styles.chartTitle}>📊 价格 & 持仓量 (OI)</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="index"
                      stroke="#9CA3AF"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      interval="preserveStartEnd"
                      minTickGap={50}
                      tickFormatter={(index) => chartData[index]?.time || ''}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#10B981"
                      tick={false}
                      domain={['auto', 'auto']}
                      label={{ value: '价格', angle: -90, position: 'insideLeft', style: { fill: '#10B981' } }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#3B82F6"
                      tick={false}
                      scale="log"
                      domain={['auto', 'auto']}
                      label={{ value: 'OI', angle: 90, position: 'insideRight', style: { fill: '#3B82F6' } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="price"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: '#10B981' }}
                      name="价格"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="oi"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: '#3B82F6' }}
                      name="OI"
                    />
                    {anomalyMarkers.firstIndex !== null && chartData[anomalyMarkers.firstIndex] && (
                      <ReferenceDot
                        yAxisId="right"
                        x={chartData[anomalyMarkers.firstIndex].index}
                        y={chartData[anomalyMarkers.firstIndex].oi}
                        r={4}
                        fill="#EF4444"
                      />
                    )}
                    {anomalyMarkers.lastIndex !== null &&
                     anomalyMarkers.lastIndex !== anomalyMarkers.firstIndex &&
                     chartData[anomalyMarkers.lastIndex] && (
                      <ReferenceDot
                        yAxisId="right"
                        x={chartData[anomalyMarkers.lastIndex].index}
                        y={chartData[anomalyMarkers.lastIndex].oi}
                        r={4}
                        fill="#F59E0B"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 资金费率曲线图 */}
            {chartData.some(d => d.fundingRate !== undefined && d.fundingRate !== null) && (
              <div className={styles.chartSection}>
                <h3 className={styles.chartTitle}>📈 资金费率</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="index"
                      stroke="#9CA3AF"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      interval="preserveStartEnd"
                      minTickGap={50}
                      tickFormatter={(index) => chartData[index]?.time || ''}
                    />
                    <YAxis
                      stroke="#F59E0B"
                      tick={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="fundingRate"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: '#F59E0B' }}
                      name="资金费率"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
};

export default OICurveChart;
