import { lstat, link, open, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export class PublicationError extends Error {
  constructor(message: string, public readonly rollbackIncomplete = false, public readonly published: readonly Created[] = []) {
    super(message);
  }
}

type Created = { path: string; dev: number; ino: number };
export interface PublisherFs { lstat(path:string):Promise<any>; open(path:string, flags:string, mode:number):Promise<FileHandle>; link(from:string,to:string):Promise<void>; unlink(path:string):Promise<void>; platform?:string; }
export interface ReportArtifact { name:string; contents:string; }
const defaultFs:PublisherFs={lstat,open,link,unlink,platform:process.platform};
const unsupportedLinkCodes=new Set(['ENOTSUP','EOPNOTSUPP','ENOSYS','EXDEV']);
function unsupportedLink(error:unknown):boolean { return unsupportedLinkCodes.has((error as NodeJS.ErrnoException)?.code??''); }

async function assertDirectory(path: string, root: string, fs:PublisherFs): Promise<void> {
  // The trusted-owner POSIX profile cannot eliminate a malicious directory
  // replacement between validation and the hard-link call; the immediate
  // lstat and same-directory no-overwrite link minimize that residual TOCTOU.
  if (fs.platform !== 'darwin' && fs.platform !== 'linux') throw new PublicationError('unsupported platform/filesystem profile');
  const absolute = resolve(path);
  const rel = relative(root, absolute);
  if (rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))) throw new PublicationError('output directory must be external to the scanner root');
  for (let current = absolute; ; current = resolve(current, '..')) {
    const stat = await fs.lstat(current).catch(() => { throw new PublicationError('output directory and ancestors must already exist'); });
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new PublicationError('output directory and ancestors must be non-symlink directories');
    if (current === resolve(current, '..')) break;
  }
}

async function prepare(directory: string, name: string, contents: string, fs:PublisherFs): Promise<{ temp: string; stat: { dev: number; ino: number } }> {
  let handle: FileHandle | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    const temp = join(directory, `.${name}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
    try {
      handle = await fs.open(temp, 'wx', 0o600);
      await handle.writeFile(contents, 'utf8');
      await handle.sync();
      const stat = await handle.stat();
      await handle.close();
      return { temp, stat: { dev: stat.dev, ino: stat.ino } };
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await fs.unlink(temp).catch(() => undefined);
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  throw new PublicationError('could not create an unpredictable exclusive temporary file');
}

async function publish(directory: string, name: string, contents: string, fs:PublisherFs): Promise<Created> {
  const prepared = await prepare(directory, name, contents, fs);
  let created: Created | undefined;
  try {
    await assertDirectory(directory, directory + '/__external-root-that-cannot-match', fs);
    const destination = join(directory, name);
    await fs.link(prepared.temp, destination);
    created = { path: destination, ...prepared.stat };
    await fs.unlink(prepared.temp);
    return created;
  } catch (error) {
    await fs.unlink(prepared.temp).catch(() => undefined);
    if (unsupportedLink(error)) throw new PublicationError('unsupported hard-link publication capability', false, created?[created]:[]);
    if (created && error instanceof Error && !(error instanceof PublicationError)) throw new PublicationError(`published ${name} but temporary cleanup failed`, false, [created]);
    if (created && error instanceof PublicationError && error.published.length === 0) throw new PublicationError(error.message, error.rollbackIncomplete, [created]);
    throw error;
  }
}

async function removeIfOwned(file: Created, fs:PublisherFs): Promise<boolean> {
  try {
    const stat = await fs.lstat(file.path);
    if (stat.dev !== file.dev || stat.ino !== file.ino || stat.isSymbolicLink()) return false;
    await fs.unlink(file.path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    return false;
  }
}

export async function publishArtifacts(root: string, outputDirectory: string, artifacts:readonly ReportArtifact[], fs:PublisherFs=defaultFs): Promise<void> {
  const directory = resolve(outputDirectory);
  await assertDirectory(directory, resolve(root), fs);
  const published: Created[] = [];
  try {
    for(const artifact of artifacts) published.push(await publish(directory, artifact.name, artifact.contents, fs));
  } catch (error) {
    const allPublished = [...published, ...(error instanceof PublicationError ? error.published : [])];
    const results = await Promise.all(allPublished.reverse().map(file=>removeIfOwned(file,fs)));
    if (results.some(result => !result)) throw new PublicationError('report publication failed; ROLLBACK_INCOMPLETE', true, allPublished);
    throw error instanceof PublicationError ? error : new PublicationError(`report publication failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
export async function publishReports(root:string, outputDirectory:string, json:string, markdown:string, fs:PublisherFs=defaultFs):Promise<void>{return publishArtifacts(root,outputDirectory,[{name:'rtl-report.json',contents:json},{name:'rtl-report.md',contents:markdown}],fs);}
