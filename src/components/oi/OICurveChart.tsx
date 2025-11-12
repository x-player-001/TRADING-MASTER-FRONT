import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Brush } from 'recharts';
import { Modal, DatePicker, Spin } from 'antd';
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
        timestamp: point.timestamp
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
        </div>
      );
    }
    return null;
  };


  return (
    <Modal
      title={
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
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
      onCancel={onClose}
      width={1000}
      footer={null}
      centered
      className={styles.curveModal}
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
            <div className={styles.chartStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>数据点数:</span>
                <span className={styles.statValue}>{curveData?.count || 0}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>日期:</span>
                <span className={styles.statValue}>{curveData?.date}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>最新OI:</span>
                <span className={styles.statValue}>
                  {chartData[chartData.length - 1]?.oi.toLocaleString() || '--'}
                </span>
              </div>
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

            {/* Recharts图表 */}
            <ResponsiveContainer width="100%" height={450}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 50 }}
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
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickFormatter={(value) => value.toLocaleString()}
                  scale="log"
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />

                <Line
                  type="monotone"
                  dataKey="oi"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, fill: '#3B82F6' }}
                />

                {anomalyMarkers.firstIndex !== null && chartData[anomalyMarkers.firstIndex] && (
                  <ReferenceDot
                    x={chartData[anomalyMarkers.firstIndex].index}
                    y={chartData[anomalyMarkers.firstIndex].oi}
                    r={4}
                    fill="#EF4444"
                    isFront={true}
                  />
                )}

                {anomalyMarkers.lastIndex !== null &&
                 anomalyMarkers.lastIndex !== anomalyMarkers.firstIndex &&
                 chartData[anomalyMarkers.lastIndex] && (
                  <ReferenceDot
                    x={chartData[anomalyMarkers.lastIndex].index}
                    y={chartData[anomalyMarkers.lastIndex].oi}
                    r={4}
                    fill="#F59E0B"
                    isFront={true}
                  />
                )}

                <Brush
                  dataKey="time"
                  height={30}
                  stroke="#3B82F6"
                  fill="#1f2937"
                  travellerWidth={10}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </Modal>
  );
};

export default OICurveChart;
