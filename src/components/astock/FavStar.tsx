import React, { useState } from 'react';
import { message, Tooltip } from 'antd';
import styles from '../../pages/WatchPool.module.scss';
import { favoriteAPI } from '../../services/favoriteAPI';

interface FavStarProps {
  code: string;
  /** 已收藏代码集合，由父级拉一次 /api/favorite/codes 得到，O(1) 查表 */
  favCodes: Set<string>;
  /** 收藏状态变化后通知父级更新集合 */
  onChange: (code: string, faved: boolean) => void;
}

/**
 * 列表用星标。K线弹窗里另有一个独立星标，两处互不依赖。
 * POST 幂等、DELETE 不存在返回 404，所以这里可以放心做乐观更新：
 * 先翻转 UI，失败再回滚。
 */
const FavStar: React.FC<FavStarProps> = ({ code, favCodes, onChange }) => {
  const [busy, setBusy] = useState(false);
  const faved = favCodes.has(code);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    onChange(code, !faved); // 乐观更新
    try {
      if (faved) await favoriteAPI.remove(code);
      else await favoriteAPI.add(code);
    } catch (err: any) {
      onChange(code, faved); // 回滚
      message.error(err?.message || (faved ? '取消收藏失败' : '收藏失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tooltip title={faved ? '取消收藏' : '收藏'}>
      <span
        className={`${styles.favStar} ${faved ? styles.favStarOn : ''} ${busy ? styles.favStarBusy : ''}`}
        onClick={toggle}
        role="button"
        aria-label={faved ? '取消收藏' : '收藏'}
      >
        {faved ? '★' : '☆'}
      </span>
    </Tooltip>
  );
};

export default FavStar;
