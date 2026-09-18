import astockApiClient, { astockGet } from './astockApiClient';

// ===== 自选收藏 =====
// 几个后端已确认的行为，前端依赖它们简化逻辑：
// 1. POST 是幂等的——重复收藏同一只票不报错，而是更新备注后返回原记录
//    （实测连发两次都返回 id:3）。所以重复点击 / 网络重试都安全，无需去重。
// 2. DELETE 不存在的返回 404，可据此区分「本来就没收藏」和「删成功」。
// 3. name 不传会自动从 stock_basic 补全（实测 000565 自动填「渝三峡Ａ」），
//    存的是收藏时的名称快照，因为股票会改名。

export interface Favorite {
  id: number;
  code: string;
  name: string | null;    // 收藏时的名称快照
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ⚠️ 服务器与客户端之间有台网络设备（云厂商的流量检测）带着一条误伤规则，
// 命中时直接返回 503，请求到不了应用（响应无 server: uvicorn，带 Proxy-Connection: close）。
// 它**不是简单的长度阈值**，不同方法命中的长度不同，实测：
//           路径(长度)              OPTIONS   GET
//   /api/favorite       (13)          503      200
//   /api/favorite?_=1   (17)          200      503   ← 同一后缀，两种方法结果相反
//   /api/favorite?_=12  (18)          200      200   ← 两者都安全
// 命中的是「请求行长度」而非路径长度，方法名长短（OPTIONS 7 / GET 3）会让
// 同一后缀落到不同长度上，所以才出现上面这种相反的结果。
// `_=12` 是实测对 OPTIONS / GET / POST 都安全的取值。
// DELETE/PATCH 带股票代码，本身不命中，无需补。
// 等该设备规则修正后，PAD 和这段注释都可以删掉。
const PAD = { _: 12 };

class FavoriteAPIService {
  // 收藏列表，按时间倒序。裸路径本身不命中规则，不要加 PAD
  async getList(limit?: number): Promise<Favorite[]> {
    return astockGet<Favorite[]>('/api/favorite', {
      params: limit ? { limit } : undefined,
    });
  }

  // 只取代码数组，专门给打星标用：拉一次做 O(1) 查表，
  // 不用为列表每行单独查收藏状态
  async getCodes(): Promise<string[]> {
    return astockGet<string[]>('/api/favorite/codes');
  }

  // 新增收藏（幂等）。name 不传由后端自动补全
  // 路径补 PAD：POST 会触发 CORS 预检，而 OPTIONS /api/favorite 会被误伤规则拦掉
  async add(code: string, note?: string): Promise<Favorite> {
    const res = await astockApiClient.post('/api/favorite', { code, note: note ?? null }, { params: PAD });
    return res as unknown as Favorite;
  }

  // 取消收藏。不存在时后端返回 404
  async remove(code: string): Promise<void> {
    await astockApiClient.delete(`/api/favorite/${code}`);
  }

  // 改备注
  async updateNote(code: string, note: string): Promise<Favorite> {
    const res = await astockApiClient.patch(`/api/favorite/${code}`, { note });
    return res as unknown as Favorite;
  }
}

export const favoriteAPI = new FavoriteAPIService();
export default FavoriteAPIService;
