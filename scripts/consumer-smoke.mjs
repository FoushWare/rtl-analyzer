import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const repo=resolve(import.meta.dirname,'..'),artifacts=mkdtempSync(join(realpathSync(tmpdir()),'rtl-analyzer-release-smoke-'));
if(!process.env.npm_execpath)throw Error('Run npm run rtl:cli:package:smoke');
const [pack]=JSON.parse(execFileSync(process.execPath,[process.env.npm_execpath,'pack','--json','--pack-destination',artifacts],{cwd:join(repo,'packages/rtl-analyzer'),encoding:'utf8'}));
console.log('PACK_ARTIFACT',join(artifacts,pack.filename));
execFileSync(process.execPath,[join(repo,'implementation/tests/e2e/package-consumer-smoke.mjs'),join(artifacts,pack.filename),'--wrapper'],{cwd:repo,stdio:'inherit'});
