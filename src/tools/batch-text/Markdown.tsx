import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 只在预览里按需加载。不接 rehype-raw：模型输出里的 HTML 按原文显示，不当成页面元素执行。
const prose = [
  "grid gap-3 text-body text-ink [overflow-wrap:anywhere]",
  "[&_h1]:m-0 [&_h1]:text-title-2 [&_h2]:m-0 [&_h2]:text-title-3 [&_h3]:m-0 [&_h3]:text-body-lg [&_h3]:font-semibold",
  "[&_p]:m-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-6 [&_li+li]:mt-1",
  "[&_a]:text-sky-text [&_a]:underline [&_strong]:font-semibold",
  "[&_blockquote]:m-0 [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-4 [&_blockquote]:text-ink-muted",
  "[&_code]:rounded-xs [&_code]:bg-surface-raised [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_pre]:m-0 [&_pre]:overflow-auto [&_pre]:rounded-sm [&_pre]:bg-surface-raised [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_hr]:w-full [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-line",
].join(" ");

export default function Markdown({ text }: { text: string }) {
  return (
    <div className={prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
