// 统一导出所有API服务

// K线数据服务
export { default as apiClient, apiGet, apiPost, apiPut, apiDelete, apiPatch, API_BASE_URL } from './apiClient';
export { oiAPI, default as OIAPIService } from './oiAPI';
export { monitoringAPI, default as MonitoringAPIService } from './monitoringAPI';
export { marketAPI } from './marketAPI';
export { symbolConfigAPI } from './symbolConfigAPI';
export { klineAPI } from './klineAPI';
export { signalAPI } from './signalAPI';
export { structureAPI } from './structureAPI';
export { chanAPI } from './chanAPI';
export { historicalAPI } from './historicalAPI';

// CZSC回测系统服务 (http://localhost:8000)
export { default as czscApiClient, czscApiGet, czscApiPost, czscApiPut, czscApiDelete, CZSC_API_BASE_URL } from './czscApiClient';
export { czscBacktestAPI } from './czscBacktestAPI';
export { czscAnalyzeAPI } from './czscAnalyzeAPI';
export { czscStrategyAPI } from './czscStrategyAPI';