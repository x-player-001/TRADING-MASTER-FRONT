import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// A股选股API基础配置
const ASTOCK_API_BASE_URL = import.meta.env.VITE_ASTOCK_API_URL || 'http://118.194.233.95:8000';

// 创建独立的axios实例（不复用apiClient，因为是独立后端服务）
const astockApiClient: AxiosInstance = axios.create({
  baseURL: ASTOCK_API_BASE_URL,
  timeout: 15000, // 15秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
astockApiClient.interceptors.request.use(
  (config) => {
    console.log(`📈 A股API请求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: AxiosError) => {
    console.error('❌ A股请求配置错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
astockApiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ A股API响应: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    // FastAPI 直接返回数据，无需解包
    return response.data;
  },
  (error: AxiosError) => {
    console.error(`❌ A股API错误: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error);

    let errorMessage = 'A股选股服务请求失败';

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 400:
          errorMessage = data?.detail || '请求参数错误';
          break;
        case 404:
          errorMessage = data?.detail || '资源不存在';
          break;
        case 422:
          errorMessage = data?.detail || '参数验证失败';
          break;
        case 500:
          errorMessage = data?.detail || '服务器内部错误';
          break;
        default:
          errorMessage = data?.detail || `HTTP错误: ${status}`;
      }
    } else if (error.request) {
      errorMessage = 'A股选股服务连接超时，请检查服务是否可用';
    } else {
      errorMessage = error.message || '请求配置错误';
    }

    const customError = new Error(errorMessage);
    customError.name = 'AStockAPIError';
    return Promise.reject(customError);
  }
);

export default astockApiClient;

// 便捷方法
export const astockGet = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return astockApiClient.get(url, config);
};

// 导出配置常量
export { ASTOCK_API_BASE_URL };
