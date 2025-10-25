import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// 链上数据API基础配置
const BLOCKCHAIN_API_BASE_URL = import.meta.env.VITE_BLOCKCHAIN_API_URL || 'http://localhost:8888';

// 创建独立的axios实例（不复用apiClient，因为端口不同）
const blockchainApiClient: AxiosInstance = axios.create({
  baseURL: BLOCKCHAIN_API_BASE_URL,
  timeout: 10000, // 10秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
blockchainApiClient.interceptors.request.use(
  (config) => {
    console.log(`🔗 Blockchain API请求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: AxiosError) => {
    console.error('❌ Blockchain请求配置错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
blockchainApiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ Blockchain API响应: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);

    // Blockchain API直接返回数据，无需解包
    return response.data;
  },
  (error: AxiosError) => {
    console.error(`❌ Blockchain API错误: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error);

    let errorMessage = '链上数据服务请求失败';

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
      errorMessage = '链上数据服务连接超时，请检查服务是否启动（端口8888）';
    } else {
      errorMessage = error.message || '请求配置错误';
    }

    const customError = new Error(errorMessage);
    customError.name = 'BlockchainAPIError';
    return Promise.reject(customError);
  }
);

export default blockchainApiClient;

// 便捷方法
export const blockchainGet = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return blockchainApiClient.get(url, config);
};

export const blockchainPost = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return blockchainApiClient.post(url, data, config);
};

export const blockchainPut = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return blockchainApiClient.put(url, data, config);
};

export const blockchainPatch = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return blockchainApiClient.patch(url, data, config);
};

export const blockchainDelete = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return blockchainApiClient.delete(url, config);
};

// 导出配置常量
export { BLOCKCHAIN_API_BASE_URL };
