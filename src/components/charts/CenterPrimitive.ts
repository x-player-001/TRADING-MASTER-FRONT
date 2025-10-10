/**
 * 缠论中枢矩形自定义图元
 * 用于在K线图上绘制中枢区域（支撑位-阻力位矩形框）
 * 基于 lightweight-charts Custom Primitives API
 */

import {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  ISeriesPrimitivePaneView,
} from 'lightweight-charts';

// ============= 数据接口 =============

export interface CenterPrimitiveData {
  high: number;           // 中枢上沿(阻力位)
  low: number;            // 中枢下沿(支撑位)
  middle: number;         // 中枢中轴
  startTime?: Time;       // 开始时间
  endTime?: Time;         // 结束时间
  isActive?: boolean;     // 是否活跃
  strength?: number;      // 强度 0-100
}

export interface CenterPrimitiveOptions {
  fillColor?: string;           // 填充颜色
  borderColor?: string;         // 边框颜色
  upperLineColor?: string;      // 上沿线颜色
  lowerLineColor?: string;      // 下沿线颜色
  middleLineColor?: string;     // 中轴线颜色
  lineWidth?: number;           // 线宽
  fillOpacity?: number;         // 填充透明度
  showMiddleLine?: boolean;     // 是否显示中轴线
}

// ============= Custom Primitive 实现 =============

export class CenterPrimitive implements ISeriesPrimitive<Time> {
  private _data: CenterPrimitiveData;
  private _options: Required<CenterPrimitiveOptions>;
  private _series: SeriesAttachedParameter<Time> | null = null;

  constructor(data: CenterPrimitiveData, options: CenterPrimitiveOptions = {}) {
    this._data = data;
    this._options = {
      fillColor: options.fillColor ?? (data.isActive ? 'rgba(255, 193, 7, 0.15)' : 'rgba(96, 125, 139, 0.08)'),
      borderColor: options.borderColor ?? (data.isActive ? 'rgba(255, 193, 7, 0.6)' : 'rgba(96, 125, 139, 0.4)'),
      upperLineColor: options.upperLineColor ?? '#F59E0B',
      lowerLineColor: options.lowerLineColor ?? '#10B981',
      middleLineColor: options.middleLineColor ?? '#6B7280',
      lineWidth: options.lineWidth ?? 1,
      fillOpacity: options.fillOpacity ?? 0.15,
      showMiddleLine: options.showMiddleLine ?? true,
    };
  }

  /**
   * 更新数据
   */
  updateData(data: Partial<CenterPrimitiveData>): void {
    this._data = { ...this._data, ...data };
    this.updateAllViews();
  }

  /**
   * paneViews - 返回绘制视图
   */
  paneViews(): readonly ISeriesPrimitivePaneView[] {
    const self = this;

    return [
      {
        zOrder(): 'bottom' | 'normal' | 'top' {
          return 'bottom'; // 绘制在K线下方
        },

        renderer(): any {
          return {
            draw(target: any): void {
              if (!self._series) return;

              const ctx = target._context as CanvasRenderingContext2D;
              if (!ctx) return;

              const width = target._bitmapSize?.width || 0;
              const height = target._bitmapSize?.height || 0;

              if (width === 0 || height === 0) return;

              const series = self._series.series;
              const timeScale = self._series.chart.timeScale();

              // 计算价格对应的Y坐标
              const upperY = series.priceToCoordinate(self._data.high);
              const lowerY = series.priceToCoordinate(self._data.low);
              const middleY = series.priceToCoordinate(self._data.middle);

              if (upperY === null || lowerY === null || middleY === null) return;

              // 计算时间对应的X坐标
              let startX = 0;
              let endX = width;

              if (self._data.startTime !== undefined) {
                const startCoord = timeScale.timeToCoordinate(self._data.startTime);
                if (startCoord !== null) {
                  startX = startCoord;
                }
              }

              if (self._data.endTime !== undefined) {
                const endCoord = timeScale.timeToCoordinate(self._data.endTime);
                if (endCoord !== null) {
                  endX = endCoord;
                } else {
                  // 结束时间超出可见范围，使用可见区域右边界
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
              const rectHeight = lowerY - upperY;

              // 绘制填充矩形
              ctx.fillStyle = self._options.fillColor;
              ctx.fillRect(startX, upperY, rectWidth, rectHeight);

              // 绘制边框
              ctx.strokeStyle = self._options.borderColor;
              ctx.lineWidth = self._options.lineWidth;
              ctx.strokeRect(startX, upperY, rectWidth, rectHeight);

              // 绘制上沿线（阻力位）
              ctx.strokeStyle = self._options.upperLineColor;
              ctx.lineWidth = self._options.lineWidth + 1;
              ctx.beginPath();
              ctx.moveTo(startX, upperY);
              ctx.lineTo(endX, upperY);
              ctx.stroke();

              // 绘制下沿线（支撑位）
              ctx.strokeStyle = self._options.lowerLineColor;
              ctx.lineWidth = self._options.lineWidth + 1;
              ctx.beginPath();
              ctx.moveTo(startX, lowerY);
              ctx.lineTo(endX, lowerY);
              ctx.stroke();

              // 绘制中轴线
              if (self._options.showMiddleLine) {
                ctx.strokeStyle = self._options.middleLineColor;
                ctx.lineWidth = self._options.lineWidth;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(startX, middleY);
                ctx.lineTo(endX, middleY);
                ctx.stroke();
                ctx.setLineDash([]);
              }
            },
          };
        },
      },
    ];
  }

  /**
   * priceAxisViews - 价格轴标签
   */
  priceAxisViews(): readonly any[] {
    const self = this;

    return [
      // 上沿（阻力位）标签
      {
        coordinate(): number {
          if (!self._series) return 0;
          const y = self._series.series.priceToCoordinate(self._data.high);
          return y ?? 0;
        },
        text(): string {
          return `阻 ${self._data.high.toFixed(2)}`;
        },
        textColor(): string {
          return '#FFFFFF';
        },
        backColor(): string {
          return self._options.upperLineColor;
        },
      },
      // 下沿（支撑位）标签
      {
        coordinate(): number {
          if (!self._series) return 0;
          const y = self._series.series.priceToCoordinate(self._data.low);
          return y ?? 0;
        },
        text(): string {
          return `撑 ${self._data.low.toFixed(2)}`;
        },
        textColor(): string {
          return '#FFFFFF';
        },
        backColor(): string {
          return self._options.lowerLineColor;
        },
      },
      // 中轴标签
      {
        coordinate(): number {
          if (!self._series) return 0;
          const y = self._series.series.priceToCoordinate(self._data.middle);
          return y ?? 0;
        },
        text(): string {
          return `中 ${self._data.middle.toFixed(2)}`;
        },
        textColor(): string {
          return '#FFFFFF';
        },
        backColor(): string {
          return self._options.middleLineColor;
        },
      },
    ];
  }

  /**
   * timeAxisViews - 时间轴标签（可选）
   */
  timeAxisViews(): readonly any[] {
    return [];
  }

  /**
   * attached - 图元附加到series时调用
   */
  attached(param: SeriesAttachedParameter<Time>): void {
    this._series = param;
  }

  /**
   * detached - 图元从series分离时调用
   */
  detached(): void {
    this._series = null;
  }

  /**
   * updateAllViews - 请求重绘（内部调用）
   */
  updateAllViews(): void {
    // lightweight-charts 会自动处理重绘，不需要手动调用 requestUpdate
  }
}

/**
 * 创建中枢图元的工厂函数
 */
export function createCenterPrimitive(
  data: CenterPrimitiveData,
  options?: CenterPrimitiveOptions
): CenterPrimitive {
  return new CenterPrimitive(data, options);
}
