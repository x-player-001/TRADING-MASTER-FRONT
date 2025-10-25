/**
 * 链上数据类型定义
 * 对应后端 Blockchain Data API
 */

// DexScreener代币信息
export interface DexScreenerToken {
  id: string;
  chain_id: string;
  dex_id: string;
  pair_address: string;
  base_token_address: string;
  base_token_name: string;
  base_token_symbol: string;
  quote_token_address: string;
  quote_token_symbol: string;
  price_native: number;
  price_usd: number;
  volume_h24: number;
  volume_h6: number;
  volume_h1: number;
  txns_h24_buys: number;
  txns_h24_sells: number;
  price_change_h24: number;
  price_change_h6: number;
  price_change_h1: number;
  liquidity_usd: number;
  market_cap: number;
  fdv: number;
  dexscreener_url?: string;
  image_url?: string;
  website_url?: string;
  twitter_url?: string;
  telegram_url?: string;
  labels?: string;
  pair_created_at: number; // 毫秒时间戳
  created_at: string;
  updated_at: string;
}

// 保留旧的Token接口用于兼容
export interface Token {
  id: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
  data_source: string;
  created_at: string;
  updated_at: string;
  // 市场数据
  price_usd?: number;
  market_cap?: number;
  liquidity_usd?: number;
  volume_24h?: number;
  price_change_24h?: number;
  holders_count?: number;
  metrics_updated_at?: string;
  pair_address?: string; // DEX交易对地址
  pair_created_at?: string; // 交易对创建时间
}

// 代币列表响应（分页）
export interface TokenListResponse {
  total: number;
  page: number;
  page_size: number;
  data: Token[];
}

// DexScreener代币列表响应
export interface DexScreenerTokenListResponse {
  total: number;
  page: number;
  page_size: number;
  data: DexScreenerToken[];
}

// OHLCV K线数据
export interface OHLCV {
  token_id: string;
  token_address: string;
  timestamp: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  interval: string;
}

// 数据源统计
export interface SourceStats {
  source: string;
  token_count: number;
  ohlcv_count: number;
}

// 统计信息响应
export interface StatsResponse {
  total_tokens: number;
  total_ohlcv: number;
  sources: SourceStats[];
  updated_at: string;
}

// 健康检查响应
export interface HealthResponse {
  status: string;
  timestamp: string;
}

// 搜索响应（复用TokenListResponse）
export type SearchResponse = TokenListResponse;

// API查询参数
export interface TokenListParams {
  page?: number;
  page_size?: number;
  data_source?: string;
  min_market_cap?: number;
  symbol?: string;
}

// DexScreener查询参数
export interface DexScreenerTokenListParams {
  page?: number;
  page_size?: number;
  chain_id?: string;
  dex_id?: string;
  min_liquidity?: number;
  min_market_cap?: number;
  symbol?: string;
  sort_by?: 'market_cap' | 'liquidity_usd' | 'volume_h24' | 'price_change_h24';
  sort_order?: 'asc' | 'desc';
}

export interface OHLCVParams {
  interval?: string;
  limit?: number;
}

export interface SearchParams {
  q: string;
  page?: number;
  page_size?: number;
}

// ==================== 潜力代币 API ====================

// 潜力代币信息（匹配后端实际返回字段）
export interface PotentialToken {
  id: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  dex_id: string;
  pair_address: string;
  amm: string;

  // 抓取时的数据
  scraped_price_usd: number;
  scraped_timestamp: string;
  market_cap_at_scrape: number | null;
  liquidity_at_scrape: number | null;
  volume_24h_at_scrape: number | null;
  price_change_24h_at_scrape: number | null;

  // 当前数据
  current_price_usd: number;
  price_ath_usd: number;
  current_tvl: number;
  current_market_cap: number | null;

  // 时间信息
  token_created_at: string | null;
  first_trade_at: string | null;
  last_ave_update: string;

  // 价格变化
  price_change_1m: number | null;
  price_change_5m: number | null;
  price_change_15m: number | null;
  price_change_1h: number | null;
  price_change_24h: number | null;

  // 交易量
  volume_1m: number | null;
  volume_5m: number | null;
  volume_1h: number | null;
  volume_24h: number | null;

  // 交易次数
  buys_1m: number | null;
  sells_1m: number | null;
  buys_5m: number | null;
  sells_5m: number | null;
  buys_1h: number | null;
  sells_1h: number | null;
  buys_24h: number | null;
  sells_24h: number | null;
}

// 潜力代币列表响应
export interface PotentialTokenListResponse {
  total: number;
  data: PotentialToken[];
}

// 潜力代币查询参数
export interface PotentialTokenParams {
  limit?: number;
  offset?: number;
  only_not_added?: boolean;
}

// 添加到监控的请求参数
export interface AddToMonitorRequest {
  potential_token_id: string;
  drop_threshold_percent?: number;
}

// ==================== 价格报警 API ====================

// 价格报警信息
export interface PriceAlert {
  id: string;
  token_symbol: string;
  token_address: string;
  alert_type: string;
  triggered_at: string;
  trigger_price_usd: number;
  peak_price_usd: number;
  entry_price_usd: number;
  drop_from_peak_percent: number;
  drop_from_entry_percent: number;
  message: string;
  severity: string; // 'critical' | 'warning' | 'info'
  acknowledged: boolean;
}

// 价格报警列表响应
export interface PriceAlertListResponse {
  total: number;
  data: PriceAlert[];
}

// 价格报警查询参数
export interface PriceAlertParams {
  limit?: number;
  acknowledged?: boolean | null;
  severity?: string | null;
}

// ==================== 监控代币 API ====================

// 监控代币信息（完整60个字段）
export interface MonitorToken {
  id: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  dex_id: string;
  pair_address: string;
  amm: string;

  // 价格信息
  entry_price_usd: number;
  current_price_usd: number;
  peak_price_usd: number;
  price_ath_usd: number;
  open_price_24h: number;
  price_24h_high: number;
  price_24h_low: number;

  // 时间信息
  entry_timestamp: string;
  last_update_timestamp: string;
  peak_timestamp: string;
  token_created_at: string | null;
  first_trade_at: string | null;

  // 市场数据
  current_tvl: number;
  current_market_cap: number | null;
  market_cap_at_entry: number;
  liquidity_at_entry: number;
  volume_24h_at_entry: number;

  // 价格变化（百分比）
  price_change_24h_at_entry: number;
  price_change_1m: number;
  price_change_5m: number;
  price_change_15m: number;
  price_change_30m: number;
  price_change_1h: number;
  price_change_4h: number;
  price_change_24h: number;

  // 交易量
  volume_1m: number;
  volume_5m: number;
  volume_15m: number;
  volume_30m: number;
  volume_1h: number;
  volume_4h: number;
  volume_24h: number;

  // 交易次数
  tx_count_1m: number;
  tx_count_5m: number;
  tx_count_15m: number;
  tx_count_30m: number;
  tx_count_1h: number;
  tx_count_4h: number;
  tx_count_24h: number;

  // 买卖数据
  buys_24h: number;
  sells_24h: number;
  makers_24h: number;
  buyers_24h: number;
  sellers_24h: number;

  // 流动性池信息
  lp_holders: number;
  lp_locked_percent: number;
  lp_lock_platform: string;

  // 其他
  rusher_tx_count: number;
  sniper_tx_count: number;
  creation_block_number: number | null;
  creation_tx_hash: string | null;
  status: string;
  drop_threshold_percent: number;

  // 峰值相关指标
  drop_from_peak_percent: number; // 距峰值跌幅百分比
  multiplier_to_peak: number;     // 峰值倍数

  // 报警阈值
  alert_thresholds: number[]; // 报警阈值数组，例如 [70, 80, 90]
}

// 监控代币列表响应
export interface MonitorTokenListResponse {
  total: number;
  data: MonitorToken[];
}

// 监控代币查询参数
export interface MonitorTokenParams {
  limit?: number;
  offset?: number;
  status?: 'active' | 'inactive';
}

// ==================== 价格波动分析 API ====================

// 价格波动记录
export interface PriceSwing {
  id: string;
  token_id: string;
  token_symbol: string;
  token_name: string;
  swing_type: 'rise' | 'fall';
  swing_pct: number;
  start_time: string;
  end_time: string;
  duration_hours: number;
  start_price: number;
  end_price: number;
  min_swing_threshold: number;
  timeframe: string;
  created_at: string;
}

// 价格波动列表响应
export interface PriceSwingListResponse {
  total: number;
  page: number;
  page_size: number;
  data: PriceSwing[];
}

// 代币波动统计
export interface TokenSwingStats {
  token_id: string;
  token_symbol: string;
  token_name: string;
  total_swings: number;
  rises: number;
  falls: number;
  max_rise_pct: number;
  max_fall_pct: number;
  avg_duration_hours: number;
  current_price: number;
  liquidity_usd: number;
  market_cap: number;
}

// 代币波动统计列表响应
export interface TokenSwingStatsListResponse {
  total: number;
  page: number;
  page_size: number;
  data: TokenSwingStats[];
}

// 价格波动查询参数
export interface PriceSwingParams {
  page?: number;
  page_size?: number;
  token_id?: string;
  symbol?: string;
  swing_type?: 'rise' | 'fall';
  min_swing_pct?: number;
  sort_by?: 'start_time' | 'swing_pct' | 'duration_hours';
  sort_order?: 'asc' | 'desc';
}

// 代币波动统计查询参数
export interface TokenSwingStatsParams {
  page?: number;
  page_size?: number;
  min_swings?: number;
  min_liquidity?: number;
  sort_by?: 'total_swings' | 'max_rise_pct' | 'max_fall_pct' | 'liquidity_usd';
  sort_order?: 'asc' | 'desc';
}

// ==================== 爬虫配置 API ====================

// 爬虫配置信息
export interface ScraperConfig {
  top_n_per_chain: number;
  count_per_chain: number;
  scrape_interval_min: number;
  scrape_interval_max: number;
  enabled_chains: string;
  use_undetected_chrome: boolean;
  enabled: boolean;
}

// 更新爬虫配置请求参数
export interface UpdateScraperConfigRequest {
  top_n_per_chain?: number;
  count_per_chain?: number;
  scrape_interval_min?: number;
  scrape_interval_max?: number;
  enabled_chains?: string;
  use_undetected_chrome?: number;
  enabled?: number;
}

// ==================== 手动添加监控 API ====================

// 手动添加监控请求参数
export interface AddMonitorByPairRequest {
  pair_address: string;
  chain?: string;
  drop_threshold?: number;
  alert_thresholds?: string;
}
