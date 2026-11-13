import { constants } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertSecureFileAccessSupported, openSecureRead, UNSUPPORTED_SECURE_FILE_ACCESS } from '../src/secure-file-access.js';

describe('secure file access policy', () => {
  it('fails closed when no-follow flags are unavailable', async () => {
    if (constants.O_NOFOLLOW !== undefined) {
      expect(() => assertSecureFileAccessSupported()).not.toThrow();
      return;
    }
    expect(() => assertSecureFileAccessSupported()).toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    await expect(openSecureRead('does-not-exist')).rejects.toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
  });

  it('never silently substitutes ordinary read flags', () => {
    if (constants.O_NOFOLLOW === undefined) expect(() => assertSecureFileAccessSupported()).toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    else expect(() => assertSecureFileAccessSupported()).not.toThrow();
  });
});
