import { constants } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';

export const UNSUPPORTED_SECURE_FILE_ACCESS = 'UNSUPPORTED_SECURE_FILE_ACCESS';
export class SecureFileAccessRejected extends Error { constructor() { super(UNSUPPORTED_SECURE_FILE_ACCESS); } }
export function assertSecureFileAccessSupported(): void { if (constants.O_NOFOLLOW === undefined) throw new SecureFileAccessRejected(); }
export async function openSecureRead(path: string): Promise<FileHandle> { assertSecureFileAccessSupported(); return open(path, constants.O_RDONLY | constants.O_NOFOLLOW); }
