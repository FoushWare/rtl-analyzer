import { createHash } from "node:crypto";
export type Mechanism = "css" | "emotion-template" | "mui-sx" | "mui-theme" | "react-inline" | "html-root";
export interface Point { offset: number; line: number; column: number }
export interface Range { start: Point; end: Point }
export interface Evidence { id: string; path: string; mechanism: Mechanism; context: string; property: string; value: string; original: string; range: Range; semantics: string; tokens?: string[] }
export interface Diagnostic { impact?: "NONBLOCKING_DYNAMIC" | "DIRECTIONAL_UNSUPPORTED" | "SOURCE_FAILURE"; blocking?: boolean; rationale?: string; path: string; code: string; message: string; range: Range }
export type Category = "AUTO_CANDIDATE" | "MANUAL_REVIEW" | "RUNTIME_CONFIG" | "INTENTIONAL_LTR" | "INFORMATIONAL";
export interface Finding { id:string; ruleId:string; ruleVersion:1; category:Category; severity:"Critical"|"Major"|"Minor"|"Info"; confidence:"High"|"Medium"|"Low"; title:string; sourceMechanism:Mechanism|"typescript-structure"; applications:string[]; path:string; range:Range; original:string; context:string; ownership:string; rationale:string; treatment:string; evidenceIds:string[]; relatedLocations:{path:string;range:Range}[]; issueIds:string[]; suggestion:{property:string;value:string}|null; limitation:string; exceptionReason?:string; originalCategory?:Category }
export interface Report { schemaVersion: 2; kind: "rtl-risk-report"; policyDigest:string; inputDigest: string; files: string[]; skipped: string[]; evidence: Evidence[]; diagnostics: Diagnostic[]; findings: Finding[]; metrics:{byCategory:Record<string,number>;bySeverity:Record<string,number>;byConfidence:Record<string,number>;uniqueAffectedFiles:number;referenceCaseIds:string[]}; complete: boolean }
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function range(text: string, start: number, end: number): Range {
  const point = (offset: number): Point => { const lines = text.slice(0, offset).split(/\r\n|\r|\n/); return { offset, line: lines.length, column: lines.at(-1)!.length + 1 }; };
  return { start: point(start), end: point(end) };
}
export function fact(path: string, text: string, mechanism: Mechanism, context: string, property: string, value: string, start: number, end: number, semantics = "css", tokens?: string[]): Evidence {
  return { id: hash(`${path}|${mechanism}|${context}|${property}|${start}`).slice(0,24), path, mechanism, context, property, value, original: text.slice(start,end), range: range(text,start,end), semantics, ...(tokens ? {tokens} : {}) };
}
