import { fact, type Evidence } from './model.js';

const utilities: Record<string, string> = {
  ml: 'margin-left', mr: 'margin-right', pl: 'padding-left', pr: 'padding-right',
  left: 'left', right: 'right', 'text-left': 'text-align', 'text-right': 'text-align',
  'border-l': 'border-left', 'border-r': 'border-right',
};

export function extractTailwind(path: string, text: string, value: string, valueStart: number, context: string): Evidence[] {
  const evidence: Evidence[] = [];
  for (const match of value.matchAll(/\S+/g)) {
    const token = match[0];
    const parts = token.split(':');
    const utility = parts.at(-1)!;
    const key = /^(text-left|text-right)(?:-|$)/.test(utility) ? utility.startsWith('text-left') ? 'text-left' : 'text-right' : utility.match(/^(border-[lr]|(?:ml|mr|pl|pr|left|right))(?:-|$)/)?.[1];
    if (!key || !utilities[key]) continue;
    const start = valueStart + match.index!;
    const value = key === 'text-left' ? 'left' : key === 'text-right' ? 'right' : token;
    evidence.push(fact(path, text, 'css', `${context}/.${token}`, utilities[key], value, start, start + token.length, 'tailwind-utility', [token]));
  }
  return evidence;
}
