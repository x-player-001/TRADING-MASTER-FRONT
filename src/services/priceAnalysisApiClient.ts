import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// 价格分析API基础配置
const PRICE_ANALYSIS_API_BASE_URL = import.meta.env.VITE_PRICE_ANALYSIS_API_URL || 'http://localhost:8000';

// 创建独立的axios实例（价格分析服务，端口8000）
const priceAnalysisApiClient: AxiosInstance = axios.create({
  baseURL: PRICE_ANALYSIS_API_BASE_URL,
  timeout: 10000, // 10秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
priceAnalysisApiClient.interceptors.request.use(
  (config) => {
    console.log(`🔗 Price Analysis API请求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: AxiosError) => {
    console.error('❌ Price Analysis请求配置错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
priceAnalysisApiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ Price Analysis API响应: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);

    // Price Analysis API直接返回数据，无需解包
    return response.data;
  },
  (error: AxiosError) => {
    console.error(`❌ Price Analysis API错误: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error);

    let errorMessage = '价格分析服务请求失败';

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
      errorMessage = '价格分析服务连接超时，请检查服务是否启动（端口8000）';
    } else {
      errorMessage = error.message || '请求配置错误';
    }

    const customError = new Error(errorMessage);
    customError.name = 'PriceAnalysisAPIError';
    return Promise.reject(customError);
  }
);

export default priceAnalysisApiClient;

// 便捷方法
export const priceAnalysisGet = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return priceAnalysisApiClient.get(url, config);
};

export const priceAnalysisPost = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return priceAnalysisApiClient.post(url, data, config);
};

export const priceAnalysisPut = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return priceAnalysisApiClient.put(url, data, config);
};

export const priceAnalysisDelete = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return priceAnalysisApiClient.delete(url, config);
};

// 导出配置常量
export { PRICE_ANALYSIS_API_BASE_URL };
