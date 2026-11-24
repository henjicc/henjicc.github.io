export const PLACEHOLDER = "{content}";

export type PromptTemplate = {
  id: string;
  name: string;
  systemPrompt: string;
  /** 用 {content} 标出文件内容放在哪里，可以出现多次。 */
  userPrompt: string;
};

export type ChatMessage = { role: "system" | "user"; content: string };

export function hasPlaceholder(userPrompt: string): boolean {
  return userPrompt.includes(PLACEHOLDER);
}

/**
 * 把文件内容填进用户提示词。
 * 用替换函数而不是替换字符串：内容里的 `$&`、`$'` 这类序列在替换字符串里有特殊含义，会把原文改掉。
 * 模板里没有 {content} 时把内容接在提示词后面（界面会提前标出来），否则文件内容根本发不出去。
 */
export function fillPrompt(userPrompt: string, content: string): string {
  if (hasPlaceholder(userPrompt)) return userPrompt.replaceAll(PLACEHOLDER, () => content);
  return userPrompt.trim() ? `${userPrompt}\n\n${content}` : content;
}

export function buildMessages(template: Pick<PromptTemplate, "systemPrompt" | "userPrompt">, content: string): ChatMessage[] {
  const user: ChatMessage = { role: "user", content: fillPrompt(template.userPrompt, content) };
  return template.systemPrompt.trim() ? [{ role: "system", content: template.systemPrompt }, user] : [user];
}
