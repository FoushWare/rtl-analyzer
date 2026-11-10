import { lstat } from 'node:fs/promises';
import { dirname, isAbsolute, normalize, parse, relative, resolve, sep } from 'node:path';

export type OutputPathErrorCode = 'ABSOLUTE' | 'OUTSIDE_ROOT' | 'INPUT_TREE' | 'UNSAFE_NAME' | 'SYMLINK' | 'EXISTS';

export class OutputPathError extends Error {
  constructor(public readonly code: OutputPathErrorCode, message: string) {
    super(`${code}: ${message}`);
  }
}

export interface OutputPathPlan {
  readonly root: string;
  readonly path: string;
  readonly relativePath: string;
  readonly format: 'json' | 'markdown';
  readonly revalidateBeforeWrite: true;
  readonly overwrite: false;
}

export interface OutputPathOptions { readonly protectedRoots?: readonly string[]; readonly overwrite?: false; }

/**
 * Validate and plan a future report destination. This function is read-only:
 * it does not stat, create, truncate, or write the destination.
 *
 * Milestone 2 must revalidate this plan immediately before writing and use a
 * no-follow/atomic write strategy to protect against symlink races.
 */
export async function planOutputPath(root: string, requestedPath: string, format: 'json' | 'markdown', options: OutputPathOptions = {}): Promise<OutputPathPlan> {
  const windowsPath = /^[A-Za-z]:[\\/]/.test(requestedPath) || requestedPath.startsWith('\\\\') || requestedPath.startsWith('//');
  const requestedAbsolute = isAbsolute(requestedPath);
  if (!requestedPath || windowsPath || requestedPath.includes('\\') || /[\0\r\n]/.test(requestedPath)) {
    throw new OutputPathError('ABSOLUTE', 'output path must be a non-empty repository-relative POSIX path');
  }
  const normalized = normalize(requestedPath);
  const rootPath = resolve(root);
  const destination = resolve(isAbsolute(normalized) ? normalized : resolve(rootPath, normalized));
  const rel = relative(rootPath, destination);
  if (!requestedAbsolute && (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))) throw new OutputPathError('OUTSIDE_ROOT', 'relative output path escapes the scanner root');
  if (rel === '' || (rel !== '' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) throw new OutputPathError('INPUT_TREE', 'output path may not be inside the scanner root');
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    const protectedRoots = [rootPath, ...(options.protectedRoots ?? [])].map(item => resolve(item));
    if (protectedRoots.some(protectedRoot => { const r = relative(protectedRoot, destination); return r === '' || (r !== '' && !r.startsWith(`..${sep}`) && !isAbsolute(r)); })) throw new OutputPathError('INPUT_TREE', 'output path is inside a protected input root');
  }
  if (parse(destination).root !== parse(rootPath).root && !isAbsolute(destination)) {
    throw new OutputPathError('INPUT_TREE', 'output path may not be inside a source or historical-input tree');
  }
  const expected = format === 'json' ? '.json' : '.md';
  if (!destination.endsWith(expected)) throw new OutputPathError('UNSAFE_NAME', `output path must end with ${expected}`);
  for (let current = dirname(destination); ; current = dirname(current)) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new OutputPathError('SYMLINK', 'output directory or ancestor is a symlink'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (current === parse(current).root) break;
  }
  try { if ((await lstat(destination)).isSymbolicLink()) throw new OutputPathError('SYMLINK', 'output destination is a symlink'); if (await lstat(destination)) throw new OutputPathError('EXISTS', 'output destination already exists'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return Object.freeze({ root: rootPath, path: destination, relativePath: rel.split(sep).join('/'), format, revalidateBeforeWrite: true, overwrite: false });
}
