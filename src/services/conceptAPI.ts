import { astockGet } from './astockApiClient';

// ===== 概念映射 =====
// 数据由 sync_concepts 维护（遍历 390 个板块反建，一周跑一次）。
// 实测 70,520 条映射 / 5,571 只票 / 390 个概念，平均每票 12.7 个概念。

export interface StockConcept {
  thscode: string;
  concept_name: string;
  member_count: number;   // 成分股数——按升序返回，窄题材在前
  is_broad: boolean;      // 是否宽基/交易属性标签
}

export interface StockConcepts {
  code: string;
  stock_name: string;
  total: number;
  concepts: StockConcept[];
}

class ConceptAPIService {
  /**
   * 个股 → 所属概念。
   * exclude_broad 默认 true，排除「融资融券/沪深股通/沪深300」这类交易属性标签。
   * ⚠️ 宽基判定用的是名单而非数量阈值：机器人概念 1228 只、人工智能 1085 只
   * 都是真题材，成分股多 ≠ 不是题材，所以不要再按 member_count 二次过滤。
   */
  async getStockConcepts(code: string, excludeBroad = true): Promise<StockConcepts> {
    return astockGet<StockConcepts>(`/api/concept/stock/${code}`, {
      params: { exclude_broad: excludeBroad },
    });
  }
}

export const conceptAPI = new ConceptAPIService();
export default ConceptAPIService;
