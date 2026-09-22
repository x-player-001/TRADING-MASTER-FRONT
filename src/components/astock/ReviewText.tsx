import React from 'react';

// 复盘正文只用到 **加粗** 一种标记（实测无标题/列表/链接），
// 为此引整个 markdown 库不划算，这里手工切一下。

const BOLD = /(\*\*[^*]+\*\*)/g;

const renderInline = (text: string, keyPrefix = ''): React.ReactNode[] =>
  text.split(BOLD).map((seg, i) =>
    seg.startsWith('**') && seg.endsWith('**') && seg.length > 4
      ? <b key={`${keyPrefix}b${i}`}>{seg.slice(2, -2)}</b>
      : <React.Fragment key={`${keyPrefix}t${i}`}>{seg}</React.Fragment>
  );

interface ReviewTextProps {
  content: string;
  className?: string;
  /**
   * 段落模式：以 **加粗** 作为段首另起一行。
   * 板块复盘是「主线/第二梯队/当日异动」这类分段结构，挤成一坨很难扫；
   * 个股复盘是连贯的一段话，不适用。
   */
  paragraphs?: boolean;
  paragraphClassName?: string;
}

const ReviewText: React.FC<ReviewTextProps> = ({
  content,
  className,
  paragraphs = false,
  paragraphClassName,
}) => {
  if (!paragraphs) {
    return <div className={className}>{renderInline(content)}</div>;
  }

  // 在每个加粗标题前断开；首个加粗之前的内容自成一段（开篇总述）
  const blocks: string[] = [];
  let buf = '';
  for (const seg of content.split(BOLD)) {
    if (!seg) continue;
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
      if (buf.trim()) blocks.push(buf);
      buf = seg;
    } else {
      buf += seg;
    }
  }
  if (buf.trim()) blocks.push(buf);

  return (
    <div className={className}>
      {blocks.map((b, i) => (
        <p key={i} className={paragraphClassName}>{renderInline(b, `p${i}`)}</p>
      ))}
    </div>
  );
};

export default ReviewText;
