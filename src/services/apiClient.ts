import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// API基础配置
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://45.249.246.109:3000';

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 在请求发送前做一些处理，比如添加loading状态、token等
    console.log(`🚀 API请求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: AxiosError) => {
    console.error('❌ 请求配置错误:', error);
    return Promise.reject(error);
  }
);

/**
 * 时区转换：保持原始时间戳不变
 * 时间戳是绝对值，不需要时区转换
 * JavaScript的Date对象会自动根据浏览器时区显示正确的本地时间
 */
const convertTimestampToUTC8 = (timestamp: number): number => {
  return timestamp; // 不再进行时区转换
};

/**
 * 递归转换对象中的时间戳字段
 */
const convertTimestampsInObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertTimestampsInObject(item));
  }

  const converted: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      // 转换时间戳字段
      if (
        (key === 'timestamp' ||
         key === 'open_time' ||
         key === 'close_time' ||
         key.endsWith('_time') ||
         key.endsWith('Time')) &&
        typeof value === 'number' &&
        value > 1000000000000 // 毫秒级时间戳
      ) {
        converted[key] = convertTimestampToUTC8(value);
      } else if (typeof value === 'object') {
        converted[key] = convertTimestampsInObject(value);
      } else {
        converted[key] = value;
      }
    }
  }
  return converted;
};

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ API响应: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);

    let data = response.data;

    if (data && typeof data === 'object' && data.success === false) {
      console.warn('⚠️ 业务逻辑错误:', data.message);
      throw new Error(data.message || 'API请求失败');
    }

    // 解包data字段
    data = data?.data !== undefined ? data.data : data;

    // 🔥 统一时区转换：UTC+0 → UTC+8
    data = convertTimestampsInObject(data);

    return data;
  },
  (error: AxiosError) => {
    // 统一处理错误响应
    console.error(`❌ API错误: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error);

    let errorMessage = '网络请求失败';

    if (error.response) {
      // 服务器响应了错误状态码
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 400:
          errorMessage = data?.message || '请求参数错误';
          break;
        case 401:
          errorMessage = '未授权访问';
          break;
        case 403:
          errorMessage = '访问被禁止';
          break;
        case 404:
          errorMessage = '请求的资源不存在';
          break;
        case 500:
          errorMessage = '服务器内部错误';
          break;
        case 502:
          errorMessage = '网关错误';
          break;
        case 503:
          errorMessage = '服务暂时不可用';
          break;
        default:
          errorMessage = data?.message || `HTTP错误: ${status}`;
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      errorMessage = '网络连接超时，请检查网络连接';
    } else {
      // 请求配置出错
      errorMessage = error.message || '请求配置错误';
    }

    const customError = new Error(errorMessage);
    customError.name = 'APIError';
    return Promise.reject(customError);
  }
);

// 导出配置好的axios实例和一些便捷方法
export default apiClient;

// 便捷方法
export const apiGet = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return apiClient.get(url, config);
};

export const apiPost = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return apiClient.post(url, data, config);
};

export const apiPut = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return apiClient.put(url, data, config);
};

export const apiDelete = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return apiClient.delete(url, config);
};

export const apiPatch = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return apiClient.patch(url, data, config);
};

// 导出配置常量
export { API_BASE_URL };