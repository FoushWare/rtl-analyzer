import type { SchemaV2PresentationReport } from './presentation-adapter.js';

const sort = (a: string, b: string) => a.localeCompare(b);
// Escape backslashes before pipes as well as the pipe itself. Otherwise an
// input such as `\\|` can leave a pipe that CommonMark treats as a column.
const esc = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, '�').replace(/\\/g, '\\\\').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/`/g, '\\`').replace(/\r?\n/g, ' ');
const block = (s: string) => { const runs = [...s.matchAll(/`+/g)].map(x => x[0].length); const fence = '`'.repeat(Math.max(3, (runs.length ? Math.max(...runs) : 2) + 1)); return fence + '\n' + s.replace(/[\u0000-\u001f\u007f]/g, '�') + '\n' + fence; };
const tally = (xs: string[]) => { const m = new Map<string, number>(); xs.forEach(x => m.set(x, (m.get(x) || 0) + 1)); return [...m].sort((a, b) => sort(a[0], b[0])); };

export function structuredMarkdown(r: SchemaV2PresentationReport): string {
  const groups = [
    ['Actionable findings', r.findings.filter(f => ['AUTO_CANDIDATE', 'MANUAL_REVIEW', 'RUNTIME_CONFIG'].includes(f.category))],
    ['Informational findings', r.findings.filter(f => f.category === 'INFORMATIONAL')],
    ['Intentional-LTR findings', r.findings.filter(f => f.category === 'INTENTIONAL_LTR')],
  ] as const;
  const table = (title: string, rows: [string, number][]) => `## ${title}\n\n| Name | Count |\n| --- | ---: |\n${rows.map(x => `| ${esc(x[0])} | ${x[1]} |`).join('\n')}\n\n`;
  let out = `# Structured RTL risk report\n\nStatic analysis and documented exceptions; not proof of visual failure.\n\n## Executive summary\n\n- Scan status: **${r.complete ? 'Complete' : 'Incomplete'}**\n- Schema: ${r.schemaVersion}\n- Files analyzed: ${r.files.length}\n- Skipped paths: ${r.skipped.length}\n- Findings: ${r.findings.length}\n- Diagnostics: ${r.diagnostics.length}\n- Blocking diagnostics: ${r.diagnostics.filter(d => d.blocking).length}\n\n${r.complete ? '' : '> This report is incomplete; absence of a finding is not evidence of safety.\n\n'}`;
  out += `## Report metadata\n\n- Kind: ${esc(r.kind)}\n- Schema version: ${r.schemaVersion}\n- Input digest: ${esc(r.inputDigest)}\n- Policy digest: ${esc(r.policyDigest)}\n- Unique affected files: ${r.metrics.uniqueAffectedFiles}\n- Confidence metrics: ${Object.entries(r.metrics.byConfidence).sort(([a], [b]) => sort(a, b)).map(([k, v]) => `${esc(k)}=${v}`).join(', ') || 'none'}\n- Reference case IDs: ${r.metrics.referenceCaseIds.slice().sort(sort).map(esc).join(', ') || 'none'}\n\n`;
  out += table('Findings overview', [['Actionable', groups[0][1].length], ['Informational', groups[1][1].length], ['Intentional LTR', groups[2][1].length]]);
  out += table('Category breakdown', ['AUTO_CANDIDATE', 'MANUAL_REVIEW', 'RUNTIME_CONFIG', 'INFORMATIONAL', 'INTENTIONAL_LTR'].map(category => [category, r.findings.filter(f => f.category === category).length]));
  out += table('Severity breakdown', tally(r.findings.map(f => f.severity)));
  out += table('Rule breakdown', tally(r.findings.map(f => f.ruleId)));
  out += table('Ownership', tally(r.findings.map(f => f.ownership)));
  out += table('Application reachability', tally(r.findings.flatMap(f => f.applications.length ? f.applications : ['Shared or unresolved reachability'])));
  out += '> Application attribution counts may overlap; they are not a unique finding total.\n\n';
  for (const [title, list] of groups) {
    out += `## ${title}\n\n`;
    for (const f of list.slice().sort((a, b) => sort(a.path, b.path) || a.range.start.offset - b.range.start.offset || sort(a.id, b.id))) {
      const ref = r.evidenceReferences.find(x => x.findingId === f.id);
      const locations = f.relatedLocations.slice().sort((a, b) => sort(a.path, b.path) || a.range.start.offset - b.range.start.offset).map(x => `${esc(x.path)}:${x.range.start.line}:${x.range.start.column}`).join(', ') || 'none';
      const exception = f.exceptionReason ? `\nException metadata: ${esc(f.exceptionReason)}; original category: ${esc(f.originalCategory ?? 'unknown')}.\n` : '';
      const suggestion = f.suggestion ? `\nConditional suggestion (review required; not an automatic fix):\n\n- Property: ${esc(f.suggestion.property)}\n- Value:\n\n${block(f.suggestion.value)}\n` : '';
      out += `### ${esc(f.id)}\n\n**${esc(f.title)}** — ${f.category}; ${f.severity}; ${f.confidence} confidence.\n\n- Source: ${esc(f.path)}:${f.range.start.line}:${f.range.start.column}\n- Owner: ${esc(f.ownership)}\n- Applications: ${f.applications.length ? f.applications.slice().sort(sort).map(esc).join(', ') : 'shared or unresolved reachability'}\n- Evidence IDs: ${ref?.evidenceIds.map(esc).join(', ') || 'none'}${ref?.missingEvidenceIds.length ? ` (missing: ${ref.missingEvidenceIds.map(esc).join(', ')})` : ''}${ref?.duplicateEvidenceIds.length ? ` (duplicate: ${ref.duplicateEvidenceIds.map(esc).join(', ')})` : ''}\n- Related locations: ${locations}\n\nOriginal declaration:\n\n${block(f.original)}\n\nRationale: ${esc(f.rationale)}\n\nTreatment: ${esc(f.treatment)}\n\nLimits: ${esc(f.limitation)}\n${exception}${suggestion}\n`;
    }
  }
  const diagnostics = r.diagnostics.slice().sort((a, b) => sort(a.path, b.path) || a.range.start.offset - b.range.start.offset || sort(a.code, b.code)).map(d => `- ${esc(d.path)}:${d.range.start.line}:${d.range.start.column} — ${esc(d.code)}, impact=${esc(d.impact ?? 'none')}, blocking=${d.blocking}: ${esc(d.message)} ${esc(d.rationale ?? '')}`).join('\n') || '_None._';
  const evidence = r.evidence.slice().sort((a, b) => sort(a.id, b.id)).map(e => `### ${esc(e.id)}\n\n- Source: ${esc(e.path)}:${e.range.start.line}:${e.range.start.column}\n- Mechanism: ${esc(e.mechanism)}\n- Property: ${esc(e.property)}\n- Value: ${block(e.value)}\n- Semantics: ${esc(e.semantics)}\n\n${block(e.original)}`).join('\n\n') || '_None._';
  return out + `## Diagnostics and coverage warnings\n\n${diagnostics}\n\n## Evidence index\n\n${evidence}\n`;
}
