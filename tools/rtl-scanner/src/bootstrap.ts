import { fact, type Evidence } from './model.js';

const utilities: Record<string, string> = {
  'float-left': 'float',
  'float-right': 'float',
  'text-left': 'text-align',
  'text-right': 'text-align',
  'border-left': 'border-left',
  'border-right': 'border-right',
};

export function extractBootstrap(path: string, text: string, value: string, valueStart: number, context: string): Evidence[] {
  const evidence: Evidence[] = [];
  for (const match of value.matchAll(/\S+/g)) {
    const token = match[0];
    const utility = token;
    const key = utility.match(/^(?:float|border)-(?:left|right)(?:-0)?$|^(?:float|text)-(?:sm|md|lg|xl)-(?:left|right)$/)?.[0];
    if (!key) continue;
    const base = key.replace(/^(?:float|text)-(?:sm|md|lg|xl)-/, (key.startsWith('float-') ? 'float-' : 'text-')).replace(/-0$/, '');
    if (!utilities[base]) continue;
    const property = utilities[base];
    const normalized = property === 'text-align' ? base.endsWith('left') ? 'left' : 'right' : token;
    const start = valueStart + match.index!;
    evidence.push(fact(path, text, 'css', `${context}/.${token}`, property, normalized, start, start + token.length, 'bootstrap-utility', [token]));
  }
  return evidence;
}
