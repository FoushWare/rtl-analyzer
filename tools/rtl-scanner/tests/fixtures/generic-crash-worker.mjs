import { readFile } from 'node:fs/promises';
import { GenericApplyService, GENERIC_APPLY_CONFIRMATION } from '../../../../dist/tools/rtl-scanner/generic-apply.js';
import { GenericRollbackService, GENERIC_ROLLBACK_CONFIRMATION } from '../../../../dist/tools/rtl-scanner/generic-rollback.js';
import { GenericRecoveryService } from '../../../../dist/tools/rtl-scanner/generic-recovery.js';
import { TrustedRoot } from '../../../../dist/tools/rtl-scanner/generic-trusted-root.js';
import { acquireGenericLock } from '../../../../dist/tools/rtl-scanner/generic-lock.js';
import { GenericMultiFileApplyService, GENERIC_MULTI_APPLY_CONFIRMATION, GenericMultiFileRollbackService, GENERIC_MULTI_ROLLBACK_CONFIRMATION } from '../../../../dist/tools/rtl-scanner/generic-multi-file-transaction.js';
import { GenericMultiFileRecoveryService } from '../../../../dist/tools/rtl-scanner/generic-multi-file-recovery.js';

const payload = JSON.parse(await readFile(process.argv[2], 'utf8'));
const root = await TrustedRoot.create(payload.projectRoot, payload.storageRoot);
const project = { canonicalRoot: root.projectRoot, repositoryIdentity: payload.repositoryIdentity };
const hold = (boundary, path) => { if (payload.crashOnPath && payload.crashOnPath !== path) return; if (process.send) process.send({ type: 'boundary', boundary, path }); setInterval(() => {}, 1000); };

if (payload.mode === 'apply') {
  const service = new GenericApplyService(root, project, { failAt: undefined, onBoundary: hold });
  await service.apply(payload.review, payload.approval, payload.proposal, payload.evidence, payload.authorization, { confirmation: GENERIC_APPLY_CONFIRMATION });
} else if (payload.mode === 'rollback') {
  const service = new GenericRollbackService(root, { onBoundary: hold });
  await service.rollback(payload.receipt, GENERIC_ROLLBACK_CONFIRMATION);
} else if (payload.mode === 'multi-apply') {
  const service = new GenericMultiFileApplyService(root, project, { onBoundary: hold });
  await service.apply(payload.review, payload.approval, payload.proposals, payload.evidence, payload.authorization, { confirmation: GENERIC_MULTI_APPLY_CONFIRMATION });
} else if (payload.mode === 'multi-rollback') {
  const service = new GenericMultiFileRollbackService(root, project, { onBoundary: hold });
  await service.rollback(payload.receipt, GENERIC_MULTI_ROLLBACK_CONFIRMATION);
} else if (payload.mode === 'recover') {
  const assessment = await new GenericRecoveryService(root, project).assess(payload.transactionId);
  process.stdout.write(`${JSON.stringify(assessment)}\n`);
} else if (payload.mode === 'multi-recover') {
  const assessment = await new GenericMultiFileRecoveryService(root, project).assess(payload.transactionId);
  process.stdout.write(`${JSON.stringify(assessment)}\n`);
} else if (payload.mode === 'lock') {
  await acquireGenericLock(root, payload.name ?? 'apply-stale');
  hold('lock-acquired');
} else {
  throw new Error('UNKNOWN_WORKER_MODE');
}
