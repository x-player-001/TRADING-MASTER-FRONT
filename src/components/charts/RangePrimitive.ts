/**
 * 区间范围框自定义图元
 * 使用 lightweight-charts v5 Custom Primitives API
 * 绘制透明矩形框来表示支撑/阻力区间
 */

import {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts';

export interface RangeData {
  support: number;      // 支撑价格
  resistance: number;   // 阻力价格
  middle: number;       // 中轨价格
  startTime?: Time;     // 区间开始时间（可选）
  endTime?: Time;       // 区间结束时间（可选）
}

export interface RangePrimitiveOptions {
  supportColor?: string;      // 支撑线颜色
  resistanceColor?: string;   // 阻力线颜色
  middleColor?: string;       // 中轨线颜色
  fillColor?: string;         // 填充颜色
  fillOpacity?: number;       // 填充透明度 0-1
  lineWidth?: number;         // 线宽
  showMiddle?: boolean;       // 是否显示中轨
}

/**
 * 区间范围框图元类
 */
export class RangePrimitive implements ISeriesPrimitive<Time> {
  private _data: RangeData;
  private _options: Required<RangePrimitiveOptions>;
  private _series: SeriesAttachedParameter<Time> | null = null;

  constructor(data: RangeData, options?: RangePrimitiveOptions) {
    this._data = data;
    this._options = {
      supportColor: options?.supportColor ?? '#2196F3',
      resistanceColor: options?.resistanceColor ?? '#F44336',
      middleColor: options?.middleColor ?? '#9E9E9E',
      fillColor: options?.fillColor ?? '#3B82F6',
      fillOpacity: options?.fillOpacity ?? 0.1,
      lineWidth: options?.lineWidth ?? 2,
      showMiddle: options?.showMiddle ?? true,
    };
  }

  /**
   * 更新数据
   */
  updateData(data: RangeData): void {
    this._data = data;
  }

  /**
   * 附加到系列时调用
   */
  attached(param: SeriesAttachedParameter<Time>): void {
    this._series = param;
    // 注意：不要在attached中调用requestUpdate()，会导致无限循环
    // lightweight-charts会自动处理更新
  }

  /**
   * 从系列分离时调用
   */
  detached(): void {
    this._series = null;
  }

  /**
   * 更新所有视图
   */
  updateAllViews(): void {
    // 注意：不要在updateAllViews中调用requestUpdate()，会导致无限循环
    // 如果需要更新数据，应该在外部调用updateData()后让图表库自动处理更新
  }

  /**
   * 创建价格轴视图（显示价格标签）
   */
  priceAxisViews(): readonly any[] {
    const self = this;
    return [
      // 阻力位标签
      {
        coordinate(): number {
          if (!self._series) return 0;
          return self._series.series.priceToCoordinate(self._data.resistance) ?? 0;
        },
        text(): string {
          return self._data.resistance.toFixed(2);
        },
        textColor(): string {
          return '#FFFFFF';
        },
        backColor(): string {
          return self._options.fillColor;
        },
      },
      // 支撑位标签
      {
        coordinate(): number {
          if (!self._series) return 0;
          return self._series.series.priceToCoordinate(self._data.support) ?? 0;
        },
        text(): string {
          return self._data.support.toFixed(2);
        },
        textColor(): string {
          return '#FFFFFF';
        },
        backColor(): string {
          return self._options.fillColor;
        },
      },
    ];
  }

  /**
   * 创建时间轴视图（不需要）
   */
  timeAxisViews(): readonly any[] {
    return [];
  }

  /**
   * 创建面板视图（主绘制逻辑）
   */
  paneViews(): readonly any[] {
    const self = this;
    return [
      {
        zOrder(): 'bottom' | 'normal' | 'top' {
          return 'bottom'; // 在K线下方绘制
        },
        renderer(): any {
          return {
            draw(target: any): void {
              if (!self._series) {
                console.warn('[RangePrimitive] No series attached');
                return;
              }

              const series = self._series.series;
              const timeScale = self._series.chart.timeScale();

              // 获取画布上下文和尺寸
              const ctx = target._context as CanvasRenderingContext2D;
              const width = target._bitmapSize.width;
              const height = target._bitmapSize.height;

              if (width === 0 || height === 0) {
                console.warn('[RangePrimitive] Canvas size is 0');
                return;
              }

              // 将价格转换为像素坐标
              const resistanceY = series.priceToCoordinate(self._data.resistance);
              const supportY = series.priceToCoordinate(self._data.support);

              if (resistanceY === null || supportY === null) {
                console.warn('[RangePrimitive] Invalid Y coordinates');
                return;
              }

              // 计算矩形的左右边界
              let startX = 0;
              let endX = width;

              // 如果有起始时间和结束时间，转换为像素坐标
              if (self._data.startTime !== undefined) {
                const startCoord = timeScale.timeToCoordinate(self._data.startTime);
                if (startCoord !== null) {
                  startX = startCoord;
                } else {
                  // 如果起始时间超出范围，从左边界开始
                  startX = 0;
                }
              }

              if (self._data.endTime !== undefined) {
                const endCoord = timeScale.timeToCoordinate(self._data.endTime);
                if (endCoord !== null) {
                  endX = endCoord;
                } else {
                  // 如果结束时间超出可见范围，限制到可见区域的右边界
                  // 获取时间轴的可见范围
                  const visibleRange = timeScale.getVisibleRange();
                  if (visibleRange && visibleRange.to !== null) {
                    const visibleEndCoord = timeScale.timeToCoordinate(visibleRange.to);
                    if (visibleEndCoord !== null) {
                      endX = visibleEndCoord;
                    }
                  }
                }
              }

              const rectWidth = endX - startX;
              const rectHeight = Math.abs(resistanceY - supportY);
              const rectY = Math.min(resistanceY, supportY);

              ctx.save();

              // 绘制填充矩形（透明背景）
              ctx.fillStyle = self._hexToRgba(self._options.fillColor, self._options.fillOpacity);
              ctx.fillRect(startX, rectY, rectWidth, rectHeight);

              // 绘制上下边框线（实线）
              ctx.strokeStyle = self._options.fillColor;
              ctx.lineWidth = 2;
              ctx.setLineDash([]);

              // 上边框（阻力位）
              ctx.beginPath();
              ctx.moveTo(startX, resistanceY);
              ctx.lineTo(endX, resistanceY);
              ctx.stroke();

              // 下边框（支撑位）
              ctx.beginPath();
              ctx.moveTo(startX, supportY);
              ctx.lineTo(endX, supportY);
              ctx.stroke();

              ctx.restore();
            },
          };
        },
      },
    ];
  }


  /**
   * 将十六进制颜色转换为 rgba
   */
  private _hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

/**
 * 创建区间范围框图元的工厂函数
 */
export function createRangePrimitive(
  data: RangeData,
  options?: RangePrimitiveOptions
): RangePrimitive {
  return new RangePrimitive(data, options);
}
