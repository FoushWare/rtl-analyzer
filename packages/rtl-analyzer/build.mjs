// Compile one pinned implementation, then overlay the existing consumer router.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const packageDir=dirname(fileURLToPath(import.meta.url)),repo=resolve(packageDir,'../..');
const implementation=join(repo,'implementation');
const expected=JSON.parse(readFileSync(join(packageDir,'package.json'),'utf8')).rtlAnalyzerImplementation.commit;
const git=(args)=>execFileSync('git',args,{cwd:implementation,encoding:'utf8'}).trim();
if(git(['rev-parse','HEAD'])!==expected)throw Error('Implementation commit mismatch; run git submodule update --init');
if(git(['status','--porcelain','--untracked-files=no']))throw Error('Implementation has tracked changes; refusing an unverifiable build');
const staging=mkdtempSync(join(packageDir,'.build-source-'));
try{
 const prefix='tools/rtl-scanner/src/';
 // Read the pinned Git objects, so untracked/ignored files cannot enter the build.
 for(const path of git(['ls-tree','-r','--name-only',expected,'--',prefix]).split('\n')){
  if(!path.endsWith('.ts'))continue;
  const target=join(staging,path.slice(prefix.length));mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,execFileSync('git',['show',`${expected}:${path}`],{cwd:implementation}));
 }
 cpSync(join(repo,'tools/rtl-scanner/src/standalone-cli.ts'),join(staging,'standalone-cli.ts'));
 // dist is generated output, never a source input. Remove stale modules before packing.
 rmSync(join(packageDir,'dist'),{recursive:true,force:true});
 execFileSync(process.execPath,[join(repo,'node_modules/typescript/bin/tsc'),'--project',join(packageDir,'tsconfig.json'),'--rootDir',staging],{cwd:packageDir,stdio:'inherit'});
}finally{rmSync(staging,{recursive:true,force:true})}
