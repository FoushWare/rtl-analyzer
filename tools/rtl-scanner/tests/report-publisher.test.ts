import { describe, expect, it } from 'vitest';
import { lstat, mkdir, readFile, symlink, writeFile, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { publishReports, publishArtifacts, PublicationError, type PublisherFs } from '../src/report-publisher.js';
import * as fs from 'node:fs/promises';

async function dirs() {
  const tempRoot = await realpath(tmpdir());
  const root = await (await import('node:fs/promises')).mkdtemp(join(tempRoot, 'rtl-publisher-root-'));
  const out = await (await import('node:fs/promises')).mkdtemp(join(tempRoot, 'rtl-publisher-out-'));
  return { root, out };
}

describe('report publication', () => {
  function injected(overrides:Partial<PublisherFs>={}):PublisherFs { return { lstat:fs.lstat, open:fs.open, link:fs.link, unlink:fs.unlink, platform:'darwin', ...overrides }; }
  it('publishes deterministic JSON and Markdown bytes', async () => {
    const { root, out } = await dirs();
    try {
      await publishReports(root, out, '{"complete":false}\n', '# report\n');
      expect(await readFile(join(out, 'rtl-report.json'), 'utf8')).toBe('{"complete":false}\n');
      expect(await readFile(join(out, 'rtl-report.md'), 'utf8')).toBe('# report\n');
    } finally { await rm(root, { recursive: true, force: true }); await rm(out, { recursive: true, force: true }); }
  });

  it('rejects JSON and Markdown collisions and preserves pre-existing files', async () => {
    const { root, out } = await dirs();
    const existing = join(out, 'rtl-report.json');
    try {
      await writeFile(existing, 'original\n');
      await expect(publishReports(root, out, 'new\n', 'md\n')).rejects.toBeInstanceOf(PublicationError);
      expect(await readFile(existing, 'utf8')).toBe('original\n');
      expect(await lstat(join(out, 'rtl-report.md')).catch(() => undefined)).toBeUndefined();
      await rm(existing);
      await writeFile(join(out, 'rtl-report.md'), 'original markdown\n');
      await expect(publishReports(root, out, 'new\n', 'new markdown\n')).rejects.toBeInstanceOf(PublicationError);
      expect(await readFile(join(out, 'rtl-report.md'), 'utf8')).toBe('original markdown\n');
      expect(await lstat(join(out, 'rtl-report.json')).catch(() => undefined)).toBeUndefined();
    } finally { await rm(root, { recursive: true, force: true }); await rm(out, { recursive: true, force: true }); }
  });

  it('rejects symlinked output directories and source-tree directories', async () => {
    const { root, out } = await dirs();
    const linked = join(root, 'linked');
    try {
      await symlink(out, linked);
      await expect(publishReports(root, linked, 'j\n', 'm\n')).rejects.toThrow(/external|non-symlink/);
      await mkdir(join(root, 'nested'));
      await expect(publishReports(root, join(root, 'nested'), 'j\n', 'm\n')).rejects.toThrow(/external/);
      const ancestor = await (await import('node:fs/promises')).mkdtemp(join(await realpath(tmpdir()), 'rtl-publisher-parent-'));
      const nested = join(ancestor, 'nested');
      await symlink(out, nested);
      await expect(publishReports(root, nested, 'j\n', 'm\n')).rejects.toThrow(/symlink/);
      await rm(ancestor, { recursive: true, force: true });
    } finally { await rm(root, { recursive: true, force: true }); await rm(out, { recursive: true, force: true }); }
  });

  it('tracks both destinations when Markdown temp cleanup fails after linking', async () => {
    const { root, out } = await dirs(); let failed=false;
    const ops=injected({unlink:async path=>{if(path.includes('.rtl-report.md.')&&!failed){failed=true;throw new Error('injected cleanup failure');}return fs.unlink(path);}});
    try { await expect(publishReports(root,out,'json\n','md\n',ops)).rejects.toThrow(/published rtl-report.md|publication failed/); expect(await lstat(join(out,'rtl-report.json')).catch(()=>undefined)).toBeUndefined(); expect(await lstat(join(out,'rtl-report.md')).catch(()=>undefined)).toBeUndefined(); }
    finally { await rm(root,{recursive:true,force:true}); await rm(out,{recursive:true,force:true}); }
  });

  it('preserves an identity-uncertain artifact and reports incomplete rollback', async () => {
    const { root, out } = await dirs(); let published=false;
    const ops=injected({link:async(a,b)=>{await fs.link(a,b);if(b.endsWith('rtl-report.md'))published=true;},unlink:async path=>{if(path.includes('.rtl-report.md.'))throw new Error('injected cleanup failure');return fs.unlink(path);},lstat:async path=>{const s=await fs.lstat(path);return published&&path.endsWith('rtl-report.md')?{...s,ino:s.ino+1}:s;}});
    try { const error=await publishReports(root,out,'json\n','md\n',ops).catch(e=>e as PublicationError); expect(error).toMatchObject({rollbackIncomplete:true}); expect(String(error)).toContain('ROLLBACK_INCOMPLETE'); expect(await readFile(join(out,'rtl-report.md'),'utf8')).toBe('md\n'); }
    finally { await rm(root,{recursive:true,force:true}); await rm(out,{recursive:true,force:true}); }
  });

  it('fails closed for unsupported platforms without touching existing destinations', async () => {
    const { root, out } = await dirs(); const existing=join(out,'rtl-report.json');
    try { await writeFile(existing,'old\n'); await expect(publishReports(root,out,'new\n','md\n',injected({platform:'win32'}))).rejects.toThrow(/unsupported platform/); expect(await readFile(existing,'utf8')).toBe('old\n'); expect(await lstat(join(out,'rtl-report.md')).catch(()=>undefined)).toBeUndefined(); }
    finally { await rm(root,{recursive:true,force:true}); await rm(out,{recursive:true,force:true}); }
  });

  it('fails closed on unsupported hard links before publication and cleans the temp file', async () => {
    const { root, out } = await dirs(); const temps:string[]=[];
    const ops=injected({open:async(path,flags,mode)=>{temps.push(path);return fs.open(path,flags,mode);},link:async()=>{const e=Object.assign(new Error('not supported'),{code:'ENOTSUP'});throw e;}});
    try { await expect(publishReports(root,out,'json\n','md\n',ops)).rejects.toThrow(/unsupported hard-link/); expect(await lstat(join(out,'rtl-report.json')).catch(()=>undefined)).toBeUndefined(); expect(await lstat(join(out,'rtl-report.md')).catch(()=>undefined)).toBeUndefined(); for(const temp of temps) expect(await lstat(temp).catch(()=>undefined)).toBeUndefined(); }
    finally { await rm(root,{recursive:true,force:true}); await rm(out,{recursive:true,force:true}); }
  });

  it('rolls back JSON when Markdown hard-link capability fails', async () => {
    const { root, out } = await dirs(); const temps:string[]=[];
    const ops=injected({open:async(path,flags,mode)=>{temps.push(path);return fs.open(path,flags,mode);},link:async(a,b)=>{if(b.endsWith('rtl-report.md')){const e=Object.assign(new Error('filesystem does not support links'),{code:'EOPNOTSUPP'});throw e;}return fs.link(a,b);}});
    try { await expect(publishReports(root,out,'json\n','md\n',ops)).rejects.toThrow(/unsupported hard-link/); expect(await lstat(join(out,'rtl-report.json')).catch(()=>undefined)).toBeUndefined(); expect(await lstat(join(out,'rtl-report.md')).catch(()=>undefined)).toBeUndefined(); for(const temp of temps) expect(await lstat(temp).catch(()=>undefined)).toBeUndefined(); }
    finally { await rm(root,{recursive:true,force:true}); await rm(out,{recursive:true,force:true}); }
  });

  it('publishes three artifacts in order and rolls them back on the third collision', async () => {
    const { root, out } = await dirs();
    try { await writeFile(join(out,'rtl-report-structured.md'),'existing\n'); await expect(publishArtifacts(root,out,[{name:'rtl-report.json',contents:'j\n'},{name:'rtl-report.md',contents:'m\n'},{name:'rtl-report-structured.md',contents:'s\n'}])).rejects.toBeInstanceOf(PublicationError); expect(await lstat(join(out,'rtl-report.json')).catch(()=>undefined)).toBeUndefined(); expect(await lstat(join(out,'rtl-report.md')).catch(()=>undefined)).toBeUndefined(); expect(await readFile(join(out,'rtl-report-structured.md'),'utf8')).toBe('existing\n'); }
    finally { await rm(root,{recursive:true,force:true}); await rm(out,{recursive:true,force:true}); }
  });

  it('publishes three artifacts successfully', async () => {
    const { root, out } = await dirs();
    try {
      await publishArtifacts(root, out, [
        { name: 'rtl-report.json', contents: 'j\n' },
        { name: 'rtl-report.md', contents: 'm\n' },
        { name: 'rtl-report-structured.md', contents: 's\n' },
      ]);
      expect(await readFile(join(out, 'rtl-report.json'), 'utf8')).toBe('j\n');
      expect(await readFile(join(out, 'rtl-report.md'), 'utf8')).toBe('m\n');
      expect(await readFile(join(out, 'rtl-report-structured.md'), 'utf8')).toBe('s\n');
    } finally { await rm(root, { recursive: true, force: true }); await rm(out, { recursive: true, force: true }); }
  });

  it('publishes four dashboard artifacts and rolls them back on HTML collision', async () => {
    const { root, out } = await dirs();
    try {
      await writeFile(join(out, 'rtl-report-dashboard.html'), 'existing\n');
      await expect(publishArtifacts(root, out, [
        { name: 'rtl-report.json', contents: 'j\n' }, { name: 'rtl-report.md', contents: 'm\n' },
        { name: 'rtl-report-structured.md', contents: 's\n' }, { name: 'rtl-report-dashboard.html', contents: 'h\n' },
      ])).rejects.toBeInstanceOf(PublicationError);
      for (const name of ['rtl-report.json', 'rtl-report.md', 'rtl-report-structured.md']) expect(await lstat(join(out, name)).catch(() => undefined)).toBeUndefined();
      expect(await readFile(join(out, 'rtl-report-dashboard.html'), 'utf8')).toBe('existing\n');
    } finally { await rm(root, { recursive: true, force: true }); await rm(out, { recursive: true, force: true }); }
  });

  it('rolls back earlier artifacts after a third-artifact hard-link failure', async () => {
    const { root, out } = await dirs();
    const ops = injected({ link: async (from, to) => {
      if (to.endsWith('rtl-report-structured.md')) { const e = Object.assign(new Error('link failure'), { code: 'EOPNOTSUPP' }); throw e; }
      return fs.link(from, to);
    }});
    try {
      await expect(publishArtifacts(root, out, [
        { name: 'rtl-report.json', contents: 'j\n' }, { name: 'rtl-report.md', contents: 'm\n' }, { name: 'rtl-report-structured.md', contents: 's\n' },
      ], ops)).rejects.toThrow(/unsupported hard-link/);
      for (const name of ['rtl-report.json', 'rtl-report.md', 'rtl-report-structured.md']) expect(await lstat(join(out, name)).catch(() => undefined)).toBeUndefined();
    } finally { await rm(root, { recursive: true, force: true }); await rm(out, { recursive: true, force: true }); }
  });

  it('rolls back after third-artifact temporary cleanup failure', async () => {
    const { root, out } = await dirs();
    const ops = injected({ unlink: async path => {
      if (path.includes('.rtl-report-structured.md.')) throw new Error('cleanup failure');
      return fs.unlink(path);
    }});
    try {
      await expect(publishArtifacts(root, out, [
        { name: 'rtl-report.json', contents: 'j\n' }, { name: 'rtl-report.md', contents: 'm\n' }, { name: 'rtl-report-structured.md', contents: 's\n' },
      ], ops)).rejects.toThrow(/published rtl-report-structured.md|publication failed/);
      for (const name of ['rtl-report.json', 'rtl-report.md', 'rtl-report-structured.md']) expect(await lstat(join(out, name)).catch(() => undefined)).toBeUndefined();
    } finally { await rm(root, { recursive: true, force: true }); await rm(out, { recursive: true, force: true }); }
  });
});
