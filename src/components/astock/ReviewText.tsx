import React from 'react';

// 复盘正文的实际格式（后端 LLM 输出，两种混用）：
//   1. 以空行分块，块首是标题——「一、强支撑」或「**一、强支撑**」
//   2. 早期只有行内 **加粗**，没有换行
// 统一切成 { heading, body } 的块来渲染；为一种加粗语法引 markdown 库不划算。

const BOLD = /(\*\*[^*]+\*\*)/g;
const isBold = (s: string) => s.startsWith('**') && s.endsWith('**') && s.length > 4;

// 「一、」「二、」…中文序号标题
const CN_HEADING = /^[一二三四五六七八九十]+、\s*(.+)$/;

const renderInline = (text: string, keyPrefix = ''): React.ReactNode[] =>
  text.split(BOLD).map((seg, i) =>
    isBold(seg)
      ? <b key={`${keyPrefix}b${i}`}>{seg.slice(2, -2)}</b>
      : <React.Fragment key={`${keyPrefix}t${i}`}>{seg}</React.Fragment>
  );

interface Block {
  heading: string | null;
  body: string;
}

// 把正文切成带标题的块
const toBlocks = (content: string): Block[] => {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let cur: Block | null = null;

  const headingOf = (raw: string): string | null => {
    const line = raw.trim();
    // 整行就是一个加粗片段 → 当标题，如 **一、强支撑**
    if (isBold(line) && line.indexOf('**', 2) === line.length - 2) {
      const inner = line.slice(2, -2).trim();
      return inner.replace(CN_HEADING, '$1') || inner;
    }
    // 「一、强支撑」这种独立成行的短标题（带正文的长行不算）
    const m = line.match(CN_HEADING);
    if (m && line.length <= 12) return m[1];
    return null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const h = headingOf(raw);
    if (h !== null) {
      cur = { heading: h, body: '' };
      blocks.push(cur);
      continue;
    }
    if (!cur) {
      cur = { heading: null, body: line };
      blocks.push(cur);
    } else {
      cur.body = cur.body ? `${cur.body}\n${line}` : line;
    }
  }

  // 没有任何换行/标题的老格式：回退到「按行内加粗分段」
  if (blocks.length <= 1 && content.includes('**')) {
    const out: Block[] = [];
    let buf = '';
    for (const seg of content.split(BOLD)) {
      if (!seg) continue;
      if (isBold(seg)) {
        if (buf.trim()) out.push({ heading: null, body: buf });
        buf = seg;
      } else {
        buf += seg;
      }
    }
    if (buf.trim()) out.push({ heading: null, body: buf });
    if (out.length > 1) return out;
  }

  return blocks;
};

interface ReviewTextProps {
  content: string;
  className?: string;
  /** 分块渲染：标题独立成行、正文另起一段。不开则渲染成连贯的一段话 */
  paragraphs?: boolean;
  paragraphClassName?: string;
  headingClassName?: string;
}

const ReviewText: React.FC<ReviewTextProps> = ({
  content,
  className,
  paragraphs = false,
  paragraphClassName,
  headingClassName,
}) => {
  if (!paragraphs) {
    return <div className={className}>{renderInline(content)}</div>;
  }

  return (
    <div className={className}>
      {toBlocks(content).map((b, i) => (
        <div key={i} className={paragraphClassName}>
          {b.heading && <div className={headingClassName}>{b.heading}</div>}
          {b.body && <p>{renderInline(b.body, `p${i}`)}</p>}
        </div>
      ))}
    </div>
  );
};

export default ReviewText;
