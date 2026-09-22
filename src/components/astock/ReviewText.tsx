import React from 'react';

// 复盘正文只用到 **加粗** 一种标记（实测无标题/列表/链接），
// 为此引整个 markdown 库不划算，这里手工切一下。
const ReviewText: React.FC<{ content: string; className?: string }> = ({ content, className }) => (
  <div className={className}>
    {content.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
      seg.startsWith('**') && seg.endsWith('**') && seg.length > 4
        ? <b key={i}>{seg.slice(2, -2)}</b>
        : <React.Fragment key={i}>{seg}</React.Fragment>
    )}
  </div>
);

export default ReviewText;
