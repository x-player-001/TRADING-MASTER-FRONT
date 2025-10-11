import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// CZSC回测系统API基础配置
const CZSC_API_BASE_URL = import.meta.env.VITE_CZSC_API_URL || 'http://localhost:8000';

// 创建CZSC专用axios实例
const czscApiClient: AxiosInstance = axios.create({
  baseURL: CZSC_API_BASE_URL,
  timeout: 30000, // CZSC回测可能耗时较长，设置30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
czscApiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 CZSC API请求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: AxiosError) => {
    console.error('❌ CZSC请求配置错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
czscApiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ CZSC API响应: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);

    let data = response.data;

    // CZSC系统的标准响应格式: { code, message, data }
    if (data && typeof data === 'object') {
      // 检查是否是错误响应
      if (data.code && data.code !== 200) {
        console.warn('⚠️ CZSC业务逻辑错误:', data.message);
        throw new Error(data.message || 'CZSC API请求失败');
      }

      // 检查是否有error字段（另一种错误格式）
      if (data.error) {
        console.warn('⚠️ CZSC错误:', data.message);
        throw new Error(data.message || 'CZSC API请求失败');
      }

      // 解包data字段 (CZSC后端返回格式: {code: 200, message: "success", data: {...}})
      if (data.data !== undefined) {
        console.log('🔓 解包CZSC响应data字段');
        return data.data;
      }
    }

    return data;
  },
  (error: AxiosError) => {
    console.error(`❌ CZSC API错误: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error);

    let errorMessage = 'CZSC服务请求失败';

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 400:
          errorMessage = data?.message || '请求参数错误';
          break;
        case 404:
          errorMessage = data?.message || '请求的资源不存在';
          break;
        case 500:
          errorMessage = data?.message || 'CZSC服务器内部错误';
          break;
        default:
          errorMessage = data?.message || `HTTP错误: ${status}`;
      }
    } else if (error.request) {
      errorMessage = 'CZSC服务连接超时，请检查网络连接';
    } else {
      errorMessage = error.message || 'CZSC请求配置错误';
    }

    const customError = new Error(errorMessage);
    customError.name = 'CZSCAPIError';
    return Promise.reject(customError);
  }
);

// 导出配置好的axios实例和便捷方法
export default czscApiClient;

// 便捷方法
export const czscApiGet = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return czscApiClient.get(url, config);
};

export const czscApiPost = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return czscApiClient.post(url, data, config);
};

export const czscApiPut = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return czscApiClient.put(url, data, config);
};

export const czscApiDelete = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return czscApiClient.delete(url, config);
};

// 导出配置常量
export { CZSC_API_BASE_URL };
