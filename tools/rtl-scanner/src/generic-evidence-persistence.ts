import type { GenericCodeEvidence } from './generic-evidence.js';
import { validateGenericCodeEvidence } from './generic-evidence.js';
import { GenericRecordStore } from './generic-persistence.js';
import type { TrustedRoot } from './generic-trusted-root.js';

export class GenericEvidencePersistence {
  private readonly store: GenericRecordStore;
  constructor(root: TrustedRoot, maxBytes = 5_000_000) { this.store = new GenericRecordStore(root, 'evidence', maxBytes); }
  async append(evidence: GenericCodeEvidence): Promise<GenericCodeEvidence> {
    const valid = validateGenericCodeEvidence(evidence);
    await this.store.append({ ...valid, id: valid.evidenceId, kind: 'generic-evidence', formatVersion: 1 });
    return valid;
  }
  async list(): Promise<GenericCodeEvidence[]> {
    return (await this.store.list()).map(record => validateGenericCodeEvidence(record as unknown as GenericCodeEvidence));
  }
}
