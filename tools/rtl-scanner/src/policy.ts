import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { range, type Mechanism } from './model.js';
import { PolicyError, policyPath, validatePolicy } from './policy-validation.js';
export interface Binding { ruleId:string; path:string; contextIncludes:string; originalIncludes?:string; issueId:string }
export interface Approval { path:string; context:string; property:string; value:string; owner:string; logicalProperty:string; reason:string; reviewedBy:string; sourceDigest:string }
export interface Exception { ruleId:string; path:string; context:string; category:'INTENTIONAL_LTR'|'INFORMATIONAL'; reason:string; reviewedBy:string; originalDigest:string }
export interface Policy { schemaVersion:1; generatedStyleOwner:string; ownership:Partial<Record<Mechanism,string>>; ownerOverrides?:{path:string;context:string;owner:string;reason:string}[]; approvals:Approval[]; exceptions:Exception[]; issueBindings:Binding[]; dynamicExceptions:{path:string; property:string; valueDigest:string; sourceDigest:string; reason:string}[]; roles:{kind:'brand';path:string;className:string}[] }
export const emptyPolicy:Policy={schemaVersion:1,generatedStyleOwner:'unknown',ownership:{},approvals:[],exceptions:[],issueBindings:[],dynamicExceptions:[],roles:[]};
const sourceTexts = new WeakMap<Policy,string>();
export const policySourceText = (policy:Policy) => sourceTexts.get(policy) ?? JSON.stringify(policy,null,2);
export async function loadPolicy(root:string):Promise<Policy>{
 let text:string;try{if((await lstat(join(root,policyPath))).isSymbolicLink())throw new PolicyError({path:policyPath,range:range('',0,0),code:'POLICY_INVALID_PATH',message:'BLOCKING /: symlink policy file not permitted',impact:'SOURCE_FAILURE',blocking:true,rationale:'Policy input must remain inside the read-only repository scope.'});text=await readFile(join(root,policyPath),'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return emptyPolicy;throw e;}
 if(text.length>1_000_000)throw new PolicyError({path:policyPath,range:range(text,0,0),code:'POLICY_INVALID',message:'BLOCKING /: policy exceeds size limit',impact:'SOURCE_FAILURE',blocking:true,rationale:'Policy input size is bounded.'});
 let input:unknown;
 try { input=JSON.parse(text); } catch { throw new PolicyError({path:policyPath,range:range(text,0,0),code:'POLICY_INVALID_JSON',message:'BLOCKING /: invalid JSON',impact:'SOURCE_FAILURE',blocking:true,rationale:'Policy JSON cannot be interpreted; no policy decisions are applied.'}); }
 const policy=validatePolicy(input,text);sourceTexts.set(policy,text);return policy;
}
