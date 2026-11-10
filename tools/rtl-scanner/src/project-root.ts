import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

export async function resolveTrustedProjectRoot(): Promise<string> {
  const configured = process.env.RTL_PROJECT_ROOT;
  if (!configured || !isAbsolute(configured)) throw new Error('TRUSTED_PROJECT_ROOT_REQUIRED');
  const root = await realpath(resolve(configured));
  const stat = await lstat(root);
  if (!stat.isDirectory()) throw new Error('TRUSTED_PROJECT_ROOT_NOT_DIRECTORY');
  return root;
}
