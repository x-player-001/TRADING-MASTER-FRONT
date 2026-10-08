import type { LiveTradeStatus } from '../../services/liveTradingAPI';

export const liveStatusColor = (s: LiveTradeStatus): string =>
  ({
    placing: 'gold',
    pending: 'gold',
    entering: 'processing',
    open: 'processing',
    closing: 'processing',
    closed: 'default',
    cancelled: 'default',
    skipped: 'default',
    shadow: 'purple',
    error: 'error',
  })[s] ?? 'default';
