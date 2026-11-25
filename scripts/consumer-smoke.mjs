import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const repo=resolve(import.meta.dirname,'..'),artifacts=mkdtempSync(join(realpathSync(tmpdir()),'rtl-analyzer-release-smoke-'));
// The packed tarball and its directory are temporary artifacts of this run. They are removed whether packing or the smoke failed.
try{
  if(!process.env.npm_execpath)throw Error('Run npm run rtl:cli:package:smoke');
  const [pack]=JSON.parse(execFileSync(process.execPath,[process.env.npm_execpath,'pack','--json','--pack-destination',artifacts],{cwd:join(repo,'packages/rtl-analyzer'),encoding:'utf8'}));
  console.log('PACK_ARTIFACT',join(artifacts,pack.filename));
  execFileSync(process.execPath,[join(repo,'implementation/tests/e2e/package-consumer-smoke.mjs'),join(artifacts,pack.filename),'--wrapper'],{cwd:repo,stdio:'inherit'});
}finally{rmSync(artifacts,{recursive:true,force:true})}
