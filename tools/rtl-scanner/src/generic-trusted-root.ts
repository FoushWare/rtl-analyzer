import { lstat, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export class TrustedRootRejected extends Error {
  constructor(readonly code: string) { super(code); }
}

const contained = (root: string, target: string): boolean => {
  const value = relative(root, target);
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value));
};

async function assertDirectory(path: string, code: string): Promise<string> {
  const original = await lstat(path).catch(() => { throw new TrustedRootRejected(code); });
  if (original.isSymbolicLink()) throw new TrustedRootRejected('SYMLINK_ROOT_REJECTED');
  let canonical: string;
  try { canonical = await realpath(path); } catch { throw new TrustedRootRejected(code); }
  const info = await lstat(canonical);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new TrustedRootRejected(code);
  return canonical;
}

async function rejectSymlinkChain(root: string, target: string, allowMissingTail = false): Promise<void> {
  const canonicalRoot = resolve(root);
  const canonicalTarget = resolve(target);
  if (!contained(canonicalRoot, canonicalTarget)) throw new TrustedRootRejected('PATH_OUTSIDE_TRUSTED_ROOT');
  const parts = relative(canonicalRoot, canonicalTarget).split(sep).filter(Boolean);
  let cursor = canonicalRoot;
  for (let index = 0; index < parts.length; index += 1) {
    cursor = resolve(cursor, parts[index]!);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new TrustedRootRejected('SYMLINK_PATH_REJECTED');
      if (index < parts.length - 1 && !info.isDirectory()) throw new TrustedRootRejected('NON_DIRECTORY_ANCESTOR');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && allowMissingTail) return;
      throw error;
    }
  }
}

export interface FileIdentity {
  readonly size: number;
  readonly mtimeMs: number;
  readonly dev?: number;
  readonly ino?: number;
  readonly nlink?: number;
}

export class TrustedRoot {
  readonly projectRoot: string;
  readonly storageRoot: string;

  private constructor(projectRoot: string, storageRoot: string) {
    this.projectRoot = projectRoot;
    this.storageRoot = storageRoot;
  }

  static async create(projectRoot: string, storageRoot: string): Promise<TrustedRoot> {
    if (!isAbsolute(projectRoot) || !isAbsolute(storageRoot)) throw new TrustedRootRejected('ROOTS_MUST_BE_ABSOLUTE');
    const project = await assertDirectory(projectRoot, 'PROJECT_ROOT_UNAVAILABLE');
    const storage = await assertDirectory(storageRoot, 'STORAGE_ROOT_UNAVAILABLE');
    if (project === storage || contained(project, storage) || contained(storage, project)) throw new TrustedRootRejected('ROOTS_MUST_BE_SEPARATE');
    return new TrustedRoot(project, storage);
  }

  relativeProjectPath(path: string): string {
    return this.relativeContained(this.projectRoot, path, 'PROJECT_PATH_REJECTED');
  }

  relativeStoragePath(path: string): string {
    return this.relativeContained(this.storageRoot, path, 'STORAGE_PATH_REJECTED');
  }

  async validateProjectPath(path: string, options: { file?: boolean; allowMissing?: boolean } = {}): Promise<string> {
    const target = resolve(this.projectRoot, this.relativeProjectPath(path));
    await rejectSymlinkChain(this.projectRoot, target, options.allowMissing ?? false);
    if (options.file) {
      let info;
      try { info = await lstat(target); } catch { throw new TrustedRootRejected('PROJECT_FILE_UNAVAILABLE'); }
      if (!info.isFile() || info.isSymbolicLink()) throw new TrustedRootRejected('PROJECT_FILE_NOT_REGULAR');
    }
    return target;
  }

  async validateStoragePath(path: string, options: { allowMissingLeaf?: boolean } = {}): Promise<string> {
    const target = resolve(this.storageRoot, this.relativeStoragePath(path));
    await rejectSymlinkChain(this.storageRoot, target, options.allowMissingLeaf ?? false);
    return target;
  }

  async identity(path: string): Promise<FileIdentity> {
    const target = await this.validateProjectPath(path, { file: true });
    const info = await stat(target);
    return { size: info.size, mtimeMs: info.mtimeMs, dev: typeof info.dev === 'number' ? info.dev : undefined, ino: typeof info.ino === 'number' ? info.ino : undefined, nlink: typeof info.nlink === 'number' ? info.nlink : undefined };
  }

  private relativeContained(root: string, input: string, code: string): string {
    if (!input || isAbsolute(input) || input.includes('\0')) throw new TrustedRootRejected(code);
    const target = resolve(root, input);
    if (!contained(root, target)) throw new TrustedRootRejected(code);
    return relative(root, target);
  }
}

export { contained as isWithinTrustedRoot };
